import { CometChatUIKit, UIKitSettingsBuilder } from '@cometchat/chat-uikit-react';
import { cometChatConfig, isCometChatConfigured } from './config';
import { logCometChatError } from './errors';

// Module-level guards. React 18 StrictMode double-invokes effects in dev, and
// the provider may mount from multiple places, so init + login must be
// idempotent at module scope.
let initialized = false;
let initPromise: Promise<void> | null = null;
let loginInFlight: Promise<unknown> | null = null;

/**
 * Initialize the CometChat UI Kit exactly once. Safe to call repeatedly —
 * concurrent callers await the same in-flight promise.
 */
export async function initCometChat(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  if (!isCometChatConfigured()) {
    throw new Error(
      'CometChat is not configured. Set VITE_COMETCHAT_APP_ID and VITE_COMETCHAT_REGION.',
    );
  }

  const settings = new UIKitSettingsBuilder()
    .setAppId(cometChatConfig.appId)
    .setRegion(cometChatConfig.region)
    .setAuthKey(cometChatConfig.authKey)
    .subscribePresenceForAllUsers()
    .build();

  initPromise = (async () => {
    await CometChatUIKit.init(settings);
    initialized = true;
    // eslint-disable-next-line no-console
    console.log('CometChat initialized');
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

export function isCometChatInitialized(): boolean {
  return initialized;
}

/**
 * Log a user into CometChat. Prefers a server-minted auth token (production)
 * and falls back to auth-key login by UID (development). Guards against
 * concurrent login calls which the SDK rejects with
 * "Please wait until the previous login request ends."
 */
export async function loginToCometChat(uid: string, authToken?: string): Promise<void> {
  const existing = await CometChatUIKit.getLoggedinUser();
  if (existing) {
    if (existing.getUid() === uid) return;
    // A different user is logged in — switch sessions.
    await CometChatUIKit.logout();
  }

  if (loginInFlight) {
    await loginInFlight;
    const current = await CometChatUIKit.getLoggedinUser();
    if (current?.getUid() === uid) return;
  }

  loginInFlight = authToken
    ? CometChatUIKit.loginWithAuthToken(authToken)
    : CometChatUIKit.login(uid);

  try {
    await loginInFlight;
  } catch (e) {
    // Auth tokens are single-use; a stale token (e.g. after a page refresh)
    // fails. Fall back to auth-key login by UID (dev mode) so chat still works.
    if (authToken) {
      logCometChatError(e);
      loginInFlight = CometChatUIKit.login(uid);
      await loginInFlight;
    } else {
      throw e;
    }
  } finally {
    loginInFlight = null;
  }
}

export async function logoutFromCometChat(): Promise<void> {
  try {
    const existing = await CometChatUIKit.getLoggedinUser();
    if (existing) {
      await CometChatUIKit.logout();
    }
  } catch (e) {
    logCometChatError(e);
  }
}
