import { logger } from '../../utils/logger';
import { AdminService } from './admin.service';

const adminService = new AdminService();
let schedulerStarted = false;
let lastSentWeekKey = '';

function getIsoWeekKey(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shouldRunNow(now: Date) {
  // Monday morning, local server time (from 08:00 onward) once per week.
  return now.getDay() === 1 && now.getHours() >= 8;
}

async function runScheduledExecutiveSummary() {
  const now = new Date();
  const weekKey = getIsoWeekKey(now);
  if (!shouldRunNow(now)) return;
  if (lastSentWeekKey === weekKey) return;

  logger.info('Running scheduled AI executive summary batch');
  try {
    const result = await adminService.emailAdminAiExecutiveSummaryToActivePlatformAdmins();
    lastSentWeekKey = weekKey;
    logger.info('Scheduled AI executive summary batch completed', result);
  } catch (error: any) {
    logger.error('Scheduled AI executive summary batch failed', {
      message: String(error?.message || error),
    });
  }
}

export function startAdminSchedulers() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run a quick check at boot, then every minute.
  runScheduledExecutiveSummary().catch(() => {});
  setInterval(() => {
    runScheduledExecutiveSummary().catch(() => {});
  }, 60 * 1000);

  logger.info('Admin schedulers started (weekly executive summary enabled)');
}
