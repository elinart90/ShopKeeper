import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { SubscriptionsController } from './subscriptions.controller';

const router = Router();
const controller = new SubscriptionsController();

router.get('/plans', (req, res) => controller.listPlans(req, res));
router.use(requireAuth);
router.get('/status', (req, res, next) => controller.getStatus(req, res, next));
router.post('/initialize', (req, res, next) => controller.initialize(req, res, next));
router.post('/verify', (req, res, next) => controller.verify(req, res, next));

export default router;
