import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentsApi, salesApi } from '../../../lib/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PENDING_PAYSTACK_SALE_KEY = 'shoopkeeper_pending_paystack_sale';

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get('reference');

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setErrorMessage('No payment reference in URL.');
      return;
    }

    let cancelled = false;

    paymentsApi
      .verifyPaystack(reference)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data?.data?.payment) {
          setStatus('success');
          const pendingJson = sessionStorage.getItem(PENDING_PAYSTACK_SALE_KEY);
          if (pendingJson) {
            try {
              const pending = JSON.parse(pendingJson) as {
                items: Array<{ product_id: string; quantity: number; unit_price: number; discount_amount: number }>;
                discount_amount: number;
                payment_method: string;
              };
              salesApi
                .create(pending)
                .then((saleRes) => {
                  if (cancelled) return;
                  const sale = saleRes.data?.data;
                  if (sale?.id) {
                    sessionStorage.removeItem(PENDING_PAYSTACK_SALE_KEY);
                    setSaleId(sale.id);
                  }
                })
                .catch(() => {
                  if (cancelled) return;
                  setErrorMessage('Payment verified but sale could not be completed. Contact support.');
                });
            } catch {
              sessionStorage.removeItem(PENDING_PAYSTACK_SALE_KEY);
            }
          }
        } else {
          setStatus('failed');
          setErrorMessage((res.data as { error?: { message?: string } })?.error?.message || 'Verification failed.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('failed');
        setErrorMessage(err.response?.data?.error?.message || err.message || 'Verification failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [reference]);

  const goToDashboard = () => navigate('/dashboard', { replace: true });
  const goToSale = () => saleId && navigate(`/sales/${saleId}`, { replace: true });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="relative z-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-emerald-500/20 mb-6">
              <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Verifying payment...
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Do not close this page. We are confirming your payment with Paystack.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-emerald-500/20 mb-6">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {saleId ? 'Sale completed' : 'Payment successful'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {saleId
                ? 'Your payment was confirmed and the sale has been recorded.'
                : errorMessage
                  ? errorMessage
                  : 'Your payment has been confirmed. You can return to the dashboard.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {saleId && (
                <button
                  type="button"
                  onClick={goToSale}
                  className="px-6 py-3 rounded-xl btn-primary-gradient font-medium"
                >
                  View sale
                </button>
              )}
              <button
                type="button"
                onClick={goToDashboard}
                className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                  saleId
                    ? 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    : 'btn-primary-gradient'
                }`}
              >
                {saleId ? 'Dashboard' : 'Back to Dashboard'}
              </button>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-red-500/20 mb-6">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment verification failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage || 'We could not confirm your payment. Please try again or contact support.'}
            </p>
            <button
              type="button"
              onClick={goToDashboard}
              className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
