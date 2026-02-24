import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../lib/api';

type VerifyResponse = {
  receiptRef: string;
  verifiedAt: string;
  isValid: boolean;
  sale: {
    id: string;
    sale_number: string;
    status: string;
    created_at: string;
    payment_method?: string;
    final_amount?: number;
    items?: Array<{
      id: string;
      quantity: number;
      total_price: number;
      product?: { name?: string };
    }>;
  };
  shop?: { name: string; currency?: string } | null;
};

export default function VerifyReceiptPage() {
  const { receiptRef = '' } = useParams<{ receiptRef: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<{ success: boolean; data: VerifyResponse }>(
          `/public/receipts/${encodeURIComponent(receiptRef)}`
        );
        if (!active) return;
        setData(res.data?.data || null);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Receipt not found');
      } finally {
        if (active) setLoading(false);
      }
    };
    if (receiptRef) run();
    else {
      setLoading(false);
      setError('Invalid receipt reference');
    }
    return () => {
      active = false;
    };
  }, [receiptRef]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl border border-red-300 bg-white p-5 dark:border-red-800 dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-red-700 dark:text-red-300">Receipt verification failed</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{error || 'Receipt not found'}</p>
          <Link to="/" className="mt-4 inline-block text-sm text-emerald-600 hover:text-emerald-700">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  const currency = data.shop?.currency || 'GHS';

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Receipt verification</h1>
          <span className={data.isValid ? 'text-emerald-600' : 'text-red-600'}>{data.isValid ? 'Valid' : 'Invalid'}</span>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {data.shop?.name || '-'} | {data.sale.sale_number || '-'} | {currency} {Number(data.sale.final_amount || 0).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
