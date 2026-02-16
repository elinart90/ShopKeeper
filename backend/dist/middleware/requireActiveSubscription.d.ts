import { Response, NextFunction } from 'express';
import { AuthRequest } from './requireAuth';
import { SubscriptionStatusResult } from '../modules/subscriptions/subscriptions.service';
export interface SubscriptionRequest extends AuthRequest {
    subscription?: SubscriptionStatusResult;
}
export declare function requireActiveSubscription(req: SubscriptionRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=requireActiveSubscription.d.ts.map