import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';
import AdminDataTable from '../components/AdminDataTable';
import AdminFiltersBar from '../components/AdminFiltersBar';
import AdminStatusBadge from '../components/AdminStatusBadge';

export default function AdminTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [query, setQuery] = useState({
    search: '',
    status: '',
    paymentMethod: '',
    cashierUserId: '',
    from: '',
    to: '',
    page: 1,
    limit: 50,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.getTransactions({
        search: query.search || undefined,
        status: query.status || undefined,
        paymentMethod: query.paymentMethod || undefined,
        cashierUserId: query.cashierUserId || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        page: query.page,
        limit: query.limit,
      }),
      adminApi.getWorkerInsights({
        from: query.from || undefined,
        to: query.to || undefined,
      }),
    ])
      .then(([txRes, insightsRes]) => {
        setTransactions(txRes.data?.data?.items || []);
        setInsights(insightsRes.data?.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const cancelSale = async (saleId: string) => {
    const ok = window.confirm('Cancel this sale globally? This reflects across owner/admin dashboards.');
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi.cancelTransactionSale(saleId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revokeWorker = async (userId: string) => {
    const ok = window.confirm('Revoke this worker access now? This will disable the user account.');
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi.revokeWorkerAccess(userId, {});
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Transactions & Cashier Intelligence</h1>

      <AdminFiltersBar onApply={load}>
        <input
          value={query.search}
          onChange={(e) => setQuery((s) => ({ ...s, search: e.target.value }))}
          placeholder="Search sale #"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <input
          value={query.cashierUserId}
          onChange={(e) => setQuery((s) => ({ ...s, cashierUserId: e.target.value }))}
          placeholder="Cashier user ID"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <select
          value={query.status}
          onChange={(e) => setQuery((s) => ({ ...s, status: e.target.value }))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={query.paymentMethod}
          onChange={(e) => setQuery((s) => ({ ...s, paymentMethod: e.target.value }))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">All payments</option>
          <option value="cash">Cash</option>
          <option value="mobile_money">Mobile money</option>
          <option value="card">Card</option>
          <option value="credit">Credit</option>
        </select>
        <input
          type="date"
          value={query.from}
          onChange={(e) => setQuery((s) => ({ ...s, from: e.target.value }))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <input
          type="date"
          value={query.to}
          onChange={(e) => setQuery((s) => ({ ...s, to: e.target.value }))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
      </AdminFiltersBar>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Suspicious / Underperforming Cashiers</h2>
        <AdminDataTable
          rows={insights}
          rowKey={(r) => r.cashierUserId}
          emptyText={loading ? 'Loading insights...' : 'No worker insights.'}
          columns={[
            { key: 'cashier', header: 'Cashier', render: (r) => `${r.cashierName}${r.cashierEmail ? ` (${r.cashierEmail})` : ''}` },
            { key: 'risk', header: 'Risk', render: (r) => <AdminStatusBadge status={r.riskLevel === 'high' ? 'flagged' : r.riskLevel === 'medium' ? 'suspended' : 'active'} /> },
            { key: 'tx', header: 'Transactions', render: (r) => Number(r.transactionCount || 0).toLocaleString() },
            { key: 'cancel', header: 'Cancel %', render: (r) => `${Number(r.cancelRate || 0).toFixed(2)}%` },
            { key: 'avg', header: 'Avg Ticket', render: (r) => `GHS ${Number(r.avgTicket || 0).toLocaleString()}` },
            { key: 'signals', header: 'Signals', render: (r) => (Array.isArray(r.signals) && r.signals.length ? r.signals.join(', ') : '-') },
            {
              key: 'action',
              header: 'Action',
              className: 'text-right',
              render: (r) => (
                <button
                  disabled={busy}
                  onClick={() => revokeWorker(r.cashierUserId)}
                  className="rounded-lg border border-red-500 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  Revoke access
                </button>
              ),
            },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Global Transactions</h2>
        <AdminDataTable
          rows={transactions}
          rowKey={(r) => r.id}
          emptyText={loading ? 'Loading transactions...' : 'No transactions found.'}
          columns={[
            { key: 'sale', header: 'Sale #', render: (r) => r.sale_number || '-' },
            { key: 'shop', header: 'Shop', render: (r) => r.shopName || '-' },
            { key: 'cashier', header: 'Cashier', render: (r) => r.cashier?.name || r.cashier?.email || '-' },
            { key: 'payment', header: 'Payment', render: (r) => r.payment_method || '-' },
            { key: 'amount', header: 'Amount', render: (r) => `GHS ${Number(r.final_amount || 0).toLocaleString()}` },
            { key: 'status', header: 'Status', render: (r) => <AdminStatusBadge status={r.status || 'unknown'} /> },
            { key: 'time', header: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
            {
              key: 'action',
              header: 'Action',
              className: 'text-right',
              render: (r) =>
                String(r.status || '').toLowerCase() === 'completed' ? (
                  <button
                    disabled={busy}
                    onClick={() => cancelSale(r.id)}
                    className="rounded-lg border border-red-500 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    Cancel sale
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
