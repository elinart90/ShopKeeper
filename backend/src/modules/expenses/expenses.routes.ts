import { Router } from 'express';
import { ExpensesController } from './expenses.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';
import { requireOwner } from '../../middleware/requireOwner';

const router = Router();
const controller = new ExpensesController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.post('/', requireOwner, (req, res, next) => controller.createExpense(req, res, next));
router.get('/', requireOwner, (req, res, next) => controller.getExpenses(req, res, next));
router.get('/categories', requireOwner, (req, res, next) => controller.getExpenseCategories(req, res, next));
router.post('/categories', requireOwner, (req, res, next) => controller.createExpenseCategory(req, res, next));

export default router;
