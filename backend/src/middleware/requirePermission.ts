import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { ShopRequest } from './requireShop';
import { errorHandler, AppError } from './errorHandler';

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  manager: [
    'sales.create',
    'sales.cancel',
    'inventory.create',
    'inventory.update',
    'inventory.receive_stock',
    'customers.record_payment',
    'reports.view',
    'wallets.manage',
    'staff.view',
  ],
  cashier: [
    'sales.create',
    'customers.record_payment',
    'inventory.receive_stock',
    'staff.view',
  ],
  staff: [
    'sales.create',
    'staff.view',
  ],
};

function hasDefaultPermission(role: string | undefined, permissionKey: string) {
  const defaults = DEFAULT_ROLE_PERMISSIONS[(role || 'staff').toLowerCase()] || [];
  return defaults.includes('*') || defaults.includes(permissionKey);
}

export function requirePermission(permissionKey: string) {
  return async (req: ShopRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      // Owner always has full permissions.
      if ((req.userRole || '').toLowerCase() === 'owner') {
        return next();
      }

      const defaultAllowed = hasDefaultPermission(req.userRole, permissionKey);

      const { data: override } = await supabase
        .from('staff_permissions')
        .select('allowed')
        .eq('shop_id', req.shopId)
        .eq('user_id', req.userId)
        .eq('permission_key', permissionKey)
        .maybeSingle();

      const finalAllowed = override?.allowed ?? defaultAllowed;
      if (!finalAllowed) {
        throw new AppError(`Permission denied: ${permissionKey}`, 403, 'PERMISSION_DENIED');
      }

      next();
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  };
}

export function getDefaultPermissionsForRole(role: string | undefined) {
  const key = (role || 'staff').toLowerCase();
  return DEFAULT_ROLE_PERMISSIONS[key] || DEFAULT_ROLE_PERMISSIONS.staff;
}
