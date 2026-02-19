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

router.post('/stock/snapshots', requireOwner, (req, res, next) => controller.createStockSnapshot(req, res, next));
router.get('/stock/snapshots', (req, res, next) => controller.listStockSnapshots(req, res, next));
router.get('/stock/movements', (req, res, next) => controller.listStockMovements(req, res, next));
router.get('/stock/variances', (req, res, next) => controller.listStockVariances(req, res, next));
router.post('/stock/variances', (req, res, next) => controller.recordStockVariance(req, res, next));
router.post('/stock/variances/:id/review', requireOwner, (req, res, next) => controller.reviewStockVariance(req, res, next));
router.get('/stock/config', (req, res, next) => controller.getStockVarianceConfig(req, res, next));
router.post('/stock/count-sessions', (req, res, next) => controller.startStockCountSession(req, res, next));
router.get('/stock/count-sessions', (req, res, next) => controller.listStockCountSessions(req, res, next));
router.get('/stock/count-sessions/:id/progress', (req, res, next) => controller.getStockCountProgress(req, res, next));
router.get('/stock/count-sessions/:id/items', (req, res, next) => controller.listStockCountItems(req, res, next));
router.post('/stock/count-sessions/:id/items', (req, res, next) => controller.recordStockCountItem(req, res, next));
router.post('/stock/count-sessions/:id/submit', (req, res, next) => controller.submitStockCountSession(req, res, next));
router.get('/stock/reminders', (req, res, next) => controller.getStockCountReminders(req, res, next));
router.post('/stock/locations', requireOwner, (req, res, next) => controller.createStockLocation(req, res, next));
router.get('/stock/locations', (req, res, next) => controller.listStockLocations(req, res, next));
router.put('/stock/location-balances', (req, res, next) => controller.setLocationBalance(req, res, next));
router.get('/stock/location-balances', (req, res, next) => controller.getLocationBalances(req, res, next));
router.post('/stock/transfers', (req, res, next) => controller.transferStock(req, res, next));
router.get('/stock/transfers', (req, res, next) => controller.listStockTransfers(req, res, next));
router.post('/stock/supplier-deliveries', (req, res, next) => controller.recordSupplierDelivery(req, res, next));
router.get('/stock/supplier-scorecard', (req, res, next) => controller.getSupplierScorecard(req, res, next));
router.get('/stock/pattern-alerts', (req, res, next) => controller.getVariancePatternAlerts(req, res, next));

router.get('/permissions/:userId', requireOwner, (req, res, next) => controller.getPermissions(req, res, next));
router.put('/permissions/:userId', requireOwner, (req, res, next) => controller.setPermissions(req, res, next));

export default router;
