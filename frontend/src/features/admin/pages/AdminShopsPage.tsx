import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Search } from 'lucide-react';
import { adminApi, type AdminShopRow } from '../../../lib/api';
import AdminDataTable from '../components/AdminDataTable';
import AdminStatusBadge from '../components/AdminStatusBadge';
import AdminFiltersBar from '../components/AdminFiltersBar';

const IC = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const IS = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties;
const SS = { background: 'rgba(20,25,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties;

const PLAN_LABELS: Record<string, string> = { small: 'Small', medium: 'Medium', big: 'Big', enterprise: 'Enterprise' };
const PLAN_COLORS: Record<string, string> = { small: '#6b7280', medium: '#60a5fa', big: '#a78bfa', enterprise: '#fbbf24' };

export default function AdminShopsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminShopRow[]>([]);
  const [query, setQuery] = useState<{
    search: string; plan: '' | 'small' | 'medium' | 'big' | 'enterprise';
    active: '' | 'true' | 'false'; page: number; limit: number;
  }>({ search: '', plan: '', active: '', page: 1, limit: 20 });

  const load = () => {
    setLoading(true);
    adminApi.getShops({
      search: query.search || undefined,
      plan: query.plan || undefined,
      active: query.active === '' ? undefined : query.active === 'true',
      page: query.page, limit: query.limit,
    }).then(res => setRows(res.data?.data?.items || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20">
          <Store className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Shops</h1>
          <p className="text-xs text-gray-500">{loading ? 'Loading...' : `${rows.length} shop${rows.length !== 1 ? 's' : ''}`}</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.06 }}>
        <AdminFiltersBar onApply={load}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
            <input value={query.search} onChange={e => setQuery(s => ({ ...s, search: e.target.value }))}
              placeholder="Search shop" className={`${IC} pl-8`} style={IS} />
          </div>
          <select value={query.plan} onChange={e => setQuery(s => ({ ...s, plan: e.target.value as any }))}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
            <option value="">All plans</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="big">Big</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={query.active} onChange={e => setQuery(s => ({ ...s, active: e.target.value as any }))}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
            <option value="">All states</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </AdminFiltersBar>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.12 }}>
        <AdminDataTable<AdminShopRow> rows={rows} rowKey={r => r.id} loading={loading} emptyText="No shops found."
          columns={[
            { key: 'name', header: 'Shop', render: r => <span className="font-semibold text-gray-200">{r.name}</span> },
            {
              key: 'plan', header: 'Plan', render: r => {
                const code = String(r.subscription?.planCode || r.plan || '').toLowerCase();
                const isActive = Boolean(r.subscription?.isActive);
                if (!isActive || !code) return <span className="text-xs text-gray-600">No plan</span>;
                const label = PLAN_LABELS[code] || code;
                const color = PLAN_COLORS[code] || '#6b7280';
                return (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}>
                    {label}
                  </span>
                );
              },
            },
            { key: 'active', header: 'Status', render: r => <AdminStatusBadge status={r.is_active ? 'active' : 'suspended'} /> },
            {
              key: 'tx', header: 'Transactions', className: 'text-right',
              render: r => <span className="tabular-nums font-semibold text-gray-300">{Number(r.kpis?.transaction_count || 0).toLocaleString()}</span>,
            },
            {
              key: 'action', header: '', className: 'text-right',
              render: r => (
                <Link to={`/super-admin/shops/${r.id}`} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                  View
                </Link>
              ),
            },
          ]}
        />
      </motion.div>
    </div>
  );
}