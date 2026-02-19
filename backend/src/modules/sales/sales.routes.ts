import { Router } from 'express';
import { SalesController } from './sales.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();
const controller = new SalesController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.post('/', requirePermission('sales.create'), (req, res, next) => controller.createSale(req, res, next));
router.get('/', (req, res, next) => controller.getSales(req, res, next));
router.get('/summary', (req, res, next) => controller.getSalesSummary(req, res, next));
router.get('/goods-sold-summary', (req, res, next) => controller.getGoodsSoldSummary(req, res, next));
router.get('/:id', (req, res, next) => controller.getSale(req, res, next));
router.post('/:id/cancel', requirePermission('sales.cancel'), (req, res, next) => controller.cancelSale(req, res, next));
router.post('/:id/return-item', requirePermission('sales.cancel'), (req, res, next) => controller.returnSaleItem(req, res, next));
router.post('/:id/partial-refund', requirePermission('sales.cancel'), (req, res, next) => controller.createPartialRefund(req, res, next));

export default router;
