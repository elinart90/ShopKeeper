import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';
import { getParam } from '../../utils/params';
import { logAuditAction } from '../controls/audit';

const inventoryService = new InventoryService();

export class InventoryController {
  async createProduct(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const product = await inventoryService.createProduct(req.shopId, req.userId, req.body);
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'inventory.create',
        entityType: 'product',
        entityId: product?.id,
        after: product,
      });
      res.status(201).json({ success: true, data: product });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getProducts(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const products = await inventoryService.getProducts(req.shopId, req.query as any);
      res.json({ success: true, data: products });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req, 'id');
      const product = await inventoryService.getProductById(id);
      res.json({ success: true, data: product });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getProductByBarcode(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const barcode = getParam(req, 'barcode');
      const product = await inventoryService.getProductByBarcode(req.shopId, barcode);

      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      res.json({ success: true, data: product });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async checkDuplicate(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const barcode = (req.query.barcode as string)?.trim() || undefined;
      const name = (req.query.name as string)?.trim() || undefined;
      const data = await inventoryService.checkDuplicate(req.shopId, barcode, name);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async receiveStock(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID required', 400);
      const id = getParam(req, 'id');
      const { quantity, note } = req.body || {};
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new AppError('Valid quantity required', 400);
      const product = await inventoryService.receiveStock(req.shopId, id, req.userId, qty, note);
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'inventory.receive_stock',
        entityType: 'product',
        entityId: id,
        metadata: { quantity: qty, note: note || null },
        after: product,
      });
      res.json({ success: true, data: product });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async updateProduct(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const id = getParam(req, 'id');
      const product = await inventoryService.updateProduct(id, req.shopId, req.userId, req.body);
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'inventory.update',
        entityType: 'product',
        entityId: id,
        after: product,
      });
      res.json({ success: true, data: product });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async deleteProduct(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }

      const id = getParam(req, 'id');
      await inventoryService.deleteProduct(id, req.shopId);
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'inventory.delete',
        entityType: 'product',
        entityId: id,
      });
      res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getLowStockProducts(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const products = await inventoryService.getLowStockProducts(req.shopId);
      res.json({ success: true, data: products });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getStockHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req, 'id');
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await inventoryService.getStockHistory(id, limit);
      res.json({ success: true, data: history });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  // Categories
  async createCategory(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const category = await inventoryService.createCategory(req.shopId, req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getCategories(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const categories = await inventoryService.getCategories(req.shopId);
      res.json({ success: true, data: categories });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
