import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Search } from 'lucide-react';
import { adminApi } from '../../../lib/api';
import AdminDataTable from '../components/AdminDataTable';
import AdminStatusBadge from '../components/AdminStatusBadge';
import AdminFiltersBar from '../components/AdminFiltersBar';

const IC = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const IS = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' };
const SS = { background: 'rgba(20,25,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' };

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState({ search: '', status: '', role: '', page: 1, limit: 20 });

  const load = () => {
    setLoading(true);
    adminApi.getUsers({
      search: query.search || undefined,
      status: query.status || undefined,
      role: query.role || undefined,
      page: query.page,
      limit: query.limit,
    }).then(res => setRows(res.data?.data?.items || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
          <Users className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-gray-500">{loading ? 'Loading...' : `${rows.length} result${rows.length !== 1 ? 's' : ''}`}</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.06 }}>
        <AdminFiltersBar onApply={load}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
            <input value={query.search} onChange={e => setQuery(s => ({ ...s, search: e.target.value }))}
              placeholder="Search name or email" className={`${IC} pl-8`} style={IS} />
          </div>
          <select value={query.status} onChange={e => setQuery(s => ({ ...s, status: e.target.value }))}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="flagged">Flagged</option>
          </select>
          <input value={query.role} onChange={e => setQuery(s => ({ ...s, role: e.target.value }))}
            placeholder="Filter by role" className={IC} style={IS} />
        </AdminFiltersBar>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.12 }}>
        <AdminDataTable rows={rows} rowKey={r => r.id} loading={loading} emptyText="No users found."
          columns={[
            { key: 'name', header: 'User', render: r => (
              <div>
                <p className="font-semibold text-gray-200">{r.name || '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.email}</p>
              </div>
            )},
            { key: 'role', header: 'Role', render: r => <span className="text-xs text-gray-400 capitalize">{r.role || '—'}</span> },
            { key: 'status', header: 'Status', render: r => <AdminStatusBadge status={r.status} /> },
            { key: 'created_at', header: 'Joined', render: r => <span className="font-mono text-xs text-gray-500">{String(r.created_at || '').slice(0, 10)}</span> },
            { key: 'actions', header: '', className: 'text-right', render: r => (
              <Link to={`/super-admin/users/${r.id}`} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                View
              </Link>
            )},
          ]}
        />
      </motion.div>
    </div>
  );
}
