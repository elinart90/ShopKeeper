import { Response, NextFunction } from 'express';
import { ShopRequest } from './requireShop';
/**
 * Requires X-Dashboard-Edit-Token header with a valid JWT (purpose: dashboard_edit).
 * Use after requireAuth and requireShop so req.userId and req.shopId are set.
 */
export declare function requireDashboardEditToken(req: ShopRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=requireDashboardEditToken.d.ts.map