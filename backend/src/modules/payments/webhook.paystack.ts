import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';
import { logger } from '../../utils/logger';

const paymentsService = new PaymentsService();

/**
 * Paystack webhook handler. Must be mounted with express.raw({ type: 'application/json' })
 * so req.body is the raw Buffer for signature verification.
 */
export async function paystackWebhook(
  req: Request & { body?: Buffer },
  res: Response,
  next: NextFunction
) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: { message: 'Method not allowed' } });
      return;
    }
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      res.status(400).json({ success: false, error: { message: 'Raw body required' } });
      return;
    }

    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      res.status(401).json({ success: false, error: { message: 'Missing x-paystack-signature' } });
      return;
    }

    await paymentsService.processWebhook(rawBody, signature);
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Paystack webhook error', error);
    res.status(400).json({
      success: false,
      error: { message: (error as Error).message || 'Webhook processing failed' },
    });
  }
}
