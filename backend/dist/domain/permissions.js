"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPermissions = getPermissions;
function getPermissions(role) {
    const basePermissions = {
        canViewSales: true,
        canCreateSales: true,
        canModifySales: false,
        canViewInventory: true,
        canModifyInventory: false,
        canViewReports: true,
        canManageCustomers: false,
        canManageExpenses: false,
        canManageStaff: false,
        canManageSettings: false,
    };
    switch (role) {
        case 'owner':
            return {
                ...basePermissions,
                canModifySales: true,
                canModifyInventory: true,
                canManageCustomers: true,
                canManageExpenses: true,
                canManageStaff: true,
                canManageSettings: true,
            };
        case 'manager':
            return {
                ...basePermissions,
                canModifySales: true,
                canModifyInventory: true,
                canManageCustomers: true,
                canManageExpenses: true,
                canManageStaff: false,
                canManageSettings: false,
            };
        case 'cashier':
            return {
                ...basePermissions,
                canCreateSales: true,
                canViewInventory: true,
                canManageCustomers: true,
            };
        case 'staff':
        default:
            return basePermissions;
    }
}
//# sourceMappingURL=permissions.js.map