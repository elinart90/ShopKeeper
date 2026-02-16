import { Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';
import { ShopRequest } from '../../middleware/requireShop';
import { errorHandler, AppError } from '../../middleware/errorHandler';

const service = new PaymentsService();

export class PaymentsController {
  async initialize(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      const shopId = req.shopId;
      if (!shopId) throw new AppError('Shop required', 400);

      const { amount, email, metadata } = req.body;
      if (amount == null || !email) {
        throw new AppError('amount and email are required', 400);
      }

      const result = await service.initialize({
        shop_id: shopId,
        amount: Number(amount),
        email: String(email).trim(),
        purpose: req.body.purpose,
        metadata: req.body.metadata,
      });

      res.status(200).json({
        success: true,
        data: {
          authorization_url: result.authorization_url,
          access_code: result.access_code,
          reference: result.reference,
        },
      });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }

  async verify(req: ShopRequest, res: Response, next: NextFunction) {
    try {
      const { reference } = req.body;
      if (!reference || typeof reference !== 'string') {
        throw new AppError('reference is required', 400);
      }

      const result = await service.verify(reference.trim());

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: { message: 'Verification failed or transaction not successful' },
        });
      }

      res.json({
        success: true,
        data: { payment: result.payment },
      });
    } catch (error) {
      errorHandler(error as AppError, req, res, next);
    }
  }
}
