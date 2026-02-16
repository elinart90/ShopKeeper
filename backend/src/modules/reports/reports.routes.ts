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
router.get('/expenses-profit', (req, res, next) => controller.getExpensesProfit(req, res, next));
router.get('/compliance-export', requireOwner, (req, res, next) => controller.getComplianceExport(req, res, next));

export default router;
