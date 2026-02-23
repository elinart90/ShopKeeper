import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from './requireAuth';
import { AppError, errorHandler } from './errorHandler';
import { ADMIN_ROLE_SCOPES, ADMIN_SCOPES, AdminRole, AdminScope } from '../modules/admin/admin.permissions';
import { logger } from '../utils/logger';

export interface SuperAdminRequest extends AuthRequest {
  adminRole?: AdminRole;
  adminScopes?: AdminScope[];
}

function hasScope(scopes: ReadonlyArray<string>, permissionKey: string): boolean {
  if (scopes.includes(ADMIN_SCOPES.ALL)) return true;
  if (scopes.includes(permissionKey)) return true;
  return scopes.some((scope) => scope.endsWith('.*') && permissionKey.startsWith(scope.slice(0, -2)));
}

export function requireSuperAdmin(permissionKey?: string) {
  return async (req: SuperAdminRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { data: admin, error } = await supabase
        .from('platform_admins')
        .select('role, is_active')
        .eq('user_id', req.userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        logger.error('requireSuperAdmin failed querying platform_admins', {
          userId: req.userId,
          code: (error as any)?.code,
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        });

        const code = String((error as any)?.code || '');
        if (code === '42P01') {
          throw new AppError(
            'Platform admin table not found. Run the super-admin migrations first.',
            500,
            'PLATFORM_ADMINS_TABLE_MISSING'
          );
        }

        throw new AppError('Failed to validate platform admin access', 500);
      }
      if (!admin) {
        throw new AppError('Forbidden: Super admin access required', 403);
      }

      const role = String(admin.role || '') as AdminRole;
      const scopes = ADMIN_ROLE_SCOPES[role] || [];

      if (permissionKey && !hasScope(scopes, permissionKey)) {
        throw new AppError(`Forbidden: Missing admin scope ${permissionKey}`, 403, 'ADMIN_SCOPE_DENIED');
      }

      req.adminRole = role;
      req.adminScopes = scopes;
      next();
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  };
}
