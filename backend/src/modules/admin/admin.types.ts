export type UserAdminStatus = 'active' | 'suspended' | 'flagged';
export type ShopAdminPlan = 'small' | 'medium' | 'big' | 'enterprise';
export type PlatformAdminRole = 'super_admin' | 'admin_analyst' | 'admin_operator';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminListUsersFilters extends PaginationInput {
  search?: string;
  status?: UserAdminStatus;
  role?: string;
  from?: string;
  to?: string;
}

export interface AdminListShopsFilters extends PaginationInput {
  search?: string;
  plan?: ShopAdminPlan;
  active?: boolean;
}

export interface AdminListAuditLogFilters extends PaginationInput {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
}

export interface AdminActionResult {
  success: boolean;
  message: string;
}

export interface AdminSecurityThreatsFilters {
  hours?: number;
}

export interface AdminSecuritySessionsFilters extends PaginationInput {
  search?: string;
  activeOnly?: boolean;
}

export interface AdminApiAccessLogsFilters extends PaginationInput {
  from?: string;
  to?: string;
  actorUserId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
}

export interface AdminMonetizationBillingFilters extends PaginationInput {
  search?: string;
  plan?: ShopAdminPlan;
  status?: 'inactive' | 'active' | 'past_due' | 'expired' | 'cancelled';
  overdueOnly?: boolean;
}
