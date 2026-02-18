"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const inventory_service_1 = require("./inventory.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const params_1 = require("../../utils/params");
const audit_1 = require("../controls/audit");
const inventoryService = new inventory_service_1.InventoryService();
class InventoryController {
    async createProduct(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const product = await inventoryService.createProduct(req.shopId, req.userId, req.body);
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'inventory.create',
                entityType: 'product',
                entityId: product?.id,
                after: product,
            });
            res.status(201).json({ success: true, data: product });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getProducts(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const products = await inventoryService.getProducts(req.shopId, req.query);
            res.json({ success: true, data: products });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getProduct(req, res, next) {
        try {
            const id = (0, params_1.getParam)(req, 'id');
            const product = await inventoryService.getProductById(id);
            res.json({ success: true, data: product });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getProductByBarcode(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const barcode = (0, params_1.getParam)(req, 'barcode');
            const product = await inventoryService.getProductByBarcode(req.shopId, barcode);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
            res.json({ success: true, data: product });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async checkDuplicate(req, res, next) {
        try {
            if (!req.shopId)
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            const barcode = req.query.barcode?.trim() || undefined;
            const name = req.query.name?.trim() || undefined;
            const data = await inventoryService.checkDuplicate(req.shopId, barcode, name);
            res.json({ success: true, data });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async receiveStock(req, res, next) {
        try {
            if (!req.shopId || !req.userId)
                throw new errorHandler_1.AppError('Shop ID and User ID required', 400);
            const id = (0, params_1.getParam)(req, 'id');
            const { quantity, note } = req.body || {};
            const qty = Number(quantity);
            if (!Number.isFinite(qty) || qty <= 0)
                throw new errorHandler_1.AppError('Valid quantity required', 400);
            const product = await inventoryService.receiveStock(req.shopId, id, req.userId, qty, note);
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'inventory.receive_stock',
                entityType: 'product',
                entityId: id,
                metadata: { quantity: qty, note: note || null },
                after: product,
            });
            res.json({ success: true, data: product });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async updateProduct(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            const product = await inventoryService.updateProduct(id, req.shopId, req.userId, req.body);
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'inventory.update',
                entityType: 'product',
                entityId: id,
                after: product,
            });
            res.json({ success: true, data: product });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async deleteProduct(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const id = (0, params_1.getParam)(req, 'id');
            await inventoryService.deleteProduct(id, req.shopId);
            await (0, audit_1.logAuditAction)({
                shopId: req.shopId,
                userId: req.userId,
                action: 'inventory.delete',
                entityType: 'product',
                entityId: id,
            });
            res.json({ success: true, message: 'Product deleted' });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getLowStockProducts(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const products = await inventoryService.getLowStockProducts(req.shopId);
            res.json({ success: true, data: products });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getStockHistory(req, res, next) {
        try {
            const id = (0, params_1.getParam)(req, 'id');
            const limit = parseInt(req.query.limit) || 50;
            const history = await inventoryService.getStockHistory(id, limit);
            res.json({ success: true, data: history });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    // Categories
    async createCategory(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const category = await inventoryService.createCategory(req.shopId, req.body);
            res.status(201).json({ success: true, data: category });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
    async getCategories(req, res, next) {
        try {
            if (!req.shopId) {
                throw new errorHandler_1.AppError('Shop ID is required', 400);
            }
            const categories = await inventoryService.getCategories(req.shopId);
            res.json({ success: true, data: categories });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.InventoryController = InventoryController;
//# sourceMappingURL=inventory.controller.js.map