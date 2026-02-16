export type UserRole = 'owner' | 'manager' | 'cashier' | 'staff';
export interface Permissions {
    canViewSales: boolean;
    canCreateSales: boolean;
    canModifySales: boolean;
    canViewInventory: boolean;
    canModifyInventory: boolean;
    canViewReports: boolean;
    canManageCustomers: boolean;
    canManageExpenses: boolean;
    canManageStaff: boolean;
    canManageSettings: boolean;
}
export declare function getPermissions(role: UserRole): Permissions;
//# sourceMappingURL=permissions.d.ts.map