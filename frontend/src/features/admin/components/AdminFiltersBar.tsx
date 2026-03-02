import type { ReactNode } from 'react';

type AdminFiltersBarProps = {
  children: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
};

const GLASS = {
  background: 'rgba(17,24,39,0.75)',
  border: '1px solid rgba(255,255,255,0.07)',
  backdropFilter: 'blur(12px)',
};

export default function AdminFiltersBar({ children, onApply, onReset }: AdminFiltersBarProps) {
  return (
    <div className="rounded-xl p-3" style={GLASS}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      {(onApply || onReset) && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-white"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Reset
            </button>
          )}
          {onApply && (
            <button
              onClick={onApply}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Apply
            </button>
          )}
        </div>
      )}
    </div>
  );
}
