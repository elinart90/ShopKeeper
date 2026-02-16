import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { salesApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    salesApi
      .getSale(id)
      .then((res) => {
        setSale(res.data.data);
      })
      .catch(() => {
        toast.error('Sale not found');
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (!currentShop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Select a shop first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sale) return null;

  const currency = currentShop.currency || 'USD';
  const isCreditRepayment = String(sale.notes || '').includes('[CREDIT_REPAYMENT]');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-lg mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {isCreditRepayment ? 'Credit repayment' : 'Sale completed'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sale.sale_number}
              </p>
              {isCreditRepayment && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  Credit Repayment
                </span>
              )}
            </div>
          </div>

          <dl className="space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Total</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">
                {currency} {Number(sale.final_amount).toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Payment</dt>
              <dd className="capitalize text-gray-900 dark:text-white">
                {sale.payment_method?.replace('_', ' ')}
              </dd>
            </div>
            {sale.customer && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Customer</dt>
                <dd className="text-gray-900 dark:text-white">
                  {sale.customer.name || sale.customer_id}
                </dd>
              </div>
            )}
          </dl>

          {!isCreditRepayment && (
            <>
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Items
              </h2>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 mb-6">
                {(sale.items || []).map((item: any) => (
                  <li
                    key={item.id}
                    className="py-2 flex justify-between text-sm text-gray-900 dark:text-white"
                  >
                    <span>
                      {item.product?.name || 'Product'} × {item.quantity}
                    </span>
                    <span>
                      {currency} {Number(item.total_price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/sales/new')}
              className="flex-1 py-3 rounded-lg btn-primary-gradient flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-5 w-5" />
              New sale
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
