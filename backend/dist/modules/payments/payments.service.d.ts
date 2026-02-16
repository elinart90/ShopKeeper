declare const PURPOSES: readonly ["subscription", "topup", "invoice", "order"];
type Purpose = (typeof PURPOSES)[number];
export interface InitializeInput {
    shop_id: string;
    amount: number;
    currency?: string;
    email: string;
    purpose?: Purpose;
    metadata?: Record<string, unknown>;
}
export interface InitializeResult {
    authorization_url: string;
    access_code: string;
    reference: string;
}
export declare class PaymentsService {
    private getSecretKey;
    initialize(input: InitializeInput): Promise<InitializeResult>;
    verify(reference: string): Promise<{
        success: boolean;
        payment?: Record<string, unknown>;
    }>;
    getWebhookSecret(): string;
    processWebhook(rawBody: Buffer, signature: string): Promise<void>;
}
export {};
//# sourceMappingURL=payments.service.d.ts.map