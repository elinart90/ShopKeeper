import { Request, Response, NextFunction } from 'express';
import { ShopsService } from './shops.service';
import { AuthRequest } from '../../middleware/requireAuth';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';
import { getParam } from '../../utils/params';

const shopsService = new ShopsService();

export class ShopsController {
  async createShop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AppError('User ID is required', 401);
      }
      const shop = await shopsService.createShop(req.userId, req.body);
      res.status(201).json({ success: true, data: shop });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getShop(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req, 'id');
      const shop = await shopsService.getShopById(id);
      res.json({ success: true, data: shop });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getUserShops(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AppError('User ID is required', 401);
      }
      const shops = await shopsService.getUserShops(req.userId);
      res.json({ success: true, data: shops });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async updateShop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AppError('User ID is required', 401);
      }
      const id = getParam(req, 'id');
      const shop = await shopsService.updateShop(id, req.userId, req.body);
      res.json({ success: true, data: shop });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async deleteShop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AppError('User ID is required', 401);
      }
      const id = getParam(req, 'id');
      await shopsService.deleteShop(id, req.userId);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async addMember(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const { email, name, password, role } = req.body;
      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }
      const result = await shopsService.addMember(req.shopId, req.userId, {
        email,
        name,
        password,
        role: role || 'staff',
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getShopMembers(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const members = await shopsService.getShopMembers(req.shopId, req.userId);
      res.json({ success: true, data: members });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async removeMember(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const memberUserId = getParam(req, 'userId');
      if (!memberUserId) throw new AppError('Member user ID is required', 400);
      await shopsService.removeMember(req.shopId, memberUserId, req.userId);
      res.json({ success: true, data: { removed: true } });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async transferOwnership(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const { newOwnerUserId } = req.body;
      if (!newOwnerUserId) throw new AppError('newOwnerUserId is required', 400);
      const result = await shopsService.transferOwnership(req.shopId, newOwnerUserId, req.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async requestClearDataPin(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const { password } = req.body;
      if (!password) throw new AppError('Password is required', 400);
      const result = await shopsService.requestClearDataPin(req.shopId, req.userId, password);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async confirmDashboardEdit(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const { pin } = req.body;
      if (!pin) throw new AppError('PIN is required', 400);
      const result = await shopsService.confirmDashboardEdit(req.shopId, req.userId, pin);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async clearDashboardData(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const result = await shopsService.clearDashboardData(req.shopId, req.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async resetDashboardView(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) {
        throw new AppError('Shop ID and User ID are required', 400);
      }
      const result = await shopsService.resetDashboardView(req.shopId, req.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
