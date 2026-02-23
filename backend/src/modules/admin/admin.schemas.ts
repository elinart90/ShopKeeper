import { z } from 'zod';

const optionalDate = z.string().trim().optional();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const usersListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(['active', 'suspended', 'flagged']).optional(),
  role: z.string().trim().optional(),
  from: optionalDate,
  to: optionalDate,
});

export const shopsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  plan: z.enum(['small', 'medium', 'big', 'enterprise']).optional(),
  active: z
    .union([z.boolean(), z.string().trim().toLowerCase().transform((v) => v === 'true')])
    .optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user id'),
});

export const shopIdParamSchema = z.object({
  id: z.string().uuid('Invalid shop id'),
});

export const suspendBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const flagUserBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const assignPlanBodySchema = z.object({
  plan: z.enum(['small', 'medium', 'big', 'enterprise']),
});

export const loginHistoryQuerySchema = paginationQuerySchema;
export const userWorkspaceQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
  limit: z.coerce.number().int().min(1).max(300).default(100),
});

export const transactionsListQuerySchema = paginationQuerySchema.extend({
  from: optionalDate,
  to: optionalDate,
  shopId: z.string().uuid().optional(),
  cashierUserId: z.string().uuid().optional(),
  paymentMethod: z.string().trim().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const workerInsightsQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
});

export const adminAiIntelligenceQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
  rankBy: z.enum(['revenue', 'transactions', 'profit']).default('revenue'),
});

export const adminAiExecutiveSummaryEmailBodySchema = z.object({
  email: z.string().trim().email().optional(),
});

export const growthQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export const topProductsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const peakHoursQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export const userSaleActionParamsSchema = z.object({
  id: z.string().uuid('Invalid user id'),
  saleId: z.string().uuid('Invalid sale id'),
});

export const transactionSaleParamsSchema = z.object({
  saleId: z.string().uuid('Invalid sale id'),
});

export const managedUserActionParamsSchema = z.object({
  id: z.string().uuid('Invalid user id'),
  targetUserId: z.string().uuid('Invalid target user id'),
});

export const workerParamsSchema = z.object({
  userId: z.string().uuid('Invalid user id'),
});

export const revokeWorkerAccessBodySchema = z.object({
  shopId: z.string().uuid().optional(),
});

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  actorUserId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  from: optionalDate,
  to: optionalDate,
});

export const grantPlatformAdminBodySchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['super_admin', 'admin_analyst', 'admin_operator']),
});

export const setPlatformAdminStatusParamsSchema = z.object({
  userId: z.string().uuid('Invalid user id'),
});

export const setPlatformAdminStatusBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const updatePlatformAdminRoleBodySchema = z.object({
  role: z.enum(['super_admin', 'admin_analyst', 'admin_operator']),
});

export const securityThreatsQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24),
});

export const securitySessionsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  activeOnly: z.union([z.boolean(), z.string().trim().toLowerCase().transform((v) => v === 'true')]).default(true),
});

export const terminateSessionParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session id'),
});

export const terminateSessionBodySchema = z.object({
  reason: z.string().trim().min(2).max(200).optional(),
});

export const apiAccessLogsQuerySchema = paginationQuerySchema.extend({
  from: optionalDate,
  to: optionalDate,
  actorUserId: z.string().uuid().optional(),
  path: z.string().trim().optional(),
  method: z.string().trim().optional(),
  statusCode: z.coerce.number().int().min(100).max(599).optional(),
});

export const gdprDeleteUserBodySchema = z.object({
  userId: z.string().uuid('Invalid user id'),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const enforce2faBodySchema = z.object({
  thresholdAmount: z.coerce.number().min(0),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const monetizationBillingQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  plan: z.enum(['small', 'medium', 'big', 'enterprise']).optional(),
  status: z.enum(['inactive', 'active', 'past_due', 'expired', 'cancelled']).optional(),
  overdueOnly: z.union([z.boolean(), z.string().trim().toLowerCase().transform((v) => v === 'true')]).optional(),
});

export const monetizationSetPlanBodySchema = z.object({
  userId: z.string().uuid('Invalid user id'),
  planCode: z.enum(['small', 'medium', 'big', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

export const monetizationApplyPromoBodySchema = z.object({
  userId: z.string().uuid('Invalid user id'),
  code: z.string().trim().min(2).max(60),
});

export const monetizationCreatePromoBodySchema = z.object({
  code: z.string().trim().min(2).max(60),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.coerce.number().min(0),
  trialExtensionDays: z.coerce.number().int().min(0).max(365).default(0),
  maxRedemptions: z.coerce.number().int().min(1).optional(),
  validFrom: z.string().trim().optional(),
  validTo: z.string().trim().optional(),
});

export const monetizationCommissionQuerySchema = z.object({
  month: z.string().trim().optional(), // YYYY-MM
  ratePercent: z.coerce.number().min(0).max(100).optional(),
});

export const monetizationForecastQuerySchema = z.object({
  months: z.coerce.number().int().min(3).max(12).default(12),
});

export const monetizationSuspendOverdueBodySchema = z.object({
  daysPastDue: z.coerce.number().int().min(1).max(180).default(7),
});
