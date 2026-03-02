import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, RefreshCw, AlertTriangle, Users, Monitor, Lock, KeyRound, Mail, Eye, EyeOff } from 'lucide-react';
import { adminApi, authApi, type AdminApiAccessLogRow, type AdminSecuritySessionRow, type AdminSecurityThreatData } from '../../../lib/api';
import AdminKpiCard from '../components/AdminKpiCard';
import { useAuth } from '../../../contexts/useAuth';
import toast from 'react-hot-toast';

const GLASS = { background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' } as React.CSSProperties;
const IC = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const IS = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } as React.CSSProperties;
const METHOD_COLORS: Record<string, string> = { GET: '#60a5fa', POST: '#34d399', PATCH: '#a78bfa', PUT: '#fbbf24', DELETE: '#f87171' };

function SectionTitle({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${color}22` }}>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">{title}</p>
    </div>
  );
}

export default function AdminSecurityPage() {
  const { user } = useAuth();
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

  // ── Change-my-password PIN flow ──────────────────────────────────────────
  const [pwStep, setPwStep] = useState<'idle' | 'pin_sent' | 'new_password' | 'done'>('idle');
  const [pwEmail, setPwEmail] = useState('');
  const [pwPin, setPwPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  // Pre-fill email from logged-in user
  useEffect(() => {
    if (user?.email && !pwEmail) setPwEmail(user.email);
  }, [user?.email]);

  const handleSendPwPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwEmail.trim()) { toast.error('Enter your email'); return; }
    setPwBusy(true);
    try {
      await authApi.forgotPasswordRequest(pwEmail.trim());
      toast.success('PIN sent to your email. Check your inbox.');
      setPwStep('pin_sent');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to send PIN');
    } finally { setPwBusy(false); }
  };

  const handleVerifyPwPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwPin.trim().length !== 6) { toast.error('Enter the 6-digit PIN'); return; }
    setPwBusy(true);
    try {
      await authApi.verifyForgotPasswordPin({ email: pwEmail.trim(), pin: pwPin.trim() });
      toast.success('PIN verified. Set your new password.');
      setPwStep('new_password');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Invalid or expired PIN');
    } finally { setPwBusy(false); }
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setPwBusy(true);
    try {
      await authApi.forgotPasswordReset({ email: pwEmail.trim(), pin: pwPin.trim(), newPassword });
      toast.success('Password updated successfully.');
      setPwStep('done');
      setPwPin(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Invalid or expired PIN');
    } finally { setPwBusy(false); }
  };

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
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const terminateSession = async (sessionId: string) => {
    const reason = window.prompt('Reason for terminating?', 'Security review');
    if (reason === null) return;
    setBusy(true);
    try { await adminApi.terminateSecuritySession(sessionId, { reason }); toast.success('Session terminated'); await load(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const runGdprDelete = async () => {
    if (!gdprUserId.trim()) return toast.error('Enter a valid user ID');
    if (!window.confirm('This permanently deletes user data. Continue?')) return;
    setBusy(true);
    try {
      await adminApi.gdprDeleteUser({ userId: gdprUserId.trim(), reason: gdprReason || undefined });
      toast.success('GDPR deletion executed');
      setGdprUserId(''); setGdprReason('');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const enforce2fa = async () => {
    setBusy(true);
    try {
      const res = await adminApi.enforce2faPolicy({ thresholdAmount: Number(threshold), days: Number(days) || 30 });
      toast.success(`2FA enforced for ${res.data?.data?.affectedOwnerCount || 0} owner(s)`);
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="rounded-xl p-5" style={GLASS}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20">
              <Shield className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Security & Compliance</h1>
              <p className="text-xs text-gray-500">Threat detection · Sessions · GDPR · 2FA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={720} value={hours}
              onChange={e => setHours(Number(e.target.value) || 24)}
              className="w-24 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" style={IS} />
            <span className="text-xs text-gray-500">hours</span>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminKpiCard label="Failed Logins" accent="#f87171" value={loading ? '—' : (threats?.totals?.failedLoginAttempts ?? 0)} delay={0.08} />
        <AdminKpiCard label="Successful Logins" accent="#34d399" value={loading ? '—' : (threats?.totals?.successfulLogins ?? 0)} delay={0.14} />
        <AdminKpiCard label="Active Sessions" accent="#60a5fa" value={loading ? '—' : (threats?.totals?.activeSessions ?? 0)} delay={0.2} />
        <AdminKpiCard label="Brute-force IPs" accent="#fbbf24" value={loading ? '—' : (threats?.bruteForceIps?.length ?? 0)} delay={0.26} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.3 }} className="rounded-xl p-5" style={GLASS}>
          <SectionTitle icon={AlertTriangle} title="Unusual Access Patterns" color="#fbbf24" />
          {loading ? (
            <div className="space-y-2 animate-pulse">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />)}</div>
          ) : !(threats?.unusualAccesses?.length) ? (
            <p className="text-xs text-gray-600">No unusual patterns detected.</p>
          ) : (
            <ul className="space-y-2">
              {(threats.unusualAccesses).slice(0, 10).map(u => (
                <li key={u.userId} className="flex items-start gap-2 text-xs">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  <span className="text-gray-300"><span className="font-semibold">{u.name}</span><span className="text-gray-500"> · {u.email} · {u.distinctIpCount} IPs, {u.distinctDeviceCount} devices</span></span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.34 }} className="rounded-xl p-5" style={GLASS}>
          <SectionTitle icon={Users} title="Multiple Accounts on Same IP" color="#f87171" />
          {loading ? (
            <div className="space-y-2 animate-pulse">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />)}</div>
          ) : !(threats?.sharedIps?.length) ? (
            <p className="text-xs text-gray-600">No shared IPs detected.</p>
          ) : (
            <ul className="space-y-2">
              {(threats.sharedIps).slice(0, 10).map(x => (
                <li key={x.ipAddress} className="flex items-center gap-2 text-xs">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-red-400" />
                  <span className="font-mono text-gray-300">{x.ipAddress}</span>
                  <span className="text-gray-500">· {x.userCount} accounts</span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.38 }} className="rounded-xl p-5" style={GLASS}>
        <SectionTitle icon={Monitor} title="Device & Session Management" color="#60a5fa" />
        <div className="flex gap-2 mb-4">
          <input placeholder="Search user, email, IP, device..." value={sessionSearch} onChange={e => setSessionSearch(e.target.value)}
            className={`${IC} max-w-sm`} style={IS} />
          <button onClick={load} className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Search
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['User', 'IP', 'Device', 'Last Seen', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-500 font-bold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td className="px-3 py-2 font-medium text-gray-300">{s.user?.name || s.user_id}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">{s.ip_address || '—'}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-gray-500">{s.user_agent || '—'}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => terminateSession(s.id)} disabled={busy}
                      className="rounded px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-60"
                      style={{ border: '1px solid rgba(244,63,94,0.3)' }}>
                      Terminate
                    </button>
                  </td>
                </tr>
              ))}
              {!sessions.length && !loading && <tr><td colSpan={5} className="py-6 text-center text-sm text-gray-600">No active sessions.</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.42 }} className="rounded-xl p-5" style={GLASS}>
        <SectionTitle icon={Lock} title="Data Access Logs (Recent API Calls)" color="#a78bfa" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Time', 'Actor', 'Method', 'Path', 'Status', 'IP'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-500 font-bold">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {accessLogs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td className="px-3 py-2 font-mono text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-gray-400">{l.actor?.email || l.actor_user_id || 'anon'}</td>
                  <td className="px-3 py-2"><span className="font-mono font-bold text-[10px]" style={{ color: METHOD_COLORS[l.method] || '#9ca3af' }}>{l.method}</span></td>
                  <td className="px-3 py-2 max-w-[280px] truncate font-mono text-gray-400">{l.path}</td>
                  <td className="px-3 py-2"><span className={`font-bold ${Number(l.status_code) < 300 ? 'text-emerald-400' : Number(l.status_code) < 500 ? 'text-amber-400' : 'text-red-400'}`}>{l.status_code}</span></td>
                  <td className="px-3 py-2 font-mono text-gray-500">{l.ip_address || '—'}</td>
                </tr>
              ))}
              {!accessLogs.length && !loading && <tr><td colSpan={6} className="py-6 text-center text-sm text-gray-600">No recent API calls.</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.46 }} className="rounded-xl p-5" style={GLASS}>
          <SectionTitle icon={Shield} title="GDPR / Data Privacy Controls" color="#f87171" />
          <p className="text-xs text-gray-500 mb-4">Permanently deletes a user account and all owned shop data.</p>
          <div className="space-y-2">
            <input placeholder="Target User ID (UUID)" value={gdprUserId} onChange={e => setGdprUserId(e.target.value)} className={IC} style={IS} />
            <input placeholder="Reason (optional)" value={gdprReason} onChange={e => setGdprReason(e.target.value)} className={IC} style={IS} />
            <button onClick={runGdprDelete} disabled={busy}
              className="w-full rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
              Execute Full Account Wipe
            </button>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.5 }} className="rounded-xl p-5" style={GLASS}>
          <SectionTitle icon={Lock} title="Two-Factor Authentication Enforcement" color="#a78bfa" />
          <p className="text-xs text-gray-500 mb-4">Require 2FA for owners above a transaction-volume threshold.</p>
          <div className="grid gap-2 sm:grid-cols-2 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">Threshold (GHS)</p>
              <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value) || 0)} className={IC} style={IS} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">Lookback days</p>
              <input type="number" value={days} onChange={e => setDays(Number(e.target.value) || 30)} className={IC} style={IS} />
            </div>
          </div>
          <button onClick={enforce2fa} disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
            Enforce 2FA Policy
          </button>
        </motion.section>
      </div>
      {/* ── Change My Password (PIN flow) ─────────────────────────────────── */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.54 }} className="rounded-xl p-5" style={GLASS}>
        <SectionTitle icon={KeyRound} title="Change My Password (PIN Verification)" color="#34d399" />
        <p className="text-xs text-gray-500 mb-4">
          A 6-digit PIN will be sent to your email. Enter it to unlock your new password — same flow as Dashboard Edit.
        </p>

        {pwStep === 'idle' && (
          <form onSubmit={handleSendPwPin} className="space-y-3 max-w-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">Your email</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input
                  type="email" value={pwEmail} onChange={e => setPwEmail(e.target.value)}
                  className="rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full"
                  style={IS} placeholder="admin@example.com" required />
              </div>
            </div>
            <button type="submit" disabled={pwBusy || !pwEmail.trim()}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
              {pwBusy ? 'Sending…' : 'Send 6-digit PIN to email'}
            </button>
          </form>
        )}

        {pwStep === 'pin_sent' && (
          <form onSubmit={handleVerifyPwPin} className="space-y-3 max-w-sm">
            <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
              <Mail className="h-4 w-4" /> PIN sent to {pwEmail}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">6-digit PIN</p>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={pwPin} onChange={e => setPwPin(e.target.value.replace(/\D/g, ''))}
                className="rounded-lg px-3 py-2 text-sm text-white font-mono text-xl tracking-widest focus:outline-none w-full"
                style={IS} placeholder="000000" autoFocus />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pwBusy || pwPin.length !== 6}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
                {pwBusy ? 'Verifying…' : 'Verify PIN'}
              </button>
              <button type="button" onClick={() => { setPwStep('idle'); setPwPin(''); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {pwStep === 'new_password' && (
          <form onSubmit={handleResetPw} className="space-y-3 max-w-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">New password</p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full"
                  style={IS} placeholder="At least 8 characters" minLength={8} required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">Confirm password</p>
              <input
                type={showPw ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full"
                style={IS} placeholder="Repeat password" minLength={8} required />
            </div>
            <div className="flex gap-2">
              <button type="submit"
                disabled={pwBusy || newPassword.length < 8 || newPassword !== confirmPassword}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
                {pwBusy ? 'Updating…' : 'Update password'}
              </button>
              <button type="button" onClick={() => { setPwStep('pin_sent'); setNewPassword(''); setConfirmPassword(''); }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                Back
              </button>
            </div>
          </form>
        )}

        {pwStep === 'done' && (
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 text-sm font-medium">Password updated successfully.</span>
            <button onClick={() => setPwStep('idle')}
              className="text-xs text-gray-500 hover:text-gray-300 underline">
              Change again
            </button>
          </div>
        )}
      </motion.section>

      {busy && <div className="fixed inset-0 z-50 cursor-wait" />}
    </div>
  );
}