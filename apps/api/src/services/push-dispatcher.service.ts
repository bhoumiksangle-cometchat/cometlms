import * as admin from 'firebase-admin';
import { logger } from '../lib/logger';

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  success: boolean;
  error?: 'invalid-token' | 'transient' | 'unknown';
}

class PushDispatcherService {
  private firebaseApp: admin.app.App | null;
  private enabled: boolean;

  constructor() {
    this.enabled = false;
    this.firebaseApp = null;
  }

  /**
   * Initialize Firebase Admin SDK using environment variable credentials.
   * If credentials are missing or invalid, logs an error and disables push dispatch.
   */
  initialize(): void {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      logger.error(
        '[PushDispatcherService] Missing Firebase credentials. Push notifications disabled. ' +
          'Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.'
      );
      this.enabled = false;
      return;
    }

    try {
      // Replace escaped newline characters with actual newlines
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });

      this.enabled = true;
      logger.info('[PushDispatcherService] Firebase Admin SDK initialized successfully.');
    } catch (error) {
      logger.error('[PushDispatcherService] Failed to initialize Firebase Admin SDK:', error);
      this.enabled = false;
      this.firebaseApp = null;
    }
  }

  /**
   * Returns whether push dispatch is enabled (Firebase initialized successfully).
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Returns the Firebase app instance (used internally by send methods).
   */
  getFirebaseApp(): admin.app.App | null {
    return this.firebaseApp;
  }

  /**
   * Constructs an FCM message object from a push payload.
   * Sets notification title/body, click actions for web/android/iOS, and optional data.
   */
  buildFcmMessage(payload: PushPayload): admin.messaging.Message {
    const message: admin.messaging.Message = {
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: process.env.FRONTEND_URL || 'http://localhost:5173',
        },
      },
      android: {
        notification: {
          clickAction: 'OPEN_HOME',
        },
      },
      apns: {
        payload: {
          aps: {
            category: 'DEFAULT',
          },
        },
      },
    };

    if (payload.data) {
      message.data = payload.data;
    }

    return message;
  }

  /**
   * Sends a push notification via FCM.
   * Classifies errors as 'invalid-token', 'transient', or 'unknown'.
   */
  async send(payload: PushPayload): Promise<PushResult> {
    if (!this.enabled || !this.firebaseApp) {
      logger.warn('[PushDispatcherService] Push dispatch is not enabled. Skipping send.');
      return { success: false, error: 'unknown' };
    }

    const message = this.buildFcmMessage(payload);

    try {
      await admin.messaging(this.firebaseApp).send(message);
      return { success: true };
    } catch (error: any) {
      const errorCode: string = error?.code || error?.errorInfo?.code || '';

      // Invalid token errors — token should be removed
      if (
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/registration-token-not-registered'
      ) {
        logger.warn(
          `[PushDispatcherService] Invalid token detected (${errorCode}). Token: ${payload.token}`
        );
        return { success: false, error: 'invalid-token' };
      }

      // Transient errors — should be retried
      if (
        errorCode === 'messaging/unavailable' ||
        errorCode === 'messaging/internal-error'
      ) {
        logger.warn(
          `[PushDispatcherService] Transient FCM error (${errorCode}). Will retry.`
        );
        return { success: false, error: 'transient' };
      }

      // Check for HTTP 5xx errors (transient)
      const httpStatus: number | undefined =
        error?.httpResponse?.status || error?.status;
      if (httpStatus && httpStatus >= 500 && httpStatus < 600) {
        logger.warn(
          `[PushDispatcherService] Transient HTTP error (${httpStatus}). Will retry.`
        );
        return { success: false, error: 'transient' };
      }

      // Unknown errors
      logger.error('[PushDispatcherService] Unexpected FCM error:', error);
      return { success: false, error: 'unknown' };
    }
  }
}

export const pushDispatcherService = new PushDispatcherService();
