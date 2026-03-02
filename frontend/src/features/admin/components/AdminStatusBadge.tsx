type AdminStatusBadgeProps = { status?: string | null };

const BADGE_MAP: Record<string, { dot: string; text: string; bg: string }> = {
  active:    { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'rgba(16,185,129,0.12)' },
  suspended: { dot: 'bg-red-400',     text: 'text-red-300',     bg: 'rgba(239,68,68,0.12)'  },
  flagged:   { dot: 'bg-amber-400',   text: 'text-amber-300',   bg: 'rgba(245,158,11,0.12)' },
  draft:     { dot: 'bg-gray-400',    text: 'text-gray-400',    bg: 'rgba(156,163,175,0.1)' },
  completed: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { dot: 'bg-red-400',     text: 'text-red-300',     bg: 'rgba(239,68,68,0.12)'  },
};

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const key = String(status || 'unknown').toLowerCase();
  const { dot, text, bg } = BADGE_MAP[key] ?? { dot: 'bg-blue-400', text: 'text-blue-300', bg: 'rgba(96,165,250,0.12)' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${text}`}
      style={{ background: bg, border: `1px solid ${bg.replace('0.12', '0.2')}` }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status || 'unknown'}
    </span>
  );
}
