import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireOwner } from '../../middleware/requireOwner';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';

const router = Router();
const controller = new ReportsController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.get('/dashboard', (req, res, next) => controller.getDashboardStats(req, res, next));
router.get('/sales-intelligence', (req, res, next) => controller.getSalesIntelligence(req, res, next));
router.get('/inventory-finance', requireOwner, (req, res, next) => controller.getInventoryFinance(req, res, next));
router.get('/expenses-profit', requireOwner, (req, res, next) => controller.getExpensesProfit(req, res, next));
router.get('/compliance-export', requireOwner, (req, res, next) => controller.getComplianceExport(req, res, next));
router.get('/business-intelligence', requireOwner, (req, res, next) => controller.getBusinessIntelligence(req, res, next));
router.post('/business-intelligence/query', requireOwner, (req, res, next) => controller.queryBusinessIntelligence(req, res, next));
router.get('/inventory-intelligence', requireOwner, (req, res, next) => controller.getInventoryStockIntelligence(req, res, next));
router.post('/inventory-intelligence/query', requireOwner, (req, res, next) => controller.queryInventoryStockIntelligence(req, res, next));
router.post('/natural-language', requireOwner, (req, res, next) => controller.getNaturalLanguageReport(req, res, next));

export default router;
