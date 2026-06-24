import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export const engagementWebhookRoutes = Router();

/**
 * CometChat Webhook — Course Engagement Analytics.
 *
 * This is the ONLY custom webhook endpoint we maintain. CometChat's built-in
 * AI Agent Builder handles bot replies natively (no server-side relay needed),
 * but per-course engagement metrics (messages/reactions/call-minutes per day)
 * are tracked here because CometChat doesn't aggregate at the course-group level.
 *
 * Configure this webhook in CometChat Dashboard → Webhooks:
 *   URL: https://<your-domain>/api/webhooks/cometchat/events
 *   Triggers: message_new, message_reaction_added, call_ended
 *   Security: HMAC-SHA256 (set COMETCHAT_WEBHOOK_SECRET in .env)
 */

/**
 * Verify CometChat webhook HMAC signature.
 * CometChat signs the raw body with the webhook secret using SHA-256.
 */
function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
}

/**
 * Extract course ID from a CometChat group receiver string.
 * Format: "course-{courseId}"
 */
function extractCourseId(receiver: string | undefined): string | null {
  if (!receiver || !receiver.startsWith('course-')) return null;
  return receiver.replace('course-', '');
}

/** Get today's date as a Date object with time zeroed (for @db.Date column). */
function todayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * POST /api/webhooks/cometchat/events
 *
 * Receives CometChat webhook events for engagement analytics.
 * Handles: message sent, reaction added, call ended.
 * Updates CourseEngagementMetrics counters atomically via upsert.
 */
engagementWebhookRoutes.post('/', async (req: Request, res: Response) => {
  // --- Signature verification ---
  const webhookSecret = process.env.COMETCHAT_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers['x-cometchat-signature'] as string | undefined;
    if (!signature) {
      logger.warn('[EngagementWebhook] Missing x-cometchat-signature header');
      res.status(401).json({ error: 'Missing signature' });
      return;
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      logger.error('[EngagementWebhook] rawBody not available for HMAC verification');
      res.status(500).json({ error: 'Internal configuration error' });
      return;
    }

    try {
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        logger.warn('[EngagementWebhook] Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch (err) {
      logger.warn('[EngagementWebhook] Signature verification failed:', err);
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  } else {
    logger.warn('[EngagementWebhook] COMETCHAT_WEBHOOK_SECRET not set — skipping signature verification');
  }

  // Respond 200 immediately so CometChat doesn't retry
  res.status(200).json({ success: true });

  // Process the event asynchronously
  try {
    const event = req.body;
    if (!event || !event.data) return;

    const trigger: string = event.trigger || '';
    const data = event.data;
    const receiver: string = data.receiver || '';
    const receiverType: string = data.receiverType || '';

    // Only process group messages (course discussions)
    if (receiverType !== 'group') return;

    const courseId = extractCourseId(receiver);
    if (!courseId) return;

    const date = todayDate();

    if (trigger === 'on_message_sent' || trigger === 'message_new' || trigger === 'message.new') {
      // Increment total messages for this course + today
      await prisma.courseEngagementMetrics.upsert({
        where: { courseId_date: { courseId, date } },
        create: {
          courseId,
          date,
          totalMessages: 1,
          totalReactions: 0,
          activeChatters: 0,
          callMinutes: 0,
          flaggedMessages: 0,
          resolvedFlags: 0,
        },
        update: {
          totalMessages: { increment: 1 },
        },
      });
      logger.debug(`[EngagementWebhook] Incremented totalMessages for course ${courseId}`);
    } else if (
      trigger === 'on_message_reaction_added' ||
      trigger === 'message_reaction_added' ||
      trigger === 'message.reaction_added'
    ) {
      // Increment total reactions
      await prisma.courseEngagementMetrics.upsert({
        where: { courseId_date: { courseId, date } },
        create: {
          courseId,
          date,
          totalMessages: 0,
          totalReactions: 1,
          activeChatters: 0,
          callMinutes: 0,
          flaggedMessages: 0,
          resolvedFlags: 0,
        },
        update: {
          totalReactions: { increment: 1 },
        },
      });
      logger.debug(`[EngagementWebhook] Incremented totalReactions for course ${courseId}`);
    } else if (
      trigger === 'on_call_ended' ||
      trigger === 'call_ended' ||
      trigger === 'call.ended'
    ) {
      // Extract duration in seconds and convert to minutes (rounded up)
      const durationSeconds: number = data.duration || 0;
      const durationMinutes = Math.ceil(durationSeconds / 60);

      if (durationMinutes > 0) {
        await prisma.courseEngagementMetrics.upsert({
          where: { courseId_date: { courseId, date } },
          create: {
            courseId,
            date,
            totalMessages: 0,
            totalReactions: 0,
            activeChatters: 0,
            callMinutes: durationMinutes,
            flaggedMessages: 0,
            resolvedFlags: 0,
          },
          update: {
            callMinutes: { increment: durationMinutes },
          },
        });
        logger.debug(
          `[EngagementWebhook] Incremented callMinutes by ${durationMinutes} for course ${courseId}`,
        );
      }
    }
  } catch (error) {
    logger.error('[EngagementWebhook] Error processing webhook event:', error);
  }
});
