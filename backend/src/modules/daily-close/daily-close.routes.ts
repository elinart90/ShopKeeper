import { Router } from 'express';
import { DailyCloseController } from './daily-close.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireOwner } from '../../middleware/requireOwner';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';

const router = Router();
const controller = new DailyCloseController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);
router.use(requireOwner);

router.post('/', (req, res, next) => controller.create(req, res, next));
router.get('/', (req, res, next) => controller.getRecent(req, res, next));
router.get('/by-date', (req, res, next) => controller.getByDate(req, res, next));
router.post('/:id/approve', (req, res, next) => controller.approve(req, res, next));
router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));

export default router;
