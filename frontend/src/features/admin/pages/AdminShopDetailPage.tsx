import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopRow } from '../../../lib/api';
import AdminStatusBadge from '../components/AdminStatusBadge';
import AdminDataTable from '../components/AdminDataTable';

type AdminShopDetailModel = AdminShopRow & {
  owner?: { id: string; name: string; email: string } | null;
};

type DrilldownData = {
  membersCount: number;
  recentSales: Array<Record<string, unknown>>;
};

type RecentSaleRow = {
  id: string;
  sale_number?: string;
  final_amount?: number;
  payment_method?: string;
  created_at?: string;
};

export default function AdminShopDetailPage() {
  const { id = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<AdminShopDetailModel | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownData | null>(null);

  const formatPlanLabel = (code?: string | null) => {
    const normalized = String(code || '').toLowerCase();
    if (normalized === 'small') return 'Small Shop';
    if (normalized === 'medium') return 'Medium Shop';
    if (normalized === 'big') return 'Big Shop';
    if (normalized === 'enterprise') return 'Enterprise / Mall';
    return 'No active plan';
  };

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([adminApi.getShopById(id), adminApi.getShopDrilldown(id)])
      .then(([s, d]) => {
        const shopData = s.data?.data || null;
        setShop(shopData);
        setDrilldown(d.data?.data || null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const recentSales: RecentSaleRow[] = (drilldown?.recentSales || [])
    .map((row) => ({
      id: String(row.id || ''),
      sale_number: row.sale_number ? String(row.sale_number) : undefined,
      final_amount: Number(row.final_amount || 0),
      payment_method: row.payment_method ? String(row.payment_method) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
    }))
    .filter((row) => !!row.id);

  if (loading && !shop) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading shop...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Shop Detail</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{shop?.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AdminStatusBadge status={shop?.is_active ? 'active' : 'suspended'} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Plan: {formatPlanLabel(shop?.subscription?.isActive ? shop?.subscription?.planCode : null)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Subscription: {String(shop?.subscription?.status || 'inactive')}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              await adminApi.suspendShop(id);
              load();
            }}
            className="rounded-lg border border-red-500 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            Suspend
          </button>
          <button
            onClick={async () => {
              await adminApi.reactivateShop(id);
              load();
            }}
            className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
          >
            Reactivate
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Plan is sourced from the owner account subscription. Manage upgrades/renewals on the account Subscription page.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Ghost Admin Drilldown (Read-only)</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Members: {drilldown?.membersCount || 0} | Recent sales: {(drilldown?.recentSales || []).length}
        </p>
      </div>

      <AdminDataTable<RecentSaleRow>
        rows={recentSales}
        rowKey={(r) => r.id}
        emptyText="No recent sales."
        columns={[
          { key: 'sale', header: 'Sale #', render: (r) => r.sale_number || '-' },
          { key: 'amount', header: 'Amount', render: (r) => `GHS ${Number(r.final_amount || 0).toLocaleString()}` },
          { key: 'payment', header: 'Payment', render: (r) => r.payment_method || '-' },
          { key: 'time', header: 'Time', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '-') },
        ]}
      />
    </div>
  );
}
