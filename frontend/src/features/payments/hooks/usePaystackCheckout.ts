import { useState } from 'react';
import { paymentsApi } from '../../../lib/api';

/**
 * Call backend to initialize Paystack, then redirect to authorization_url.
 * After payment, user lands on /payments/callback where we verify and show result.
 */
export function usePaystackCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (params: {
    amount: number; // in kobo/pesewas (e.g. 5000 = 50.00 GHS)
    email: string;
    purpose?: 'subscription' | 'topup' | 'invoice' | 'order';
    metadata?: Record<string, unknown>;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsApi.initializePaystack({
        amount: params.amount,
        email: params.email,
        purpose: params.purpose,
        metadata: params.metadata,
      });
      const url = res.data?.data?.authorization_url;
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Could not get payment URL');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to start payment');
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading, error };
}
