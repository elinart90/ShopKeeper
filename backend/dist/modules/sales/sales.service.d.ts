export declare class SalesService {
    private consumeFifoCost;
    private restoreCostLayerFromReturn;
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
    getGoodsSoldSummary(shopId: string, startDate?: string, endDate?: string): Promise<any[]>;
    getSalesSummary(shopId: string, startDate?: string, endDate?: string): Promise<{
        totalSales: number;
        totalTransactions: number;
        averageTransaction: number;
        paymentMethodBreakdown: any;
    }>;
    cancelSale(saleId: string, shopId: string, userId: string): Promise<any>;
    returnSaleItem(saleId: string, shopId: string, userId: string, input: {
        sale_item_id: string;
        quantity: number;
        reason?: string;
    }): Promise<any>;
    createPartialRefund(saleId: string, shopId: string, userId: string, input: {
        amount: number;
        reason?: string;
    }): Promise<any>;
}
//# sourceMappingURL=sales.service.d.ts.map