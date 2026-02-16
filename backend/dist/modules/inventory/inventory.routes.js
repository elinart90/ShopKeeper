"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("./inventory.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireShop_1 = require("../../middleware/requireShop");
const requireActiveSubscription_1 = require("../../middleware/requireActiveSubscription");
const router = (0, express_1.Router)();
const controller = new inventory_controller_1.InventoryController();
router.use(requireAuth_1.requireAuth);
router.use(requireActiveSubscription_1.requireActiveSubscription);
router.use(requireShop_1.requireShop);
// Products
router.post('/products', (req, res, next) => controller.createProduct(req, res, next));
router.get('/products', (req, res, next) => controller.getProducts(req, res, next));
router.get('/products/check-duplicate', (req, res, next) => controller.checkDuplicate(req, res, next));
router.get('/products/low-stock', (req, res, next) => controller.getLowStockProducts(req, res, next));
router.get('/products/barcode/:barcode', (req, res, next) => controller.getProductByBarcode(req, res, next));
router.get('/products/:id', (req, res, next) => controller.getProduct(req, res, next));
router.patch('/products/:id', (req, res, next) => controller.updateProduct(req, res, next));
router.post('/products/:id/receive-stock', (req, res, next) => controller.receiveStock(req, res, next));
router.delete('/products/:id', (req, res, next) => controller.deleteProduct(req, res, next));
router.get('/products/:id/history', (req, res, next) => controller.getStockHistory(req, res, next));
// Categories
router.post('/categories', (req, res, next) => controller.createCategory(req, res, next));
router.get('/categories', (req, res, next) => controller.getCategories(req, res, next));
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map