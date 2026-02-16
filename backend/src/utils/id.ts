import { randomUUID } from 'crypto';

export function generateId(): string {
  return randomUUID();
}

export function generateSaleNumber(shopId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SALE-${timestamp}-${random}`;
}
