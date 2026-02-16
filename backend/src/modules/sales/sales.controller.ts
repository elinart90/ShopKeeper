import { Request, Response, NextFunction } from 'express';
import { SalesService } from './sales.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const salesService = new SalesService();

export class SalesController {
  async createSale(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const sale = await salesService.createSale(req.shopId, req.userId, req.body);
      res.status(201).json({ success: true, data: sale });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getSales(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const sales = await salesService.getSales(req.shopId, req.query as any);
      res.json({ success: true, data: sales });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const sale = await salesService.getSaleById(id);
      res.json({ success: true, data: sale });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getSalesSummary(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const summary = await salesService.getSalesSummary(
        req.shopId,
        req.query.startDate as string,
        req.query.endDate as string
      );
      res.json({ success: true, data: summary });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async cancelSale(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const { id } = req.params;
      const sale = await salesService.cancelSale(id, req.shopId, req.userId);
      res.json({ success: true, data: sale });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
