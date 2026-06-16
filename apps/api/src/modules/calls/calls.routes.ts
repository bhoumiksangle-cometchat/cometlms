import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getIceServers } from '../../lib/iceServers';

export const callRoutes = Router();

// Return the WebRTC ICE server list (STUN + optional TURN) for clients.
// Requires auth so TURN credentials are not exposed publicly.
callRoutes.get('/ice-servers', requireAuth, (_req, res) => {
  res.json({ success: true, data: { iceServers: getIceServers() } });
});
