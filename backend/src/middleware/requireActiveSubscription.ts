import { Response, NextFunction } from 'express';
import { AuthRequest } from './requireAuth';
import { errorHandler } from './errorHandler';
import { SubscriptionStatusResult } from '../modules/subscriptions/subscriptions.service';

export interface SubscriptionRequest extends AuthRequest {
  subscription?: SubscriptionStatusResult;
  subscriptionUserId?: string;
}

function createHttpError(message: string, statusCode: number, code?: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export async function requireActiveSubscription(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) throw createHttpError('Unauthorized', 401);
    // Subscription enforcement removed: authenticated users can access app features without active plan.
    req.subscription = {
      hasPlan: false,
      status: 'inactive',
      isActive: true,
    };
    req.subscriptionUserId = req.userId;

    next();
  } catch (error) {
    errorHandler(error as Error, req, res, next);
  }
}
