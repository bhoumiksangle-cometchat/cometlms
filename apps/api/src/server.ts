import dotenv from 'dotenv';
dotenv.config(); // Must run before any other imports that read process.env

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './lib/prisma';
import { setupSocketServer } from './modules/chat/socket.server';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/user.routes';
import { courseRoutes } from './modules/courses/course.routes';
import { enrollmentRoutes } from './modules/enrollments/enrollment.routes';
import { quizRoutes } from './modules/quizzes/quiz.routes';
import { paymentRoutes } from './modules/payments/payment.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { chatRoutes } from './modules/chat/chat.routes';
import { callRoutes } from './modules/calls/calls.routes';
import { categoryRoutes } from './modules/categories/categories.routes';
import { processActivityEvents } from './modules/chat/eventProcessor';
import { scheduleRecurringJob, checkQueueHealth } from './lib/queue';
import { pushDispatcherService } from './services/push-dispatcher.service';
import './workers/notification.worker';
import './workers/event.worker';

// Initialize Firebase Admin SDK before workers start dispatching push notifications.
// Worker is imported above and is already wired to skip when isEnabled() is false,
// but with proper credentials in env this initializes the singleton so dispatch works.
pushDispatcherService.initialize();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.WEB_URL,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
].filter(Boolean) as string[];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No origin = server-to-server or mobile app (no CORS restriction needed)
    if (!origin) {
      callback(null, true);
      return;
    }
    const isAllowed =
      allowedOrigins.includes(origin) ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/.*\.cometchat-staging\.com$/.test(origin);
    if (isAllowed) {
      callback(null, true);
    } else {
      // Reject the origin without throwing — the cors middleware then omits the
      // Access-Control-Allow-Origin header and the browser refuses the request.
      // Throwing here results in a 500 from the Express error handler, which is
      // both noisier than necessary and confuses CORS preflight diagnosis.
      callback(null, false);
    }
  },
  credentials: true,
};

const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/api/health', async (_req, res) => {
  const queueHealth = await checkQueueHealth();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    queues: queueHealth,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/categories', categoryRoutes);

// Error handling
app.use(errorHandler);

// Socket.IO
setupSocketServer(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  console.log(`[LMS API] Server running on port ${PORT}`);
  console.log(`[LMS API] Environment: ${process.env.NODE_ENV || 'development'}`);

  // Schedule event processing every minute using BullMQ
  try {
    await scheduleRecurringJob(
      'events',
      'process-activity-events',
      {},
      '*/1 * * * *' // Every minute
    );
    console.log('[LMS API] Scheduled recurring event processing job');
  } catch (error) {
    console.error('[LMS API] Failed to schedule recurring jobs:', error);
  }

  // Keep the old setInterval as fallback if BullMQ is not available
  setInterval(async () => {
    try {
      const result = await processActivityEvents();
      if (result.processed > 0 || result.failed > 0) {
        console.log(`[EventProcessor] Processed: ${result.processed}, Failed: ${result.failed}`);
      }
    } catch (error) {
      console.error('[EventProcessor] Error processing events:', error);
    }
  }, 60000);
});

export { app, httpServer, io, prisma };