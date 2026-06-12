import { prisma } from '../../server';
import { Payment } from './payment.model';
import { AppError } from '../../middleware/errorHandler';

export class PaymentService {
  public async createCheckoutSession(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Check if user is already enrolled
    const existing = await prisma.enrollment.findFirst({
      where: { userId, courseId },
    });
    if (existing) {
      throw new AppError('Already enrolled in this course', 400);
    }

    // Create payment record
    const payment = new Payment({
      userId,
      courseId,
      amount: course.price,
      currency: course.currency,
    });

    const saved = await payment.save();

    // In production, this would create a Stripe Checkout Session
    // For now, we'll simulate it
    return {
      id: saved.id,
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/checkout/${saved.id}`,
      amount: course.price,
      currency: course.currency,
      courseTitle: course.title,
    };
  }

  public async handleWebhook(payload: any, signature: string) {
    // In production, verify Stripe webhook signature
    // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    // Handle checkout.session.completed event
    if (payload.type === 'checkout.session.completed') {
      const session = payload.data.object;
      const payment = await Payment.findByStripeSessionId(session.id);

      if (payment) {
        payment.status = 'COMPLETED';
        await payment.save();

        // Create enrollment
        await prisma.enrollment.create({
          data: {
            userId: payment.userId,
            courseId: payment.courseId,
          },
        });

        // Add user to course chat room
        const course = await prisma.course.findUnique({
          where: { id: payment.courseId },
        });
        if (course?.chatRoomId) {
          await prisma.chatRoomMember.create({
            data: {
              roomId: course.chatRoomId,
              userId: payment.userId,
              role: 'member',
            },
          });
        }
      }
    }

    return { received: true };
  }

  public async getUserPayments(userId: string) {
    const payments = await Payment.findByUser(userId);
    return payments;
  }
}