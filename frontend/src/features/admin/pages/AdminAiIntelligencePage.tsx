import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, RefreshCw, Send, Trophy, AlertTriangle, TrendingDown, Zap } from 'lucide-react';
import { adminApi, type AdminAiIntelligenceData } from '../../../lib/api';
import toast from 'react-hot-toast';

const GLASS = { background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' };
const INPUT_CLS = 'rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none w-full';
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' };
const SELECT_STYLE = { background: 'rgba(20,25,40,0.95)', border: '1px solid rgba(255,255,255,0.08)' };

function InsightSection({
  title, icon: Icon, iconColor, summary, items, loading, delay,
}: { title: string; icon: React.ElementType; iconColor: string; summary?: string; items: string[]; loading: boolean; delay: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl p-5" style={GLASS}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${iconColor}22` }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 rounded w-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="h-3 rounded w-4/5" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="h-3 rounded w-3/5" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
      ) : (
        <>
          {summary && <p className="text-sm text-gray-300 mb-3 leading-relaxed">{summary}</p>}
          {items.length > 0 && (
            <ul className="space-y-1.5">
              {items.slice(0, 8).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-gray-400">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: iconColor }} />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </motion.section>
  );
}

export default function AdminAiIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<AdminAiIntelligenceData | null>(null);
  const [query, setQuery] = useState<{ from: string; to: string; rankBy: 'revenue' | 'transactions' | 'profit' }>({
    from: '', to: '', rankBy: 'revenue',
  });
  const [email, setEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAiIntelligence({ from: query.from || undefined, to: query.to || undefined, rankBy: query.rankBy });
      setData(res.data?.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendExecutiveSummary = async () => {
    setSending(true);
    try {
      await adminApi.emailAiExecutiveSummary({ email: email || undefined });
      toast.success('Executive summary sent successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send executive summary');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header card */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }} className="rounded-xl p-5" style={GLASS}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20">
              <Brain className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI Intelligence</h1>
              <p className="text-xs text-gray-500 mt-0.5">Claude primary · OpenAI fallback · Platform-wide insights</p>
            </div>
          </div>
          {!loading && data?.providerUsed && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
              {data.providerUsed}
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input type="date" value={query.from} onChange={e => setQuery(s => ({ ...s, from: e.target.value }))}
            className={INPUT_CLS} style={{ ...INPUT_STYLE, width: 'auto' }} />
          <input type="date" value={query.to} onChange={e => setQuery(s => ({ ...s, to: e.target.value }))}
            className={INPUT_CLS} style={{ ...INPUT_STYLE, width: 'auto' }} />
          <select value={query.rankBy} onChange={e => setQuery(s => ({ ...s, rankBy: e.target.value as any }))}
            className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none" style={SELECT_STYLE}>
            <option value="revenue">Top 10 by Revenue</option>
            <option value="transactions">Top 10 by Transactions</option>
            <option value="profit">Top 10 by Profit</option>
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Insights
          </button>
        </div>
      </motion.div>

      {/* 4 insight panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightSection title="Anomaly Detection" icon={AlertTriangle} iconColor="#f59e0b"
          summary={data?.anomalyDetection?.summary} items={data?.anomalyDetection?.highlights || []}
          loading={loading} delay={0.1} />
        <InsightSection title="Churn Prediction" icon={TrendingDown} iconColor="#f87171"
          summary={data?.churnPrediction?.summary} items={data?.churnPrediction?.warnings || []}
          loading={loading} delay={0.16} />
        <InsightSection title="Growth Opportunities" icon={Zap} iconColor="#34d399"
          summary={data?.growthOpportunities?.summary} items={data?.growthOpportunities?.alerts || []}
          loading={loading} delay={0.22} />

        {/* Top 10 Shops */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl p-5" style={GLASS}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
              <Trophy className="h-4 w-4 text-amber-400" />
            </div>
            <h2 className="text-sm font-bold text-white">Top 10 Performing Shops</h2>
          </div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
            Ranked by {data?.topPerformingShopsRankBy || query.rankBy}
          </p>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 rounded" style={{ background: 'rgba(255,255,255,0.04)', animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['#', 'Shop', 'Revenue', 'Tx', 'Profit', 'Avg Ticket'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-gray-500 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.topPerformingShops || []).map((shop, idx) => (
                    <tr key={shop.shopId} className="transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-2 py-2">
                        <span className="font-bold" style={{ color: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#cd7f32' : '#4b5563' }}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-semibold text-gray-200">{shop.shopName}</td>
                      <td className="px-2 py-2 text-emerald-400">GHS {shop.revenue.toFixed(0)}</td>
                      <td className="px-2 py-2 text-gray-400">{shop.transactions}</td>
                      <td className="px-2 py-2 text-violet-400">GHS {Number(shop.profit || 0).toFixed(0)}</td>
                      <td className="px-2 py-2 text-gray-400">GHS {shop.avgTicket.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(data?.topPerformingShops?.length) && (
                <p className="py-4 text-center text-xs text-gray-500">No data in this date range.</p>
              )}
            </div>
          )}
        </motion.section>
      </div>

      {/* Executive Summary */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl p-5" style={GLASS}>
        <h2 className="text-sm font-bold text-white mb-3">AI Executive Summary</h2>
        <div className="rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap min-h-[80px]"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: i === 3 ? '60%' : '100%' }} />
              ))}
            </div>
          ) : (data?.executiveSummary || 'No summary available.')}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Optional recipient email"
            className={INPUT_CLS} style={{ ...INPUT_STYLE, maxWidth: 320 }} />
          <button onClick={sendExecutiveSummary} disabled={sending}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60">
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending...' : 'Send Executive Summary'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-600">
          Schedule <code className="text-gray-500">/api/admin/ai-intelligence/executive-summary/email</code> every Monday for auto-delivery.
        </p>
      </motion.section>
    </div>
  );
}
