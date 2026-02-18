import { Router } from 'express';
import { ControlsController } from './controls.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireShop } from '../../middleware/requireShop';
import { requireActiveSubscription } from '../../middleware/requireActiveSubscription';
import { requireOwner } from '../../middleware/requireOwner';

const router = Router();
const controller = new ControlsController();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireShop);

router.post('/shifts/start', (req, res, next) => controller.startShift(req, res, next));
router.post('/shifts/:id/end', (req, res, next) => controller.endShift(req, res, next));
router.get('/shifts', (req, res, next) => controller.listShifts(req, res, next));

router.get('/discrepancies', (req, res, next) => controller.listDiscrepancies(req, res, next));
router.post('/discrepancies/:id/review', requireOwner, (req, res, next) => controller.reviewDiscrepancy(req, res, next));

router.get('/audit-logs', (req, res, next) => controller.listAuditLogs(req, res, next));

router.get('/permissions/:userId', requireOwner, (req, res, next) => controller.getPermissions(req, res, next));
router.put('/permissions/:userId', requireOwner, (req, res, next) => controller.setPermissions(req, res, next));

export default router;
