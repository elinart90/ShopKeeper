import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscriptionsApi } from '../../../lib/api';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';

export default function SubscriptionCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get('reference');
  const [state, setState] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('Verifying your subscription payment...');

  useEffect(() => {
    if (!reference) {
      setState('failed');
      setMessage('Missing payment reference.');
      return;
    }

    let active = true;
    subscriptionsApi
      .verify(reference)
      .then((res) => {
        if (!active) return;
        if (res.data?.success && res.data?.data?.isActive) {
          setState('success');
          setMessage('Subscription activated successfully.');
          setTimeout(() => {
            navigate('/shops/create', { replace: true });
          }, 1200);
        } else {
          setState('failed');
          setMessage((res.data as any)?.error?.message || 'Payment was not confirmed.');
        }
      })
      .catch((error: any) => {
        if (!active) return;
        setState('failed');
        setMessage(error?.response?.data?.error?.message || 'Verification failed.');
      });

    return () => {
      active = false;
    };
  }, [reference, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-emerald-500/20 mb-6">
              <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifying...</h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-emerald-500/20 mb-6">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Subscription active</h2>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-red-500/20 mb-6">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/subscription', { replace: true })}
              className="px-6 py-3 rounded-xl btn-primary-gradient font-medium"
            >
              Back to plans
            </button>
          </>
        )}
      </div>
    </div>
  );
}
