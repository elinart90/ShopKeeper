"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paystackWebhook = paystackWebhook;
const payments_service_1 = require("./payments.service");
const logger_1 = require("../../utils/logger");
const paymentsService = new payments_service_1.PaymentsService();
/**
 * Paystack webhook handler. Must be mounted with express.raw({ type: 'application/json' })
 * so req.body is the raw Buffer for signature verification.
 */
async function paystackWebhook(req, res, next) {
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
        const signature = req.headers['x-paystack-signature'];
        if (!signature) {
            res.status(401).json({ success: false, error: { message: 'Missing x-paystack-signature' } });
            return;
        }
        await paymentsService.processWebhook(rawBody, signature);
        res.status(200).json({ received: true });
    }
    catch (error) {
        logger_1.logger.error('Paystack webhook error', error);
        res.status(400).json({
            success: false,
            error: { message: error.message || 'Webhook processing failed' },
        });
    }
}
//# sourceMappingURL=webhook.paystack.js.map