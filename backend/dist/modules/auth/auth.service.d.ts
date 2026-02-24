interface LoginAttemptMeta {
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceFingerprint?: string | null;
}
export declare class AuthService {
    private createSession;
    private writeLoginHistory;
    register(name: string, email: string, password: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: string;
        };
        token: string;
    }>;
    login(email: string, password: string, meta?: LoginAttemptMeta): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            role: string;
        };
        token: string;
        sessionId: string | undefined;
    }>;
    /**
     * Create a user account for staff (used when owner adds staff by email/name/password).
     * Returns the user if created or existing; does not return a token.
     */
    createUserForShop(name: string, email: string, password: string): Promise<{
        id: any;
        name: any;
        email: any;
    }>;
    getMe(userId: string): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
    }>;
    getPlatformAdminStatus(userId: string): Promise<{
        isPlatformAdmin: false;
        role?: undefined;
    } | {
        isPlatformAdmin: true;
        role: string;
    }>;
    updateProfile(userId: string, data: {
        name?: string;
        email?: string;
    }): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
    }>;
    /**
     * Verify that the given password matches the user's password. Used for sensitive actions (e.g. clear dashboard).
     */
    verifyPassword(userId: string, password: string): Promise<boolean>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        updated: boolean;
    }>;
    /**
     * Resolve the canonical user id from the database (single source of truth).
     * Uses JWT sub first, then email (unique) so shops/records are always tied to the same user row.
     */
    resolveUserId(userIdFromToken: string, emailFromToken?: string): Promise<string>;
    private createToken;
    /** Request password reset: send 6-digit PIN to email. Always returns success (don't reveal if email exists). */
    forgotPasswordRequest(email: string): Promise<{
        message: string;
    }>;
    /** Verify forgot-password PIN without changing password. */
    verifyForgotPasswordPin(email: string, pin: string): Promise<{
        valid: boolean;
    }>;
    /** Reset password with PIN. */
    forgotPasswordReset(email: string, pin: string, newPassword: string): Promise<{
        success: boolean;
    }>;
}
export {};
//# sourceMappingURL=auth.service.d.ts.map