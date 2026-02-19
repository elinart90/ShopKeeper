import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const reportsService = new ReportsService();

export class ReportsController {
  async getDashboardStats(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const stats = await reportsService.getDashboardStats(
        req.shopId,
        req.query.startDate as string,
        req.query.endDate as string
      );
      res.json({ success: true, data: stats });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getSalesIntelligence(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await reportsService.getSalesIntelligence(
        req.shopId,
        req.query.startDate as string,
        req.query.endDate as string
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getInventoryFinance(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const deadStockDays = req.query.days ? Number(req.query.days) : 30;
      const data = await reportsService.getInventoryFinance(req.shopId, deadStockDays);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getExpensesProfit(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await reportsService.getExpensesProfitReport(
        req.shopId,
        req.query.startDate as string,
        req.query.endDate as string
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getComplianceExport(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const type = (req.query.type as string) || 'daily';
      if (!['daily', 'weekly', 'monthly', 'pl', 'tax'].includes(type)) {
        throw new AppError('Invalid type. Use: daily, weekly, monthly, pl, tax', 400);
      }
      const data = await reportsService.getComplianceExport(req.shopId, type as 'daily' | 'weekly' | 'monthly' | 'pl' | 'tax', {
        date: req.query.date as string,
        week: req.query.week as string,
        month: req.query.month as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
