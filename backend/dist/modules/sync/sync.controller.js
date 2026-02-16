"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncController = void 0;
const sync_service_1 = require("./sync.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const syncService = new sync_service_1.SyncService();
class SyncController {
    async sync(req, res, next) {
        try {
            if (!req.shopId || !req.userId) {
                throw new errorHandler_1.AppError('Shop ID and User ID are required', 400);
            }
            const result = await syncService.syncData(req.shopId, req.userId, req.body);
            res.json({ success: true, data: result });
        }
        catch (error) {
            (0, errorHandler_1.errorHandler)(error, req, res, next);
        }
    }
}
exports.SyncController = SyncController;
//# sourceMappingURL=sync.controller.js.map