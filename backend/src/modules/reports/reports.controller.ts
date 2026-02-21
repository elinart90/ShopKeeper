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

  async getNaturalLanguageReport(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const query = String(req.body?.query || '').trim();
      if (!query) throw new AppError('query is required', 400);
      const language = String(req.body?.language || '').trim().toLowerCase();
      const data = await reportsService.getNaturalLanguageReport(
        req.shopId,
        req.userId,
        query,
        language === 'auto' ? 'auto' : language === 'twi' ? 'twi' : 'en'
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getBusinessIntelligence(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const period = String(req.query.period || 'daily').toLowerCase();
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        throw new AppError('Invalid period. Use daily, weekly, or monthly', 400);
      }
      const data = await reportsService.getBusinessIntelligence(
        req.shopId,
        req.userId,
        period as 'daily' | 'weekly' | 'monthly'
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async queryBusinessIntelligence(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const query = String(req.body?.query || '').trim();
      if (!query) throw new AppError('query is required', 400);
      const period = String(req.body?.period || 'daily').toLowerCase();
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        throw new AppError('Invalid period. Use daily, weekly, or monthly', 400);
      }
      const data = await reportsService.queryBusinessIntelligence(
        req.shopId,
        req.userId,
        query,
        period as 'daily' | 'weekly' | 'monthly'
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getInventoryStockIntelligence(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const period = String(req.query.period || 'weekly').toLowerCase();
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        throw new AppError('Invalid period. Use daily, weekly, or monthly', 400);
      }
      const data = await reportsService.getInventoryStockIntelligence(
        req.shopId,
        req.userId,
        period as 'daily' | 'weekly' | 'monthly'
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async queryInventoryStockIntelligence(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const query = String(req.body?.query || '').trim();
      if (!query) throw new AppError('query is required', 400);
      const period = String(req.body?.period || 'weekly').toLowerCase();
      if (!['daily', 'weekly', 'monthly'].includes(period)) {
        throw new AppError('Invalid period. Use daily, weekly, or monthly', 400);
      }
      const data = await reportsService.queryInventoryStockIntelligence(
        req.shopId,
        req.userId,
        query,
        period as 'daily' | 'weekly' | 'monthly'
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
