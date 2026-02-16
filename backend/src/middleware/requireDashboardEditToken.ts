import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ShopRequest } from './requireShop';
import { errorHandler, AppError } from './errorHandler';

/**
 * Requires X-Dashboard-Edit-Token header with a valid JWT (purpose: dashboard_edit).
 * Use after requireAuth and requireShop so req.userId and req.shopId are set.
 */
export function requireDashboardEditToken(
  req: ShopRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers['x-dashboard-edit-token'] as string;
    if (!token) {
      const err = new Error('Dashboard edit token is required') as AppError;
      err.statusCode = 403;
      throw err;
    }
    const decoded = jwt.verify(token, env.jwtSecret) as {
      purpose?: string;
      shopId?: string;
      userId?: string;
    };
    if (decoded.purpose !== 'dashboard_edit') {
      const err = new Error('Invalid dashboard edit token') as AppError;
      err.statusCode = 403;
      throw err;
    }
    if (decoded.shopId !== req.shopId || decoded.userId !== req.userId) {
      const err = new Error('Dashboard edit token does not match this shop') as AppError;
      err.statusCode = 403;
      throw err;
    }
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      const err = new Error('Dashboard edit session expired. Enter password and PIN again.') as AppError;
      err.statusCode = 403;
      errorHandler(err, req, res, next);
      return;
    }
    errorHandler(error as AppError, req, res, next);
  }
}
