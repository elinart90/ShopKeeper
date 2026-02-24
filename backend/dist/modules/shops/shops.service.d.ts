export declare class ShopsService {
    private isMissingBillingCycleColumn;
    private readSubscriptionForTransfer;
    private carryOwnerSubscriptionToNewOwner;
    createShop(userId: string, data: any): Promise<any>;
    getShopById(shopId: string): Promise<any>;
    getUserShops(userId: string): Promise<any[]>;
    updateShop(shopId: string, userId: string, data: any): Promise<any>;
    addMember(shopId: string, requesterUserId: string, data: {
        email: string;
        name?: string;
        password: string;
        role: string;
    }): Promise<{
        user_id: any;
        name: any;
        email: any;
        role: string;
        added: boolean;
    }>;
    getShopMembers(shopId: string, requesterUserId: string): Promise<{
        id?: string;
        user_id: string;
        role: string;
        name: string;
        email: string;
        is_owner: boolean;
    }[]>;
    removeMember(shopId: string, memberUserId: string, requesterUserId: string): Promise<{
        removed: boolean;
    }>;
    transferOwnership(shopId: string, newOwnerUserId: string, requesterUserId: string): Promise<{
        transferred: boolean;
        newOwnerId: string;
    }>;
    deleteShop(shopId: string, userId: string): Promise<{
        deleted: boolean;
    }>;
    /** Owner-only: request a 6-digit PIN to open the dashboard edit interface. PIN is sent to user email. */
    requestClearDataPin(shopId: string, userId: string, password: string): Promise<{
        message: string;
    }>;
    /** Owner-only: verify PIN and return a short-lived token to use the dashboard edit interface. */
    confirmDashboardEdit(shopId: string, userId: string, pin: string): Promise<{
        dashboardEditToken: string;
        expiresIn: number;
    }>;
    /**
     * Owner-only (via dashboard edit token): set data_cleared_at so the dashboard only shows data from now on.
     */
    clearDashboardData(shopId: string, userId: string): Promise<{
        cleared: boolean;
    }>;
    /**
     * Owner-only (via dashboard edit token): reset data_cleared_at so the main dashboard shows all data again.
     */
    resetDashboardView(shopId: string, userId: string): Promise<{
        reset: boolean;
    }>;
}
//# sourceMappingURL=shops.service.d.ts.map