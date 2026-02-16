"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const payments_service_1 = require("./payments.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const service = new payments_service_1.PaymentsService();
class PaymentsController {
    async initialize(req, res, next) {
        try {
            const shopId = req.shopId;
            if (!shopId)
                throw new errorHandler_1.AppError('Shop required', 400);
            const { amount, email, metadata } = req.body;
            if (amount == null || !email) {
                throw new errorHandler_1.AppError('amount and email are required', 400);
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
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async verify(req, res, next) {
        try {
            const { reference } = req.body;
            if (!reference || typeof reference !== 'string') {
                throw new errorHandler_1.AppError('reference is required', 400);
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
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.PaymentsController = PaymentsController;
//# sourceMappingURL=payments.controller.js.map