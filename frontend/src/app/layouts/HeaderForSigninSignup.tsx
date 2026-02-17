import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, RefreshCw, Trash2, RotateCcw } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { useSyncQueueCount } from "../../hooks/useSyncQueueCount";
import { useSyncQueueItems } from "../../hooks/useSyncQueueItems";
import { clearFailedQueueItems, processQueueOnce, removeQueueItem, retryQueueItem } from "../../offline/offlineQueue";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncCenterOpen, setSyncCenterOpen] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const userDisplay = user?.name || user?.email || "Welcome!";
  const { online } = useOfflineStatus();
  const queue = useSyncQueueCount();
  const queueItems = useSyncQueueItems(80);

  const mobileDashboardLinks = [
    { label: "Dashboard", to: "/dashboard?tab=overview" },
    { label: "Money Flow", to: "/dashboard?tab=money-flow" },
    { label: "Inventory Finance", to: "/dashboard?tab=inventory-finance" },
    { label: "Expenses & Profit", to: "/dashboard?tab=expenses" },
    { label: "Staff & Controls", to: "/dashboard?tab=staff" },
    { label: "Credit & Risk", to: "/dashboard?tab=credit" },
    { label: "Reports", to: "/dashboard?tab=reports" },
    { label: "Dashboard Edit", to: "/dashboard/edit" },
    { label: "Sync Center", to: "/sync-center" },
    { label: "Settings", to: "/dashboard?tab=settings" },
  ];

  const handleSignOut = () => {
    setMobileMenuOpen(false);
    logout();
    navigate("/", { replace: true });
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      await processQueueOnce();
    } finally {
      setSyncingNow(false);
    }
  };

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setSyncCenterOpen(false);
  };

  const labelForItem = (item: any) => {
    const base = `${item.entity} ${item.action}`;
    if (!item.lastError) return base;
    if (String(item.lastError).toLowerCase().includes("conflict")) return `${base} (conflict)`;
    return base;
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
          <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
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
              <button
                type="button"
                onClick={() => setSyncCenterOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Sync Center
              </button>
              <Link
                to="/sync-center"
                onClick={closeAllMenus}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Open page
              </Link>
              <Link to="/dashboard" className="px-4 py-2 btn-primary-gradient">
                Dashboard
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-300">{userDisplay}</span>
              <button onClick={handleSignOut} className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium whitespace-nowrap">
                Sign out
              </button>
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
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

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setSyncCenterOpen(true);
              }}
              className="mt-2 w-full px-4 py-3 rounded-lg text-[15px] font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/80 text-left"
            >
              Sync Center
            </button>

            <button
              onClick={handleSignOut}
              className="mt-3 w-full px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-semibold text-center touch-manipulation whitespace-nowrap"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {user && syncCenterOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSyncCenterOpen(false)} aria-hidden />
          <div className="fixed inset-x-3 top-16 md:inset-auto md:right-6 md:top-20 md:w-[520px] z-[60] rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Sync Center</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pending: {queue.pending} · Failed: {queue.failed} · Processing: {queue.processing}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSyncCenterOpen(false)}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close sync center"
              >
                <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
              <Link
                to="/sync-center"
                onClick={() => setSyncCenterOpen(false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Open full page
              </Link>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={!online || syncingNow}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingNow ? "animate-spin" : ""}`} />
                {syncingNow ? "Syncing..." : "Sync now"}
              </button>
              <button
                type="button"
                onClick={() => clearFailedQueueItems()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear failed
              </button>
              {!online && (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">Offline</span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {queueItems.length === 0 ? (
                <p className="px-2 py-4 text-sm text-gray-500 dark:text-gray-400">No pending sync jobs.</p>
              ) : (
                <ul className="space-y-2">
                  {queueItems.map((item) => (
                    <li key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{labelForItem(item)}</p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            item.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : item.status === "processing"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.url} · retries: {item.retries}
                      </p>
                      {item.lastError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{item.lastError}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        {item.status !== "processing" && item.id && (
                          <button
                            type="button"
                            onClick={() => retryQueueItem(item.id!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </button>
                        )}
                        {item.id && (
                          <button
                            type="button"
                            onClick={() => removeQueueItem(item.id!)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                            Discard
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}