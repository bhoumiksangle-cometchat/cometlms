import { logger } from '../lib/logger';

/**
 * Server-side CometChat REST API client.
 *
 * Uses the REST API Key (server-only secret, never exposed to the client) to
 * manage users, groups, memberships, bot messages, and moderation. Calls the
 * v3 REST API at https://{appId}.api-{region}.cometchat.io/v3/.
 *
 * All methods are best-effort and resilient: when CometChat is not configured
 * they no-op (so the LMS keeps working), and transient/4xx errors are logged
 * rather than thrown, except where a caller explicitly needs the result
 * (e.g. createAuthToken).
 */

const APP_ID = () => process.env.COMETCHAT_APP_ID ?? '';
const REGION = () => process.env.COMETCHAT_REGION ?? '';
const REST_API_KEY = () => process.env.COMETCHAT_REST_API_KEY ?? '';

const BASE_URL = () =>
  APP_ID() && REGION() ? `https://${APP_ID()}.api-${REGION()}.cometchat.io/v3` : '';

export function isCometChatEnabled(): boolean {
  return Boolean(APP_ID() && REGION() && REST_API_KEY());
}

/** Stable CometChat group id (guid) for a course discussion. */
export function courseGroupGuid(courseId: string): string {
  return `course-${courseId}`;
}

export type CometChatScope = 'admin' | 'moderator' | 'participant';

export interface CometChatRequestResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code?: string; message?: string };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Sets the `onBehalfOf` header so the action is performed as this UID. */
  onBehalfOf?: string;
  /** Suppress error-level logging for expected failures (e.g. 409 duplicates). */
  quiet?: boolean;
}

async function request<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<CometChatRequestResult<T>> {
  if (!isCometChatEnabled()) {
    return { ok: false, status: 0, error: { message: 'CometChat not configured' } };
  }

  const { method = 'GET', body, onBehalfOf, quiet } = options;
  const url = `${BASE_URL()}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    accept: 'application/json',
    apikey: REST_API_KEY(),
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (onBehalfOf) headers.onBehalfOf = onBehalfOf;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let json: any = undefined;
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }

    if (!res.ok) {
      const err = json?.error ?? {};
      const result: CometChatRequestResult<T> = {
        ok: false,
        status: res.status,
        error: { code: err.code, message: err.message ?? json?.raw },
      };
      if (!quiet) {
        logger.warn(
          `[CometChat] ${method} ${path} -> ${res.status} ${err.code ?? ''} ${err.message ?? ''}`.trim(),
        );
      }
      return result;
    }

    return { ok: true, status: res.status, data: json?.data ?? json };
  } catch (e) {
    if (!quiet) {
      logger.error(`[CometChat] ${method} ${path} request failed:`, e);
    }
    return { ok: false, status: 0, error: { message: (e as Error).message } };
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  uid: string;
  name: string;
  avatar?: string | null;
  role?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create (or, if it already exists, update) a CometChat user. Idempotent so it
 * can be safely called on every registration/login.
 */
async function createUser(input: CreateUserInput): Promise<CometChatRequestResult> {
  const body: Record<string, unknown> = {
    uid: input.uid,
    name: input.name,
  };
  if (input.avatar) body.avatar = input.avatar;
  // CometChat's top-level `role` requires roles pre-defined in the dashboard,
  // so the LMS role is stored in freeform metadata instead.
  const metadata = buildUserMetadata(input.role, input.metadata);
  if (metadata) body.metadata = metadata;

  const res = await request('/users', { method: 'POST', body, quiet: true });
  if (res.ok) return res;

  // Already exists -> update instead (keeps name/avatar in sync).
  if (res.status === 409 || res.error?.code === 'ERR_UID_ALREADY_EXISTS') {
    return updateUser(input.uid, {
      name: input.name,
      avatar: input.avatar ?? undefined,
      role: input.role,
      metadata: input.metadata,
    });
  }

  logger.warn(`[CometChat] createUser(${input.uid}) failed: ${res.error?.message}`);
  return res;
}

function buildUserMetadata(
  role?: string,
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!role && !metadata) return undefined;
  return { ...(metadata ?? {}), ...(role ? { lmsRole: role } : {}) };
}

async function updateUser(
  uid: string,
  updates: { name?: string; avatar?: string; role?: string; metadata?: Record<string, unknown> },
): Promise<CometChatRequestResult> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.avatar !== undefined) body.avatar = updates.avatar;
  const metadata = buildUserMetadata(updates.role, updates.metadata);
  if (metadata !== undefined) body.metadata = metadata;
  return request(`/users/${encodeURIComponent(uid)}`, { method: 'PUT', body });
}

async function deleteUser(uid: string, permanent = false): Promise<CometChatRequestResult> {
  return request(`/users/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
    body: { permanent },
  });
}

/**
 * Mint a CometChat auth token for a user (server-side). Returns the token
 * string, or null on failure. Used by the login flow so the client can call
 * loginWithAuthToken() without ever seeing the Auth Key.
 */
async function createAuthToken(uid: string): Promise<string | null> {
  const res = await request<{ authToken: string }>(
    `/users/${encodeURIComponent(uid)}/auth_tokens`,
    { method: 'POST', body: { force: true } },
  );
  if (res.ok && res.data?.authToken) return res.data.authToken;
  logger.warn(`[CometChat] createAuthToken(${uid}) failed: ${res.error?.message}`);
  return null;
}

async function getUser(uid: string): Promise<CometChatRequestResult> {
  return request(`/users/${encodeURIComponent(uid)}`, { quiet: true });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface CreateGroupInput {
  guid: string;
  name: string;
  type?: 'public' | 'private' | 'password';
  owner?: string;
  metadata?: Record<string, unknown>;
}

async function createGroup(input: CreateGroupInput): Promise<CometChatRequestResult> {
  const body: Record<string, unknown> = {
    guid: input.guid,
    name: input.name,
    type: input.type ?? 'public',
  };
  if (input.owner) body.owner = input.owner;
  if (input.metadata) body.metadata = input.metadata;

  const res = await request('/groups', { method: 'POST', body, quiet: true });
  if (res.ok) return res;

  if (res.status === 409 || res.error?.code === 'ERR_GUID_ALREADY_EXISTS') {
    // Re-activate / sync existing group.
    return updateGroup(input.guid, { name: input.name, metadata: input.metadata });
  }

  logger.warn(`[CometChat] createGroup(${input.guid}) failed: ${res.error?.message}`);
  return res;
}

async function updateGroup(
  guid: string,
  updates: { name?: string; metadata?: Record<string, unknown> },
): Promise<CometChatRequestResult> {
  const body: Record<string, unknown> = {};
  if (updates.name !== undefined) body.name = updates.name;
  if (updates.metadata !== undefined) body.metadata = updates.metadata;
  return request(`/groups/${encodeURIComponent(guid)}`, { method: 'PUT', body });
}

async function deleteGroup(guid: string): Promise<CometChatRequestResult> {
  return request(`/groups/${encodeURIComponent(guid)}`, { method: 'DELETE' });
}

async function getGroup(guid: string): Promise<CometChatRequestResult> {
  return request(`/groups/${encodeURIComponent(guid)}`, { quiet: true });
}

// ---------------------------------------------------------------------------
// Group membership
// ---------------------------------------------------------------------------

export interface GroupMemberInput {
  uid: string;
  scope?: CometChatScope;
}

/**
 * Add members to a group. Groups members by scope into the participants /
 * moderators / admins arrays expected by the REST API.
 */
async function addGroupMembers(
  guid: string,
  members: GroupMemberInput[],
): Promise<CometChatRequestResult> {
  const participants: string[] = [];
  const moderators: string[] = [];
  const admins: string[] = [];

  for (const m of members) {
    if (m.scope === 'admin') admins.push(m.uid);
    else if (m.scope === 'moderator') moderators.push(m.uid);
    else participants.push(m.uid);
  }

  const body: Record<string, unknown> = {};
  if (participants.length) body.participants = participants;
  if (moderators.length) body.moderators = moderators;
  if (admins.length) body.admins = admins;

  return request(`/groups/${encodeURIComponent(guid)}/members`, {
    method: 'POST',
    body,
    quiet: true,
  });
}

async function removeGroupMember(guid: string, uid: string): Promise<CometChatRequestResult> {
  return request(
    `/groups/${encodeURIComponent(guid)}/members/${encodeURIComponent(uid)}`,
    { method: 'DELETE', quiet: true },
  );
}

// ---------------------------------------------------------------------------
// Moderation / status (Task 9 + Task 13)
// ---------------------------------------------------------------------------

async function listFlaggedMessages(params?: Record<string, string | number>): Promise<CometChatRequestResult> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params).map(([k, v]): [string, string] => [k, String(v)])
      ).toString()
    : '';
  return request(`/moderation/flagged-messages${qs}`, { quiet: true });
}

/**
 * Approve / dismiss a flagged message so it is no longer pending review.
 */
async function dismissFlaggedMessage(messageId: string): Promise<CometChatRequestResult> {
  return request(`/moderation/flagged-messages/${encodeURIComponent(messageId)}`, {
    method: 'PUT',
    body: { status: 'approved' },
  });
}

/**
 * Ban a user from the CometChat platform (deactivates their account).
 */
async function banUser(uid: string): Promise<CometChatRequestResult> {
  return request(`/users/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    body: { deactivated: true },
  });
}

/**
 * Fetch user status (online/offline) for a list of UIDs.
 * Returns user objects with their `status` field ('online' | 'offline').
 */
async function getUsersStatus(uids: string[]): Promise<CometChatRequestResult> {
  if (uids.length === 0) return { ok: true, status: 200, data: [] };
  const params = new URLSearchParams({ uids: uids.join(','), withTags: 'false' });
  return request(`/users?${params.toString()}`);
}

export const cometChatService = {
  isEnabled: isCometChatEnabled,
  // users
  createUser,
  updateUser,
  deleteUser,
  createAuthToken,
  getUser,
  getUsersStatus,
  // groups
  createGroup,
  updateGroup,
  deleteGroup,
  getGroup,
  // membership
  addGroupMembers,
  removeGroupMember,
  // moderation
  listFlaggedMessages,
  dismissFlaggedMessage,
  banUser,
  // low-level escape hatch
  request,
};

export default cometChatService;
