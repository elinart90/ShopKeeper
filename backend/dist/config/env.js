"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
    paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        password: process.env.EMAIL_PASSWORD || '',
        from: process.env.EMAIL_FROM || 'ShoopKeeper <noreply@localhost>',
    },
};
//# sourceMappingURL=env.js.map