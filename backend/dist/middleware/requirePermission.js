"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
const errorHandler_1 = require("./errorHandler");
const rolePermissions = {
    owner: ['read', 'write', 'delete', 'admin'],
    manager: ['read', 'write'],
    cashier: ['read', 'write'],
    staff: ['read'],
};
function requirePermission(permission) {
    return (req, res, next) => {
        try {
            const role = req.userRole || 'staff';
            const permissions = rolePermissions[role] || [];
            if (!permissions.includes(permission)) {
                throw new errorHandler_1.AppError(`You do not have permission to ${permission}`, 403);
            }
            next();
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    };
}
//# sourceMappingURL=requirePermission.js.map