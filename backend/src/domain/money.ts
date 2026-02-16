export class Money {
  constructor(
    public amount: number,
    public currency: string = 'USD'
  ) {}

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract different currencies');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  format(): string { 
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
