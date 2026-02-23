import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError, errorHandler } from '../../middleware/errorHandler';
import { SuperAdminRequest } from '../../middleware/requireSuperAdmin';
import {
  apiAccessLogsQuerySchema,
  assignPlanBodySchema,
  adminAiExecutiveSummaryEmailBodySchema,
  adminAiIntelligenceQuerySchema,
  auditLogsQuerySchema,
  enforce2faBodySchema,
  flagUserBodySchema,
  gdprDeleteUserBodySchema,
  grantPlatformAdminBodySchema,
  growthQuerySchema,
  loginHistoryQuerySchema,
  managedUserActionParamsSchema,
  monetizationApplyPromoBodySchema,
  monetizationBillingQuerySchema,
  monetizationCommissionQuerySchema,
  monetizationCreatePromoBodySchema,
  monetizationForecastQuerySchema,
  monetizationSetPlanBodySchema,
  monetizationSuspendOverdueBodySchema,
  peakHoursQuerySchema,
  revokeWorkerAccessBodySchema,
  shopIdParamSchema,
  shopsListQuerySchema,
  setPlatformAdminStatusBodySchema,
  setPlatformAdminStatusParamsSchema,
  suspendBodySchema,
  terminateSessionBodySchema,
  terminateSessionParamsSchema,
  transactionsListQuerySchema,
  transactionSaleParamsSchema,
  topProductsQuerySchema,
  userSaleActionParamsSchema,
  updatePlatformAdminRoleBodySchema,
  userIdParamSchema,
  workerInsightsQuerySchema,
  workerParamsSchema,
  userWorkspaceQuerySchema,
  usersListQuerySchema,
  securitySessionsQuerySchema,
  securityThreatsQuerySchema,
} from './admin.schemas';
import { AdminService } from './admin.service';

const adminService = new AdminService();

export class AdminController {
  private parseOrThrow<T>(schema: z.ZodSchema<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AppError(first?.message || 'Invalid request payload', 400);
    }
    return parsed.data;
  }

  async getMe(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const profile = await adminService.getAdminProfile(req.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getPermissions(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      res.json({
        success: true,
        data: {
          userId: req.userId,
          role: req.adminRole,
          scopes: req.adminScopes || [],
        },
      });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listUsers(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const filters = this.parseOrThrow(usersListQuerySchema, req.query);
      const data = await adminService.listUsers(filters);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getUserById(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const data = await adminService.getUserById(id);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async suspendUser(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const body = this.parseOrThrow(suspendBodySchema, req.body);
      const data = await adminService.suspendUser(id, req.userId, body.reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async reactivateUser(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const data = await adminService.reactivateUser(id, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async forcePasswordReset(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const data = await adminService.forcePasswordReset(id, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getUserLoginHistory(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const pg = this.parseOrThrow(loginHistoryQuerySchema, req.query);
      const data = await adminService.getUserLoginHistory(id, pg.page, pg.limit);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getUserWorkspace(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const q = this.parseOrThrow(userWorkspaceQuerySchema, req.query);
      const data = await adminService.getUserWorkspace(id, q.from, q.to, q.limit);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async flagUser(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(userIdParamSchema, req.params);
      const body = this.parseOrThrow(flagUserBodySchema, req.body);
      const data = await adminService.flagUser(id, req.userId, body.reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async cancelUserWorkspaceSale(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id, saleId } = this.parseOrThrow(userSaleActionParamsSchema, req.params);
      const data = await adminService.cancelSaleFromUserWorkspace(id, saleId, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async deleteManagedUser(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id, targetUserId } = this.parseOrThrow(managedUserActionParamsSchema, req.params);
      const data = await adminService.deleteManagedUserAccess(id, targetUserId, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listShops(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const filters = this.parseOrThrow(shopsListQuerySchema, req.query);
      const data = await adminService.listShops(filters);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getShopById(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = this.parseOrThrow(shopIdParamSchema, req.params);
      const data = await adminService.getShopById(id);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async suspendShop(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(shopIdParamSchema, req.params);
      const data = await adminService.suspendShop(id, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async reactivateShop(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(shopIdParamSchema, req.params);
      const data = await adminService.reactivateShop(id, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async assignShopPlan(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { id } = this.parseOrThrow(shopIdParamSchema, req.params);
      const body = this.parseOrThrow(assignPlanBodySchema, req.body);
      const data = await adminService.assignShopPlan(id, body.plan, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getShopDrilldown(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const { id } = this.parseOrThrow(shopIdParamSchema, req.params);
      const data = await adminService.getShopDrilldown(id);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getAnalyticsOverview(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAnalyticsOverview();
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getAnalyticsGrowth(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(growthQuerySchema, req.query);
      const data = await adminService.getAnalyticsGrowth(q.days);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getAnalyticsTopProducts(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(topProductsQuerySchema, req.query);
      const data = await adminService.getTopProducts(q.days, q.limit);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getAnalyticsPeakHours(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(peakHoursQuerySchema, req.query);
      const data = await adminService.getPeakHours(q.days);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listAuditLogs(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const filters = this.parseOrThrow(auditLogsQuerySchema, req.query);
      const data = await adminService.listAuditLogs(filters);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listMonetizationBilling(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(monetizationBillingQuerySchema, req.query);
      const data = await adminService.listMonetizationBilling(q);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async setMonetizationPlan(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(monetizationSetPlanBodySchema, req.body);
      const data = await adminService.setShopOwnerPlan(body.userId, body.planCode, body.billingCycle, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async createMonetizationPromo(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(monetizationCreatePromoBodySchema, req.body);
      const data = await adminService.createPromoCode(body, req.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listMonetizationPromos(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const data = await adminService.listPromoCodes();
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async applyMonetizationPromo(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(monetizationApplyPromoBodySchema, req.body);
      const data = await adminService.applyPromoCodeToUser(body.userId, body.code, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getCommissionSummary(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(monetizationCommissionQuerySchema, req.query);
      const data = await adminService.getCommissionSummary(q.month, q.ratePercent);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getRevenueForecast(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(monetizationForecastQuerySchema, req.query);
      const data = await adminService.getRevenueForecast(q.months);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async suspendOverduePlans(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(monetizationSuspendOverdueBodySchema, req.body);
      const data = await adminService.runOverduePlanSuspension(body.daysPastDue, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getSecurityThreatDashboard(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(securityThreatsQuerySchema, req.query);
      const data = await adminService.getSecurityThreatDashboard({ hours: q.hours });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listSecuritySessions(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(securitySessionsQuerySchema, req.query);
      const data = await adminService.listPlatformSessions(q);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async terminateSecuritySession(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { sessionId } = this.parseOrThrow(terminateSessionParamsSchema, req.params);
      const body = this.parseOrThrow(terminateSessionBodySchema, req.body);
      const data = await adminService.terminatePlatformSession(sessionId, req.userId, body.reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listApiAccessLogs(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(apiAccessLogsQuerySchema, req.query);
      const data = await adminService.listApiAccessLogs(q);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async gdprDeleteUser(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(gdprDeleteUserBodySchema, req.body);
      const data = await adminService.executeGdprUserDeletion(body.userId, req.userId, body.reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async enforce2faPolicy(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(enforce2faBodySchema, req.body);
      const data = await adminService.enforce2faForHighVolumeOwners(body.thresholdAmount, body.days, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getAiIntelligence(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(adminAiIntelligenceQuerySchema, req.query);
      const data = await adminService.getAdminAiIntelligence(q.from, q.to, q.rankBy);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async emailAiExecutiveSummary(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(adminAiExecutiveSummaryEmailBodySchema, req.body);
      const data = await adminService.emailAdminAiExecutiveSummary(req.userId, body.email);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listGlobalTransactions(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const filters = this.parseOrThrow(transactionsListQuerySchema, req.query);
      const data = await adminService.listGlobalTransactions(filters);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async cancelGlobalTransactionSale(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { saleId } = this.parseOrThrow(transactionSaleParamsSchema, req.params);
      const data = await adminService.cancelSaleGlobal(saleId, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getWorkerInsights(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const q = this.parseOrThrow(workerInsightsQuerySchema, req.query);
      const data = await adminService.getCashierInsights(q.from, q.to);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async revokeWorkerAccess(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { userId } = this.parseOrThrow(workerParamsSchema, req.params);
      const body = this.parseOrThrow(revokeWorkerAccessBodySchema, req.body);
      const data = await adminService.revokeWorkerAccess(userId, req.userId, body.shopId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listPlatformAdmins(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      const data = await adminService.listPlatformAdmins();
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async grantPlatformAdmin(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const body = this.parseOrThrow(grantPlatformAdminBodySchema, req.body);
      const data = await adminService.grantPlatformAdminByEmail(body.email, body.role, req.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async updatePlatformAdminRole(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { userId } = this.parseOrThrow(setPlatformAdminStatusParamsSchema, req.params);
      const body = this.parseOrThrow(updatePlatformAdminRoleBodySchema, req.body);
      const data = await adminService.updatePlatformAdminRole(userId, body.role, req.userId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async deactivatePlatformAdmin(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { userId } = this.parseOrThrow(setPlatformAdminStatusParamsSchema, req.params);
      const body = this.parseOrThrow(setPlatformAdminStatusBodySchema, req.body);
      const data = await adminService.setPlatformAdminStatus(userId, false, req.userId, body.reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async reactivatePlatformAdmin(req: SuperAdminRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Unauthorized', 401);
      const { userId } = this.parseOrThrow(setPlatformAdminStatusParamsSchema, req.params);
      const body = this.parseOrThrow(setPlatformAdminStatusBodySchema, req.body);
      const data = await adminService.setPlatformAdminStatus(userId, true, req.userId, body.reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
