import { Router } from 'express';
import { SyncController } from './sync.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';

const router = Router();
const controller = new SyncController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.post('/', (req, res, next) => controller.sync(req, res, next));

export default router;
