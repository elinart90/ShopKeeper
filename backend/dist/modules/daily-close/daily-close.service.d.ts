export declare class DailyCloseService {
    create(shopId: string, userId: string, body: unknown): Promise<any>;
    approve(shopId: string, userId: string, id: string): Promise<any>;
    reject(shopId: string, userId: string, id: string): Promise<any>;
    getByDate(shopId: string, closeDate: string): Promise<any>;
    getRecent(shopId: string, limit?: number): Promise<any[]>;
}
//# sourceMappingURL=daily-close.service.d.ts.map