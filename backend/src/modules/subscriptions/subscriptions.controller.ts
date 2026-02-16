import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/requireAuth';
import { SubscriptionsService } from './subscriptions.service';
import { BillingCycle } from './subscriptions.service';
import { errorHandler } from '../../middleware/errorHandler';

const service = new SubscriptionsService();

function createHttpError(message: string, statusCode: number, code?: string) {
  const err = new Error(message) as Error & { statusCode?: number; code?: string };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export class SubscriptionsController {
  listPlans(req: AuthRequest, res: Response) {
    res.json({ success: true, data: service.listPlans() });
  }

  async getStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw createHttpError('Unauthorized', 401);
      const shopIdHeader = req.headers['x-shop-id'];
      const shopId = typeof shopIdHeader === 'string' ? shopIdHeader : undefined;
      const status = await service.getStatus(req.userId, shopId);
      res.json({ success: true, data: status });
    } catch (error) {
      errorHandler(error as Error, req, res, next);
    }
  }

  async initialize(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw createHttpError('Unauthorized', 401);
      const planCode = String(req.body?.planCode || '').trim().toLowerCase();
      if (!planCode) throw createHttpError('planCode is required', 400);
      const billingCycle = String(req.body?.billingCycle || 'monthly').trim().toLowerCase() as BillingCycle;
      if (!['monthly', 'yearly'].includes(billingCycle)) {
        throw createHttpError('billingCycle must be monthly or yearly', 400);
      }
      const email = String(req.body?.email || req.userEmail || '').trim().toLowerCase();
      if (!email) throw createHttpError('Email is required', 400);

      const result = await service.initialize(req.userId, email, planCode, billingCycle);
      res.json({ success: true, data: result });
    } catch (error) {
      errorHandler(error as Error, req, res, next);
    }
  }

  async verify(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw createHttpError('Unauthorized', 401);
      const reference = String(req.body?.reference || '').trim();
      if (!reference) throw createHttpError('reference is required', 400);
      const result = await service.verify(req.userId, reference);
      if (!result.success) {
        res.status(400).json({ success: false, data: result.status, error: { message: 'Subscription payment verification failed' } });
        return;
      }
      res.json({ success: true, data: result.status });
    } catch (error) {
      errorHandler(error as Error, req, res, next);
    }
  }
}
