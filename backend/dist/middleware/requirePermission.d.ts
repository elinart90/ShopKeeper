import { Response, NextFunction } from 'express';
import { ShopRequest } from './requireShop';
type Permission = 'read' | 'write' | 'delete' | 'admin';
export declare function requirePermission(permission: Permission): (req: ShopRequest, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=requirePermission.d.ts.map