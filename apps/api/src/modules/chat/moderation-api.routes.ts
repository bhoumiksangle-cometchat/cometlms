import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { cometChatService } from '../../services/cometchat.service';
import { logger } from '../../lib/logger';

/**
 * Admin-only moderation routes that proxy CometChat's moderation API.
 *
 * This prevents the admin dashboard from hitting CometChat directly from the
 * client, keeping the REST API Key server-side.
 *
 * Mounted at: /api/admin/moderation (via server.ts)
 */
export const moderationApiRoutes = Router();

// All routes require an authenticated admin/super-admin
moderationApiRoutes.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

/**
 * GET /api/admin/moderation
 * Fetches flagged messages from CometChat's moderation API.
 * Query params: page, limit (forwarded to CometChat).
 */
moderationApiRoutes.get('/', async (req, res, next) => {
  try {
    if (!cometChatService.isEnabled()) {
      res.status(503).json({
        success: false,
        error: 'CometChat is not configured on this server',
      });
      return;
    }

    const params: Record<string, string | number> = {};
    if (req.query.page) params.page = Number(req.query.page);
    if (req.query.limit) params.perPage = Number(req.query.limit);

    const result = await cometChatService.listFlaggedMessages(params);

    if (!result.ok) {
      logger.warn('[Moderation API] Failed to fetch flagged messages:', result.error);
      res.status(result.status || 502).json({
        success: false,
        error: result.error?.message ?? 'Failed to fetch flagged messages from CometChat',
      });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/moderation/:id/dismiss
 * Marks a flagged message as reviewed/approved in CometChat.
 */
moderationApiRoutes.post('/:id/dismiss', async (req, res, next) => {
  try {
    if (!cometChatService.isEnabled()) {
      res.status(503).json({
        success: false,
        error: 'CometChat is not configured on this server',
      });
      return;
    }

    const { id } = req.params;
    const result = await cometChatService.dismissFlaggedMessage(id);

    if (!result.ok) {
      logger.warn(`[Moderation API] Failed to dismiss message ${id}:`, result.error);
      res.status(result.status || 502).json({
        success: false,
        error: result.error?.message ?? 'Failed to dismiss flagged message',
      });
      return;
    }

    logger.info(`[Moderation API] Message ${id} dismissed by admin ${req.user!.id}`);
    res.json({ success: true, data: result.data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/moderation/:id/ban
 * Bans the user who sent the flagged message by deactivating them in CometChat.
 * Expects { uid: string } in the request body identifying the user to ban.
 */
moderationApiRoutes.post('/:id/ban', async (req, res, next) => {
  try {
    if (!cometChatService.isEnabled()) {
      res.status(503).json({
        success: false,
        error: 'CometChat is not configured on this server',
      });
      return;
    }

    const { id } = req.params;
    const { uid } = req.body as { uid?: string };

    if (!uid) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: uid (the user ID to ban)',
      });
      return;
    }

    // First dismiss the flagged message
    await cometChatService.dismissFlaggedMessage(id);

    // Then ban (deactivate) the user in CometChat
    const banResult = await cometChatService.banUser(uid);

    if (!banResult.ok) {
      logger.warn(`[Moderation API] Failed to ban user ${uid}:`, banResult.error);
      res.status(banResult.status || 502).json({
        success: false,
        error: banResult.error?.message ?? 'Failed to ban user in CometChat',
      });
      return;
    }

    logger.info(`[Moderation API] User ${uid} banned by admin ${req.user!.id} (flag: ${id})`);
    res.json({ success: true, data: { flagId: id, bannedUid: uid } });
  } catch (error) {
    next(error);
  }
});
