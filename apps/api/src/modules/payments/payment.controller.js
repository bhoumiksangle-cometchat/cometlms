import { PaymentService } from './payment.service';
export class PaymentController {
    paymentService;
    constructor() {
        this.paymentService = new PaymentService();
    }
    checkout = async (req, res, next) => {
        try {
            const session = await this.paymentService.createCheckoutSession(req.user.id, req.body.courseId);
            res.status(200).json({ success: true, data: session });
        }
        catch (error) {
            next(error);
        }
    };
    webhook = async (req, res, next) => {
        try {
            const sig = req.headers['stripe-signature'];
            const result = await this.paymentService.handleWebhook(req.body, sig);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    };
    getMyPayments = async (req, res, next) => {
        try {
            const payments = await this.paymentService.getUserPayments(req.user.id);
            res.status(200).json({ success: true, data: payments });
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=payment.controller.js.map