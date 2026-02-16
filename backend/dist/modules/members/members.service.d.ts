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
}
//# sourceMappingURL=members.service.d.ts.map