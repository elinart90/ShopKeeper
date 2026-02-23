type AdminStatusBadgeProps = {
  status?: string | null;
};

export default function AdminStatusBadge({ status }: AdminStatusBadgeProps) {
  const key = String(status || 'unknown').toLowerCase();
  const ui =
    key === 'active'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : key === 'suspended'
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : key === 'flagged'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : key === 'draft'
            ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ui}`}>
      {status || 'unknown'}
    </span>
  );
}
