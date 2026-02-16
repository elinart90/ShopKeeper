import { Request, Response, NextFunction } from 'express';
/**
 * Paystack webhook handler. Must be mounted with express.raw({ type: 'application/json' })
 * so req.body is the raw Buffer for signature verification.
 */
export declare function paystackWebhook(req: Request & {
    body?: Buffer;
}, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=webhook.paystack.d.ts.map