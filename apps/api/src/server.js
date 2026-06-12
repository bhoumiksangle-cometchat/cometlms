import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
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
dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
    },
});
export const prisma = new PrismaClient();
// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
// Error handling
app.use(errorHandler);
// Socket.IO
setupSocketServer(io);
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`[LMS API] Server running on port ${PORT}`);
    console.log(`[LMS API] Environment: ${process.env.NODE_ENV || 'development'}`);
});
export { app, httpServer, io };
//# sourceMappingURL=server.js.map