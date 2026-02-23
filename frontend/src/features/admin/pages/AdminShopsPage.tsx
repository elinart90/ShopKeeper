import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminShopRow } from '../../../lib/api';
import AdminDataTable from '../components/AdminDataTable';
import AdminStatusBadge from '../components/AdminStatusBadge';
import AdminFiltersBar from '../components/AdminFiltersBar';

const PLAN_LABELS: Record<string, string> = {
  small: 'Small Shop',
  medium: 'Medium Shop',
  big: 'Big Shop',
  enterprise: 'Enterprise / Mall',
};

export default function AdminShopsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AdminShopRow[]>([]);
  const [query, setQuery] = useState<{
    search: string;
    plan: '' | 'small' | 'medium' | 'big' | 'enterprise';
    active: '' | 'true' | 'false';
    page: number;
    limit: number;
  }>({
    search: '',
    plan: '',
    active: '',
    page: 1,
    limit: 20,
  });

  const load = () => {
    setLoading(true);
    adminApi
      .getShops({
        search: query.search || undefined,
        plan: query.plan || undefined,
        active: query.active === '' ? undefined : query.active === 'true',
        page: query.page,
        limit: query.limit,
      })
      .then((res) => setRows(res.data?.data?.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Shops</h1>

      <AdminFiltersBar onApply={load}>
        <input
          value={query.search}
          onChange={(e) => setQuery((s) => ({ ...s, search: e.target.value }))}
          placeholder="Search shop"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <select
          value={query.plan}
          onChange={(e) =>
            setQuery((s) => ({
              ...s,
              plan: e.target.value as '' | 'small' | 'medium' | 'big' | 'enterprise',
            }))
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">All plans</option>
          <option value="small">Small Shop</option>
          <option value="medium">Medium Shop</option>
          <option value="big">Big Shop</option>
          <option value="enterprise">Enterprise / Mall</option>
        </select>
        <select
          value={query.active}
          onChange={(e) =>
            setQuery((s) => ({
              ...s,
              active: e.target.value as '' | 'true' | 'false',
            }))
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">All active states</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </AdminFiltersBar>

      <AdminDataTable<AdminShopRow>
        rows={rows}
        rowKey={(r) => r.id}
        emptyText={loading ? 'Loading shops...' : 'No shops found.'}
        columns={[
          { key: 'name', header: 'Shop', render: (r) => r.name },
          {
            key: 'plan',
            header: 'Plan',
            render: (r) => {
              const code = String(r.subscription?.planCode || r.plan || '').toLowerCase();
              const isActive = Boolean(r.subscription?.isActive);
              if (!isActive || !code) return 'No active plan';
              return PLAN_LABELS[code] || code;
            },
          },
          { key: 'active', header: 'Status', render: (r) => <AdminStatusBadge status={r.is_active ? 'active' : 'suspended'} /> },
          {
            key: 'tx',
            header: 'Transactions',
            className: 'text-right',
            render: (r) => Number(r.kpis?.transaction_count || 0).toLocaleString(),
          },
          {
            key: 'action',
            header: 'Action',
            className: 'text-right',
            render: (r) => (
              <Link to={`/super-admin/shops/${r.id}`} className="text-emerald-600 hover:text-emerald-700">
                View
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
