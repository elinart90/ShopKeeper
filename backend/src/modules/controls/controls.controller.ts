import { Response, NextFunction } from 'express';
import { ShopRequest } from '../../middleware/requireShop';
import { AppError, errorHandler } from '../../middleware/errorHandler';
import { ControlsService } from './controls.service';

const controlsService = new ControlsService();

export class ControlsController {
  async startShift(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const openingCash = Number(req.body?.opening_cash || 0);
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
      const data = await controlsService.startShift(req.shopId, req.userId, openingCash, notes);
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async endShift(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const shiftId = String(req.params.id || '');
      const closingCash = Number(req.body?.closing_cash);
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
      if (!shiftId) throw new AppError('Shift ID is required', 400);
      if (!Number.isFinite(closingCash)) throw new AppError('closing_cash is required', 400);
      const data = await controlsService.endShift(req.shopId, req.userId, shiftId, closingCash, notes);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listShifts(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.listShifts(req.shopId, {
        userId: req.query.userId as string | undefined,
        status: req.query.status as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listDiscrepancies(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.listDiscrepancies(req.shopId, req.query.status as string | undefined);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async reviewDiscrepancy(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const id = String(req.params.id || '');
      const status = String(req.body?.status || '');
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      if (!id) throw new AppError('Discrepancy ID is required', 400);
      if (status !== 'approved' && status !== 'rejected') throw new AppError('status must be approved or rejected', 400);
      const data = await controlsService.reviewDiscrepancy(req.shopId, req.userId, id, status as any, reason);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listAuditLogs(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.listAuditLogs(req.shopId, {
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getPermissions(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const userId = String(req.params.userId || '');
      const role = req.query.role as string | undefined;
      if (!userId) throw new AppError('User ID is required', 400);
      const data = await controlsService.getPermissions(req.shopId, userId, role);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async setPermissions(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const userId = String(req.params.userId || '');
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      if (!userId) throw new AppError('User ID is required', 400);
      const normalized = entries
        .filter((e: any) => e && typeof e.permissionKey === 'string')
        .map((e: any) => ({ permissionKey: String(e.permissionKey), allowed: !!e.allowed }));
      const data = await controlsService.setPermissions(req.shopId, userId, req.userId, normalized);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
