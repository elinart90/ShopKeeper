import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, RefreshCw, TrendingUp } from 'lucide-react';
import { adminApi, type AdminCommissionSummaryData, type AdminMonetizationBillingRow, type AdminRevenueForecastData } from '../../../lib/api';
import AdminKpiCard from '../components/AdminKpiCard';
import AdminStatusBadge from '../components/AdminStatusBadge';
import toast from 'react-hot-toast';

type PlanCode = 'small' | 'medium' | 'big' | 'enterprise';
const GLASS = { background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' };
const IC = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const IS = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' };
const SS = { background: 'rgba(20,25,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' };

const PLAN_COLORS: Record<string, string> = { small: '#6b7280', medium: '#60a5fa', big: '#a78bfa', enterprise: '#fbbf24' };

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">{children}</p>;
}

export default function AdminMonetizationPage() {
  const [loading, setLoading] = useState(true);
  const [billingRows, setBillingRows] = useState<AdminMonetizationBillingRow[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [commission, setCommission] = useState<AdminCommissionSummaryData | null>(null);
  const [forecast, setForecast] = useState<AdminRevenueForecastData | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState({ search: '', overdueOnly: false });
  const [planForm, setPlanForm] = useState<{ userId: string; planCode: PlanCode; billingCycle: 'monthly' | 'yearly' }>({ userId: '', planCode: 'small', billingCycle: 'monthly' });
  const [promoForm, setPromoForm] = useState({ code: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: 10, trialExtensionDays: 0, maxRedemptions: 100 });
  const [applyPromoForm, setApplyPromoForm] = useState({ userId: '', code: '' });
  const [commissionRate, setCommissionRate] = useState(1.5);
  const [months, setMonths] = useState(12);
  const [overdueDays, setOverdueDays] = useState(7);

  const load = async () => {
    setLoading(true);
    try {
      const [billingRes, promoRes, commissionRes, forecastRes] = await Promise.all([
        adminApi.getMonetizationBilling({ page: 1, limit: 30, search: query.search || undefined, overdueOnly: query.overdueOnly || undefined }),
        adminApi.getMonetizationPromos(),
        adminApi.getCommissionSummary({ ratePercent: commissionRate }),
        adminApi.getRevenueForecast({ months }),
      ]);
      setBillingRows(billingRes.data?.data?.items || []);
      setPromos((promoRes.data?.data as any[]) || []);
      setCommission(commissionRes.data?.data || null);
      setForecast(forecastRes.data?.data || null);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updatePlan = async () => {
    if (!planForm.userId.trim()) return toast.error('Enter a valid user ID');
    setBusy(true);
    try { await adminApi.setMonetizationPlan(planForm); toast.success('Plan updated'); await load(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const createPromo = async () => {
    if (!promoForm.code.trim()) return toast.error('Enter a promo code');
    setBusy(true);
    try { await adminApi.createMonetizationPromo(promoForm); toast.success('Promo created'); await load(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const applyPromo = async () => {
    if (!applyPromoForm.userId.trim() || !applyPromoForm.code.trim()) return toast.error('Provide user ID and code');
    setBusy(true);
    try { await adminApi.applyMonetizationPromo(applyPromoForm); toast.success('Promo applied'); await load(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const runSuspendOverdue = async () => {
    if (!window.confirm('Suspend shops with overdue subscriptions?')) return;
    setBusy(true);
    try {
      const res = await adminApi.suspendOverduePlans({ daysPastDue: overdueDays });
      toast.success(`Suspended ${res.data?.data?.suspendedShopCount || 0} shop(s)`);
      await load();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="rounded-xl p-5" style={GLASS}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
              <CreditCard className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Monetization</h1>
              <p className="text-xs text-gray-500">Billing · Promos · Commission · Forecasting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input value={query.search} onChange={e => setQuery(s => ({ ...s, search: e.target.value }))}
              placeholder="Search owner / shop / plan" className="rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-52" style={IS} />
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={query.overdueOnly} onChange={e => setQuery(s => ({ ...s, overdueOnly: e.target.checked }))}
                className="rounded" />
              Overdue only
            </label>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminKpiCard label="Monthly Recurring Revenue" accent="#10b981"
          value={loading ? '—' : `GHS ${forecast?.currentMRR?.toFixed(2) || '0.00'}`} delay={0.08} />
        <AdminKpiCard label="Active Subscriptions" accent="#6366f1"
          value={loading ? '—' : (forecast?.activeSubscriptions || 0)} delay={0.14} />
        <AdminKpiCard label="Est. Growth / Month" accent="#a855f7"
          value={loading ? '—' : `${forecast?.estimatedMonthlyGrowthRate || 0}%`} delay={0.2} />
      </div>

      {/* Billing table */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.26 }} className="rounded-xl p-5" style={GLASS}>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Subscription & Billing Management</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Owner', 'Plan', 'Cycle', 'Status', 'Amount', 'Overdue (days)'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-gray-500 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-3 py-3"><div className="animate-pulse h-3 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.05)' }} /></td>
                      ))}
                    </tr>
                  ))
                : billingRows.map(r => (
                    <tr key={r.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="px-3 py-2 font-semibold text-gray-200">{r.ownerName || r.ownerEmail}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-semibold capitalize px-1.5 py-0.5 rounded" style={{ color: PLAN_COLORS[r.planCode] || '#6b7280', background: `${PLAN_COLORS[r.planCode] || '#6b7280'}1a` }}>
                          {r.planCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 capitalize">{r.billingCycle}</td>
                      <td className="px-3 py-2"><AdminStatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 tabular-nums text-emerald-400 font-semibold">{r.currency} {r.amount.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className={r.overdueDays > 0 ? 'text-red-400 font-bold' : 'text-gray-500'}>{r.overdueDays}</span>
                      </td>
                    </tr>
                  ))
              }
              {!loading && !billingRows.length && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-600">No billing records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Actions row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Manual plan upgrade */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.3 }} className="rounded-xl p-5" style={GLASS}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Manual Upgrade / Downgrade</p>
          <div className="grid gap-2 sm:grid-cols-3 mb-3">
            <div><Label>Owner User ID</Label>
              <input placeholder="User ID" value={planForm.userId} onChange={e => setPlanForm(s => ({ ...s, userId: e.target.value }))} className={IC} style={IS} />
            </div>
            <div><Label>Plan</Label>
              <select value={planForm.planCode} onChange={e => setPlanForm(s => ({ ...s, planCode: e.target.value as PlanCode }))}
                className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="big">Big</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div><Label>Cycle</Label>
              <select value={planForm.billingCycle} onChange={e => setPlanForm(s => ({ ...s, billingCycle: e.target.value as 'monthly' | 'yearly' }))}
                className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <button onClick={updatePlan} disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
            Update Plan
          </button>
        </motion.section>

        {/* Overdue suspension */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.34 }} className="rounded-xl p-5" style={GLASS}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">Automated Overdue Suspension</p>
          <div className="flex items-center gap-2 mb-4">
            <input type="number" value={overdueDays} onChange={e => setOverdueDays(Number(e.target.value) || 7)}
              className="w-24 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" style={IS} />
            <span className="text-xs text-gray-500">days past due</span>
          </div>
          <button onClick={runSuspendOverdue} disabled={busy}
            className="w-full rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
            Suspend Overdue Shops Now
          </button>
        </motion.section>
      </div>

      {/* Promos + Commission */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Promo management */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.38 }} className="rounded-xl p-5" style={GLASS}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 mb-4">
            Coupon & Promo Management
            <span className="ml-2 text-emerald-400 normal-case text-[10px]">{promos.length} active codes</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2 mb-3">
            <div><Label>Code</Label>
              <input placeholder="PROMO2026" value={promoForm.code} onChange={e => setPromoForm(s => ({ ...s, code: e.target.value }))} className={IC} style={IS} />
            </div>
            <div><Label>Type</Label>
              <select value={promoForm.discountType} onChange={e => setPromoForm(s => ({ ...s, discountType: e.target.value as any }))}
                className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full" style={SS}>
                <option value="percent">Percent %</option>
                <option value="fixed">Fixed GHS</option>
              </select>
            </div>
            <div><Label>Discount value</Label>
              <input type="number" value={promoForm.discountValue} onChange={e => setPromoForm(s => ({ ...s, discountValue: Number(e.target.value) || 0 }))} className={IC} style={IS} />
            </div>
            <div><Label>Trial ext. days</Label>
              <input type="number" value={promoForm.trialExtensionDays} onChange={e => setPromoForm(s => ({ ...s, trialExtensionDays: Number(e.target.value) || 0 }))} className={IC} style={IS} />
            </div>
          </div>
          <button onClick={createPromo} disabled={busy}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 mb-4">
            Create Promo
          </button>
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Label>Apply promo to user</Label>
            <div className="grid gap-2 sm:grid-cols-2 mb-2">
              <input placeholder="User ID" value={applyPromoForm.userId} onChange={e => setApplyPromoForm(s => ({ ...s, userId: e.target.value }))} className={IC} style={IS} />
              <input placeholder="Promo code" value={applyPromoForm.code} onChange={e => setApplyPromoForm(s => ({ ...s, code: e.target.value }))} className={IC} style={IS} />
            </div>
            <button onClick={applyPromo} disabled={busy}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Apply Promo to User
            </button>
          </div>
        </motion.section>

        {/* Commission + Forecast */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.42 }} className="rounded-xl p-5" style={GLASS}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">Commission & Forecasting</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div><Label>Commission %</Label>
              <input type="number" value={commissionRate} onChange={e => setCommissionRate(Number(e.target.value) || 0)}
                className="w-24 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" style={IS} />
            </div>
            <div><Label>Forecast months</Label>
              <input type="number" value={months} onChange={e => setMonths(Number(e.target.value) || 12)}
                className="w-24 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" style={IS} />
            </div>
            <div className="mt-4">
              <button onClick={load}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors">
                Recalculate
              </button>
            </div>
          </div>
          <div className="space-y-2 mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Gross (month)</span>
              <span className="font-bold text-emerald-400">GHS {commission?.totalGross?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Commission (month)</span>
              <span className="font-bold text-violet-400">GHS {commission?.totalCommission?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {(forecast?.projections || []).map(p => (
              <div key={p.months} className="flex items-center justify-between text-xs px-1">
                <span className="text-gray-500">{p.months} month{p.months !== 1 ? 's' : ''}</span>
                <span className="tabular-nums font-semibold text-emerald-400">GHS {p.projectedRevenue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
      {busy && <div className="fixed inset-0 z-50 cursor-wait" />}
    </div>
  );
}
