import { Response, NextFunction } from 'express';
import { DailyCloseService } from './daily-close.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';
import { getParam } from '../../utils/params';

const dailyCloseService = new DailyCloseService();

export class DailyCloseController {
  async create(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID required', 400);
      const data = await dailyCloseService.create(req.shopId, req.userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async approve(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID required', 400);
      const id = getParam(req, 'id');
      const data = await dailyCloseService.approve(req.shopId, req.userId, id);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async reject(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID required', 400);
      const id = getParam(req, 'id');
      const data = await dailyCloseService.reject(req.shopId, req.userId, id);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getByDate(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID required', 400);
      const date = req.query.date as string || new Date().toISOString().slice(0, 10);
      const data = await dailyCloseService.getByDate(req.shopId, date);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getRecent(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID required', 400);
      const data = await dailyCloseService.getRecent(req.shopId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
