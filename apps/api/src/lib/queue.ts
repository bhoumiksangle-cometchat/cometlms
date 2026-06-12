import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection for BullMQ
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Notification Queue
export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

// Event Processing Queue
export const eventQueue = new Queue('events', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

// BullMQ v5 no longer requires QueueScheduler.

// Job Types
export interface NotificationJob {
  userId: string;
  type: 'email' | 'push' | 'in_app';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

export interface EventProcessingJob {
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
}

// Helper functions to add jobs
export async function addNotificationJob(
  notification: NotificationJob,
  options?: {
    delay?: number; // Delay in milliseconds
    priority?: number; // 1 (highest) to 10 (lowest)
  }
) {
  const priority = options?.priority ?? 5;
  
  return await notificationQueue.add(
    'send-notification',
    notification,
    {
      delay: options?.delay,
      priority,
    }
  );
}

export async function addEventProcessingJob(
  event: EventProcessingJob,
  options?: {
    delay?: number;
  }
) {
  return await eventQueue.add(
    'process-event',
    event,
    {
      delay: options?.delay,
    }
  );
}

// Helper to schedule recurring jobs
export async function scheduleRecurringJob(
  queueName: 'notifications' | 'events',
  jobName: string,
  data: any,
  cronExpression: string
) {
  const queue = queueName === 'notifications' ? notificationQueue : eventQueue;
  
  return await queue.add(
    jobName,
    data,
    {
      repeat: {
        pattern: cronExpression,
      },
    }
  );
}

// Cleanup function
export async function closeQueues() {
  await notificationQueue.close();
  await eventQueue.close();
  await connection.quit();
}

// Health check
export async function checkQueueHealth() {
  try {
    const notificationCounts = await notificationQueue.getJobCounts();
    const eventCounts = await eventQueue.getJobCounts();
    
    return {
      healthy: true,
      notifications: notificationCounts,
      events: eventCounts,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
