import { Router } from 'express';
import { WalletsController } from './wallets.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireOwner } from '../../middleware/requireOwner';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';

const router = Router();
const controller = new WalletsController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);
router.use(requireOwner);

router.get('/', (req, res, next) => controller.getWallets(req, res, next));
router.get('/transactions', (req, res, next) => controller.getTransactions(req, res, next));
router.post('/adjust', (req, res, next) => controller.adjustBalance(req, res, next));
router.post('/transfer', (req, res, next) => controller.transfer(req, res, next));

export default router;
