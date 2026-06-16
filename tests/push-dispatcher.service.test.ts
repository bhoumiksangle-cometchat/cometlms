import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as admin from 'firebase-admin';

// Mock firebase-admin
vi.mock('firebase-admin', () => {
  const mockSend = vi.fn();
  const mockMessaging = vi.fn(() => ({ send: mockSend }));
  return {
    default: {
      initializeApp: vi.fn(),
      credential: { cert: vi.fn() },
      messaging: mockMessaging,
    },
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: mockMessaging,
  };
});

// Mock logger
vi.mock('../apps/api/src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PushDispatcherService', () => {
  let service: any;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Set required env vars for initialization
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----';

    // Re-import to get a fresh instance
    const mod = await import('../apps/api/src/services/push-dispatcher.service');
    service = mod.pushDispatcherService;

    // Get reference to the mock send function
    mockSend = (admin.messaging as unknown as ReturnType<typeof vi.fn>)().send;
    mockSend.mockReset();
  });

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FRONTEND_URL;
    vi.restoreAllMocks();
  });

  describe('buildFcmMessage', () => {
    it('should construct message with notification title and body', () => {
      const payload = { token: 'test-token', title: 'Hello', body: 'World' };
      const message = service.buildFcmMessage(payload);

      expect(message.token).toBe('test-token');
      expect(message.notification?.title).toBe('Hello');
      expect(message.notification?.body).toBe('World');
    });

    it('should set webpush fcmOptions link to FRONTEND_URL', () => {
      process.env.FRONTEND_URL = 'https://myapp.com';
      const payload = { token: 'test-token', title: 'Hi', body: 'There' };
      const message = service.buildFcmMessage(payload);

      expect(message.webpush?.fcmOptions?.link).toBe('https://myapp.com');
    });

    it('should default webpush link to http://localhost:5173 when FRONTEND_URL is not set', () => {
      delete process.env.FRONTEND_URL;
      const payload = { token: 'test-token', title: 'Hi', body: 'There' };
      const message = service.buildFcmMessage(payload);

      expect(message.webpush?.fcmOptions?.link).toBe('http://localhost:5173');
    });

    it('should set android click action to OPEN_HOME', () => {
      const payload = { token: 'test-token', title: 'Hi', body: 'There' };
      const message = service.buildFcmMessage(payload);

      expect(message.android?.notification?.clickAction).toBe('OPEN_HOME');
    });

    it('should set apns category to DEFAULT', () => {
      const payload = { token: 'test-token', title: 'Hi', body: 'There' };
      const message = service.buildFcmMessage(payload);

      expect(message.apns?.payload?.aps?.category).toBe('DEFAULT');
    });

    it('should include data field when payload has data', () => {
      const payload = {
        token: 'test-token',
        title: 'Hi',
        body: 'There',
        data: { courseId: '123', type: 'assignment' },
      };
      const message = service.buildFcmMessage(payload);

      expect(message.data).toEqual({ courseId: '123', type: 'assignment' });
    });

    it('should not include data field when payload has no data', () => {
      const payload = { token: 'test-token', title: 'Hi', body: 'There' };
      const message = service.buildFcmMessage(payload);

      expect(message.data).toBeUndefined();
    });
  });

  describe('send', () => {
    beforeEach(() => {
      // Simulate that service is initialized and enabled
      (service as any).enabled = true;
      (service as any).firebaseApp = {} as admin.app.App;
    });

    it('should return success when FCM send succeeds', async () => {
      mockSend.mockResolvedValueOnce('message-id-123');

      const result = await service.send({
        token: 'valid-token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: true });
    });

    it('should return invalid-token error for invalid-registration-token code', async () => {
      mockSend.mockRejectedValueOnce({
        code: 'messaging/invalid-registration-token',
      });

      const result = await service.send({
        token: 'bad-token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'invalid-token' });
    });

    it('should return invalid-token error for registration-token-not-registered code', async () => {
      mockSend.mockRejectedValueOnce({
        code: 'messaging/registration-token-not-registered',
      });

      const result = await service.send({
        token: 'expired-token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'invalid-token' });
    });

    it('should return transient error for messaging/unavailable', async () => {
      mockSend.mockRejectedValueOnce({
        code: 'messaging/unavailable',
      });

      const result = await service.send({
        token: 'token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'transient' });
    });

    it('should return transient error for messaging/internal-error', async () => {
      mockSend.mockRejectedValueOnce({
        code: 'messaging/internal-error',
      });

      const result = await service.send({
        token: 'token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'transient' });
    });

    it('should return transient error for HTTP 5xx status', async () => {
      mockSend.mockRejectedValueOnce({
        code: 'some-other-code',
        status: 503,
      });

      const result = await service.send({
        token: 'token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'transient' });
    });

    it('should return unknown error for unrecognized errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Something unexpected'));

      const result = await service.send({
        token: 'token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'unknown' });
    });

    it('should return unknown error when service is not enabled', async () => {
      (service as any).enabled = false;

      const result = await service.send({
        token: 'token',
        title: 'Test',
        body: 'Message',
      });

      expect(result).toEqual({ success: false, error: 'unknown' });
    });
  });
});
