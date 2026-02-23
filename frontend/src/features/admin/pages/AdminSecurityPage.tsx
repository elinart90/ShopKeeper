import { useEffect, useState } from 'react';
import { adminApi, type AdminApiAccessLogRow, type AdminSecuritySessionRow, type AdminSecurityThreatData } from '../../../lib/api';

export default function AdminSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [threats, setThreats] = useState<AdminSecurityThreatData | null>(null);
  const [sessions, setSessions] = useState<AdminSecuritySessionRow[]>([]);
  const [accessLogs, setAccessLogs] = useState<AdminApiAccessLogRow[]>([]);
  const [hours, setHours] = useState(24);
  const [sessionSearch, setSessionSearch] = useState('');
  const [gdprUserId, setGdprUserId] = useState('');
  const [gdprReason, setGdprReason] = useState('');
  const [threshold, setThreshold] = useState(20000);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, s, a] = await Promise.all([
        adminApi.getSecurityThreats({ hours }),
        adminApi.getSecuritySessions({ page: 1, limit: 20, search: sessionSearch || undefined, activeOnly: true }),
        adminApi.getApiAccessLogs({ page: 1, limit: 20 }),
      ]);
      setThreats(t.data?.data || null);
      setSessions(s.data?.data?.items || []);
      setAccessLogs(a.data?.data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const terminateSession = async (sessionId: string) => {
    const reason = window.prompt('Reason for terminating this session?', 'Security review');
    if (reason === null) return;
    setBusy(true);
    try {
      await adminApi.terminateSecuritySession(sessionId, { reason });
      await load();
      window.alert('Session terminated.');
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to terminate session');
    } finally {
      setBusy(false);
    }
  };

  const runGdprDelete = async () => {
    if (!gdprUserId.trim()) return window.alert('Enter a valid user ID');
    if (!window.confirm('This permanently deletes user data. Continue?')) return;
    setBusy(true);
    try {
      await adminApi.gdprDeleteUser({ userId: gdprUserId.trim(), reason: gdprReason || undefined });
      window.alert('GDPR deletion executed.');
      setGdprUserId('');
      setGdprReason('');
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to execute GDPR deletion');
    } finally {
      setBusy(false);
    }
  };

  const enforce2fa = async () => {
    setBusy(true);
    try {
      const res = await adminApi.enforce2faPolicy({ thresholdAmount: Number(threshold), days: Number(days) || 30 });
      window.alert(`2FA enforced for ${res.data?.data?.affectedOwnerCount || 0} owner(s).`);
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to enforce 2FA');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Advanced Security & Compliance</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={720}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value) || 24)}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
          <button onClick={load} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Refresh Threat Dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Failed Logins</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '...' : threats?.totals?.failedLoginAttempts ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Successful Logins</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '...' : threats?.totals?.successfulLogins ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Active Sessions</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '...' : threats?.totals?.activeSessions ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Brute-force IPs</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '...' : threats?.bruteForceIps?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Unusual Access Patterns</h2>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {(threats?.unusualAccesses || []).slice(0, 12).map((u) => (
              <li key={u.userId}>
                - {u.name} ({u.email}) | IPs: {u.distinctIpCount}, Devices: {u.distinctDeviceCount}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Multiple Accounts on Same IP</h2>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {(threats?.sharedIps || []).slice(0, 12).map((x) => (
              <li key={x.ipAddress}>- {x.ipAddress} ({x.userCount} accounts)</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold">Device & Session Management</h2>
        <div className="mt-2 flex gap-2">
          <input
            placeholder="Search by user, email, IP, device..."
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
            className="min-w-[260px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
          <button onClick={load} className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white">
            Search
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">IP</th>
                <th className="px-2 py-2">Device</th>
                <th className="px-2 py-2">Last Seen</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(sessions || []).map((s) => (
                <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-2 py-2">{s.user?.name || s.user_id}</td>
                  <td className="px-2 py-2">{s.ip_address || '-'}</td>
                  <td className="max-w-[320px] truncate px-2 py-2">{s.user_agent || '-'}</td>
                  <td className="px-2 py-2">{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '-'}</td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => terminateSession(s.id)}
                      disabled={busy}
                      className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      Terminate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold">Data Access Logs (Recent API Calls)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Actor</th>
                <th className="px-2 py-2">Method</th>
                <th className="px-2 py-2">Path</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {(accessLogs || []).map((l) => (
                <tr key={l.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-2 py-2">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2">{l.actor?.email || l.actor_user_id || 'anonymous'}</td>
                  <td className="px-2 py-2">{l.method}</td>
                  <td className="max-w-[320px] truncate px-2 py-2">{l.path}</td>
                  <td className="px-2 py-2">{l.status_code}</td>
                  <td className="px-2 py-2">{l.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">GDPR / Data Privacy Controls</h2>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Permanently deletes a requested user account and owned shop data.</p>
          <div className="mt-3 space-y-2">
            <input
              placeholder="Target User ID (UUID)"
              value={gdprUserId}
              onChange={(e) => setGdprUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <input
              placeholder="Reason (optional)"
              value={gdprReason}
              onChange={(e) => setGdprReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <button onClick={runGdprDelete} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
              Execute Full Account Wipe
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Two-Factor Authentication Enforcement</h2>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">Require 2FA for shop owners above a transaction-volume threshold.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              placeholder="Threshold amount"
            />
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 30)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
              placeholder="Lookback days"
            />
          </div>
          <button onClick={enforce2fa} disabled={busy} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            Enforce 2FA Policy
          </button>
        </section>
      </div>
    </div>
  );
}
