import { prisma } from '../server';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';

// Initialize SendGrid (if API key is provided)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@lms.local';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// Fallback to nodemailer for development
const devTransporter = nodemailer.createTransport({
  host: 'localhost',
  port: 1025, // MailHog or similar
  ignoreTLS: true,
});

export interface NotificationPayload {
  userId: string;
  type: 'email' | 'push' | 'in_app';
  title: string;
  message: string;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Send a notification to a user
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    const { userId, type, title, message, data } = payload;

    // Create notification record in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data || {},
        read: false,
      },
    });

    // Send based on type
    switch (type) {
      case 'email':
        await this.sendEmail(userId, title, message, data);
        break;
      case 'push':
        await this.sendPushNotification(userId, title, message, data);
        break;
      case 'in_app':
        // In-app notifications are already in database, emit via Socket.IO
        await this.emitInAppNotification(userId, notification);
        break;
      default:
        console.warn(`Unknown notification type: ${type}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const emailContent = this.buildEmailContent(title, message, data);

      if (SENDGRID_API_KEY) {
        // Use SendGrid
        await sgMail.send({
          to: user.email,
          from: SENDGRID_FROM_EMAIL,
          subject: title,
          text: message,
          html: emailContent,
        });
        console.log(`[NotificationService] SendGrid email sent to ${user.email}`);
      } else {
        // Use nodemailer (development)
        await devTransporter.sendMail({
          from: SENDGRID_FROM_EMAIL,
          to: user.email,
          subject: title,
          text: message,
          html: emailContent,
        });
        console.log(`[NotificationService] Dev email sent to ${user.email}`);
      }
    } catch (error) {
      console.error('[NotificationService] Email error:', error);
      throw error;
    }
  }

  /**
   * Send push notification (placeholder for FCM/APNs)
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    // TODO: Implement FCM/APNs integration
    console.log(`[NotificationService] Push notification (placeholder):`, {
      userId,
      title,
      message,
      data,
    });

    // For now, fall back to in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'in_app',
        title,
        message,
        data: data || {},
        read: false,
      },
    });

    await this.emitInAppNotification(userId, notification);
  }

  /**
   * Emit in-app notification via Socket.IO
   */
  private async emitInAppNotification(
    userId: string,
    notification: any
  ): Promise<void> {
    // This will be emitted through Socket.IO server
    // Socket.IO integration happens in socket.server.ts
    console.log(`[NotificationService] In-app notification created for user ${userId}`);
  }

  /**
   * Build HTML email content
   */
  private buildEmailContent(
    title: string,
    message: string,
    data?: Record<string, any>
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            .message {
              background: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #667eea;
            }
            .footer {
              background: #f7fafc;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #718096;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎓 LearnLoop LMS</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <div class="message">
              <p>${message}</p>
            </div>
            ${data?.actionUrl ? `<a href="${data.actionUrl}" class="button">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>You received this email because you're a member of LearnLoop LMS.</p>
            <p>© ${new Date().getFullYear()} LearnLoop. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: string) {
    return await prisma.notification.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return await prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Send mention notification
   */
  async sendMentionNotification(data: {
    mentionedUserId: string;
    senderName: string;
    roomName: string;
    messagePreview: string;
    roomId: string;
  }) {
    await this.sendNotification({
      userId: data.mentionedUserId,
      type: 'in_app',
      title: `${data.senderName} mentioned you`,
      message: `${data.senderName} mentioned you in ${data.roomName}: "${data.messagePreview}"`,
      data: {
        type: 'mention',
        roomId: data.roomId,
        senderName: data.senderName,
      },
    });

    // Also send email for mentions
    await this.sendNotification({
      userId: data.mentionedUserId,
      type: 'email',
      title: `${data.senderName} mentioned you in ${data.roomName}`,
      message: `${data.senderName} mentioned you: "${data.messagePreview}"`,
      data: {
        type: 'mention',
        roomId: data.roomId,
        actionUrl: `${process.env.FRONTEND_URL}/courses/${data.roomId.replace('course-', '')}/discussion`,
      },
    });
  }

  /**
   * Send course enrollment notification
   */
  async sendEnrollmentNotification(userId: string, courseTitle: string, courseId: string) {
    await this.sendNotification({
      userId,
      type: 'email',
      title: `Welcome to ${courseTitle}!`,
      message: `You've successfully enrolled in ${courseTitle}. Start learning now!`,
      data: {
        type: 'enrollment',
        courseId,
        actionUrl: `${process.env.FRONTEND_URL}/courses/${courseId}`,
      },
    });
  }

  /**
   * Send course completion notification
   */
  async sendCompletionNotification(userId: string, courseTitle: string, courseId: string) {
    await this.sendNotification({
      userId,
      type: 'email',
      title: `Congratulations! You completed ${courseTitle}`,
      message: `Amazing work! You've completed all lessons in ${courseTitle}. Download your certificate now.`,
      data: {
        type: 'completion',
        courseId,
        actionUrl: `${process.env.FRONTEND_URL}/courses/${courseId}/certificate`,
      },
    });
  }

  /**
   * Send instructor notification for new student
   */
  async sendNewStudentNotification(instructorId: string, studentName: string, courseTitle: string) {
    await this.sendNotification({
      userId: instructorId,
      type: 'in_app',
      title: 'New Student Enrolled',
      message: `${studentName} has enrolled in your course "${courseTitle}"`,
      data: {
        type: 'new_student',
        studentName,
        courseTitle,
      },
    });
  }
}

export const notificationService = new NotificationService();
