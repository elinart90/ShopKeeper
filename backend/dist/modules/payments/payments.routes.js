"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_controller_1 = require("./payments.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireShop_1 = require("../../middleware/requireShop");
const requireActiveSubscription_1 = require("../../middleware/requireActiveSubscription");
const router = (0, express_1.Router)();
const controller = new payments_controller_1.PaymentsController();
router.use(requireAuth_1.requireAuth);
router.use(requireActiveSubscription_1.requireActiveSubscription);
router.use(requireShop_1.requireShop);
router.post('/paystack/initialize', (req, res, next) => controller.initialize(req, res, next));
router.post('/paystack/verify', (req, res, next) => controller.verify(req, res, next));
exports.default = router;
//# sourceMappingURL=payments.routes.js.map