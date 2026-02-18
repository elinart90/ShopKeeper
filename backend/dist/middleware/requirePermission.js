"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.getDefaultPermissionsForRole = getDefaultPermissionsForRole;
const supabase_1 = require("../config/supabase");
const errorHandler_1 = require("./errorHandler");
const DEFAULT_ROLE_PERMISSIONS = {
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
function hasDefaultPermission(role, permissionKey) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[(role || 'staff').toLowerCase()] || [];
    return defaults.includes('*') || defaults.includes(permissionKey);
}
function requirePermission(permissionKey) {
    return async (req, res, next) => {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            // Owner always has full permissions.
            if ((req.userRole || '').toLowerCase() === 'owner') {
                return next();
            }
            const defaultAllowed = hasDefaultPermission(req.userRole, permissionKey);
            const { data: override } = await supabase_1.supabase
                .from('staff_permissions')
                .select('allowed')
                .eq('shop_id', req.shopId)
                .eq('user_id', req.userId)
                .eq('permission_key', permissionKey)
                .maybeSingle();
            const finalAllowed = override?.allowed ?? defaultAllowed;
            if (!finalAllowed) {
                throw new errorHandler_1.AppError(`Permission denied: ${permissionKey}`, 403, 'PERMISSION_DENIED');
            }
            next();
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    };
}
function getDefaultPermissionsForRole(role) {
    const key = (role || 'staff').toLowerCase();
    return DEFAULT_ROLE_PERMISSIONS[key] || DEFAULT_ROLE_PERMISSIONS.staff;
}
//# sourceMappingURL=requirePermission.js.map