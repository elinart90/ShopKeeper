import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const { email } = env;
  const normalizedUser = String(email.user || '').trim();
  let normalizedPassword = String(email.password || '').trim();
  // Gmail app passwords are often copied with spaces every 4 chars.
  if (/gmail\.com/i.test(String(email.host || ''))) {
    normalizedPassword = normalizedPassword.replace(/\s+/g, '');
  }

  if (!normalizedUser || !normalizedPassword) {
    logger.warn('Email not configured (EMAIL_USER/EMAIL_PASSWORD missing). PIN emails will not be sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: String(email.host || '').trim(),
    port: Number(email.port || 587),
    secure: email.secure,
    auth: {
      user: normalizedUser,
      pass: normalizedPassword,
    },
  });
  return transporter;
}

/**
 * Send the 6-digit PIN for password reset.
 */
export async function sendPasswordResetPinEmail(to: string, pin: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: env.email.from,
      to,
      subject: 'Your ShopKeeper password reset PIN',
      text: `Your password reset PIN is: ${pin}\n\nThis PIN expires in 10 minutes. Do not share it.\n\nIf you did not request a password reset, please ignore this email.`,
      html: `
        <p>Your password reset PIN is: <strong style="font-size:1.2em;letter-spacing:2px;">${pin}</strong></p>
        <p>This PIN expires in 10 minutes. Do not share it.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      `,
    });
    logger.info(`Password reset PIN email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('Failed to send password reset PIN email:', err);
    return false;
  }
}

/**
 * Send the 6-digit PIN to open the dashboard edit interface (refunds, clear data, etc.).
 */
export async function sendClearDataPinEmail(to: string, pin: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: env.email.from,
      to,
      subject: 'Your ShoopKeeper PIN – Dashboard edit',
      text: `Your verification PIN is: ${pin}\n\nThis PIN expires in 10 minutes. Use it to open the dashboard edit interface (refunds, void sales, clear data). Do not share it.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <p>Your verification PIN is: <strong style="font-size:1.2em;letter-spacing:2px;">${pin}</strong></p>
        <p>This PIN expires in 10 minutes. Use it to open the dashboard edit interface (refunds, void sales, clear data). Do not share it.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
    logger.info(`Dashboard edit PIN email sent to ${to}`);
    return true;
  } catch (err) {
    logger.error('Failed to send PIN email:', err);
    return false;
  }
}

/**
 * Generic email helper for operational notifications.
 */
export async function sendGenericEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: env.email.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html || `<pre style="font-family:inherit;white-space:pre-wrap;">${params.text}</pre>`,
    });
    return true;
  } catch (err) {
    logger.error('Failed to send generic email:', err);
    return false;
  }
}
