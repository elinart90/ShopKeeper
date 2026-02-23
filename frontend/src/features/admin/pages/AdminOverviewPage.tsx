import { useEffect, useState } from 'react';
import AdminKpiCard from '../components/AdminKpiCard';
import { adminApi } from '../../../lib/api';

type Overview = {
  activeShops: number;
  activeUsers: number;
  transactionVolume: number;
  revenueProcessed: number;
};

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [growth, setGrowth] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([adminApi.getOverview(), adminApi.getGrowth({ days: 30 })])
      .then(([o, g]) => {
        if (!active) return;
        setOverview(o.data?.data || null);
        setGrowth(Array.isArray(g.data?.data) ? g.data.data : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Platform Overview</h1>

      {loading && !overview ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading overview...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminKpiCard label="Active Shops" value={overview?.activeShops ?? 0} />
            <AdminKpiCard label="Active Users" value={overview?.activeUsers ?? 0} />
            <AdminKpiCard label="Transactions" value={overview?.transactionVolume ?? 0} />
            <AdminKpiCard
              label="Revenue Processed"
              value={`GHS ${(overview?.revenueProcessed ?? 0).toLocaleString()}`}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Growth (last 30 days)</h2>
            <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {growth.slice(0, 8).map((row, idx) => (
                <div key={`${row.metric_date}-${idx}`} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 dark:bg-gray-700/40">
                  <span>{row.metric_date}</span>
                  <span>
                    users {row.new_users} | shops {row.new_shops} | tx {row.transaction_count}
                  </span>
                </div>
              ))}
              {growth.length === 0 ? <p className="text-gray-500 dark:text-gray-400">No growth data yet.</p> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
