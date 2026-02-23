import type { ReactNode } from 'react';

type AdminFiltersBarProps = {
  children: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
};

export default function AdminFiltersBar({ children, onApply, onReset }: AdminFiltersBarProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      {(onApply || onReset) && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {onReset ? (
            <button
              onClick={onReset}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Reset
            </button>
          ) : null}
          {onApply ? (
            <button
              onClick={onApply}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
            >
              Apply
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
