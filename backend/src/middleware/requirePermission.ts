import { Request, Response, NextFunction } from 'express';
import { ShopRequest } from './requireShop';
import { errorHandler, AppError } from './errorHandler';

type Permission = 'read' | 'write' | 'delete' | 'admin';

const rolePermissions: Record<string, Permission[]> = {
  owner: ['read', 'write', 'delete', 'admin'],
  manager: ['read', 'write'],
  cashier: ['read', 'write'],
  staff: ['read'],
};

export function requirePermission(permission: Permission) {
  return (req: ShopRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.userRole || 'staff';
      const permissions = rolePermissions[role] || [];

      if (!permissions.includes(permission)) {
        throw new AppError(
          `You do not have permission to ${permission}`,
          403
        );
      }

      next();
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  };
}
