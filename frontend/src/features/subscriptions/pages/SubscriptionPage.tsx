import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscriptionsApi } from '../../../lib/api';
import type { SubscriptionPlan, SubscriptionStatus } from '../../../lib/api';
import { useAuth } from '../../../contexts/useAuth';
import toast from 'react-hot-toast';

const PLAN_ORDER: SubscriptionPlan['code'][] = ['small', 'medium', 'big', 'enterprise'];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<SubscriptionPlan['code'] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [plansRes, statusRes] = await Promise.all([
          subscriptionsApi.getPlans(),
          subscriptionsApi.getStatus(),
        ]);
        if (!active) return;
        setPlans(plansRes.data.data || []);
        setStatus(statusRes.data.data || null);
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.error?.message || 'Failed to load plans');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const orderedPlans = useMemo(() => {
    const byCode = new Map(plans.map((p) => [p.code, p]));
    return PLAN_ORDER.map((code) => byCode.get(code)).filter(Boolean) as SubscriptionPlan[];
  }, [plans]);

  const payForPlan = async (plan: SubscriptionPlan) => {
    if (!user?.email) {
      toast.error('Your account email is required');
      return;
    }
    setPayingPlan(plan.code);
    try {
      const res = await subscriptionsApi.initialize({
        planCode: plan.code,
        billingCycle,
        email: user.email,
      });
      const url = res.data?.data?.authorization_url;
      if (!url) {
        toast.error('Could not start checkout');
        return;
      }
      window.location.href = url;
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to initialize payment');
    } finally {
      setPayingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status?.isActive) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Subscription active</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You are on <span className="font-semibold">{status.planName || status.planCode}</span>.
            {' '}Your plan is valid until {status.currentPeriodEnd ? new Date(status.currentPeriodEnd).toLocaleDateString() : 'N/A'}.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="px-6 py-3 rounded-lg btn-primary-gradient font-medium"
          >
            Continue to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a plan</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            An active subscription is required to use ShoopKeeper.
          </p>
          <div className="mt-4 inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 text-sm font-medium ${
                billingCycle === 'monthly'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 text-sm font-medium ${
                billingCycle === 'yearly'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Yearly (15% off)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {orderedPlans.map((plan) => {
            const isCurrent = status?.planCode === plan.code;
            return (
              <div key={plan.code} className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h2>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">
                  {plan.currency} {(billingCycle === 'yearly' ? plan.yearlyAmount : plan.monthlyAmount).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {billingCycle === 'yearly' ? 'per year' : 'per month'}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-5">
                  Full year: {plan.currency} {plan.yearlyAmount.toFixed(2)} ({plan.yearlyDiscountPercent}% off)
                </p>
                <button
                  type="button"
                  disabled={payingPlan === plan.code}
                  onClick={() => payForPlan(plan)}
                  className="w-full py-2.5 rounded-lg btn-primary-gradient disabled:opacity-60"
                >
                  {payingPlan === plan.code ? 'Redirecting...' : isCurrent ? 'Renew this plan' : 'Select plan'}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-6 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
