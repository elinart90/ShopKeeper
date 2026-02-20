import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { useSyncQueueCount } from "../../hooks/useSyncQueueCount";

export default function Header() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userDisplay = user?.name || user?.email || "Welcome!";
  const { online } = useOfflineStatus();
  const queue = useSyncQueueCount();

  const mobileDashboardLinks = [
    { label: "Dashboard", to: "/dashboard?tab=overview" },
    { label: "New Sale", to: "/sales/new" },
    { label: "Inventory", to: "/inventory" },
    { label: "Money Flow", to: "/dashboard?tab=money-flow" },
    { label: "Inventory Finance", to: "/dashboard?tab=inventory-finance" },
    { label: "Expenses & Profit", to: "/dashboard?tab=expenses" },
    { label: "Staff & Controls", to: "/dashboard?tab=staff" },
    { label: "Credit & Risk", to: "/dashboard?tab=credit" },
    { label: "Reports", to: "/dashboard?tab=reports" },
    { label: "Dashboard Edit", to: "/dashboard/edit" },
    { label: "Settings", to: "/dashboard?tab=settings" },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      {/* Desktop header */}
      <div className="hidden md:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 justify-between items-center gap-4">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity shrink-0" onClick={closeAllMenus}>
          <div className="p-1.5 sm:p-2 rounded-lg btn-primary-gradient">
            <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
            ShopKeeper
          </h1>
        </Link>

        <nav className="flex items-center gap-3">
          {!user ? (
            <>
              <Link to="/sign-up" className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium">
                Sign Up
              </Link>
              <Link to="/sign-in" className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-yellow-600 transition-all duration-300">
                Sign In
              </Link>
            </>
          ) : (
            <>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  online
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {online ? "Online" : "Offline"}
              </span>
              {queue.total > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {queue.total} pending sync
                </span>
              )}
              <Link to="/dashboard" className="px-4 py-2 btn-primary-gradient">
                Dashboard
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-300">{userDisplay}</span>
            </>
          )}
        </nav>
      </div>

      {/* Mobile header: hamburger left, logo right */}
      <div className="md:hidden px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center">
          {user ? (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="p-2.5 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          ) : (
            <nav className="flex items-center gap-2">
              <Link to="/sign-up" className="px-3 py-2.5 text-gray-700 dark:text-gray-300 font-medium text-sm">
                Sign Up
              </Link>
              <Link to="/sign-in" className="px-3 py-2.5 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium rounded-lg text-sm">
                Sign In
              </Link>
            </nav>
          )}
        </div>

        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0" onClick={closeAllMenus}>
          <div className="p-1.5 rounded-lg btn-primary-gradient">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
            ShopKeeper
          </h1>
        </Link>
      </div>

      {/* Mobile menu panel (logged in) */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/95">
          <div className="px-4 py-3">
            <div className="mb-2 px-2 flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  online
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {online ? "Online" : "Offline"}
              </span>
              {queue.total > 0 && (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {queue.total} pending
                </span>
              )}
            </div>
            <div className="mb-2 px-2">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Dashboard</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userDisplay}</p>
            </div>

            <div className="flex flex-col gap-1">
              {mobileDashboardLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className="w-full px-4 py-3 rounded-lg text-[15px] font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/80 touch-manipulation"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

    </header>
  );
}