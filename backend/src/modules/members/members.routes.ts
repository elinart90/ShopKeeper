import { Router } from 'express';
import { MembersController } from './members.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();
const controller = new MembersController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.post('/', (req, res, next) => controller.createCustomer(req, res, next));
router.get('/credit-summary', (req, res, next) => controller.getCreditSummary(req, res, next));
router.get('/', (req, res, next) => controller.getCustomers(req, res, next));
router.get('/:id', (req, res, next) => controller.getCustomer(req, res, next));
router.patch('/:id', (req, res, next) => controller.updateCustomer(req, res, next));
router.post('/:id/record-payment', requirePermission('customers.record_payment'), (req, res, next) => controller.recordPayment(req, res, next));

export default router;
