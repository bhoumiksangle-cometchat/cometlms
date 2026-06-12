import { Payment } from './payment.model';
export declare class PaymentService {
    createCheckoutSession(userId: string, courseId: string): Promise<{
        id: string;
        url: string;
        amount: any;
        currency: any;
        courseTitle: any;
    }>;
    handleWebhook(payload: any, signature: string): Promise<{
        received: boolean;
    }>;
    getUserPayments(userId: string): Promise<Payment[]>;
}
//# sourceMappingURL=payment.service.d.ts.map