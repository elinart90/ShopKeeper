import { Request, Response, NextFunction } from 'express';
import { SyncService } from './sync.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const syncService = new SyncService();

export class SyncController {
  async sync(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const result = await syncService.syncData(req.shopId, req.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
