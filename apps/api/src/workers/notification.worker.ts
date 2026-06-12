import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { notificationService } from '../services/notification.service';
import { NotificationJob } from '../lib/queue';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Worker to process notification jobs
 */
export const notificationWorker = new Worker<NotificationJob>(
  'notifications',
  async (job: Job<NotificationJob>) => {
    const { userId, type, title, message, data } = job.data;

    console.log(`[NotificationWorker] Processing job ${job.id} for user ${userId}`);

    try {
      await notificationService.sendNotification({
        userId,
        type,
        title,
        message,
        data,
      });

      console.log(`[NotificationWorker] Successfully sent ${type} notification to user ${userId}`);
      
      return {
        success: true,
        userId,
        type,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[NotificationWorker] Failed to process job ${job.id}:`, error);
      throw error; // Will trigger retry based on job options
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 notifications concurrently
  }
);

// Event handlers
notificationWorker.on('completed', (job) => {
  console.log(`[NotificationWorker] Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed:`, err.message);
});

notificationWorker.on('error', (err) => {
  console.error('[NotificationWorker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[NotificationWorker] Received SIGTERM, closing worker...');
  await notificationWorker.close();
  await connection.quit();
});

process.on('SIGINT', async () => {
  console.log('[NotificationWorker] Received SIGINT, closing worker...');
  await notificationWorker.close();
  await connection.quit();
});

export default notificationWorker;
