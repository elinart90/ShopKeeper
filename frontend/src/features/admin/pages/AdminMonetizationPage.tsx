import { useEffect, useState } from 'react';
import { adminApi, type AdminCommissionSummaryData, type AdminMonetizationBillingRow, type AdminRevenueForecastData } from '../../../lib/api';

type PlanCode = 'small' | 'medium' | 'big' | 'enterprise';

export default function AdminMonetizationPage() {
  const [loading, setLoading] = useState(true);
  const [billingRows, setBillingRows] = useState<AdminMonetizationBillingRow[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [commission, setCommission] = useState<AdminCommissionSummaryData | null>(null);
  const [forecast, setForecast] = useState<AdminRevenueForecastData | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState({ search: '', overdueOnly: false });
  const [planForm, setPlanForm] = useState<{ userId: string; planCode: PlanCode; billingCycle: 'monthly' | 'yearly' }>({
    userId: '',
    planCode: 'small',
    billingCycle: 'monthly',
  });
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updatePlan = async () => {
    if (!planForm.userId.trim()) return window.alert('Enter a valid user ID');
    setBusy(true);
    try {
      await adminApi.setMonetizationPlan(planForm);
      window.alert('Plan updated.');
      await load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to update plan');
    } finally {
      setBusy(false);
    }
  };

  const createPromo = async () => {
    if (!promoForm.code.trim()) return window.alert('Enter promo code');
    setBusy(true);
    try {
      await adminApi.createMonetizationPromo(promoForm);
      window.alert('Promo code created.');
      await load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to create promo');
    } finally {
      setBusy(false);
    }
  };

  const applyPromo = async () => {
    if (!applyPromoForm.userId.trim() || !applyPromoForm.code.trim()) return window.alert('Provide user ID and code');
    setBusy(true);
    try {
      await adminApi.applyMonetizationPromo(applyPromoForm);
      window.alert('Promo applied.');
      await load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to apply promo');
    } finally {
      setBusy(false);
    }
  };

  const runSuspendOverdue = async () => {
    if (!window.confirm('Suspend shops with overdue subscriptions now?')) return;
    setBusy(true);
    try {
      const res = await adminApi.suspendOverduePlans({ daysPastDue: overdueDays });
      window.alert(`Suspended shops: ${res.data?.data?.suspendedShopCount || 0}`);
      await load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Failed to run suspension');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Advanced Monetization Controls</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={query.search}
            onChange={(e) => setQuery((s) => ({ ...s, search: e.target.value }))}
            placeholder="Search by owner/shop/plan"
            className="min-w-[260px] rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={query.overdueOnly} onChange={(e) => setQuery((s) => ({ ...s, overdueOnly: e.target.checked }))} />
            Overdue only
          </label>
          <button onClick={load} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Current MRR</p>
          <p className="mt-1 text-xl font-semibold">GHS {loading ? '...' : forecast?.currentMRR?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Active Subscriptions</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '...' : forecast?.activeSubscriptions || 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs text-gray-500">Estimated Growth / Month</p>
          <p className="mt-1 text-xl font-semibold">{loading ? '...' : `${forecast?.estimatedMonthlyGrowthRate || 0}%`}</p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold">Subscription & Billing Management</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-2 py-2">Owner</th>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Cycle</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Overdue (days)</th>
              </tr>
            </thead>
            <tbody>
              {(billingRows || []).map((r) => (
                <tr key={r.userId} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-2 py-2">{r.ownerName || r.ownerEmail}</td>
                  <td className="px-2 py-2">{r.planCode}</td>
                  <td className="px-2 py-2">{r.billingCycle}</td>
                  <td className="px-2 py-2">{r.status}</td>
                  <td className="px-2 py-2">{r.currency} {r.amount.toFixed(2)}</td>
                  <td className="px-2 py-2">{r.overdueDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Manual Upgrade / Downgrade</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              placeholder="Owner User ID"
              value={planForm.userId}
              onChange={(e) => setPlanForm((s) => ({ ...s, userId: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            <select
              value={planForm.planCode}
              onChange={(e) => setPlanForm((s) => ({ ...s, planCode: e.target.value as PlanCode }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="small">small</option>
              <option value="medium">medium</option>
              <option value="big">big</option>
              <option value="enterprise">enterprise</option>
            </select>
            <select
              value={planForm.billingCycle}
              onChange={(e) => setPlanForm((s) => ({ ...s, billingCycle: e.target.value as 'monthly' | 'yearly' }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </div>
          <button onClick={updatePlan} disabled={busy} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            Update Plan
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Automated Overdue Suspension</h2>
          <div className="mt-3 flex items-center gap-2">
            <input type="number" value={overdueDays} onChange={(e) => setOverdueDays(Number(e.target.value) || 7)} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <span className="text-xs text-gray-600 dark:text-gray-300">days past due</span>
          </div>
          <button onClick={runSuspendOverdue} disabled={busy} className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
            Suspend Overdue Shops Now
          </button>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Coupon & Promo Management</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input placeholder="Code" value={promoForm.code} onChange={(e) => setPromoForm((s) => ({ ...s, code: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <select value={promoForm.discountType} onChange={(e) => setPromoForm((s) => ({ ...s, discountType: e.target.value as any }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
              <option value="percent">percent</option>
              <option value="fixed">fixed</option>
            </select>
            <input type="number" placeholder="Discount value" value={promoForm.discountValue} onChange={(e) => setPromoForm((s) => ({ ...s, discountValue: Number(e.target.value) || 0 }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <input type="number" placeholder="Trial extension days" value={promoForm.trialExtensionDays} onChange={(e) => setPromoForm((s) => ({ ...s, trialExtensionDays: Number(e.target.value) || 0 }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
          </div>
          <button onClick={createPromo} disabled={busy} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            Create Promo
          </button>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input placeholder="Apply to user ID" value={applyPromoForm.userId} onChange={(e) => setApplyPromoForm((s) => ({ ...s, userId: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <input placeholder="Promo code" value={applyPromoForm.code} onChange={(e) => setApplyPromoForm((s) => ({ ...s, code: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
          </div>
          <button onClick={applyPromo} disabled={busy} className="mt-3 rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            Apply Promo to User
          </button>
          <p className="mt-3 text-xs text-gray-500">Active promo codes: {promos.length}</p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Commission Tracking & Revenue Forecasting</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="number" value={commissionRate} onChange={(e) => setCommissionRate(Number(e.target.value) || 0)} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <span className="text-xs text-gray-600 dark:text-gray-300">% commission</span>
            <input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value) || 12)} className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
            <span className="text-xs text-gray-600 dark:text-gray-300">forecast months</span>
            <button onClick={load} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Recalculate</button>
          </div>
          <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            <p>Total Gross (month): GHS {commission?.totalGross?.toFixed(2) || '0.00'}</p>
            <p>Total Commission (month): GHS {commission?.totalCommission?.toFixed(2) || '0.00'}</p>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {(forecast?.projections || []).map((p) => (
              <li key={p.months}>- {p.months} months: GHS {p.projectedRevenue.toFixed(2)}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
