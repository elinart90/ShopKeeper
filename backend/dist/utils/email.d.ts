/**
 * Send the 6-digit PIN for password reset.
 */
export declare function sendPasswordResetPinEmail(to: string, pin: string): Promise<boolean>;
/**
 * Send the 6-digit PIN to open the dashboard edit interface (refunds, clear data, etc.).
 */
export declare function sendClearDataPinEmail(to: string, pin: string): Promise<boolean>;
//# sourceMappingURL=email.d.ts.map