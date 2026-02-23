import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { AdminController } from './admin.controller';
import { ADMIN_SCOPES } from './admin.permissions';

const router = Router();
const controller = new AdminController();

router.use(requireAuth);

// Admin access/profile
router.get('/me', requireSuperAdmin(ADMIN_SCOPES.DASHBOARD_READ), (req, res, next) => controller.getMe(req, res, next));
router.get('/permissions', requireSuperAdmin(ADMIN_SCOPES.DASHBOARD_READ), (req, res, next) => controller.getPermissions(req, res, next));
router.get('/platform-admins', requireSuperAdmin(ADMIN_SCOPES.PLATFORM_ADMINS_READ), (req, res, next) => controller.listPlatformAdmins(req, res, next));
router.post('/platform-admins/grant', requireSuperAdmin(ADMIN_SCOPES.PLATFORM_ADMINS_MANAGE), (req, res, next) => controller.grantPlatformAdmin(req, res, next));
router.patch('/platform-admins/:userId/role', requireSuperAdmin(ADMIN_SCOPES.PLATFORM_ADMINS_MANAGE), (req, res, next) => controller.updatePlatformAdminRole(req, res, next));
router.post('/platform-admins/:userId/deactivate', requireSuperAdmin(ADMIN_SCOPES.PLATFORM_ADMINS_MANAGE), (req, res, next) => controller.deactivatePlatformAdmin(req, res, next));
router.post('/platform-admins/:userId/reactivate', requireSuperAdmin(ADMIN_SCOPES.PLATFORM_ADMINS_MANAGE), (req, res, next) => controller.reactivatePlatformAdmin(req, res, next));

// User management
router.get('/users', requireSuperAdmin(ADMIN_SCOPES.USERS_READ), (req, res, next) => controller.listUsers(req, res, next));
router.get('/users/:id', requireSuperAdmin(ADMIN_SCOPES.USERS_READ), (req, res, next) => controller.getUserById(req, res, next));
router.post('/users/:id/suspend', requireSuperAdmin(ADMIN_SCOPES.USERS_MANAGE), (req, res, next) => controller.suspendUser(req, res, next));
router.post('/users/:id/reactivate', requireSuperAdmin(ADMIN_SCOPES.USERS_MANAGE), (req, res, next) => controller.reactivateUser(req, res, next));
router.post('/users/:id/force-password-reset', requireSuperAdmin(ADMIN_SCOPES.USERS_MANAGE), (req, res, next) => controller.forcePasswordReset(req, res, next));
router.get('/users/:id/login-history', requireSuperAdmin(ADMIN_SCOPES.USERS_READ), (req, res, next) => controller.getUserLoginHistory(req, res, next));
router.get('/users/:id/workspace', requireSuperAdmin(ADMIN_SCOPES.USERS_READ), (req, res, next) => controller.getUserWorkspace(req, res, next));
router.post('/users/:id/flag', requireSuperAdmin(ADMIN_SCOPES.USERS_MANAGE), (req, res, next) => controller.flagUser(req, res, next));
router.post('/users/:id/sales/:saleId/cancel', requireSuperAdmin(ADMIN_SCOPES.SHOPS_MANAGE), (req, res, next) => controller.cancelUserWorkspaceSale(req, res, next));
router.delete('/users/:id/managed-users/:targetUserId', requireSuperAdmin(ADMIN_SCOPES.USERS_MANAGE), (req, res, next) => controller.deleteManagedUser(req, res, next));

// Global transactions + worker intelligence
router.get('/transactions', requireSuperAdmin(ADMIN_SCOPES.WORKERS_READ), (req, res, next) => controller.listGlobalTransactions(req, res, next));
router.post('/transactions/:saleId/cancel', requireSuperAdmin(ADMIN_SCOPES.SHOPS_MANAGE), (req, res, next) => controller.cancelGlobalTransactionSale(req, res, next));
router.get('/workers/insights', requireSuperAdmin(ADMIN_SCOPES.WORKERS_READ), (req, res, next) => controller.getWorkerInsights(req, res, next));
router.post('/workers/:userId/revoke-access', requireSuperAdmin(ADMIN_SCOPES.WORKERS_MANAGE), (req, res, next) => controller.revokeWorkerAccess(req, res, next));

// AI-powered admin intelligence (Claude primary, OpenAI fallback)
router.get('/ai-intelligence', requireSuperAdmin(ADMIN_SCOPES.ANALYTICS_READ), (req, res, next) => controller.getAiIntelligence(req, res, next));
router.post('/ai-intelligence/executive-summary/email', requireSuperAdmin(ADMIN_SCOPES.ANALYTICS_READ), (req, res, next) =>
  controller.emailAiExecutiveSummary(req, res, next)
);

// Shop management
router.get('/shops', requireSuperAdmin(ADMIN_SCOPES.SHOPS_READ), (req, res, next) => controller.listShops(req, res, next));
router.get('/shops/:id', requireSuperAdmin(ADMIN_SCOPES.SHOPS_READ), (req, res, next) => controller.getShopById(req, res, next));
router.post('/shops/:id/suspend', requireSuperAdmin(ADMIN_SCOPES.SHOPS_MANAGE), (req, res, next) => controller.suspendShop(req, res, next));
router.post('/shops/:id/reactivate', requireSuperAdmin(ADMIN_SCOPES.SHOPS_MANAGE), (req, res, next) => controller.reactivateShop(req, res, next));
router.post('/shops/:id/assign-plan', requireSuperAdmin(ADMIN_SCOPES.SHOPS_MANAGE), (req, res, next) => controller.assignShopPlan(req, res, next));
router.get('/shops/:id/drilldown', requireSuperAdmin(ADMIN_SCOPES.SHOPS_READ), (req, res, next) => controller.getShopDrilldown(req, res, next));

// Platform analytics
router.get('/analytics/overview', requireSuperAdmin(ADMIN_SCOPES.ANALYTICS_READ), (req, res, next) => controller.getAnalyticsOverview(req, res, next));
router.get('/analytics/growth', requireSuperAdmin(ADMIN_SCOPES.ANALYTICS_READ), (req, res, next) => controller.getAnalyticsGrowth(req, res, next));
router.get('/analytics/top-products', requireSuperAdmin(ADMIN_SCOPES.ANALYTICS_READ), (req, res, next) => controller.getAnalyticsTopProducts(req, res, next));
router.get('/analytics/peak-hours', requireSuperAdmin(ADMIN_SCOPES.ANALYTICS_READ), (req, res, next) => controller.getAnalyticsPeakHours(req, res, next));

// Audit logs
router.get('/audit-logs', requireSuperAdmin(ADMIN_SCOPES.AUDIT_READ), (req, res, next) => controller.listAuditLogs(req, res, next));

// Advanced security and compliance
router.get('/security/threats', requireSuperAdmin(ADMIN_SCOPES.SECURITY_READ), (req, res, next) => controller.getSecurityThreatDashboard(req, res, next));
router.get('/security/sessions', requireSuperAdmin(ADMIN_SCOPES.SECURITY_READ), (req, res, next) => controller.listSecuritySessions(req, res, next));
router.post('/security/sessions/:sessionId/terminate', requireSuperAdmin(ADMIN_SCOPES.SECURITY_MANAGE), (req, res, next) =>
  controller.terminateSecuritySession(req, res, next)
);
router.get('/security/api-access-logs', requireSuperAdmin(ADMIN_SCOPES.SECURITY_READ), (req, res, next) => controller.listApiAccessLogs(req, res, next));
router.post('/privacy/gdpr-delete-user', requireSuperAdmin(ADMIN_SCOPES.PRIVACY_MANAGE), (req, res, next) => controller.gdprDeleteUser(req, res, next));
router.post('/security/enforce-2fa', requireSuperAdmin(ADMIN_SCOPES.SECURITY_MANAGE), (req, res, next) => controller.enforce2faPolicy(req, res, next));

// Advanced monetization controls
router.get('/monetization/billing', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_READ), (req, res, next) => controller.listMonetizationBilling(req, res, next));
router.post('/monetization/set-plan', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_MANAGE), (req, res, next) => controller.setMonetizationPlan(req, res, next));
router.get('/monetization/promos', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_READ), (req, res, next) => controller.listMonetizationPromos(req, res, next));
router.post('/monetization/promos', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_MANAGE), (req, res, next) => controller.createMonetizationPromo(req, res, next));
router.post('/monetization/promos/apply', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_MANAGE), (req, res, next) => controller.applyMonetizationPromo(req, res, next));
router.get('/monetization/commissions', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_READ), (req, res, next) => controller.getCommissionSummary(req, res, next));
router.get('/monetization/forecast', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_READ), (req, res, next) => controller.getRevenueForecast(req, res, next));
router.post('/monetization/suspend-overdue', requireSuperAdmin(ADMIN_SCOPES.MONETIZATION_MANAGE), (req, res, next) => controller.suspendOverduePlans(req, res, next));

export default router;
