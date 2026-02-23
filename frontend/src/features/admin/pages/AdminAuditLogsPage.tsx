import { useEffect, useState } from 'react';
import AdminDataTable from '../components/AdminDataTable';
import AdminFiltersBar from '../components/AdminFiltersBar';
import { adminApi } from '../../../lib/api';

export default function AdminAuditLogsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState({
    actorUserId: '',
    action: '',
    entityType: '',
    from: '',
    to: '',
    page: 1,
    limit: 30,
  });

  const load = () => {
    setLoading(true);
    adminApi
      .getAuditLogs({
        actorUserId: query.actorUserId || undefined,
        action: query.action || undefined,
        entityType: query.entityType || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
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
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Admin Audit Logs</h1>

      <AdminFiltersBar onApply={load}>
        <input
          value={query.actorUserId}
          onChange={(e) => setQuery((s) => ({ ...s, actorUserId: e.target.value }))}
          placeholder="Actor user ID"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <input
          value={query.action}
          onChange={(e) => setQuery((s) => ({ ...s, action: e.target.value }))}
          placeholder="Action"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <input
          value={query.entityType}
          onChange={(e) => setQuery((s) => ({ ...s, entityType: e.target.value }))}
          placeholder="Entity type"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={query.from}
            onChange={(e) => setQuery((s) => ({ ...s, from: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
          <input
            type="date"
            value={query.to}
            onChange={(e) => setQuery((s) => ({ ...s, to: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
      </AdminFiltersBar>

      <AdminDataTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyText={loading ? 'Loading logs...' : 'No logs found.'}
        columns={[
          { key: 'time', header: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
          { key: 'actor', header: 'Actor', render: (r) => r.actor_user_id || '-' },
          { key: 'action', header: 'Action', render: (r) => r.action || '-' },
          { key: 'entity', header: 'Entity', render: (r) => `${r.entity_type || '-'} / ${r.entity_id || '-'}` },
        ]}
      />
    </div>
  );
}
