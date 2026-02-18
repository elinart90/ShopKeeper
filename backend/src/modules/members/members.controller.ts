import { Request, Response, NextFunction } from 'express';
import { MembersService } from './members.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';
import { getParam } from '../../utils/params';
import { logAuditAction } from '../controls/audit';

const membersService = new MembersService();

export class MembersController {
  async createCustomer(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const customer = await membersService.createCustomer(req.shopId, req.body);
      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getCustomers(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const customers = await membersService.getCustomers(req.shopId, req.query.search as string);
      res.json({ success: true, data: customers });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const id = getParam(req, 'id');
      const customer = await membersService.getCustomerById(id);
      res.json({ success: true, data: customer });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async updateCustomer(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const id = getParam(req, 'id');
      const customer = await membersService.updateCustomer(id, req.shopId, req.body);
      res.json({ success: true, data: customer });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getCreditSummary(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }

      const data = await membersService.getCreditSummary(req.shopId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async recordPayment(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) {
        throw new AppError('Shop ID is required', 400);
      }
      const id = getParam(req, 'id');
      const amount = Number(req.body?.amount);
      const paymentMethod = String(req.body?.payment_method || 'cash');
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Valid amount is required', 400);
      }
      if (!req.userId) {
        throw new AppError('User ID is required', 401);
      }

      const customer = await membersService.recordCreditPayment(
        id,
        req.shopId,
        req.userId,
        amount,
        paymentMethod,
        notes
      );
      await logAuditAction({
        shopId: req.shopId,
        userId: req.userId,
        action: 'customers.record_payment',
        entityType: 'customer',
        entityId: id,
        metadata: { amount, paymentMethod },
        after: customer,
      });
      res.json({ success: true, data: customer });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
