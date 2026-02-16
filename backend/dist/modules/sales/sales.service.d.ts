export declare class SalesService {
    createSale(shopId: string, userId: string, data: any): Promise<any>;
    getSaleById(saleId: string): Promise<any>;
    getSales(shopId: string, filters?: {
        startDate?: string;
        endDate?: string;
        customer_id?: string;
        payment_method?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    getSalesSummary(shopId: string, startDate?: string, endDate?: string): Promise<{
        totalSales: number;
        totalTransactions: number;
        averageTransaction: number;
        paymentMethodBreakdown: any;
    }>;
    cancelSale(saleId: string, shopId: string, userId: string): Promise<any>;
}
//# sourceMappingURL=sales.service.d.ts.map