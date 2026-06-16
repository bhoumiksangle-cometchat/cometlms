import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import apiClient from './apiClient';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let firebaseApp: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/**
 * Initialize Firebase app and messaging instance.
 * Returns null if required config is missing.
 */
function initializeFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;

  // Verify required config values are present
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
  ) {
    console.warn('[Firebase Messaging] Missing Firebase config. Push notifications disabled.');
    return null;
  }

  try {
    // Reuse existing app or create a new one
    firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (error) {
    console.error('[Firebase Messaging] Initialization failed:', error);
    return null;
  }
}

/**
 * Request browser notification permission and register FCM token with the backend.
 * Returns 'granted' if successful, 'denied' if permission was denied or an error occurred.
 */
export async function requestPermissionAndRegisterToken(): Promise<'granted' | 'denied'> {
  if (!('Notification' in window)) {
    console.warn('[Firebase Messaging] Notifications not supported in this browser.');
    return 'denied';
  }

  // Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[Firebase Messaging] Notification permission denied.');
    return 'denied';
  }

  const messagingInstance = initializeFirebaseMessaging();
  if (!messagingInstance) {
    return 'denied';
  }

  try {
    // Get FCM token using the VAPID key
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(),
    });

    if (!token) {
      console.warn('[Firebase Messaging] Failed to get FCM token.');
      return 'denied';
    }

    // Register token with backend
    await apiClient.post('/api/notifications/device-token', {
      token,
      platform: 'web',
    });

    console.log('[Firebase Messaging] Token registered successfully.');
    return 'granted';
  } catch (error) {
    console.error('[Firebase Messaging] Error registering token:', error);
    return 'denied';
  }
}

/**
 * Refresh the FCM token and re-register with the backend.
 * In Firebase v9+ modular SDK, there is no automatic onTokenRefresh listener.
 * Call this periodically or on app load to ensure the token is up to date.
 */
export async function onTokenRefresh(): Promise<void> {
  const messagingInstance = initializeFirebaseMessaging();
  if (!messagingInstance) return;

  try {
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(),
    });

    if (token) {
      await apiClient.post('/api/notifications/device-token', {
        token,
        platform: 'web',
      });
      console.log('[Firebase Messaging] Token refreshed and re-registered.');
    }
  } catch (error) {
    console.error('[Firebase Messaging] Error refreshing token:', error);
  }
}

export interface ForegroundMessagePayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Listen for foreground messages (when app is focused).
 * Calls the provided callback with the message payload.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  callback: (payload: ForegroundMessagePayload) => void
): (() => void) | null {
  const messagingInstance = initializeFirebaseMessaging();
  if (!messagingInstance) return null;

  const unsubscribe = onMessage(messagingInstance, (payload) => {
    const title = payload.notification?.title || 'New Notification';
    const body = payload.notification?.body || '';
    const data = payload.data as Record<string, string> | undefined;

    callback({ title, body, data });
  });

  return unsubscribe;
}

/**
 * Remove device token from the backend (called during logout).
 */
export async function removeDeviceToken(): Promise<void> {
  try {
    await apiClient.delete('/api/notifications/device-token');
    console.log('[Firebase Messaging] Device token removed.');
  } catch (error) {
    console.error('[Firebase Messaging] Error removing device token:', error);
  }
}
