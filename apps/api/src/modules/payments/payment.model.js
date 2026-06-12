import { prisma } from '../../server';
export class Payment {
    id;
    userId;
    courseId;
    amount;
    currency;
    status; // 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
    stripeSessionId;
    stripePaymentIntentId;
    createdAt;
    updatedAt;
    constructor(data) {
        this.id = data.id || crypto.randomUUID();
        this.userId = data.userId;
        this.courseId = data.courseId;
        this.amount = data.amount;
        this.currency = data.currency;
        this.status = data.status || 'PENDING';
        this.stripeSessionId = data.stripeSessionId;
        this.stripePaymentIntentId = data.stripePaymentIntentId;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }
    async save() {
        const payment = await prisma.payment.upsert({
            where: { id: this.id },
            update: {
                userId: this.userId,
                courseId: this.courseId,
                amount: this.amount,
                currency: this.currency,
                status: this.status,
                stripeSessionId: this.stripeSessionId,
                stripePaymentIntentId: this.stripePaymentIntentId,
                updatedAt: this.updatedAt = new Date(),
            },
            create: {
                id: this.id,
                userId: this.userId,
                courseId: this.courseId,
                amount: this.amount,
                currency: this.currency,
                status: this.status,
                stripeSessionId: this.stripeSessionId,
                stripePaymentIntentId: this.stripePaymentIntentId,
            },
        });
        Object.assign(this, payment);
        return this;
    }
    static async findById(id) {
        const payment = await prisma.payment.findUnique({ where: { id } });
        if (!payment)
            return null;
        return new Payment(payment);
    }
    static async findByUser(userId) {
        const payments = await prisma.payment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return payments.map(p => new Payment(p));
    }
    static async findByStripeSessionId(sessionId) {
        const payment = await prisma.payment.findFirst({
            where: { stripeSessionId: sessionId },
        });
        if (!payment)
            return null;
        return new Payment(payment);
    }
    toJSON() {
        const { ...safePayment } = this;
        return safePayment;
    }
}
//# sourceMappingURL=payment.model.js.map