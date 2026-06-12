export declare class Payment {
    id: string;
    userId: string;
    courseId: string;
    amount: number;
    currency: string;
    status: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<Payment> & {
        userId: string;
        courseId: string;
        amount: number;
        currency: string;
    });
    save(): Promise<Payment>;
    static findById(id: string): Promise<Payment | null>;
    static findByUser(userId: string): Promise<Payment[]>;
    static findByStripeSessionId(sessionId: string): Promise<Payment | null>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
//# sourceMappingURL=payment.model.d.ts.map