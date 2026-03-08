import { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, BarChart3, ShoppingCart, Package, CreditCard, ChevronDown, Wallet, PieChart, Users, FileText, Settings, ArrowRightLeft } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import { useSyncQueueCount } from "../../hooks/useSyncQueueCount";
import { ShopContext } from "../../contexts/ShopContext";
import NotificationBell from "../../components/NotificationBell";

export default function Header() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileBottomMoreOpen, setMobileBottomMoreOpen] = useState(false);
  const userDisplay = user?.name || user?.email || "Welcome!";
  const { online } = useOfflineStatus();
  const queue = useSyncQueueCount();
  const shopCtx = useContext(ShopContext);
  const shopId = shopCtx?.currentShop?.id;
  const currentShopRole = String(shopCtx?.currentShop?.role || "").toLowerCase();
  const isOwner = currentShopRole === "owner";

  const ownerMobileDashboardLinks = [
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

  const nonOwnerMobileDashboardLinks = [
    { label: "Dashboard", to: "/dashboard?tab=overview" },
    { label: "New Sale", to: "/sales/new" },
    { label: "Inventory", to: "/inventory" },
    { label: "Credit & Risk", to: "/dashboard?tab=credit" },
    { label: "Settings", to: "/dashboard?tab=settings" },
  ];

  const mobileDashboardLinks = isOwner ? ownerMobileDashboardLinks : nonOwnerMobileDashboardLinks;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setMobileBottomMoreOpen(false);
  };

  const isSuperAdminRoute = location.pathname.startsWith("/super-admin");
  const showGlobalMobileBottomNav = Boolean(user) && !isSuperAdminRoute && location.pathname !== "/dashboard";
  const currentTab = new URLSearchParams(location.search).get("tab");
  const isOverviewActive = location.pathname === "/dashboard" && (!currentTab || currentTab === "overview");
  const isNewSalesActive = location.pathname.startsWith("/sales");
  const isInventoryActive = location.pathname.startsWith("/inventory");
  const isCreditActive = location.pathname === "/dashboard" && currentTab === "credit";
  const isMoreActive = mobileBottomMoreOpen || location.pathname === "/sync-center";

  const ownerBottomMoreLinks = [
    { label: "Money Flow", to: "/dashboard?tab=money-flow", icon: Wallet },
    { label: "Inventory Finance", to: "/dashboard?tab=inventory-finance", icon: Package },
    { label: "Expenses & Profit", to: "/dashboard?tab=expenses", icon: PieChart },
    { label: "Staff & Controls", to: "/dashboard?tab=staff", icon: Users },
    { label: "Reports", to: "/dashboard?tab=reports", icon: FileText },
    { label: "Settings", to: "/dashboard?tab=settings", icon: Settings },
  ];
  const nonOwnerBottomMoreLinks = [{ label: "Settings", to: "/dashboard?tab=settings", icon: Settings }];
  const mobileBottomMoreLinks = isOwner ? ownerBottomMoreLinks : nonOwnerBottomMoreLinks;

  useEffect(() => {
    if (!(user && mobileMenuOpen)) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [user, mobileMenuOpen]);

  useEffect(() => {
    setMobileBottomMoreOpen(false);
  }, [location.pathname, location.search]);

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
                <button
                  type="button"
                  onClick={() => navigate("/sync-center")}
                  title="Click to view & manage pending syncs"
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors cursor-pointer"
                >
                  {queue.total} pending sync
                </button>
              )}
              <NotificationBell shopId={shopId} />
              <Link to="/dashboard" className="px-4 py-2 btn-primary-gradient">
                Dashboard
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-300">{userDisplay}</span>
            </>
          )}
        </nav>
      </div>

      {/* Mobile header: hamburger left, logo center, bell right */}
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

        {/* Bell icon on mobile — only when logged in */}
        {user ? (
          <NotificationBell shopId={shopId} />
        ) : (
          <div className="w-9" /> /* spacer to keep logo centered */
        )}
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
                <button
                  type="button"
                  onClick={() => navigate("/sync-center")}
                  className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  {queue.total} pending
                </button>
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

      {/* Global mobile bottom nav for non-dashboard routes */}
      {showGlobalMobileBottomNav && (
        <>
          <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="grid grid-cols-5">
              <button
                onClick={() => navigate("/dashboard?tab=overview")}
                className={`py-2.5 text-[11px] font-medium flex flex-col items-center gap-1 ${
                  isOverviewActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <BarChart3 className="h-5 w-5" />
                <span>Overview</span>
              </button>
              <button
                onClick={() => navigate("/sales/new")}
                className={`relative py-2.5 text-[11px] font-medium flex flex-col items-center gap-1 ${
                  isNewSalesActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <ShoppingCart className="h-5 w-5" />
                <span>New Sales</span>
                {(queue.failed > 0 || queue.dead > 0) && (
                  <span
                    className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-red-500"
                    title="Some sync items failed and need attention"
                  />
                )}
              </button>
              <button
                onClick={() => navigate("/inventory")}
                className="py-1.5 text-[11px] font-semibold flex flex-col items-center gap-1 text-white"
              >
                <span className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  isInventoryActive ? "btn-primary-gradient" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
                }`}>
                  <Package className="h-5 w-5" />
                </span>
                <span className={isInventoryActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}>
                  Inventory
                </span>
              </button>
              <button
                onClick={() => navigate("/dashboard?tab=credit")}
                className={`py-2.5 text-[11px] font-medium flex flex-col items-center gap-1 ${
                  isCreditActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span>Credit</span>
              </button>
              <button
                onClick={() => setMobileBottomMoreOpen((v) => !v)}
                className={`relative py-2.5 text-[11px] font-medium flex flex-col items-center gap-1 ${
                  isMoreActive ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                <ChevronDown className={`h-5 w-5 transition-transform ${mobileBottomMoreOpen ? "rotate-180" : ""}`} />
                <span>More</span>
                {queue.total > 0 && (
                  <span className="absolute right-3 top-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] leading-none font-semibold">
                    {queue.total > 99 ? "99+" : queue.total}
                  </span>
                )}
              </button>
            </div>
          </div>

          {mobileBottomMoreOpen && (
            <div className="sm:hidden fixed inset-0 z-50">
              <button
                aria-label="Close menu"
                onClick={() => setMobileBottomMoreOpen(false)}
                className="absolute inset-0 bg-black/35"
              />
              <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl p-4 pb-6">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">More</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      navigate("/inventory");
                      setMobileBottomMoreOpen(false);
                    }}
                    className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"
                  >
                    <Package className="h-4 w-4" />
                    <span>Inventory</span>
                  </button>
                  {mobileBottomMoreLinks.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.to}
                        onClick={() => {
                          navigate(item.to);
                          setMobileBottomMoreOpen(false);
                        }}
                        className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"
                      >
                        <ItemIcon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      navigate("/sync-center");
                      setMobileBottomMoreOpen(false);
                    }}
                    className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-left text-sm text-gray-700 dark:text-gray-200 flex items-center justify-between gap-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>Sync Center</span>
                    </span>
                    {queue.total > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold">
                        {queue.total > 99 ? "99+" : queue.total}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </header>
  );
}