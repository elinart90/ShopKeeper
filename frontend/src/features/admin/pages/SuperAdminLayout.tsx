import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/super-admin', label: 'Overview', end: true },
  { to: '/super-admin/ai-intelligence', label: 'AI Intelligence' },
  { to: '/super-admin/users', label: 'Users' },
  { to: '/super-admin/transactions', label: 'Transactions' },
  { to: '/super-admin/shops', label: 'Shops' },
  { to: '/super-admin/security', label: 'Security' },
  { to: '/super-admin/monetization', label: 'Monetization' },
  { to: '/super-admin/audit-logs', label: 'Audit Logs' },
];

export default function SuperAdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-4">
        <aside className="hidden w-56 shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:block">
          <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Super Admin</p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
