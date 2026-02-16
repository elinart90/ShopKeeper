export declare class Money {
    amount: number;
    currency: string;
    constructor(amount: number, currency?: string);
    add(other: Money): Money;
    subtract(other: Money): Money;
    multiply(factor: number): Money;
    format(): string;
    toJSON(): {
        amount: number;
        currency: string;
    };
}
//# sourceMappingURL=money.d.ts.map