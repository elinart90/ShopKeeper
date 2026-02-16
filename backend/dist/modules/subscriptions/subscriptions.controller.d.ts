import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/requireAuth';
export declare class SubscriptionsController {
    listPlans(req: AuthRequest, res: Response): void;
    getStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    initialize(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    verify(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=subscriptions.controller.d.ts.map