import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { AdminService } from './modules/admin/admin.service';

const PORT = env.port;
const adminService = new AdminService();
let lastAiExecutiveSummaryWeekKey = '';
let lastOverdueSuspensionDateKey = '';

function getIsoWeekKey(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shouldRunAiWeeklySummary(now: Date) {
  // Monday morning in server local time (from 08:00 onward).
  return now.getDay() === 1 && now.getHours() >= 8;
}

async function runAiWeeklySummaryIfDue() {
  const now = new Date();
  if (!shouldRunAiWeeklySummary(now)) return;
  const weekKey = getIsoWeekKey(now);
  if (lastAiExecutiveSummaryWeekKey === weekKey) return;

  try {
    const result = await adminService.emailAdminAiExecutiveSummaryToActivePlatformAdmins();
    lastAiExecutiveSummaryWeekKey = weekKey;
    logger.info('Scheduled AI executive summary sent', result);
  } catch (error: any) {
    logger.error('Scheduled AI executive summary failed', { message: String(error?.message || error) });
  }
}

function getDateKeyLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shouldRunDailyOverdueSuspension(now: Date) {
  // Run once daily from 02:00 server local time.
  return now.getHours() >= 2;
}

async function runDailyOverdueSuspensionIfDue() {
  const now = new Date();
  if (!shouldRunDailyOverdueSuspension(now)) return;
  const dateKey = getDateKeyLocal(now);
  if (lastOverdueSuspensionDateKey === dateKey) return;

  try {
    const result = await adminService.runOverduePlanSuspension(7);
    lastOverdueSuspensionDateKey = dateKey;
    logger.info('Scheduled overdue suspension run complete', result);
  } catch (error: any) {
    logger.error('Scheduled overdue suspension failed', { message: String(error?.message || error) });
  }
}

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${env.nodeEnv}`);

  runAiWeeklySummaryIfDue().catch(() => {});
  runDailyOverdueSuspensionIfDue().catch(() => {});
  setInterval(() => {
    runAiWeeklySummaryIfDue().catch(() => {});
    runDailyOverdueSuspensionIfDue().catch(() => {});
  }, 60 * 1000);
  logger.info('Admin AI weekly scheduler enabled (Monday mornings)');
  logger.info('Monetization overdue suspension scheduler enabled (daily)');
});
