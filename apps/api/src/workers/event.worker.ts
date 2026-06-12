import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { processActivityEvents } from '../modules/chat/eventProcessor';
import { EventProcessingJob } from '../lib/queue';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

/**
 * Worker to process activity events
 */
export const eventWorker = new Worker<EventProcessingJob>(
  'events',
  async (job: Job<EventProcessingJob>) => {
    console.log(`[EventWorker] Processing job ${job.id}`);

    try {
      // Process all pending events from database
      const result = await processActivityEvents();

      console.log(`[EventWorker] Processed ${result.processed} events, ${result.failed} failed`);
      
      return {
        success: true,
        processed: result.processed,
        failed: result.failed,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[EventWorker] Failed to process job ${job.id}:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process events sequentially to avoid race conditions
  }
);

// Event handlers
eventWorker.on('completed', (job, result) => {
  console.log(`[EventWorker] Job ${job.id} completed: ${result.processed} events processed`);
});

eventWorker.on('failed', (job, err) => {
  console.error(`[EventWorker] Job ${job?.id} failed:`, err.message);
});

eventWorker.on('error', (err) => {
  console.error('[EventWorker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[EventWorker] Received SIGTERM, closing worker...');
  await eventWorker.close();
  await connection.quit();
});

process.on('SIGINT', async () => {
  console.log('[EventWorker] Received SIGINT, closing worker...');
  await eventWorker.close();
  await connection.quit();
});

export default eventWorker;
