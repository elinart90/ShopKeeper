import { Response, NextFunction } from 'express';
import { AuthRequest } from './requireAuth';
export interface ShopRequest extends AuthRequest {
    shopId?: string;
    userRole?: string;
}
export declare function requireShop(req: ShopRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=requireShop.d.ts.map