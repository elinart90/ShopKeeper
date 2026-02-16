import { Response, NextFunction } from 'express';
import { ShopRequest } from './requireShop';
import { AppError, errorHandler } from './errorHandler';

/**
 * Restrict route to shop owner only. Use after requireShop.
 * Cashiers and managers get 403.
 */
export function requireOwner(req: ShopRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'owner') {
    return errorHandler(
      new AppError('Only the shop owner can access this', 403) as AppError,
      req,
      res,
      next
    );
  }
  next();
}
