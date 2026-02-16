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

export function getPermissions(role: UserRole): Permissions {
  const basePermissions: Permissions = {
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
