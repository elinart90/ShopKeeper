import { motion } from 'framer-motion';

type AdminKpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  delay?: number;
};

export default function AdminKpiCard({ label, value, hint, accent = '#10b981', delay = 0 }: AdminKpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="relative overflow-hidden rounded-xl cursor-default select-none p-4"
      style={{
        background: 'rgba(17,24,39,0.75)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(to right, ${accent}bb, ${accent}11)` }}
      />
    </motion.div>
  );
}
