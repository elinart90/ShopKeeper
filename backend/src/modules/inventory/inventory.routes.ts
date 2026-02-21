import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';
import { requireOwner } from '../../middleware/requireOwner';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();
const controller = new InventoryController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

// Products
router.post('/products', requirePermission('inventory.create'), (req, res, next) => controller.createProduct(req, res, next));
router.post('/products/ai-onboarding', requirePermission('inventory.create'), (req, res, next) => controller.aiOnboardFromImage(req, res, next));
router.get('/products', (req, res, next) => controller.getProducts(req, res, next));
router.get('/products/check-duplicate', (req, res, next) => controller.checkDuplicate(req, res, next));
router.get('/products/low-stock', (req, res, next) => controller.getLowStockProducts(req, res, next));
router.get('/products/barcode/:barcode', (req, res, next) => controller.getProductByBarcode(req, res, next));
router.get('/products/:id', (req, res, next) => controller.getProduct(req, res, next));
router.patch('/products/:id', requirePermission('inventory.update'), (req, res, next) => controller.updateProduct(req, res, next));
router.post('/products/:id/receive-stock', requirePermission('inventory.receive_stock'), (req, res, next) => controller.receiveStock(req, res, next));
router.delete('/products/:id', requirePermission('inventory.delete'), (req, res, next) => controller.deleteProduct(req, res, next));
router.post('/products/:id/restore', requirePermission('inventory.update'), (req, res, next) => controller.restoreProduct(req, res, next));
router.get('/products/:id/history', (req, res, next) => controller.getStockHistory(req, res, next));

// Categories
router.post('/categories', requireOwner, (req, res, next) => controller.createCategory(req, res, next));
router.get('/categories', (req, res, next) => controller.getCategories(req, res, next));

export default router;
