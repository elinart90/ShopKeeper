import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Store, Users, Zap, TrendingUp, TrendingDown, Activity, Wallet } from 'lucide-react';
import { adminApi } from '../../../lib/api';

function useCountUp(end: number, duration = 700, active = true) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    setVal(0);
    if (end === 0) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(2, -10 * p);
      setVal(Math.round(ease * end));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, active]);
  return val;
}

function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  if (!data.length || data.every(v => v === 0)) return <div className="w-20 h-7" />;
  const W = 80, H = 28, pad = 3;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data
    .map((v, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2);
      const y = H - pad - ((v - min) / Math.max(max - min, 1)) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={W} height={H}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const up = value > 0;
  const neutral = Math.abs(value) < 0.1;
  const cls = neutral ? 'text-gray-500' : up ? 'text-emerald-400' : 'text-red-400';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${cls}`}>
      {!neutral && (up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />)}
      {neutral ? '\u2014' : `${up ? '+' : ''}${value.toFixed(1)}%`}
      {!neutral && <span className="text-gray-600 ml-0.5">7d</span>}
    </span>
  );
}

interface KpiProps {
  label: string; value: number; format?: (n: number) => string;
  icon: React.ElementType; iconBg: string;
  accent: string; glow: string; sparkData: number[];
  delta: number; delay: number; loading: boolean;
}

function KpiCard({ label, value, format, icon: Icon, iconBg, accent, glow, sparkData, delta, delay, loading }: KpiProps) {
  const count = useCountUp(value, 680, !loading);
  const display = format ? format(count) : count.toLocaleString();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="relative overflow-hidden rounded-xl cursor-default select-none"
      style={{
        background: 'rgba(17,24,39,0.75)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 8px 28px ${glow}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {loading ? (
        <div className="p-5 space-y-3 animate-pulse">
          <div className="h-2.5 w-24 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="h-8 w-32 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="h-2 w-14 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
      ) : (
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-gray-400">{label}</p>
              <p className="mt-2 text-[1.65rem] font-bold leading-none text-white tabular-nums tracking-tight">{display}</p>
              <div className="mt-2"><DeltaBadge value={delta} /></div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <Sparkline data={sparkData} stroke={accent} />
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(to right, ${accent}bb, ${accent}11)` }} />
    </motion.div>
  );
}

function GrowthRow({ row, maxTx, idx }: { row: any; maxTx: number; idx: number }) {
  const txPct = maxTx > 0 ? Math.min((row.transaction_count / maxTx) * 100, 100) : 0;
  const hasActivity = row.transaction_count > 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: 0.42 + idx * 0.045, ease: 'easeOut' }}
      className="group grid items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150"
      style={{ gridTemplateColumns: '90px 1fr 1fr 1fr 18px' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span className="text-[11px] font-mono text-gray-500">{row.metric_date}</span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }}
            animate={{ width: row.new_users > 0 ? '100%' : '3%' }}
            transition={{ duration: 0.55, delay: 0.48 + idx * 0.04 }} />
        </div>
        <span className="text-[11px] text-gray-400 w-3 text-right tabular-nums">{row.new_users}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div className="h-full rounded-full bg-indigo-400" initial={{ width: 0 }}
            animate={{ width: row.new_shops > 0 ? '100%' : '3%' }}
            transition={{ duration: 0.55, delay: 0.52 + idx * 0.04 }} />
        </div>
        <span className="text-[11px] text-gray-400 w-3 text-right tabular-nums">{row.new_shops}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div className="h-full rounded-full bg-amber-400" initial={{ width: 0 }}
            animate={{ width: `${Math.max(txPct, txPct > 0 ? 4 : 0)}%` }}
            transition={{ duration: 0.6, delay: 0.54 + idx * 0.04, ease: 'easeOut' }} />
        </div>
        <span className="text-[11px] tabular-nums font-semibold w-5 text-right"
          style={{ color: hasActivity ? '#fbbf24' : '#4b5563' }}>
          {row.transaction_count}
        </span>
      </div>
      <div className="flex justify-center">
        {hasActivity ? (
          <motion.span className="block h-1.5 w-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
        ) : (
          <span className="block h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        )}
      </div>
    </motion.div>
  );
}

function PlatformHealth({ growth }: { growth: any[] }) {
  const len = growth.length || 1;
  const avgTx = Math.round(growth.reduce((s, r) => s + r.transaction_count, 0) / len);
  const avgUsers = +(growth.reduce((s, r) => s + r.new_users, 0) / len).toFixed(1);
  const peak = growth.reduce((b, r) => Math.max(b, r.transaction_count), 0);
  const activeDays = growth.filter(r => r.transaction_count > 0).length;
  const stats = [
    { label: 'Avg daily tx', value: avgTx.toLocaleString(), color: '#f59e0b' },
    { label: 'Avg new users', value: String(avgUsers), color: '#10b981' },
    { label: 'Peak tx / day', value: peak.toLocaleString(), color: '#a855f7' },
    { label: 'Active days', value: `${activeDays} / ${growth.length}`, color: '#6366f1' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-48 shrink-0 rounded-xl p-4 self-start"
      style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-400">Platform Health</p>
      </div>
      <div className="space-y-4">
        {stats.map(s => (
          <div key={s.label}>
            <p className="text-[9px] uppercase tracking-widest text-gray-600 font-semibold">{s.label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function computeDelta(data: any[], field: string): number {
  if (data.length < 7) return 0;
  const last7 = data.slice(-7).reduce((s, r) => s + (Number(r[field]) || 0), 0);
  const prev7 = data.slice(-14, -7).reduce((s, r) => s + (Number(r[field]) || 0), 0);
  if (prev7 === 0) return last7 > 0 ? 100 : 0;
  return ((last7 - prev7) / prev7) * 100;
}

type Overview = { activeShops: number; activeUsers: number; transactionVolume: number; revenueProcessed: number };

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [growth, setGrowth] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([adminApi.getOverview(), adminApi.getGrowth({ days: 30 })])
      .then(([o, g]) => {
        if (!active) return;
        setOverview(o.data?.data || null);
        setGrowth(Array.isArray(g.data?.data) ? g.data.data : []);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = growth.slice(-8);
  const maxTx = Math.max(...rows.map(r => r.transaction_count), 1);
  const spark = (field: string) => growth.slice(-10).map(r => Number(r[field]) || 0);

  const cards = [
    { label: 'Active Shops', value: overview?.activeShops ?? 0, icon: Store, iconBg: 'bg-indigo-500/20', accent: '#6366f1', glow: 'rgba(99,102,241,0.18)', sparkData: spark('new_shops'), delta: computeDelta(growth, 'new_shops') },
    { label: 'Active Users', value: overview?.activeUsers ?? 0, icon: Users, iconBg: 'bg-emerald-500/20', accent: '#10b981', glow: 'rgba(16,185,129,0.18)', sparkData: spark('new_users'), delta: computeDelta(growth, 'new_users') },
    { label: 'Transactions', value: overview?.transactionVolume ?? 0, icon: Zap, iconBg: 'bg-amber-500/20', accent: '#f59e0b', glow: 'rgba(245,158,11,0.18)', sparkData: spark('transaction_count'), delta: computeDelta(growth, 'transaction_count') },
    { label: 'Revenue Processed', value: overview?.revenueProcessed ?? 0, format: (n: number) => `GHS ${n.toLocaleString()}`, icon: Wallet, iconBg: 'bg-violet-500/20', accent: '#a855f7', glow: 'rgba(168,85,247,0.18)', sparkData: spark('transaction_count'), delta: 0 },
  ] as const;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="flex items-center gap-3"
      >
        <h1 className="text-xl font-bold text-white">Platform Overview</h1>
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
        >
          <motion.span
            className="block h-1.5 w-1.5 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <KpiCard
            key={card.label}
            {...card}
            format={(card as any).format}
            delay={i * 0.08}
            loading={loading}
          />
        ))}
      </div>

      <div className="flex gap-4 items-start">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 min-w-0 rounded-xl overflow-hidden"
          style={{ background: 'rgba(17,24,39,0.75)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-sm font-bold text-white">Growth (last 30 days)</h2>
            <div className="flex items-center gap-4">
              {[{ l: 'Users', c: '#10b981' }, { l: 'Shops', c: '#818cf8' }, { l: 'Tx', c: '#fbbf24' }].map(x => (
                <span key={x.l} className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                  <span className="h-1.5 w-3 rounded-full inline-block" style={{ background: x.c }} />{x.l}
                </span>
              ))}
            </div>
          </div>
          <div
            className="grid px-3 py-2 text-[9px] uppercase tracking-[0.12em] text-gray-600 font-bold"
            style={{ gridTemplateColumns: '90px 1fr 1fr 1fr 18px' }}
          >
            <span>Date</span><span>Users</span><span>Shops</span><span>Transactions</span><span />
          </div>
          <div className="px-1 pb-2 space-y-0.5">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="animate-pulse mx-2 h-8 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', animationDelay: `${i * 70}ms` }} />
                ))
              : rows.length === 0
                ? <p className="px-3 py-4 text-sm text-gray-500">No growth data yet.</p>
                : rows.map((row, idx) => (
                    <GrowthRow key={`${row.metric_date}-${idx}`} row={row} maxTx={maxTx} idx={idx} />
                  ))
            }
          </div>
        </motion.div>

        {!loading && growth.length > 0 && <PlatformHealth growth={growth} />}
      </div>
    </div>
  );
}
