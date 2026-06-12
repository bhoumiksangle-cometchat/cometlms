import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class PaymentController {
    private paymentService;
    constructor();
    checkout: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    webhook: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getMyPayments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=payment.controller.d.ts.map