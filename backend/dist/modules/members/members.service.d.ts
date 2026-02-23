export declare class MembersService {
    private static readonly ALLOWED_PAYMENT_METHODS;
    createCustomer(shopId: string, data: any): Promise<any>;
    getCustomers(shopId: string, search?: string): Promise<any[]>;
    getCustomerById(customerId: string): Promise<any>;
    updateCustomer(customerId: string, shopId: string, data: any): Promise<any>;
    /** Credit & Customer Risk: customers owing money and total exposure */
    getCreditSummary(shopId: string): Promise<{
        totalExposure: number;
        count: number;
        customersOwing: {
            id: any;
            name: any;
            phone: any;
            email: any;
            credit_balance: number;
            credit_limit: number;
        }[];
    }>;
    /** Record customer credit repayment, reduce balance, and post to sales for dashboard visibility. */
    recordCreditPayment(customerId: string, shopId: string, userId: string, amount: number, paymentMethod: string, notes?: string): Promise<any>;
    private normalizeCurrencyText;
    private parseAiJson;
    private callOpenAiText;
    private callClaudeText;
    private callOpenAiThenClaude;
    getCreditIntelligence(shopId: string, lookbackDays?: number): Promise<{
        providerUsed: "openai" | "claude";
        lookbackDays: number;
        totalExposure: number;
        customersOwingCount: number;
        overdueAmount: number;
        highRiskCount: number;
        mediumRiskCount: number;
        collectionRateRecent: number;
        agingBuckets: {
            d0_7: number;
            d8_30: number;
            d31_60: number;
            d61_plus: number;
        };
        customers: {
            overdueDays: number;
            riskScore: number;
            riskLevel: string;
            recommendedAction: string;
            id: string;
            name: string;
            phone: any;
            email: any;
            credit_balance: number;
            credit_limit: number;
        }[];
        aiSummary: string;
        snapshot: {
            totalExposure: number;
            customersOwing: number;
            overdueAmount: number;
            highRiskCount: number;
            mediumRiskCount: number;
            agingBuckets: {
                d0_7: number;
                d8_30: number;
                d31_60: number;
                d61_plus: number;
            };
            collectionRateRecent: number;
            topRiskCustomers: {
                name: string;
                balance: number;
                overdueDays: number;
                riskScore: number;
                riskLevel: string;
            }[];
        };
    }>;
    queryCreditIntelligence(shopId: string, query: string, lookbackDays?: number): Promise<{
        providerUsed: "openai" | "claude";
        lookbackDays: number;
        query: string;
        answer: string;
        basedOn: {
            totalExposure: number;
            highRiskCount: number;
        };
    }>;
    runAutoCreditReminders(shopId: string, userId: string, intervalDays?: number, lookbackDays?: number): Promise<{
        intervalDays: number;
        dueCount: number;
        reminders: never[];
        providerUsed?: undefined;
    } | {
        providerUsed: "openai" | "claude";
        intervalDays: number;
        dueCount: number;
        reminders: {
            customerId: string;
            customerName: string;
            phone: string | null;
            email: string | null;
            balance: number;
            overdueDays: number;
            riskLevel: string;
            message: string;
        }[];
    }>;
}
//# sourceMappingURL=members.service.d.ts.map