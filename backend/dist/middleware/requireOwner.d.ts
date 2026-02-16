import { Response, NextFunction } from 'express';
import { ShopRequest } from './requireShop';
/**
 * Restrict route to shop owner only. Use after requireShop.
 * Cashiers and managers get 403.
 */
export declare function requireOwner(req: ShopRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=requireOwner.d.ts.map