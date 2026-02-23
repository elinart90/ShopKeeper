import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminAiIntelligenceData } from '../../../lib/api';
import AdminDataTable from '../components/AdminDataTable';
import AdminStatusBadge from '../components/AdminStatusBadge';
import AdminFiltersBar from '../components/AdminFiltersBar';

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState({
    search: '',
    status: '',
    role: '',
    page: 1,
    limit: 20,
  });

  const load = () => {
    setLoading(true);
    adminApi
      .getUsers({
        search: query.search || undefined,
        status: query.status || undefined,
        role: query.role || undefined,
        page: query.page,
        limit: query.limit,
      })
      .then((res) => {
        setRows(res.data?.data?.items || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h1>

      <AdminFiltersBar onApply={load}>
        <input
          value={query.search}
          onChange={(e) => setQuery((s) => ({ ...s, search: e.target.value }))}
          placeholder="Search name or email"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <select
          value={query.status}
          onChange={(e) => setQuery((s) => ({ ...s, status: e.target.value }))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="flagged">Flagged</option>
        </select>
        <input
          value={query.role}
          onChange={(e) => setQuery((s) => ({ ...s, role: e.target.value }))}
          placeholder="Role"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
      </AdminFiltersBar>

      <AdminDataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyText={loading ? 'Loading users...' : 'No users found.'}
        columns={[
          {
            key: 'name',
            header: 'User',
            render: (r) => (
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-gray-500">{r.email}</p>
              </div>
            ),
          },
          { key: 'role', header: 'Role', render: (r) => r.role || '-' },
          { key: 'status', header: 'Status', render: (r) => <AdminStatusBadge status={r.status} /> },
          { key: 'created_at', header: 'Created', render: (r) => String(r.created_at || '').slice(0, 10) },
          {
            key: 'actions',
            header: 'Action',
            className: 'text-right',
            render: (r) => (
              <Link to={`/super-admin/users/${r.id}`} className="text-emerald-600 hover:text-emerald-700">
                View
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}

export function AdminAiIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<AdminAiIntelligenceData | null>(null);
  const [query, setQuery] = useState<{ from: string; to: string; rankBy: 'revenue' | 'transactions' | 'profit' }>({
    from: '',
    to: '',
    rankBy: 'revenue',
  });
  const [email, setEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAiIntelligence({
        from: query.from || undefined,
        to: query.to || undefined,
        rankBy: query.rankBy,
      });
      setData(res.data?.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendExecutiveSummary = async () => {
    setSending(true);
    try {
      await adminApi.emailAiExecutiveSummary({ email: email || undefined });
      window.alert('Executive summary emailed successfully.');
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to send executive summary.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">AI-Powered Admin Intelligence</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Claude is primary, OpenAI fallback. Insights are generated from platform-wide behavior.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <button
            onClick={load}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Refresh AI insights
          </button>
          <select
            value={query.rankBy}
            onChange={(e) => setQuery((s) => ({ ...s, rankBy: e.target.value as 'revenue' | 'transactions' | 'profit' }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            title="Top 10 ranking mode"
          >
            <option value="revenue">Rank Top 10 by Revenue</option>
            <option value="transactions">Rank Top 10 by Transactions</option>
            <option value="profit">Rank Top 10 by Profit</option>
          </select>
          <span className="text-xs text-gray-500 dark:text-gray-400">Provider: {loading ? '...' : data?.providerUsed || '-'}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Platform-Wide Anomaly Detection</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{loading ? 'Loading...' : data?.anomalyDetection?.summary || '-'}</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {(data?.anomalyDetection?.highlights || []).slice(0, 8).map((item: string, idx: number) => (
              <li key={idx}>- {item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Churn Prediction</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{loading ? 'Loading...' : data?.churnPrediction?.summary || '-'}</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {(data?.churnPrediction?.warnings || []).slice(0, 8).map((item: string, idx: number) => (
              <li key={idx}>- {item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Growth Opportunity Alerts</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{loading ? 'Loading...' : data?.growthOpportunities?.summary || '-'}</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {(data?.growthOpportunities?.alerts || []).slice(0, 8).map((item: string, idx: number) => (
              <li key={idx}>- {item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Top 10 Performing Shops</h2>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Ranked by {loading ? query.rankBy : data?.topPerformingShopsRankBy || query.rankBy} for the selected period.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Shop</th>
                  <th className="px-2 py-2">Revenue</th>
                  <th className="px-2 py-2">Transactions</th>
                  <th className="px-2 py-2">Profit</th>
                  <th className="px-2 py-2">Avg Ticket</th>
                </tr>
              </thead>
              <tbody>
                {(loading ? [] : data?.topPerformingShops || []).map((shop, idx) => (
                  <tr key={shop.shopId} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-white">{shop.shopName}</td>
                    <td className="px-2 py-2">GHS {shop.revenue.toFixed(2)}</td>
                    <td className="px-2 py-2">{shop.transactions}</td>
                    <td className="px-2 py-2">GHS {Number(shop.profit || 0).toFixed(2)}</td>
                    <td className="px-2 py-2">GHS {shop.avgTicket.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !(data?.topPerformingShops || []).length ? (
              <p className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">No performance data in this date range.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">AI Executive Summary</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {loading ? 'Loading...' : data?.executiveSummary || '-'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional recipient email (default: your admin email)"
              className="min-w-[280px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <button
              onClick={sendExecutiveSummary}
              disabled={sending}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {sending ? 'Sending...' : 'Send Executive Summary Email'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            For automatic Monday delivery, schedule backend call to <code>/api/admin/ai-intelligence/executive-summary/email</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
