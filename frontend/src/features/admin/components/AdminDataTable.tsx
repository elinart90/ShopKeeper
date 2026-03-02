import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyText?: string;
  loading?: boolean;
};

const GLASS = {
  background: 'rgba(17,24,39,0.75)',
  border: '1px solid rgba(255,255,255,0.07)',
  backdropFilter: 'blur(12px)',
};

const SKELETON_WIDTHS = ['72%', '55%', '80%', '60%', '75%'];

export default function AdminDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyText = 'No data found.',
  loading,
}: AdminDataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl" style={GLASS}>
      <table className="min-w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-[10px] uppercase tracking-[0.12em] font-bold text-gray-500 ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {columns.map((col, ci) => (
                  <td key={col.key} className="px-4 py-3">
                    <div
                      className="animate-pulse h-3 rounded"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        animationDelay: `${i * 60}ms`,
                        width: SKELETON_WIDTHS[(i + ci) % SKELETON_WIDTHS.length],
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <motion.tr
                key={rowKey(row, index)}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.3), ease: 'easeOut' }}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-gray-300 ${col.className || ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </motion.tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
