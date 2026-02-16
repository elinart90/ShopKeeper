export declare class ReportsService {
    getDashboardStats(shopId: string, startDate?: string, endDate?: string): Promise<{
        totalSales: number;
        totalExpenses: number;
        profit: number;
        totalTransactions: number;
        lowStockCount: number;
        averageTransaction: number;
        paymentMethodBreakdown: Record<string, number>;
        activeStaffToday: number;
    }>;
    getSalesIntelligence(shopId: string, startDate?: string, endDate?: string): Promise<{
        topProducts: {
            productId: string;
            name: any;
            quantitySold: number;
            revenue: number;
        }[];
        slowMovingProducts: {
            productId: any;
            name: any;
            quantitySold: any;
            revenue: any;
        }[];
        paymentMethodBreakdown: Record<string, {
            amount: number;
            count: number;
        }>;
        peakHours: {
            hour: number;
            amount: number;
        }[];
        salesByStaff: {
            amount: number;
            count: number;
            staffId: string;
        }[];
    }>;
    getInventoryFinance(shopId: string, deadStockDays?: number): Promise<{
        totalStockValue: number;
        potentialRevenue: number;
        potentialProfit: number;
        lowStock: {
            productId: string;
            name: string;
            stockQuantity: number;
            minStockLevel: number;
            costPrice: number;
            valueAtRisk: number;
            replenishCost: number;
        }[];
        deadStock: {
            productId: any;
            name: any;
            stockQuantity: number;
            stockValue: number;
        }[];
        productCount: number;
    }>;
    getExpensesProfitReport(shopId: string, startDate?: string, endDate?: string): Promise<{
        totalRevenue: any;
        totalExpenses: any;
        netProfit: number;
        expenseVsRevenueRatio: number;
        expensesByCategory: {
            categoryId: string;
            categoryName: string;
            amount: number;
            count: number;
        }[];
        dailyNetProfit: {
            date: string;
            revenue: number;
            expenses: number;
            profit: number;
        }[];
        monthlyTrend: {
            month: string;
            year: number;
            monthLabel: string;
            revenue: number;
            expenses: number;
            profit: number;
        }[];
    }>;
    /** Compliance export: daily | monthly | pl | tax. Returns one payload for PDF/email. */
    getComplianceExport(shopId: string, type: 'daily' | 'monthly' | 'pl' | 'tax', opts: {
        date?: string;
        startDate?: string;
        endDate?: string;
        month?: string;
    }): Promise<{
        monthlyTrend?: {
            month: string;
            year: number;
            monthLabel: string;
            revenue: number;
            expenses: number;
            profit: number;
        }[] | undefined;
        type: "monthly" | "pl" | "daily" | "tax";
        periodLabel: string;
        startDate: string;
        endDate: string;
        totalSales: number;
        totalExpenses: number;
        profit: number;
        totalTransactions: number;
        paymentMethodBreakdown: Record<string, number>;
        expensesByCategory: {
            categoryId: string;
            categoryName: string;
            amount: number;
            count: number;
        }[];
        dailyNetProfit: {
            date: string;
            revenue: number;
            expenses: number;
            profit: number;
        }[];
    }>;
}
//# sourceMappingURL=reports.service.d.ts.map