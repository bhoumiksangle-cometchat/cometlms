import { PaymentStatus } from '@prisma/client';
import { prisma } from '../../server';

export class Payment {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Payment> & {
    userId: string;
    courseId: string;
    amount: number;
    currency: string;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    this.courseId = data.courseId;
    this.amount = data.amount;
    this.currency = data.currency;
    this.status = data.status || 'PENDING';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save(): Promise<Payment> {
    const payment = await prisma.payment.upsert({
      where: { id: this.id },
      update: {
        userId: this.userId,
        courseId: this.courseId,
        amount: this.amount,
        currency: this.currency,
        status: this.status,
        updatedAt: this.updatedAt = new Date(),
      },
      create: {
        id: this.id,
        userId: this.userId,
        courseId: this.courseId,
        amount: this.amount,
        currency: this.currency,
        status: this.status,
      },
    });

    Object.assign(this, payment);
    return this;
  }

  static async findById(id: string): Promise<Payment | null> {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return null;
    return new Payment(payment);
  }

  static async findByUser(userId: string): Promise<Payment[]> {
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(p => new Payment(p));
  }

  toJSON() {
    const { ...safePayment } = this;
    return safePayment;
  }
}