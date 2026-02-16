import { Response, NextFunction } from 'express';
import { WalletsService } from './wallets.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const walletsService = new WalletsService();

export class WalletsController {
  async getWallets(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID required', 400);
      const data = await walletsService.getWallets(req.shopId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getTransactions(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID required', 400);
      const walletId = req.query.walletId as string | undefined;
      const data = await walletsService.getWalletTransactions(req.shopId, walletId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async adjustBalance(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID required', 400);
      const wallet = await walletsService.adjustBalance(req.shopId, req.userId, req.body);
      res.json({ success: true, data: wallet });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async transfer(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID required', 400);
      const result = await walletsService.transfer(req.shopId, req.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
