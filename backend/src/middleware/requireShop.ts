import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from './requireAuth';
import { errorHandler, AppError } from './errorHandler';

export interface ShopRequest extends AuthRequest {
  shopId?: string;
  userRole?: string;
}

export async function requireShop(
  req: ShopRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const shopId = req.headers['x-shop-id'] as string;

    if (!shopId) {
      throw new AppError('Shop ID is required', 400);
    }

    if (!req.userId) {
      throw new AppError('User ID is required', 401);
    }

    const { data: shop } = await supabase.from('shops').select('id, owner_id').eq('id', shopId).single();

    if (!shop) {
      throw new AppError('Shop not found', 404);
    }

    const isOwner = shop.owner_id === req.userId;
    const { data: member } = await supabase
      .from('shop_members')
      .select('role')
      .eq('shop_id', shopId)
      .eq('user_id', req.userId)
      .maybeSingle();

    if (!member && !isOwner) {
      throw new AppError('You do not have access to this shop', 403);
    }

    req.shopId = shopId;
    req.userRole = member?.role || (isOwner ? 'owner' : 'staff');

    next();
  } catch (error) {
    errorHandler(error as AppError, req, res, next);
  }
}
