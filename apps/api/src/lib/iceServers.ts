/**
 * Centralized ICE server configuration for WebRTC calling.
 *
 * STUN alone only works when both peers can reach each other directly (same
 * LAN, or simple NATs). For reliable connectivity across the public internet
 * (symmetric NATs, mobile carriers, corporate firewalls) a TURN relay is
 * REQUIRED. Configure TURN via environment variables:
 *
 *   TURN_URLS        comma-separated turn/turns URLs
 *                    e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"
 *   TURN_USERNAME    TURN credential username
 *   TURN_CREDENTIAL  TURN credential password
 *   STUN_URLS        optional override for STUN urls (comma-separated)
 *
 * Both the web and mobile clients fetch this list from GET /api/calls/ice-servers
 * so the configuration lives in exactly one place.
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

export function getIceServers(): IceServer[] {
  const servers: IceServer[] = [];

  const stunUrls = (process.env.STUN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  servers.push({ urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS });

  const turnUrls = (process.env.TURN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // The `turns:` (TLS) variant requires coturn to be launched with --cert/--pkey.
  // If the deployment hasn't enabled TLS, advertising turns: URLs to clients
  // just yields broken ICE candidates that hang the connection. Filter them out
  // unless COTURN_TLS_ENABLED is explicitly set, so plain `turn:` works as
  // intended without manual ICE-server overrides on every client.
  const tlsEnabled = process.env.COTURN_TLS_ENABLED === 'true';
  const usableTurnUrls = tlsEnabled
    ? turnUrls
    : turnUrls.filter((url) => !url.startsWith('turns:'));

  if (usableTurnUrls.length > 0) {
    servers.push({
      urls: usableTurnUrls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return servers;
}
