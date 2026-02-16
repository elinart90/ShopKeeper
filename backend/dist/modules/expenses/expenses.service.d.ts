export declare class ExpensesService {
    createExpense(shopId: string, userId: string, data: any): Promise<any>;
    getExpenses(shopId: string, filters?: {
        startDate?: string;
        endDate?: string;
        category_id?: string;
    }): Promise<any[]>;
    getExpenseCategories(shopId: string): Promise<{
        id: any;
        name: any;
        description: any;
    }[]>;
    createExpenseCategory(shopId: string, data: {
        name: string;
        description?: string;
    }): Promise<any>;
}
//# sourceMappingURL=expenses.service.d.ts.map