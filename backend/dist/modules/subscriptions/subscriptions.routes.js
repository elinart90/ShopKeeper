"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requireAuth_1 = require("../../middleware/requireAuth");
const subscriptions_controller_1 = require("./subscriptions.controller");
const router = (0, express_1.Router)();
const controller = new subscriptions_controller_1.SubscriptionsController();
router.get('/plans', (req, res) => controller.listPlans(req, res));
router.use(requireAuth_1.requireAuth);
router.get('/status', (req, res, next) => controller.getStatus(req, res, next));
router.post('/initialize', (req, res, next) => controller.initialize(req, res, next));
router.post('/verify', (req, res, next) => controller.verify(req, res, next));
exports.default = router;
//# sourceMappingURL=subscriptions.routes.js.map