"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
// Import routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const shops_routes_1 = __importDefault(require("./modules/shops/shops.routes"));
const inventory_routes_1 = __importDefault(require("./modules/inventory/inventory.routes"));
const sales_routes_1 = __importDefault(require("./modules/sales/sales.routes"));
const members_routes_1 = __importDefault(require("./modules/members/members.routes"));
const expenses_routes_1 = __importDefault(require("./modules/expenses/expenses.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const sync_routes_1 = __importDefault(require("./modules/sync/sync.routes"));
const wallets_routes_1 = __importDefault(require("./modules/wallets/wallets.routes"));
const daily_close_routes_1 = __importDefault(require("./modules/daily-close/daily-close.routes"));
const payments_routes_1 = __importDefault(require("./modules/payments/payments.routes"));
const subscriptions_routes_1 = __importDefault(require("./modules/subscriptions/subscriptions.routes"));
const controls_routes_1 = __importDefault(require("./modules/controls/controls.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const public_routes_1 = __importDefault(require("./modules/public/public.routes"));
const webhook_paystack_1 = require("./modules/payments/webhook.paystack");
const apiAccessLogger_1 = require("./middleware/apiAccessLogger");
const app = (0, express_1.default)();
// Middleware - allow frontend dev server, configured URL, and LAN IPs (for phone testing)
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        const allowed = [env_1.env.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];
        if (!origin)
            return cb(null, true);
        if (allowed.includes(origin))
            return cb(null, true);
        // Allow same-machine / LAN access (e.g. http://169.254.x.x:5173 or http://192.168.x.x:5173)
        if (/^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(origin) || /^https?:\/\/\[::ffff:(\d{1,3}\.){3}\d{1,3}\](:\d+)?$/.test(origin))
            return cb(null, true);
        cb(null, false);
    },
    credentials: true,
}));
// Paystack webhook must receive raw body for signature verification (before json parser)
app.use('/api/webhooks/paystack', express_1.default.raw({ type: 'application/json' }), webhook_paystack_1.paystackWebhook);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
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
app.use('/api', apiAccessLogger_1.apiAccessLogger);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/shops', shops_routes_1.default);
app.use('/api/inventory', inventory_routes_1.default);
app.use('/api/sales', sales_routes_1.default);
app.use('/api/customers', members_routes_1.default);
app.use('/api/expenses', expenses_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api/sync', sync_routes_1.default);
app.use('/api/wallets', wallets_routes_1.default);
app.use('/api/daily-close', daily_close_routes_1.default);
app.use('/api/payments', payments_routes_1.default);
app.use('/api/subscriptions', subscriptions_routes_1.default);
app.use('/api/controls', controls_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/public', public_routes_1.default);
// Error handling
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map