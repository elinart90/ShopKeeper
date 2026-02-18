import { Response, NextFunction } from 'express';
import { ShopRequest } from './requireShop';
export declare function requirePermission(permissionKey: string): (req: ShopRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function getDefaultPermissionsForRole(role: string | undefined): string[];
//# sourceMappingURL=requirePermission.d.ts.map