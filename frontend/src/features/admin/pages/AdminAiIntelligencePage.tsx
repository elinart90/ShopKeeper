import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';

export default function AdminAiIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<any>(null);
  const [query, setQuery] = useState({ from: '', to: '' });
  const [email, setEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAiIntelligence({
        from: query.from || undefined,
        to: query.to || undefined,
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
          Claude is primary, OpenAI fallback. Insights are generated from platform-wide shop and transaction behavior.
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
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Provider used: {loading ? '...' : data?.providerUsed || '-'}
          </span>
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
            For automatic Monday delivery, schedule backend call to
            {' '}
            <code>/api/admin/ai-intelligence/executive-summary/email</code>
            {' '}
            every Monday morning.
          </p>
        </section>
      </div>
    </div>
  );
}
