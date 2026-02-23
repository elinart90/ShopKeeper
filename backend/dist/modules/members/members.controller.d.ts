import { Request, Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class MembersController {
    createCustomer(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getCustomers(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getCustomer(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateCustomer(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getCreditSummary(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    recordPayment(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getCreditIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    queryCreditIntelligence(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    runAutoCreditReminders(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=members.controller.d.ts.map