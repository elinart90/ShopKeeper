"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetPinEmail = sendPasswordResetPinEmail;
exports.sendClearDataPinEmail = sendClearDataPinEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const logger_1 = require("./logger");
let transporter = null;
function getTransporter() {
    if (transporter)
        return transporter;
    const { email } = env_1.env;
    if (!email.user || !email.password) {
        logger_1.logger.warn('Email not configured (EMAIL_USER/EMAIL_PASSWORD missing). PIN emails will not be sent.');
        return null;
    }
    transporter = nodemailer_1.default.createTransport({
        host: email.host,
        port: email.port,
        secure: email.secure,
        auth: {
            user: email.user,
            pass: email.password,
        },
    });
    return transporter;
}
/**
 * Send the 6-digit PIN for password reset.
 */
async function sendPasswordResetPinEmail(to, pin) {
    const transport = getTransporter();
    if (!transport)
        return false;
    try {
        await transport.sendMail({
            from: env_1.env.email.from,
            to,
            subject: 'Your ShopKeeper password reset PIN',
            text: `Your password reset PIN is: ${pin}\n\nThis PIN expires in 10 minutes. Do not share it.\n\nIf you did not request a password reset, please ignore this email.`,
            html: `
        <p>Your password reset PIN is: <strong style="font-size:1.2em;letter-spacing:2px;">${pin}</strong></p>
        <p>This PIN expires in 10 minutes. Do not share it.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
        });
        logger_1.logger.info(`Password reset PIN email sent to ${to}`);
        return true;
    }
    catch (err) {
        logger_1.logger.error('Failed to send password reset PIN email:', err);
        return false;
    }
}
/**
 * Send the 6-digit PIN to open the dashboard edit interface (refunds, clear data, etc.).
 */
async function sendClearDataPinEmail(to, pin) {
    const transport = getTransporter();
    if (!transport)
        return false;
    try {
        await transport.sendMail({
            from: env_1.env.email.from,
            to,
            subject: 'Your ShoopKeeper PIN – Dashboard edit',
            text: `Your verification PIN is: ${pin}\n\nThis PIN expires in 10 minutes. Use it to open the dashboard edit interface (refunds, void sales, clear data). Do not share it.\n\nIf you did not request this, please ignore this email.`,
            html: `
        <p>Your verification PIN is: <strong style="font-size:1.2em;letter-spacing:2px;">${pin}</strong></p>
        <p>This PIN expires in 10 minutes. Use it to open the dashboard edit interface (refunds, void sales, clear data). Do not share it.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
        });
        logger_1.logger.info(`Dashboard edit PIN email sent to ${to}`);
        return true;
    }
    catch (err) {
        logger_1.logger.error('Failed to send PIN email:', err);
        return false;
    }
}
//# sourceMappingURL=email.js.map