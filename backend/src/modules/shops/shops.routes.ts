import { Router } from 'express';
import { ShopsController } from './shops.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireOwner } from '../../middleware/requireOwner';
import { requireDashboardEditToken } from '../../middleware/requireDashboardEditToken';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';

const router = Router();
const controller = new ShopsController();

router.use(requireAuth);

router.get('/my-shops', (req, res, next) => controller.getUserShops(req, res, next));

router.use(requireActiveSubscription);

router.post('/', (req, res, next) => controller.createShop(req, res, next));
router.post('/members', requireShop, requireOwner, (req, res, next) => controller.addMember(req, res, next));
router.get('/members', requireShop, requireOwner, (req, res, next) => controller.getShopMembers(req, res, next));
router.delete('/members/:userId', requireShop, requireOwner, (req, res, next) => controller.removeMember(req, res, next));
router.post('/transfer-ownership', requireShop, requireOwner, (req, res, next) => controller.transferOwnership(req, res, next));
router.post('/request-clear-data-pin', requireShop, requireOwner, (req, res, next) => controller.requestClearDataPin(req, res, next));
router.post('/confirm-dashboard-edit', requireShop, requireOwner, (req, res, next) => controller.confirmDashboardEdit(req, res, next));
router.post('/clear-dashboard-data', requireShop, requireOwner, requireDashboardEditToken, (req, res, next) => controller.clearDashboardData(req, res, next));
router.post('/reset-dashboard-view', requireShop, requireOwner, requireDashboardEditToken, (req, res, next) => controller.resetDashboardView(req, res, next));
router.get('/:id', (req, res, next) => controller.getShop(req, res, next));
router.patch('/:id', (req, res, next) => controller.updateShop(req, res, next));
router.delete('/:id', (req, res, next) => controller.deleteShop(req, res, next));

export default router;
