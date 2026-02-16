import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';

const router = Router();
const controller = new PaymentsController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.post('/paystack/initialize', (req, res, next) => controller.initialize(req, res, next));
router.post('/paystack/verify', (req, res, next) => controller.verify(req, res, next));

export default router;
