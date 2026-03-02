import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Brain, Users, ArrowLeftRight,
  Store, Shield, CreditCard, ScrollText,
} from 'lucide-react';

const navItems = [
  { to: '/super-admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/super-admin/ai-intelligence', label: 'AI Intelligence', icon: Brain },
  { to: '/super-admin/users', label: 'Users', icon: Users },
  { to: '/super-admin/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/super-admin/shops', label: 'Shops', icon: Store },
  { to: '/super-admin/security', label: 'Security', icon: Shield },
  { to: '/super-admin/monetization', label: 'Monetization', icon: CreditCard },
  { to: '/super-admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export default function SuperAdminLayout() {
  return (
    <div className="min-h-screen" style={{ background: '#0f1117' }}>
      <div className="mx-auto flex w-full max-w-7xl gap-4 px-4 py-4">
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="hidden w-56 shrink-0 rounded-xl p-3 md:block self-start sticky top-4"
          style={{
            background: 'rgba(17,24,39,0.85)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="mb-4 px-1 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Super Admin</p>
            <motion.span
              className="block h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item, i) => (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.045, ease: 'easeOut' }}
              >
                <NavLink
                  to={item.to}
                  end={item.end}
                  className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 outline-none"
                  style={({ isActive }) =>
                    isActive
                      ? { color: '#fff', background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }
                      : { color: '#9ca3af' }
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-emerald-400" />
                      )}
                      <item.icon
                        className="h-4 w-4 shrink-0 transition-colors"
                        style={{ color: isActive ? '#34d399' : '#6b7280' }}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              </motion.div>
            ))}
          </nav>
        </motion.aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
