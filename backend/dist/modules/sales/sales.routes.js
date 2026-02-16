"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sales_controller_1 = require("./sales.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireShop_1 = require("../../middleware/requireShop");
const requireActiveSubscription_1 = require("../../middleware/requireActiveSubscription");
const router = (0, express_1.Router)();
const controller = new sales_controller_1.SalesController();
router.use(requireAuth_1.requireAuth);
router.use(requireActiveSubscription_1.requireActiveSubscription);
router.use(requireShop_1.requireShop);
router.post('/', (req, res, next) => controller.createSale(req, res, next));
router.get('/', (req, res, next) => controller.getSales(req, res, next));
router.get('/summary', (req, res, next) => controller.getSalesSummary(req, res, next));
router.get('/:id', (req, res, next) => controller.getSale(req, res, next));
router.post('/:id/cancel', (req, res, next) => controller.cancelSale(req, res, next));
exports.default = router;
//# sourceMappingURL=sales.routes.js.map