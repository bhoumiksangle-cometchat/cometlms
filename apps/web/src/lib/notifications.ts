/**
 * Push Notifications Service
 * Handles browser push notification permissions and displaying notifications
 */

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
}

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check if browser supports notifications
   */
  isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermissionStatus {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!this.isSupported()) {
      console.warn('Push notifications are not supported in this browser');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission was previously denied');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[Notifications] Permission:', permission);
      return permission;
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      return 'denied';
    }
  }

  /**
   * Show a notification
   */
  async show(options: NotificationOptions): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn('Push notifications are not supported');
      return null;
    }

    const permission = this.getPermissionStatus();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/logo.png',
        badge: options.badge || '/logo.png',
        tag: options.tag || 'default',
        data: options.data,
        requireInteraction: options.requireInteraction || false,
      });

      // Auto close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      return notification;
    } catch (error) {
      console.error('[Notifications] Error showing notification:', error);
      return null;
    }
  }

  /**
   * Show notification for new chat message
   */
  async showMessageNotification(senderName: string, message: string, roomId: string, roomName?: string): Promise<Notification | null> {
    const notification = await this.show({
      title: `${senderName} sent a message`,
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: '/logo.png',
      tag: `message-${roomId}`,
      data: { type: 'message', roomId, senderName, roomName },
      requireInteraction: false,
    });

    if (notification) {
      // Handle notification click
      notification.onclick = () => {
        window.focus();
        // Navigate to the message room
        if (roomId.startsWith('course-')) {
          const courseId = roomId.replace('course-', '');
          window.location.href = `/courses/${courseId}/discussion`;
        } else if (roomId.startsWith('dm-')) {
          window.location.href = '/messages';
        }
        notification.close();
      };
    }

    return notification;
  }

  /**
   * Show notification for mention
   */
  async showMentionNotification(senderName: string, message: string, roomId: string, roomName?: string): Promise<Notification | null> {
    const notification = await this.show({
      title: `${senderName} mentioned you`,
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: '/logo.png',
      tag: `mention-${roomId}`,
      data: { type: 'mention', roomId, senderName, roomName },
      requireInteraction: true, // Keep mention notifications until user interacts
    });

    if (notification) {
      notification.onclick = () => {
        window.focus();
        if (roomId.startsWith('course-')) {
          const courseId = roomId.replace('course-', '');
          window.location.href = `/courses/${courseId}/discussion`;
        } else if (roomId.startsWith('dm-')) {
          window.location.href = '/messages';
        }
        notification.close();
      };
    }

    return notification;
  }

  /**
   * Show notification for call
   */
  async showCallNotification(callerName: string, callType: 'voice' | 'video'): Promise<Notification | null> {
    const notification = await this.show({
      title: `Incoming ${callType} call`,
      body: `${callerName} is calling you`,
      icon: '/logo.png',
      tag: 'incoming-call',
      data: { type: 'call', callerName, callType },
      requireInteraction: true,
    });

    if (notification) {
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }

    return notification;
  }
}

export const notificationService = NotificationService.getInstance();
