import { Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
export declare class WalletsController {
    getWallets(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getTransactions(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    adjustBalance(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    transfer(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=wallets.controller.d.ts.map