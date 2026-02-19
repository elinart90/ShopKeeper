import { Request, Response, NextFunction } from 'express';
import { SalesService } from './sales.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';
import { getParam } from '../../utils/params';
import { logAuditAction } from '../controls/audit';

const salesService = new SalesService();

export class SalesController {
  async createSale(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const sale = await salesService.createSale(req.shopId, req.userId, req.body);
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'sale.create',
        entityType: 'sale',
        entityId: sale?.id,
        after: sale,
      });
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
      const id = getParam(req, 'id');
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

  async getGoodsSoldSummary(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }
      const data = await salesService.getGoodsSoldSummary(
        req.shopId,
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async cancelSale(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const id = getParam(req, 'id');
      const sale = await salesService.cancelSale(id, req.shopId, req.userId);
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'sale.cancel',
        entityType: 'sale',
        entityId: id,
        after: sale,
      });
      res.json({ success: true, data: sale });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async returnSaleItem(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const id = getParam(req, 'id');
      const saleItemId = String(req.body?.sale_item_id || '');
      const quantity = Number(req.body?.quantity);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      if (!saleItemId) throw new AppError('sale_item_id is required', 400);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError('Valid quantity is required', 400);
      const sale = await salesService.returnSaleItem(id, req.shopId, req.userId, {
        sale_item_id: saleItemId,
        quantity,
        reason,
      });
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'sale.return_item',
        entityType: 'sale',
        entityId: id,
        metadata: { sale_item_id: saleItemId, quantity, reason: reason || null },
        after: sale,
      });
      res.json({ success: true, data: sale });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async createPartialRefund(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const id = getParam(req, 'id');
      const amount = Number(req.body?.amount);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Valid amount is required', 400);
      const sale = await salesService.createPartialRefund(id, req.shopId, req.userId, { amount, reason });
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'sale.partial_refund',
        entityType: 'sale',
        entityId: id,
        metadata: { amount, reason: reason || null },
        after: sale,
      });
      res.json({ success: true, data: sale });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
