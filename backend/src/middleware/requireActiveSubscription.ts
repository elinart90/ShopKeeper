import { Response, NextFunction } from 'express';
import { AuthRequest } from './requireAuth';
import { errorHandler } from './errorHandler';
import { SubscriptionsService, SubscriptionStatusResult } from '../modules/subscriptions/subscriptions.service';

const subscriptionsService = new SubscriptionsService();

export interface SubscriptionRequest extends AuthRequest {
  subscription?: SubscriptionStatusResult;
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
    const shopIdHeader = req.headers['x-shop-id'];
    const shopId = typeof shopIdHeader === 'string' ? shopIdHeader : undefined;
    const status = await subscriptionsService.getStatus(req.userId, shopId);
    req.subscription = status;

    if (!status.isActive) {
      throw createHttpError(
        'Active monthly subscription is required to use this app',
        402,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    next();
  } catch (error) {
    errorHandler(error as Error, req, res, next);
  }
}
