export declare class WalletsService {
    ensureWallets(shopId: string, currency: string): Promise<void>;
    getWallets(shopId: string): Promise<any[]>;
    getWalletTransactions(shopId: string, walletId?: string, limit?: number): Promise<any[]>;
    adjustBalance(shopId: string, userId: string, body: any): Promise<any>;
    transfer(shopId: string, userId: string, body: any): Promise<any>;
}
//# sourceMappingURL=wallets.service.d.ts.map