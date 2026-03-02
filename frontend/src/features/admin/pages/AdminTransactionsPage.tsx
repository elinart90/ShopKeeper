import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';
import { adminApi } from '../../../lib/api';
import AdminDataTable from '../components/AdminDataTable';
import AdminFiltersBar from '../components/AdminFiltersBar';
import AdminStatusBadge from '../components/AdminStatusBadge';
import toast from 'react-hot-toast';

const IC = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const IS = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties;
const SS = { background: 'rgba(20,25,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties;

export default function AdminTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [query, setQuery] = useState({
    search: '', status: '', paymentMethod: '', cashierUserId: '', from: '', to: '', page: 1, limit: 50,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.getTransactions({ search: query.search || undefined, status: query.status || undefined, paymentMethod: query.paymentMethod || undefined, cashierUserId: query.cashierUserId || undefined, from: query.from || undefined, to: query.to || undefined, page: query.page, limit: query.limit }),
      adminApi.getWorkerInsights({ from: query.from || undefined, to: query.to || undefined }),
    ])
      .then(([txRes, insightsRes]) => {
        setTransactions(txRes.data?.data?.items || []);
        setInsights(insightsRes.data?.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const cancelSale = async (saleId: string) => {
    if (!window.confirm('Cancel this sale globally?')) return;
    setBusy(true);
    try { await adminApi.cancelTransactionSale(saleId); await load(); toast.success('Sale cancelled'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const revokeWorker = async (userId: string) => {
    if (!window.confirm('Revoke worker access? This disables the user account.')) return;
    setBusy(true);
    try { await adminApi.revokeWorkerAccess(userId, {}); await load(); toast.success('Access revoked'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20">
          <ArrowLeftRight className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Transactions</h1>
          <p className="text-xs text-gray-500">Cashier intelligence + global transaction management</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.06 }}>
        <AdminFiltersBar onApply={load}>
          <input value={query.search} onChange={e => setQuery(s => ({ ...s, search: e.target.value }))}
            placeholder="Search sale #" className={IC} style={IS} />
          <input value={query.cashierUserId} onChange={e => setQuery(s => ({ ...s, cashierUserId: e.target.value }))}
            placeholder="Cashier user ID" className={IC} style={IS} />
          <select value={query.status} onChange={e => setQuery(s => ({ ...s, status: e.target.value }))}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
            <option value="">All status</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={query.paymentMethod} onChange={e => setQuery(s => ({ ...s, paymentMethod: e.target.value }))}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
            <option value="">All payments</option>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile money</option>
            <option value="card">Card</option>
            <option value="credit">Credit</option>
          </select>
          <input type="date" value={query.from} onChange={e => setQuery(s => ({ ...s, from: e.target.value }))}
            className={IC} style={IS} />
          <input type="date" value={query.to} onChange={e => setQuery(s => ({ ...s, to: e.target.value }))}
            className={IC} style={IS} />
        </AdminFiltersBar>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.12 }} className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-[2px] w-4 rounded bg-amber-400" />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Cashier Intelligence</p>
        </div>
        <AdminDataTable rows={insights} rowKey={r => r.cashierUserId} loading={loading}
          emptyText="No cashier insights."
          columns={[
            { key: 'cashier', header: 'Cashier', render: r => (
              <div>
                <p className="font-semibold text-gray-200">{r.cashierName}</p>
                {r.cashierEmail && <p className="text-xs text-gray-500">{r.cashierEmail}</p>}
              </div>
            )},
            { key: 'risk', header: 'Risk', render: r => <AdminStatusBadge status={r.riskLevel === 'high' ? 'flagged' : r.riskLevel === 'medium' ? 'suspended' : 'active'} /> },
            { key: 'tx', header: 'Transactions', render: r => <span className="tabular-nums">{Number(r.transactionCount || 0).toLocaleString()}</span> },
            { key: 'cancel', header: 'Cancel %', render: r => <span className="tabular-nums text-red-400">{Number(r.cancelRate || 0).toFixed(2)}%</span> },
            { key: 'avg', header: 'Avg Ticket', render: r => <span className="tabular-nums text-emerald-400">GHS {Number(r.avgTicket || 0).toLocaleString()}</span> },
            { key: 'signals', header: 'Signals', render: r => <span className="text-xs text-gray-400">{(Array.isArray(r.signals) && r.signals.length) ? r.signals.join(', ') : '-'}</span> },
            { key: 'action', header: '', className: 'text-right', render: r => (
              <button disabled={busy} onClick={() => revokeWorker(r.cashierUserId)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
                Revoke
              </button>
            )},
          ]}
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.18 }} className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="h-[2px] w-4 rounded bg-indigo-400" />
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Global Transactions</p>
        </div>
        <AdminDataTable rows={transactions} rowKey={r => r.id} loading={loading}
          emptyText="No transactions found."
          columns={[
            { key: 'sale', header: 'Sale #', render: r => <span className="font-mono text-xs text-gray-300">{r.sale_number || '-'}</span> },
            { key: 'shop', header: 'Shop', render: r => <span className="text-gray-300">{r.shopName || '-'}</span> },
            { key: 'cashier', header: 'Cashier', render: r => <span className="text-gray-400 text-xs">{r.cashier?.name || r.cashier?.email || '-'}</span> },
            { key: 'payment', header: 'Payment', render: r => <span className="capitalize text-xs text-gray-400">{r.payment_method || '-'}</span> },
            { key: 'amount', header: 'Amount', render: r => <span className="tabular-nums font-semibold text-emerald-400">GHS {Number(r.final_amount || 0).toLocaleString()}</span> },
            { key: 'status', header: 'Status', render: r => <AdminStatusBadge status={r.status || 'unknown'} /> },
            { key: 'time', header: 'Time', render: r => <span className="font-mono text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span> },
            { key: 'action', header: '', className: 'text-right', render: r =>
              String(r.status || '').toLowerCase() === 'completed' ? (
                <button disabled={busy} onClick={() => cancelSale(r.id)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                  style={{ border: '1px solid rgba(239,68,68,0.3)' }}>
                  Cancel
                </button>
              ) : <span className="text-xs text-gray-600">-</span>
            },
          ]}
        />
      </motion.div>
      {busy && <div className="fixed inset-0 z-50 cursor-wait" />}
    </div>
  );
}
