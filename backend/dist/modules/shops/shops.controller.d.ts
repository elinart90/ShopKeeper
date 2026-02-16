import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/requireAuth';
import { ShopRequest } from '../../middleware/requireShop';
export declare class ShopsController {
    createShop(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getShop(req: Request, res: Response, next: NextFunction): Promise<void>;
    getUserShops(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateShop(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteShop(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addMember(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    getShopMembers(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    removeMember(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    transferOwnership(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    requestClearDataPin(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    confirmDashboardEdit(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    clearDashboardData(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
    resetDashboardView(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=shops.controller.d.ts.map