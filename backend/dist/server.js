"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const admin_service_1 = require("./modules/admin/admin.service");
const PORT = env_1.env.port;
const adminService = new admin_service_1.AdminService();
let lastAiExecutiveSummaryWeekKey = '';
let lastOverdueSuspensionDateKey = '';
function getIsoWeekKey(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
function shouldRunAiWeeklySummary(now) {
    // Monday morning in server local time (from 08:00 onward).
    return now.getDay() === 1 && now.getHours() >= 8;
}
async function runAiWeeklySummaryIfDue() {
    const now = new Date();
    if (!shouldRunAiWeeklySummary(now))
        return;
    const weekKey = getIsoWeekKey(now);
    if (lastAiExecutiveSummaryWeekKey === weekKey)
        return;
    try {
        const result = await adminService.emailAdminAiExecutiveSummaryToActivePlatformAdmins();
        lastAiExecutiveSummaryWeekKey = weekKey;
        logger_1.logger.info('Scheduled AI executive summary sent', result);
    }
    catch (error) {
        logger_1.logger.error('Scheduled AI executive summary failed', { message: String(error?.message || error) });
    }
}
function getDateKeyLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shouldRunDailyOverdueSuspension(now) {
    // Run once daily from 02:00 server local time.
    return now.getHours() >= 2;
}
async function runDailyOverdueSuspensionIfDue() {
    const now = new Date();
    if (!shouldRunDailyOverdueSuspension(now))
        return;
    const dateKey = getDateKeyLocal(now);
    if (lastOverdueSuspensionDateKey === dateKey)
        return;
    try {
        const result = await adminService.runOverduePlanSuspension(7);
        lastOverdueSuspensionDateKey = dateKey;
        logger_1.logger.info('Scheduled overdue suspension run complete', result);
    }
    catch (error) {
        logger_1.logger.error('Scheduled overdue suspension failed', { message: String(error?.message || error) });
    }
}
app_1.default.listen(PORT, () => {
    logger_1.logger.info(`Server running on port ${PORT}`);
    logger_1.logger.info(`Environment: ${env_1.env.nodeEnv}`);
    runAiWeeklySummaryIfDue().catch(() => { });
    runDailyOverdueSuspensionIfDue().catch(() => { });
    setInterval(() => {
        runAiWeeklySummaryIfDue().catch(() => { });
        runDailyOverdueSuspensionIfDue().catch(() => { });
    }, 60 * 1000);
    logger_1.logger.info('Admin AI weekly scheduler enabled (Monday mornings)');
    logger_1.logger.info('Monetization overdue suspension scheduler enabled (daily)');
});
//# sourceMappingURL=server.js.map