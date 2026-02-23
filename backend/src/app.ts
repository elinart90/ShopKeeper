import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import shopsRoutes from './modules/shops/shops.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import salesRoutes from './modules/sales/sales.routes';
import customersRoutes from './modules/members/members.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import reportsRoutes from './modules/reports/reports.routes';
import syncRoutes from './modules/sync/sync.routes';
import walletsRoutes from './modules/wallets/wallets.routes';
import dailyCloseRoutes from './modules/daily-close/daily-close.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes';
import controlsRoutes from './modules/controls/controls.routes';
import adminRoutes from './modules/admin/admin.routes';
import { paystackWebhook } from './modules/payments/webhook.paystack';
import { apiAccessLogger } from './middleware/apiAccessLogger';

const app = express();

// Middleware - allow frontend dev server, configured URL, and LAN IPs (for phone testing)
app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    const allowed = [env.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    // Allow same-machine / LAN access (e.g. http://169.254.x.x:5173 or http://192.168.x.x:5173)
    if (/^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(origin) || /^https?:\/\/\[::ffff:(\d{1,3}\.){3}\d{1,3}\](:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

// Paystack webhook must receive raw body for signature verification (before json parser)
app.use('/api/webhooks/paystack', express.raw({ type: 'application/json' }), paystackWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root – so visiting / doesn't return "Cannot GET"
app.get('/', (req, res) => {
  res.json({ message: 'ShoopKeeper API', health: '/health', api: '/api/...' });
});

// Health check (Render and others often use /api/health)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiAccessLogger);
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/daily-close', dailyCloseRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/controls', controlsRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use(errorHandler);

export default app;
