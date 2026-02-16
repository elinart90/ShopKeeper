import { Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class DailyCloseController {
    create(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    approve(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    reject(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getByDate(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getRecent(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=daily-close.controller.d.ts.map