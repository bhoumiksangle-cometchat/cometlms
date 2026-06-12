import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';
import { AuthRequest } from '../../middleware/auth';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  public checkout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await this.paymentService.createCheckoutSession(
        req.user!.id,
        req.body.courseId
      );
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  };

  public webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const result = await this.paymentService.handleWebhook(
        req.body,
        sig
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  public getMyPayments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payments = await this.paymentService.getUserPayments(req.user!.id);
      res.status(200).json({ success: true, data: payments });
    } catch (error) {
      next(error);
    }
  };
}