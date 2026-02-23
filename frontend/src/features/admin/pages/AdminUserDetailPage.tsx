import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminUserRow, type AdminUserWorkspaceData } from '../../../lib/api';
import AdminStatusBadge from '../components/AdminStatusBadge';
import AdminDataTable from '../components/AdminDataTable';
import AdminConfirmActionModal from '../components/AdminConfirmActionModal';

type LoginHistoryRow = {
  id: string;
  created_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  success: boolean;
};

export default function AdminUserDetailPage() {
  const { id = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [workspace, setWorkspace] = useState<AdminUserWorkspaceData>({
    ownedShops: [],
    managedUsers: [],
    sales: [],
    dailySales: [],
  });
  const [confirmAction, setConfirmAction] = useState<null | 'suspend' | 'reactivate' | 'forceReset'>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([adminApi.getUserById(id), adminApi.getUserLoginHistory(id), adminApi.getUserWorkspace(id, { limit: 200 })])
      .then(([u, h, w]) => {
        setUser(u.data?.data || null);
        setHistory(h.data?.data?.items || []);
        setWorkspace(w.data?.data || { ownedShops: [], managedUsers: [], sales: [], dailySales: [] });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const confirmMeta = useMemo(() => {
    if (confirmAction === 'suspend') {
      return { title: 'Suspend user?', label: 'Suspend', variant: 'danger' as const };
    }
    if (confirmAction === 'reactivate') {
      return { title: 'Reactivate user?', label: 'Reactivate', variant: 'primary' as const };
    }
    if (confirmAction === 'forceReset') {
      return { title: 'Force password reset?', label: 'Force reset', variant: 'primary' as const };
    }
    return null;
  }, [confirmAction]);

  const runAction = async () => {
    if (!id || !confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction === 'suspend') await adminApi.suspendUser(id, {});
      if (confirmAction === 'reactivate') await adminApi.reactivateUser(id);
      if (confirmAction === 'forceReset') await adminApi.forcePasswordReset(id);
      await load();
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const cancelSale = async (saleId: string) => {
    if (!id || !saleId) return;
    const ok = window.confirm('Cancel this sale? This updates stock/reports for the owner/admin everywhere.');
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi.cancelUserWorkspaceSale(id, saleId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const deleteManagedUser = async (targetUserId: string) => {
    if (!id || !targetUserId) return;
    const ok = window.confirm('Delete this user access under this owner/admin?');
    if (!ok) return;
    setBusy(true);
    try {
      await adminApi.deleteManagedUser(id, targetUserId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const deleteUserPermanently = async () => {
    if (!id) return;
    const ok = window.confirm(
      'Permanently delete this account and all data under it (shops, sales, managers, staff, memberships)? This cannot be undone.'
    );
    if (!ok) return;
    const reason = window.prompt('Reason for permanent delete (optional)') || undefined;
    setBusy(true);
    try {
      await adminApi.gdprDeleteUser({ userId: id, reason });
      window.alert('User permanently deleted from database.');
      window.location.href = '/super-admin/users';
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to permanently delete user');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !user) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading user...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">User Detail</h1>
        <div className="mt-2 space-y-1 text-sm">
          <p className="text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
          <div className="pt-1">
            <AdminStatusBadge status={user?.status} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setConfirmAction('suspend')}
            className="rounded-lg border border-red-500 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            Suspend
          </button>
          <button
            onClick={() => setConfirmAction('reactivate')}
            className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
          >
            Reactivate
          </button>
          <button
            onClick={() => setConfirmAction('forceReset')}
            className="rounded-lg border border-gray-400 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Force password reset
          </button>
          <button
            onClick={async () => {
              const reason = window.prompt('Flag reason');
              if (!reason) return;
              await adminApi.flagUser(id, { reason });
              load();
            }}
            className="rounded-lg border border-amber-500 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
          >
            Flag user
          </button>
          <button
            disabled={busy}
            onClick={deleteUserPermanently}
            className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Login History</h2>
        <AdminDataTable<LoginHistoryRow>
          rows={history}
          rowKey={(r) => r.id}
          columns={[
            { key: 'created', header: 'Time', render: (r) => new Date(r.created_at).toLocaleString() },
            { key: 'ip', header: 'IP', render: (r) => r.ip_address || '-' },
            { key: 'agent', header: 'User Agent', render: (r) => r.user_agent || '-' },
            { key: 'success', header: 'Result', render: (r) => <AdminStatusBadge status={r.success ? 'success' : 'failed'} /> },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Shops Created By This User</h2>
        <AdminDataTable<AdminUserWorkspaceData['ownedShops'][number]>
          rows={workspace?.ownedShops || []}
          rowKey={(r) => r.id}
          emptyText="No owned shops."
          columns={[
            { key: 'name', header: 'Shop', render: (r) => r.name || '-' },
            { key: 'status', header: 'Status', render: (r) => <AdminStatusBadge status={r.is_active ? 'active' : 'suspended'} /> },
            { key: 'created', header: 'Created', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '-') },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Users Under This Owner/Admin</h2>
        <AdminDataTable<AdminUserWorkspaceData['managedUsers'][number]>
          rows={workspace?.managedUsers || []}
          rowKey={(r) => `${r.shopId}-${r.userId}`}
          emptyText="No managed users."
          columns={[
            { key: 'name', header: 'User', render: (r) => r.user?.name || r.user?.email || 'Unknown user' },
            { key: 'email', header: 'Email', render: (r) => r.user?.email || '-' },
            { key: 'shop', header: 'Shop ID', render: (r) => r.shopId || '-' },
            { key: 'role', header: 'Role', render: (r) => r.memberRole || '-' },
            { key: 'status', header: 'Status', render: (r) => <AdminStatusBadge status={r.user?.status || 'unknown'} /> },
            {
              key: 'action',
              header: 'Action',
              className: 'text-right',
              render: (r) => (
                <button
                  disabled={busy}
                  onClick={() => deleteManagedUser(r.userId)}
                  className="rounded-lg border border-red-500 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  Delete user
                </button>
              ),
            },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Daily Sales Summary (Owned Shops)</h2>
        <AdminDataTable<AdminUserWorkspaceData['dailySales'][number]>
          rows={workspace?.dailySales || []}
          rowKey={(r) => r.date}
          emptyText="No sales for selected range."
          columns={[
            { key: 'date', header: 'Date', render: (r) => r.date || '-' },
            { key: 'count', header: 'Sales', render: (r) => Number(r.count || 0).toLocaleString() },
            { key: 'revenue', header: 'Revenue', render: (r) => `GHS ${Number(r.revenue || 0).toLocaleString()}` },
          ]}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sales (Cancel Enabled)</h2>
        <AdminDataTable<AdminUserWorkspaceData['sales'][number]>
          rows={workspace?.sales || []}
          rowKey={(r) => r.id}
          emptyText="No sales found."
          columns={[
            { key: 'sale', header: 'Sale #', render: (r) => r.sale_number || '-' },
            { key: 'shop', header: 'Shop', render: (r) => r.shop_name || '-' },
            { key: 'by', header: 'Created By', render: (r) => r.actor_name || '-' },
            { key: 'amount', header: 'Amount', render: (r) => `GHS ${Number(r.final_amount || 0).toLocaleString()}` },
            { key: 'status', header: 'Status', render: (r) => <AdminStatusBadge status={r.status || 'unknown'} /> },
            { key: 'time', header: 'Time', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : '-') },
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

      <AdminConfirmActionModal
        open={!!confirmMeta}
        title={confirmMeta?.title || ''}
        confirmLabel={confirmMeta?.label || 'Confirm'}
        confirmVariant={confirmMeta?.variant || 'primary'}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
