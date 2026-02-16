export type PlanCode = 'small' | 'medium' | 'big' | 'enterprise';
export type SubscriptionStatusCode = 'inactive' | 'active' | 'past_due' | 'expired' | 'cancelled';
export type BillingCycle = 'monthly' | 'yearly';
export interface PlanDefinition {
    code: PlanCode;
    name: string;
    amountMinor: number;
    currency: 'GHS';
}
interface ActivateFromChargeInput {
    userId: string;
    reference: string;
    amountMinor: number;
    currency?: string;
    paidAtIso?: string;
    planCode?: string;
    billingCycle?: BillingCycle;
    rawPayload?: Record<string, unknown>;
}
export interface SubscriptionStatusResult {
    hasPlan: boolean;
    status: SubscriptionStatusCode;
    isActive: boolean;
    planCode?: PlanCode;
    planName?: string;
    amount?: number;
    currency?: string;
    billingCycle?: BillingCycle;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
}
export declare class SubscriptionsService {
    private readonly yearlyDiscountPercent;
    private isMissingBillingCycleColumn;
    listPlans(): {
        code: PlanCode;
        name: string;
        monthlyAmount: number;
        yearlyAmount: number;
        yearlyDiscountPercent: number;
        currency: "GHS";
        interval: "monthly";
    }[];
    private getSecretKey;
    private getPlan;
    private createReference;
    private addByBillingCycle;
    private getAmountMinorForCycle;
    private getPlanAndCycleByAmountMinor;
    private readSubscriptionRow;
    private buildStatusFromRow;
    getStatus(userId: string, shopId?: string): Promise<SubscriptionStatusResult>;
    initialize(userId: string, email: string, planCode: string, billingCycle?: BillingCycle): Promise<{
        authorization_url: string;
        reference: string;
    }>;
    verify(userId: string, reference: string): Promise<{
        success: boolean;
        status: SubscriptionStatusResult;
    }>;
    activateFromSuccessfulCharge(input: ActivateFromChargeInput): Promise<void>;
    markPastDue(userId: string): Promise<void>;
}
export {};
//# sourceMappingURL=subscriptions.service.d.ts.map