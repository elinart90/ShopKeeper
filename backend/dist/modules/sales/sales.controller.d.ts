import { Request, Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class SalesController {
    createSale(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getSales(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getSale(req: Request, res: Response, next: NextFunction): Promise<void>;
    getSalesSummary(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getGoodsSoldSummary(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    cancelSale(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    returnSaleItem(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    createPartialRefund(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=sales.controller.d.ts.map