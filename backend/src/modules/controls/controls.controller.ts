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

  async createStockSnapshot(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const periodType = String(req.body?.periodType || 'daily') as 'daily' | 'weekly' | 'monthly';
      if (!['daily', 'weekly', 'monthly'].includes(periodType)) {
        throw new AppError('periodType must be daily, weekly, or monthly', 400);
      }
      const periodKey = typeof req.body?.periodKey === 'string' ? req.body.periodKey : undefined;
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
      const data = await controlsService.createStockSnapshot(req.shopId, req.userId, { periodType, periodKey, notes });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockSnapshots(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const data = await controlsService.listStockSnapshots(req.shopId, limit);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockMovements(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.listStockMovements(req.shopId, {
        productId: req.query.productId as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockVariances(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.listStockVariances(req.shopId, {
        status: req.query.status as string | undefined,
        severity: req.query.severity as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async recordStockVariance(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const productId = String(req.body?.productId || '');
      const countedQty = Number(req.body?.countedQty);
      const expectedQty = req.body?.expectedQty != null ? Number(req.body.expectedQty) : undefined;
      const reasonCode = String(req.body?.reasonCode || '');
      const reasonNote = typeof req.body?.reasonNote === 'string' ? req.body.reasonNote : undefined;
      const evidenceUrl = typeof req.body?.evidenceUrl === 'string' ? req.body.evidenceUrl : undefined;
      if (!productId) throw new AppError('productId is required', 400);
      if (!Number.isFinite(countedQty)) throw new AppError('countedQty is required', 400);
      if (!reasonCode) throw new AppError('reasonCode is required', 400);
      const data = await controlsService.recordStockVariance(req.shopId, req.userId, {
        productId,
        countedQty,
        expectedQty,
        reasonCode,
        reasonNote,
        evidenceUrl,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async reviewStockVariance(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const varianceId = String(req.params.id || '');
      const status = String(req.body?.status || '');
      const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
      if (!varianceId) throw new AppError('Variance ID is required', 400);
      if (status !== 'approved' && status !== 'rejected') {
        throw new AppError('status must be approved or rejected', 400);
      }
      const data = await controlsService.reviewStockVariance(req.shopId, req.userId, varianceId, status, note);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getStockVarianceConfig(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      const data = controlsService.getStockVarianceConfig();
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async startStockCountSession(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
      const scopeType = typeof req.body?.scopeType === 'string' ? req.body.scopeType : undefined;
      const scopeValue = typeof req.body?.scopeValue === 'string' ? req.body.scopeValue : undefined;
      const data = await controlsService.startStockCountSession(req.shopId, req.userId, { title, scopeType, scopeValue });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockCountSessions(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const limit = req.query.limit ? Number(req.query.limit) : 30;
      const data = await controlsService.listStockCountSessions(req.shopId, limit);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getStockCountProgress(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const sessionId = String(req.params.id || '');
      if (!sessionId) throw new AppError('Session ID is required', 400);
      const data = await controlsService.getStockCountProgress(req.shopId, sessionId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockCountItems(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const sessionId = String(req.params.id || '');
      if (!sessionId) throw new AppError('Session ID is required', 400);
      const data = await controlsService.listStockCountSessionItems(req.shopId, sessionId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async recordStockCountItem(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const sessionId = String(req.params.id || '');
      const productId = String(req.body?.productId || '');
      const countedQty = Number(req.body?.countedQty);
      const photoUrl = typeof req.body?.photoUrl === 'string' ? req.body.photoUrl : undefined;
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
      if (!sessionId) throw new AppError('Session ID is required', 400);
      if (!productId) throw new AppError('productId is required', 400);
      if (!Number.isFinite(countedQty)) throw new AppError('countedQty is required', 400);
      const data = await controlsService.recordStockCountItem(req.shopId, req.userId, sessionId, {
        productId,
        countedQty,
        photoUrl,
        notes,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async submitStockCountSession(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const sessionId = String(req.params.id || '');
      if (!sessionId) throw new AppError('Session ID is required', 400);
      const data = await controlsService.submitStockCountSession(req.shopId, req.userId, sessionId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getStockCountReminders(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const thresholdDays = req.query.thresholdDays ? Number(req.query.thresholdDays) : 14;
      const data = await controlsService.getStockCountReminders(req.shopId, thresholdDays);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async createStockLocation(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const name = String(req.body?.name || '').trim();
      const locationType = typeof req.body?.locationType === 'string' ? req.body.locationType : undefined;
      if (!name) throw new AppError('name is required', 400);
      const data = await controlsService.createStockLocation(req.shopId, req.userId, { name, locationType });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockLocations(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.listStockLocations(req.shopId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async setLocationBalance(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const locationId = String(req.body?.locationId || '');
      const productId = String(req.body?.productId || '');
      const quantity = Number(req.body?.quantity);
      if (!locationId) throw new AppError('locationId is required', 400);
      if (!productId) throw new AppError('productId is required', 400);
      if (!Number.isFinite(quantity) || quantity < 0) throw new AppError('quantity must be >= 0', 400);
      const data = await controlsService.setLocationBalance(req.shopId, req.userId, { locationId, productId, quantity });
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getLocationBalances(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const locationId = req.query.locationId as string | undefined;
      const data = await controlsService.getLocationBalances(req.shopId, locationId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async transferStock(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const fromLocationId = String(req.body?.fromLocationId || '');
      const toLocationId = String(req.body?.toLocationId || '');
      const productId = String(req.body?.productId || '');
      const quantity = Number(req.body?.quantity);
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
      if (!fromLocationId || !toLocationId || !productId) {
        throw new AppError('fromLocationId, toLocationId and productId are required', 400);
      }
      if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError('quantity must be > 0', 400);
      const data = await controlsService.transferStock(req.shopId, req.userId, {
        fromLocationId,
        toLocationId,
        productId,
        quantity,
        notes,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async listStockTransfers(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const data = await controlsService.listStockTransfers(req.shopId, limit);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async recordSupplierDelivery(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId || !req.userId) throw new AppError('Shop ID and User ID are required', 400);
      const supplierName = String(req.body?.supplierName || '').trim();
      const productId = String(req.body?.productId || '');
      const expectedQuantity = Number(req.body?.expectedQuantity);
      const receivedQuantity = Number(req.body?.receivedQuantity);
      if (!supplierName) throw new AppError('supplierName is required', 400);
      if (!productId) throw new AppError('productId is required', 400);
      if (!Number.isFinite(expectedQuantity) || expectedQuantity <= 0) {
        throw new AppError('expectedQuantity must be > 0', 400);
      }
      if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0) {
        throw new AppError('receivedQuantity must be >= 0', 400);
      }
      const data = await controlsService.recordSupplierDelivery(req.shopId, req.userId, {
        supplierName,
        invoiceNumber: typeof req.body?.invoiceNumber === 'string' ? req.body.invoiceNumber : undefined,
        productId,
        expectedQuantity,
        receivedQuantity,
        unitCost: req.body?.unitCost != null ? Number(req.body.unitCost) : undefined,
        deliveryPersonName: typeof req.body?.deliveryPersonName === 'string' ? req.body.deliveryPersonName : undefined,
        deliverySignature: typeof req.body?.deliverySignature === 'string' ? req.body.deliverySignature : undefined,
        photoUrl: typeof req.body?.photoUrl === 'string' ? req.body.photoUrl : undefined,
        notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
        locationId: typeof req.body?.locationId === 'string' ? req.body.locationId : undefined,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getSupplierScorecard(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const supplierName = req.query.supplierName as string | undefined;
      const data = await controlsService.getSupplierScorecard(req.shopId, supplierName);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async getVariancePatternAlerts(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      if (!req.shopId) throw new AppError('Shop ID is required', 400);
      const data = await controlsService.getVariancePatternAlerts(req.shopId);
      res.json({ success: true, data });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
