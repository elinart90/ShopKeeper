import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText } from 'lucide-react';
import AdminDataTable from '../components/AdminDataTable';
import AdminFiltersBar from '../components/AdminFiltersBar';
import { adminApi } from '../../../lib/api';

const IC = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const IS = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties;

const ACTION_COLORS: Record<string, string> = {
  create: '#34d399', update: '#60a5fa', delete: '#f87171',
  login: '#a78bfa', logout: '#9ca3af', suspend: '#fbbf24',
};

export default function AdminAuditLogsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState({ actorUserId: '', action: '', entityType: '', from: '', to: '', page: 1, limit: 30 });

  const load = () => {
    setLoading(true);
    adminApi.getAuditLogs({
      actorUserId: query.actorUserId || undefined,
      action: query.action || undefined,
      entityType: query.entityType || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
      page: query.page,
      limit: query.limit,
    }).then(res => setRows(res.data?.data?.items || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-500/20">
          <ScrollText className="h-5 w-5 text-gray-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Audit Logs</h1>
          <p className="text-xs text-gray-500">Immutable record of all admin actions</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.06 }}>
        <AdminFiltersBar onApply={load}>
          <input value={query.actorUserId} onChange={e => setQuery(s => ({ ...s, actorUserId: e.target.value }))}
            placeholder="Actor user ID" className={IC} style={IS} />
          <input value={query.action} onChange={e => setQuery(s => ({ ...s, action: e.target.value }))}
            placeholder="Action (create, update...)" className={IC} style={IS} />
          <input value={query.entityType} onChange={e => setQuery(s => ({ ...s, entityType: e.target.value }))}
            placeholder="Entity type" className={IC} style={IS} />
          <div className="flex gap-2">
            <input type="date" value={query.from} onChange={e => setQuery(s => ({ ...s, from: e.target.value }))}
              className={`${IC} flex-1`} style={IS} />
            <input type="date" value={query.to} onChange={e => setQuery(s => ({ ...s, to: e.target.value }))}
              className={`${IC} flex-1`} style={IS} />
          </div>
        </AdminFiltersBar>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.12 }}>
        <AdminDataTable rows={rows} rowKey={r => r.id} loading={loading} emptyText="No logs found."
          columns={[
            {
              key: 'time', header: 'Time',
              render: r => <span className="font-mono text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>,
            },
            {
              key: 'actor', header: 'Actor',
              render: r => <span className="font-mono text-xs text-gray-400">{r.actor_user_id ? `${r.actor_user_id.slice(0, 12)}…` : '—'}</span>,
            },
            {
              key: 'action', header: 'Action',
              render: r => {
                const key = String(r.action || '').toLowerCase().split('_')[0];
                const color = ACTION_COLORS[key] || '#6b7280';
                return (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}>
                    {r.action || '—'}
                  </span>
                );
              },
            },
            {
              key: 'entity', header: 'Entity',
              render: r => (
                <div>
                  <span className="text-xs font-semibold text-gray-300">{r.entity_type || '—'}</span>
                  {r.entity_id && <p className="font-mono text-[10px] text-gray-600 mt-0.5">{String(r.entity_id).slice(0, 16)}…</p>}
                </div>
              ),
            },
          ]}
        />
      </motion.div>
    </div>
  );
}