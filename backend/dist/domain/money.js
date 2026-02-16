"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Money = void 0;
class Money {
    constructor(amount, currency = 'USD') {
        this.amount = amount;
        this.currency = currency;
    }
    add(other) {
        if (this.currency !== other.currency) {
            throw new Error('Cannot add different currencies');
        }
        return new Money(this.amount + other.amount, this.currency);
    }
    subtract(other) {
        if (this.currency !== other.currency) {
            throw new Error('Cannot subtract different currencies');
        }
        return new Money(this.amount - other.amount, this.currency);
    }
    multiply(factor) {
        return new Money(this.amount * factor, this.currency);
    }
    format() {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.currency,
        }).format(this.amount);
    }
    toJSON() {
        return {
            amount: this.amount,
            currency: this.currency,
        };
    }
}
exports.Money = Money;
//# sourceMappingURL=money.js.map