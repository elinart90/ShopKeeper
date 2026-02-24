"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const expenses_controller_1 = require("./expenses.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireShop_1 = require("../../middleware/requireShop");
const requireActiveSubscription_1 = require("../../middleware/requireActiveSubscription");
const requireOwner_1 = require("../../middleware/requireOwner");
const router = (0, express_1.Router)();
const controller = new expenses_controller_1.ExpensesController();
router.use(requireAuth_1.requireAuth);
router.use(requireActiveSubscription_1.requireActiveSubscription);
router.use(requireShop_1.requireShop);
router.post('/', requireOwner_1.requireOwner, (req, res, next) => controller.createExpense(req, res, next));
router.get('/', requireOwner_1.requireOwner, (req, res, next) => controller.getExpenses(req, res, next));
router.get('/categories', requireOwner_1.requireOwner, (req, res, next) => controller.getExpenseCategories(req, res, next));
router.post('/categories', requireOwner_1.requireOwner, (req, res, next) => controller.createExpenseCategory(req, res, next));
exports.default = router;
//# sourceMappingURL=expenses.routes.js.map