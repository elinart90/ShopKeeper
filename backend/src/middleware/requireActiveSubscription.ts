import { Response, NextFunction } from 'express';
import { AuthRequest } from './requireAuth';
import { errorHandler } from './errorHandler';
import { SubscriptionsService, SubscriptionStatusResult } from '../modules/subscriptions/subscriptions.service';
import { supabase } from '../config/supabase';

const subscriptionsService = new SubscriptionsService();

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

    // Platform admins should never be blocked by tenant subscription checks.
    const { data: platformAdmin } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .maybeSingle();
    if (platformAdmin?.user_id) {
      return next();
    }

    const shopIdHeader = req.headers['x-shop-id'];
    const shopId = typeof shopIdHeader === 'string' ? shopIdHeader : undefined;
    let subscriptionUserId = req.userId;

    // If user is a member (not owner) in the selected shop, validate owner's subscription instead.
    if (shopId) {
      const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).maybeSingle();
      const ownerId = String((shop as any)?.owner_id || '');
      if (ownerId && ownerId !== req.userId) {
        const { data: member } = await supabase.from('shop_members').select('id').eq('shop_id', shopId).eq('user_id', req.userId).maybeSingle();
        if (member) {
          subscriptionUserId = ownerId;
        }
      }
    }

    const status = await subscriptionsService.getStatus(subscriptionUserId);
    req.subscription = status;
    req.subscriptionUserId = subscriptionUserId;

    if (!status.isActive) {
      throw createHttpError(
        subscriptionUserId === req.userId
          ? 'Active monthly subscription is required to use this app'
          : 'Active owner subscription is required to use this shop',
        402,
        'SUBSCRIPTION_REQUIRED'
      );
    }

    next();
  } catch (error) {
    errorHandler(error as Error, req, res, next);
  }
}
