export declare class MembersService {
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
}
//# sourceMappingURL=members.service.d.ts.map