import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../lib/prisma';
import { pushDispatcherService } from '../services/push-dispatcher.service';
import { notificationService } from '../services/notification.service';
import { NotificationJob } from '../lib/queue';
import { logger } from '../lib/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export interface PushJobResult {
  status: 'sent' | 'skipped_disabled' | 'skipped_no_token' | 'token_invalidated' | 'failed';
  reason?: string;
}

/**
 * Process a push notification job.
 * Implements the dispatch gate logic:
 * 1. Check if push dispatcher is enabled (Firebase configured)
 * 2. Check user's pushNotificationsEnabled flag
 * 3. Look up DeviceToken
 * 4. Send via FCM
 * 5. Handle invalid-token and transient errors
 */
export async function processPushJob(job: Job<NotificationJob>): Promise<PushJobResult> {
  const { userId, title, message, data } = job.data;

  // 1. Check if push dispatcher is enabled
  if (!pushDispatcherService.isEnabled()) {
    logger.info(`[NotificationWorker] Push dispatcher not enabled, skipping push for user ${userId}`);
    return { status: 'skipped_disabled', reason: 'Push dispatcher not enabled' };
  }

  // 2. Check user's pushNotificationsEnabled flag
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushNotificationsEnabled: true },
  });

  if (!user || !user.pushNotificationsEnabled) {
    logger.info(`[NotificationWorker] User ${userId} has push notifications disabled, skipping`);
    return { status: 'skipped_disabled', reason: 'User has push disabled' };
  }

  // 3. Look up DeviceToken
  const deviceToken = await prisma.deviceToken.findUnique({
    where: { userId },
  });

  if (!deviceToken) {
    logger.warn(`[NotificationWorker] No device token found for user ${userId}, skipping push`);
    return { status: 'skipped_no_token', reason: 'No device token for user' };
  }

  // 4. Send via FCM
  const result = await pushDispatcherService.send({
    token: deviceToken.token,
    title,
    body: message,
    data: data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : undefined,
  });

  // 5. Handle result
  if (result.success) {
    logger.info(`[NotificationWorker] Push notification sent successfully to user ${userId}`);
    return { status: 'sent' };
  }

  if (result.error === 'invalid-token') {
    logger.warn(`[NotificationWorker] Invalid token for user ${userId}, deleting device token`);
    await prisma.deviceToken.deleteMany({ where: { userId } });
    return { status: 'token_invalidated' };
  }

  if (result.error === 'transient') {
    // Throw to trigger BullMQ retry with exponential backoff
    throw new Error(`Transient FCM error for user ${userId} — will retry`);
  }

  logger.error(`[NotificationWorker] Unknown FCM error for user ${userId}: ${result.error}`);
  return { status: 'failed', reason: `Unknown FCM error: ${result.error}` };
}

/**
 * Worker to process notification jobs from the 'notifications' queue.
 */
export const notificationWorker = new Worker<NotificationJob>(
  'notifications',
  async (job: Job<NotificationJob>) => {
    const { userId, type, title, message, data } = job.data;

    logger.info(`[NotificationWorker] Processing job ${job.id} — type: ${type}, user: ${userId}`);

    try {
      // Handle push notifications with dedicated dispatch gate logic
      if (type === 'push') {
        return await processPushJob(job);
      }

      // For email and in_app notifications, delegate to NotificationService
      await notificationService.sendNotification({
        userId,
        type,
        title,
        message,
        data,
      });

      logger.info(`[NotificationWorker] Successfully sent ${type} notification to user ${userId}`);

      return {
        success: true,
        userId,
        type,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[NotificationWorker] Failed to process job ${job.id}:`, error);
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
  logger.info(`[NotificationWorker] Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job, err) => {
  logger.error(`[NotificationWorker] Job ${job?.id} failed: ${err.message}`);
});

notificationWorker.on('error', (err) => {
  logger.error('[NotificationWorker] Worker error:', err);
});

/**
 * Creates and returns the notification worker instance.
 * Useful for testing and explicit lifecycle management.
 */
export function startNotificationWorker(): Worker<NotificationJob> {
  return notificationWorker;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[NotificationWorker] Received SIGTERM, closing worker...');
  await notificationWorker.close();
  await connection.quit();
});

process.on('SIGINT', async () => {
  logger.info('[NotificationWorker] Received SIGINT, closing worker...');
  await notificationWorker.close();
  await connection.quit();
});

export default notificationWorker;
