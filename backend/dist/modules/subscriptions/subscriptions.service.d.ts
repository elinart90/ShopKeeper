export type PlanCode = 'small' | 'medium' | 'big' | 'enterprise';
export type SubscriptionStatusCode = 'inactive' | 'active' | 'past_due' | 'expired' | 'cancelled';
export interface PlanDefinition {
    code: PlanCode;
    name: string;
    amountMinor: number;
    currency: 'GHS';
}
export interface SubscriptionStatusResult {
    hasPlan: boolean;
    status: SubscriptionStatusCode;
    isActive: boolean;
    planCode?: PlanCode;
    planName?: string;
    amount?: number;
    currency?: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
}
export declare class SubscriptionsService {
    listPlans(): {
        code: PlanCode;
        name: string;
        amount: number;
        currency: "GHS";
        interval: "monthly";
    }[];
    private getSecretKey;
    private getPlan;
    private createReference;
    private addOneCalendarMonth;
    getStatus(userId: string): Promise<SubscriptionStatusResult>;
    initialize(userId: string, email: string, planCode: string): Promise<{
        authorization_url: string;
        reference: string;
    }>;
    verify(userId: string, reference: string): Promise<{
        success: boolean;
        status: SubscriptionStatusResult;
    }>;
}
//# sourceMappingURL=subscriptions.service.d.ts.map