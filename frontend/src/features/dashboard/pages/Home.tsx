import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import {
  ShoppingCart,
  Package,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Wallet,
  Clock,
  Users,
  CreditCard,
  Smartphone,
  Banknote,
  PieChart,
  Settings,
  FileText,
  ChevronDown,
  Trash2,
  ArrowRightLeft,
  Plus,
  Minus,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import { useShop } from "../../../contexts/useShop";
import { useAuth } from "../../../contexts/useAuth";
import { reportsApi, walletsApi, dailyCloseApi, shopsApi, salesApi, authApi, clearShopId } from "../../../lib/api";
import type { ComplianceExportData } from "../../../lib/api";
import toast from "react-hot-toast";
import CreditTab from "../components/CreditTab";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "money-flow", label: "Money Flow", icon: Wallet, ownerOnly: true },
  { id: "inventory-finance", label: "Inventory Finance", icon: Package, ownerOnly: true },
  { id: "expenses", label: "Expenses & Profit", icon: PieChart },
  { id: "staff", label: "Staff & Controls", icon: Users, ownerOnly: true },
  { id: "credit", label: "Credit & Risk", icon: CreditCard },
  { id: "reports", label: "Reports", icon: FileText, ownerOnly: true },
  { id: "dashboard-edit", label: "Dashboard Edit", icon: ShieldCheck, ownerOnly: true },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

const OWNER_ONLY_TAB_IDS: TabId[] = ["money-flow", "inventory-finance", "staff", "reports"];

function getVisibleTabs(role?: string) {
  const isOwner = role === "owner";
  return TABS.filter((t) => !("ownerOnly" in t && t.ownerOnly) || isOwner);
}

function useLiveTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatDateRange(start: string, end: string) {
  if (!start || !end) return "Today";
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString();
  return `${s.toLocaleDateString()} - ${e.toLocaleDateString()}`;
}

function ShopSwitcher({
  currentShop,
  shops,
  onSelect,
  onCreate,
}: {
  currentShop: { id: string; name: string };
  shops: Array<{ id: string; name: string }>;
  onSelect: (shop: { id: string; name: string }) => void;
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const otherShops = shops.filter((s) => s.id !== currentShop.id);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-gray-600"
      >
        <Package className="h-4 w-4 text-emerald-500" />
        <span>{currentShop.name}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full mt-1 py-1 w-56 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-20">
            {otherShops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => {
                  onSelect(shop);
                  setOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {shop.name}
              </button>
            ))}
            <button
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-emerald-600 dark:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
            >
              + Create new shop
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { currentShop, shops, loading: shopLoading, lastError, selectShop, refreshShops, deleteShop } = useShop();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<any>(null);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const d = new Date();
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: d.toISOString().slice(0, 10),
    };
  });
  const liveTime = useLiveTime();

  useEffect(() => {
    if (currentShop) {
      loadStats();
      loadIntelligence();
    }
  }, [currentShop, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (currentShop?.role !== "owner" && OWNER_ONLY_TAB_IDS.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [currentShop?.role, activeTab]);

  const loadStats = async () => {
    if (!currentShop) return;
    setLoadingStats(true);
    try {
      const res = await reportsApi.getDashboardStats({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      setStats(res.data.data);
    } catch (e: any) {
      console.error("Failed to load stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadIntelligence = async () => {
    if (!currentShop) return;
    try {
      const res = await reportsApi.getSalesIntelligence({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      setIntelligence(res.data.data);
    } catch (e) {
      console.error("Failed to load intelligence:", e);
    }
  };

  if (shopLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentShop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8">
            {shops.length > 0 ? (
              <>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Select your store
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Choose a store to continue, or create a new one.
                </p>
                <div className="space-y-2 mb-6">
                  {shops.map((shop) => (
                    <div
                      key={shop.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      <button
                        onClick={() => selectShop(shop)}
                        className="flex-1 flex items-center justify-between px-4 py-3 text-left transition"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{shop.name}</span>
                        <span className="text-sm text-gray-500">Select</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Permanently delete "${shop.name}"? This will remove the store and all its products, sales, and data. This cannot be undone.`)) {
                            deleteShop(shop.id);
                          }
                        }}
                        className="p-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-r-lg transition"
                        title="Delete store"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/shops/create")}
                  className="w-full py-2.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                >
                  + Create another shop
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  No store yet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create your first shop to become the owner. After that you can add staff and give them the permissions you want (manager, cashier, or staff).
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <button
                    onClick={() => navigate("/shops/create")}
                    className="flex-1 px-6 py-3 btn-primary-gradient"
                  >
                    Create Shop
                  </button>
                  <button
                    onClick={() => refreshShops()}
                    className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Refresh my shops
                  </button>
                </div>
                <button
                  onClick={logout}
                  className="w-full py-2.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-sm"
                >
                  Sign out and use another account
                </button>
              </>
            )}
            {shops.length > 0 && (
              <button
                onClick={logout}
                className="w-full mt-4 py-2.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 text-sm"
              >
                Sign out
              </button>
            )}
            <details className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700">
                Debug info
              </summary>
              <pre className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-auto max-h-32">
                {JSON.stringify(
                  {
                    email: user?.email,
                    userId: user?.id,
                    shopsCount: shops.length,
                    loading: shopLoading,
                    lastError: lastError || null,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }

  const currency = currentShop.currency || "USD";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top bar: date/time + range + shop switcher */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Clock className="h-5 w-5" />
            <span className="font-mono text-lg">
              {liveTime.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              {liveTime.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Range:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-2 py-1"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-2 py-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShopSwitcher
            currentShop={currentShop}
            shops={shops}
            onSelect={(s) => {
              const full = shops.find((sh) => sh.id === s.id);
              if (full) selectShop(full);
            }}
            onCreate={() => navigate("/shops/create")}
          />
        </div>
      </div>

      {/* Tabs (Money Flow, Inventory Finance, Reports, Staff & Controls are owner-only) */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
        <nav className="flex gap-1 overflow-x-auto py-2">
          {getVisibleTabs(currentShop?.role).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === "dashboard-edit") {
                  navigate("/dashboard/edit");
                  return;
                }
                setActiveTab(id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === id
                  ? "btn-tab-gradient"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4 max-w-7xl mx-auto min-h-[320px]">
        {activeTab === "overview" && (
          <OverviewTab
            currency={currency}
            stats={stats}
            intelligence={intelligence}
            loading={loadingStats}
            dateRangeLabel={formatDateRange(dateRange.start, dateRange.end)}
            onNavigate={navigate}
          />
        )}
        {activeTab === "money-flow" && (
          <MoneyFlowTab currency={currency} currentShop={currentShop} />
        )}
        {activeTab === "inventory-finance" && (
          <InventoryFinanceTab currency={currency} onNavigate={navigate} />
        )}
        {activeTab === "expenses" && (
          <ExpensesTab
            currency={currency}
            dateRange={dateRange}
            onNavigate={navigate}
          />
        )}
        {activeTab === "staff" && (
          <StaffTab
            currency={currency}
            currentShop={currentShop}
            intelligence={intelligence}
          />
        )}
        {activeTab === "credit" && <CreditTab onNavigate={navigate} />}
        {activeTab === "reports" && <ReportsTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

function OverviewTab({
  currency,
  stats,
  intelligence,
  loading,
  dateRangeLabel,
  onNavigate,
}: {
  currency: string;
  stats: any;
  intelligence: any;
  loading: boolean;
  dateRangeLabel: string;
  onNavigate: (path: string) => void;
}) {
  const paymentBreakdown = stats?.paymentMethodBreakdown || {};
  const cash = paymentBreakdown.cash ?? 0;
  const mobileMoney = paymentBreakdown.mobile_money ?? 0;
  const card = paymentBreakdown.card ?? 0;
  const other = (paymentBreakdown.bank_transfer ?? 0) + (paymentBreakdown.credit ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Welcome{stats ? "" : " - loading..."}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">{dateRangeLabel}</p>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Revenue"
              value={`${currency} ${(stats?.totalSales ?? 0).toFixed(2)}`}
              icon={<DollarSign className="h-6 w-6" />}
              color="emerald"
            />
            <KpiCard
              title="Gross Profit"
              value={`${currency} ${((stats?.salesProfit ?? stats?.profit) ?? 0).toFixed(2)}`}
              icon={<TrendingUp className="h-6 w-6" />}
              color="green"
            />
            <KpiCard
              title="Transactions"
              value={stats?.totalTransactions ?? 0}
              icon={<ShoppingCart className="h-6 w-6" />}
              color="blue"
            />
            <KpiCard
              title="Active shopkeepers today"
              value={stats?.activeStaffToday ?? 0}
              icon={<Users className="h-6 w-6" />}
              color="purple"
            />
          </div>

          {/* Cash vs Mobile Money vs Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sales by payment method
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <PaymentChip
                icon={<Banknote className="h-5 w-5" />}
                label="Cash"
                value={cash}
                currency={currency}
              />
              <PaymentChip
                icon={<Smartphone className="h-5 w-5" />}
                label="Mobile Money"
                value={mobileMoney}
                currency={currency}
              />
              <PaymentChip
                icon={<CreditCard className="h-5 w-5" />}
                label="Card"
                value={card}
                currency={currency}
              />
              <PaymentChip
                icon={<Wallet className="h-5 w-5" />}
                label="Other"
                value={other}
                currency={currency}
              />
            </div>
          </div>

          {/* Sales Intelligence */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sales Intelligence
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Top-selling products
                </h3>
                <ul className="space-y-2">
                  {(intelligence?.topProducts ?? []).slice(0, 5).map((p: any) => (
                    <li
                      key={p.productId}
                      className="flex justify-between text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span>{p.name}</span>
                      <span>{currency} {Number(p.revenue).toFixed(2)}</span>
                    </li>
                  ))}
                  {(!intelligence?.topProducts?.length) && (
                    <li className="text-sm text-gray-500">No sales in this period</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Slow-moving products
                </h3>
                <ul className="space-y-2">
                  {(intelligence?.slowMovingProducts ?? []).slice(0, 5).map((p: any) => (
                    <li
                      key={p.productId}
                      className="flex justify-between text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span>{p.name}</span>
                      <span>qty: {p.quantitySold ?? 0}</span>
                    </li>
                  ))}
                  {(!intelligence?.slowMovingProducts?.length) && (
                    <li className="text-sm text-gray-500">No data</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Peak hours (by revenue)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(intelligence?.peakHours ?? []).map((h: any) => (
                    <span
                      key={h.hour}
                      className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs"
                    >
                      {h.hour}:00 - {currency} {Number(h.amount).toFixed(0)}
                    </span>
                  ))}
                  {(!intelligence?.peakHours?.length) && (
                    <span className="text-sm text-gray-500">No data</span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Sales by shopkeeper
                </h3>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {(intelligence?.salesByStaff ?? []).slice(0, 5).map((s: any) => (
                    <li key={s.staffId}>
                      {s.staffId.slice(0, 8)}... - {currency} {Number(s.amount).toFixed(2)} ({s.count} txns)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Low stock + Quick actions */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {stats?.lowStockCount > 0 && (
              <button
                onClick={() => onNavigate("/inventory?filter=low_stock")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
              >
                <AlertTriangle className="h-5 w-5" />
                {stats.lowStockCount} low stock item(s)
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate("/sales/new")}
                className="px-4 py-2 btn-primary-gradient"
              >
                New Sale
              </button>
              <button
                onClick={() => onNavigate("/inventory")}
                className="px-4 py-2 btn-tab-gradient rounded-lg"
              >
                Inventory
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "green" | "orange" | "purple";
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500 text-white",
    blue: "bg-blue-500 text-white",
    green: "bg-green-500 text-white",
    orange: "bg-orange-500 text-white",
    purple: "bg-purple-500 text-white",
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
    </div>
  );
}

function PaymentChip({
  icon,
  label,
  value,
  currency,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  currency: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <div className="text-gray-500 dark:text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="font-semibold text-gray-900 dark:text-white">
          {currency} {Number(value).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

function MoneyFlowTab({
  currency,
  currentShop,
}: {
  currency: string;
  currentShop: { id: string; name: string; role?: string } | null;
}) {
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dailyCloses, setDailyCloses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState<{ wallet: any; type: "inflow" | "outflow" } | null>(null);
  const [transferModal, setTransferModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState({ expected_cash: 0, actual_cash: 0, notes: "" });
  const [adjustForm, setAdjustForm] = useState({ amount: 0, description: "" });
  const [transferForm, setTransferForm] = useState({ from_wallet_id: "", to_wallet_id: "", amount: 0 });
  const isOwner = currentShop?.role === "owner";

  const [walletsError, setWalletsError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setWalletsError(null);
    try {
      const [wRes, tRes, dcRes] = await Promise.all([
        walletsApi.getWallets(),
        walletsApi.getTransactions(),
        dailyCloseApi.getRecent(),
      ]);
      setWallets(wRes.data.data || []);
      setTransactions(tRes.data.data || []);
      setDailyCloses(dcRes.data.data || []);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || "";
      if (msg.includes("wallets") || msg.includes("PGRST205")) {
        setWalletsError("Run migration 005 in Supabase (SQL Editor) to enable Money Flow and Daily Close.");
        setWallets([]);
        setTransactions([]);
        setDailyCloses([]);
      } else {
        toast.error(msg || "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdjust = async () => {
    if (!adjustModal || !adjustForm.amount) return;
    try {
      await walletsApi.adjust({
        wallet_id: adjustModal.wallet.id,
        amount: adjustForm.amount,
        type: adjustModal.type,
        description: adjustForm.description || undefined,
      });
      toast.success(adjustModal.type === "inflow" ? "Cash added" : "Cash withdrawn");
      setAdjustModal(null);
      setAdjustForm({ amount: 0, description: "" });
      loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed");
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.from_wallet_id || !transferForm.to_wallet_id || !transferForm.amount) return;
    try {
      await walletsApi.transfer(transferForm);
      toast.success("Transfer completed");
      setTransferModal(false);
      setTransferForm({ from_wallet_id: "", to_wallet_id: "", amount: 0 });
      loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed");
    }
  };

  const handleCreateClose = async () => {
    try {
      await dailyCloseApi.create({
        expected_cash: closeForm.expected_cash,
        actual_cash: closeForm.actual_cash,
        notes: closeForm.notes || undefined,
      });
      toast.success("Daily close recorded");
      setCloseModal(false);
      setCloseForm({ expected_cash: 0, actual_cash: 0, notes: "" });
      loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed");
    }
  };

  const handleApproveReject = async (id: string, approve: boolean) => {
    try {
      if (approve) await dailyCloseApi.approve(id);
      else await dailyCloseApi.reject(id);
      toast.success(approve ? "Approved" : "Rejected");
      loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (walletsError) {
    return (
      <div className="max-w-2xl p-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <h2 className="text-xl font-semibold text-amber-800 dark:text-amber-200 mb-2">Money Flow (Fintech)</h2>
        <p className="text-amber-700 dark:text-amber-300 mb-4">{walletsError}</p>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Open Supabase Dashboard â†’ SQL Editor â†’ paste and run the contents of{" "}
          <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">backend/supabase/migrations/005_wallets_and_daily_close.sql</code>
        </p>
        <button onClick={loadData} className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Money Flow (Fintech)</h2>

      {/* Wallets */}
      <div className="grid gap-4 md:grid-cols-3">
        {wallets.map((w) => (
          <div
            key={w.id}
            className="p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <p className="font-medium text-gray-900 dark:text-white">{w.name}</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {currency} {Number(w.balance || 0).toFixed(2)}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setAdjustModal({ wallet: w, type: "inflow" });
                  setAdjustForm({ amount: 0, description: "" });
                }}
                className="flex items-center gap-1 px-2 py-1 text-sm btn-primary-gradient"
              >
                <Plus className="h-4 w-4" /> In
              </button>
              <button
                onClick={() => {
                  setAdjustModal({ wallet: w, type: "outflow" });
                  setAdjustForm({ amount: 0, description: "" });
                }}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-amber-500 text-white rounded hover:bg-amber-600"
              >
                <Minus className="h-4 w-4" /> Out
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          setTransferModal(true);
          setTransferForm({ from_wallet_id: wallets[0]?.id || "", to_wallet_id: wallets[1]?.id || "", amount: 0 });
        }}
        className="flex items-center gap-2 px-4 py-2 border border-emerald-500 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
      >
        <ArrowRightLeft className="h-4 w-4" /> Transfer between wallets
      </button>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Recent transactions</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {transactions.slice(0, 10).map((t) => (
              <li key={t.id} className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t.description || t.type} Â· {new Date(t.created_at).toLocaleString()}
                </span>
                <span className={t.type === "inflow" || t.type === "transfer_in" ? "text-emerald-600" : "text-red-600"}>
                  {t.type === "inflow" || t.type === "transfer_in" ? "+" : "-"}
                  {currency} {Number(t.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Daily Close Summary */}
      <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Daily Close Summary</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
          Expected vs actual cash, difference, approval status (owner-only).
        </p>
        <button
          onClick={() => setCloseModal(true)}
          className="mb-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
        >
          Record daily close
        </button>
        {dailyCloses.length > 0 ? (
          <div className="space-y-2">
            {dailyCloses.slice(0, 7).map((dc) => (
              <div
                key={dc.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800"
              >
                <div>
                  <span className="font-medium">{dc.close_date}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    Expected {currency} {Number(dc.expected_cash).toFixed(2)} Â· Actual {currency}{" "}
                    {Number(dc.actual_cash).toFixed(2)} Â· Diff {currency} {Number(dc.difference).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      dc.status === "approved"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30"
                        : dc.status === "rejected"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30"
                    }`}
                  >
                    {dc.status}
                  </span>
                  {isOwner && dc.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApproveReject(dc.id, true)}
                        className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                        title="Approve"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleApproveReject(dc.id, false)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Reject"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400">No daily closes yet</p>
        )}
      </div>

      {/* Adjust modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAdjustModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">
              {adjustModal.type === "inflow" ? "Add cash" : "Withdraw"} - {adjustModal.wallet.name}
            </h3>
            <input
              type="number"
              placeholder="Amount"
              value={adjustForm.amount || ""}
              onChange={(e) => setAdjustForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border rounded-lg mb-3"
              min="0"
              step="0.01"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={adjustForm.description}
              onChange={(e) => setAdjustForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={handleAdjust} className="flex-1 py-2 btn-primary-gradient">
                Confirm
              </button>
              <button onClick={() => setAdjustModal(null)} className="flex-1 py-2 border rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setTransferModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Transfer between wallets</h3>
            <select
              value={transferForm.from_wallet_id}
              onChange={(e) => setTransferForm((f) => ({ ...f, from_wallet_id: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg mb-3"
            >
              <option value="">From wallet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select
              value={transferForm.to_wallet_id}
              onChange={(e) => setTransferForm((f) => ({ ...f, to_wallet_id: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg mb-3"
            >
              <option value="">To wallet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={transferForm.amount || ""}
              onChange={(e) => setTransferForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              min="0"
              step="0.01"
            />
            <div className="flex gap-2">
              <button onClick={handleTransfer} className="flex-1 py-2 btn-primary-gradient">
                Transfer
              </button>
              <button onClick={() => setTransferModal(false)} className="flex-1 py-2 border rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily close modal */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCloseModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Record daily close</h3>
            <input
              type="number"
              placeholder="Expected cash"
              value={closeForm.expected_cash || ""}
              onChange={(e) => setCloseForm((f) => ({ ...f, expected_cash: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border rounded-lg mb-3"
              min="0"
            />
            <input
              type="number"
              placeholder="Actual cash counted"
              value={closeForm.actual_cash || ""}
              onChange={(e) => setCloseForm((f) => ({ ...f, actual_cash: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border rounded-lg mb-3"
              min="0"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={closeForm.notes}
              onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg mb-4"
            />
            <div className="flex gap-2">
              <button onClick={handleCreateClose} className="flex-1 py-2 bg-amber-500 text-white rounded-lg">
                Submit
              </button>
              <button onClick={() => setCloseModal(false)} className="flex-1 py-2 border rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryFinanceTab({
  currency,
  onNavigate,
}: {
  currency: string;
  onNavigate: (path: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deadStockDays, setDeadStockDays] = useState(30);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getInventoryFinance({ days: deadStockDays });
      setData(res.data.data);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || "Failed to load";
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [deadStockDays]);

  const fmt = (n: number) => `${currency} ${Number(n).toFixed(2)}`;

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8">
        <p className="text-gray-500">Loading inventory finance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Inventory Finance</h2>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-gray-500">Dead stock: not sold in</label>
          <select
            value={deadStockDays}
            onChange={(e) => setDeadStockDays(Number(e.target.value))}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
          <button
            onClick={load}
            className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => onNavigate("/inventory")}
            className="px-4 py-2 btn-primary-gradient"
          >
            Open Inventory
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total stock value (cost)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(data.totalStockValue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Potential revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(data.potentialRevenue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Potential profit</p>
              <p className={`text-xl font-bold ${data.potentialProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(data.potentialProfit)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active products</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{data.productCount}</p>
            </div>
          </div>

          {data.lowStock?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Low stock ({data.lowStock.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Stock / Min</th>
                      <th className="pb-2">Value at risk</th>
                      <th className="pb-2">Replenish cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.map((p: any) => (
                      <tr key={p.productId} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2">{p.stockQuantity} / {p.minStockLevel}</td>
                        <td className="py-2">{fmt(p.valueAtRisk)}</td>
                        <td className="py-2">{fmt(p.replenishCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => onNavigate("/inventory?filter=low_stock")}
                className="mt-3 text-sm text-emerald-600 hover:underline"
              >
                View in inventory â†’
              </button>
            </div>
          )}

          {data.deadStock?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Dead stock (not sold in {deadStockDays} days)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Quantity</th>
                      <th className="pb-2">Stock value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deadStock.map((p: any) => (
                      <tr key={p.productId} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2">{p.stockQuantity}</td>
                        <td className="py-2">{fmt(p.stockValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => onNavigate("/inventory")}
                className="mt-3 text-sm text-emerald-600 hover:underline"
              >
                View in inventory â†’
              </button>
            </div>
          )}

          {(!data.lowStock?.length && !data.deadStock?.length) && data.productCount > 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No low stock or dead stock alerts. All products are in good standing.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ExpensesTab({
  currency,
  dateRange,
  onNavigate,
}: {
  currency: string;
  dateRange: { start: string; end: string };
  onNavigate: (path: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getExpensesProfit({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      setData(res.data.data);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || "Failed to load";
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dateRange.start, dateRange.end]);

  const fmt = (n: number) => `${currency} ${Number(n).toFixed(2)}`;

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8">
        <p className="text-gray-500">Loading expenses & profit...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Expenses & Profit
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate("/expenses")}
            className="px-4 py-2 btn-primary-gradient"
          >
            Record expense
          </button>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Revenue (selected range)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(data.totalRevenue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Sales profit (from sales made)</p>
              <p className={`text-xl font-bold ${Number(data.salesProfit || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(data.salesProfit || 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmt(data.totalExpenses)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Net profit (after expenses)</p>
              <p className={`text-xl font-bold ${data.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(data.netProfit)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Expense vs revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {(data.expenseVsRevenueRatio * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {data.expensesByCategory?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Expenses by category
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Count</th>
                      <th className="pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expensesByCategory.map((c: any) => (
                      <tr key={c.categoryId} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">{c.categoryName}</td>
                        <td className="py-2">{c.count}</td>
                        <td className="py-2">{fmt(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.dailyNetProfit?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Daily profit breakdown (selected range)
              </h3>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Revenue</th>
                      <th className="pb-2">Sales profit</th>
                      <th className="pb-2">Expenses</th>
                      <th className="pb-2">Net profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyNetProfit.slice(-14).map((d: any) => (
                      <tr key={d.date} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">{d.date}</td>
                        <td className="py-2">{fmt(d.revenue)}</td>
                        <td className={`py-2 ${Number(d.salesProfit || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(d.salesProfit || 0)}
                        </td>
                        <td className="py-2">{fmt(d.expenses)}</td>
                        <td className={`py-2 ${d.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(d.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.monthlyTrend?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Monthly profit trend (last 6 months)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                      <th className="pb-2">Month</th>
                      <th className="pb-2">Revenue</th>
                      <th className="pb-2">Sales profit</th>
                      <th className="pb-2">Expenses</th>
                      <th className="pb-2">Net profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyTrend.map((m: any) => (
                      <tr key={m.month} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">{m.monthLabel}</td>
                        <td className="py-2">{fmt(m.revenue)}</td>
                        <td className={`py-2 ${Number(m.salesProfit || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(m.salesProfit || 0)}
                        </td>
                        <td className="py-2">{fmt(m.expenses)}</td>
                        <td className={`py-2 ${m.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {fmt(m.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!data.expensesByCategory?.length && !data.dailyNetProfit?.length && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No expenses in the selected date range. Use the dashboard range above to change period.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StaffTab({
  currency,
  currentShop,
  intelligence,
}: {
  currency: string;
  currentShop: { id: string; name: string; role?: string } | null;
  intelligence: any;
}) {
  const { refreshShops } = useShop();
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [addStaffForm, setAddStaffForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "staff",
  });
  const [addingStaff, setAddingStaff] = useState(false);

  const isOwner = currentShop?.role === "owner";

  const loadMembers = async () => {
    if (!isOwner) return;
    setLoadingMembers(true);
    try {
      const res = await shopsApi.getMembers();
      setMembers(res.data.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to load team");
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (isOwner && currentShop?.id) loadMembers();
  }, [isOwner, currentShop?.id]);

  const handleRevoke = async (userId: string, name: string) => {
    if (!confirm(`Revoke access for ${name}? They will no longer be able to use this shop.`)) return;
    try {
      await shopsApi.removeMember(userId);
      toast.success("Access revoked");
      loadMembers();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to revoke");
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (addStaffForm.email || "").trim().toLowerCase();
    const password = addStaffForm.password;
    if (!email) {
      toast.error("Email is required");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setAddingStaff(true);
    try {
      await shopsApi.addMember({
        email,
        name: (addStaffForm.name || "").trim() || undefined,
        password,
        role: addStaffForm.role,
      });
      toast.success("Staff added. They can sign in with this email and password.");
      setAddStaffForm({ email: "", name: "", password: "", role: "staff" });
      loadMembers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to add staff");
    } finally {
      setAddingStaff(false);
    }
  };

  const handleTransferOwnership = async (newOwnerUserId: string, newOwnerName: string) => {
    if (
      !confirm(
        `Transfer ownership to ${newOwnerName}? You will no longer be the owner and may lose access to this shop. This cannot be undone.`
      )
    )
      return;
    setTransferring(true);
    try {
      await shopsApi.transferOwnership({ newOwnerUserId });
      toast.success("Ownership transferred. Refreshing...");
      clearShopId();
      await refreshShops();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to transfer ownership");
    } finally {
      setTransferring(false);
    }
  };

  const salesByStaff = intelligence?.salesByStaff ?? [];
  const membersById = members.reduce((acc: Record<string, any>, m) => {
    acc[m.user_id] = m;
    return acc;
  }, {});

  if (!isOwner) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 max-w-2xl">
        <h2 className="text-xl font-semibold text-amber-800 dark:text-amber-200 mb-2">
          Staff Performance & Controls
        </h2>
        <p className="text-amber-700 dark:text-amber-300">
          Only the store owner can view this admin panel. Here the owner can see sales per staff, team members, permissions, and revoke access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
          Staff Performance & Controls
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You are the owner. Add staff, assign roles (manager, cashier, staff), and control access.
        </p>
      </div>

      {/* Add staff */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Add staff</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Create a staff account. If the email already exists, they will be added to this shop with the chosen role.
        </p>
        <form onSubmit={handleAddStaff} className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input
              type="email"
              value={addStaffForm.email}
              onChange={(e) => setAddStaffForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="staff@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={addStaffForm.name}
              onChange={(e) => setAddStaffForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="Display name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password * (min 8 characters)</label>
            <input
              type="password"
              value={addStaffForm.password}
              onChange={(e) => setAddStaffForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select
              value={addStaffForm.role}
              onChange={(e) => setAddStaffForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="staff">Staff (view sales, inventory, reports)</option>
              <option value="cashier">Cashier (create sales, view inventory, manage customers)</option>
              <option value="manager">Manager (all except staff & settings)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={addingStaff}
            className="px-4 py-2 btn-primary-gradient text-sm disabled:opacity-50"
          >
            {addingStaff ? "Adding..." : "Add staff"}
          </button>
        </form>
      </div>

      {/* Sales per staff (selected date range) */}
      {salesByStaff.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Sales per staff (selected range)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2">Staff</th>
                  <th className="pb-2">Sales</th>
                  <th className="pb-2">Transactions</th>
                  <th className="pb-2">Average sale</th>
                </tr>
              </thead>
              <tbody>
                {salesByStaff.map((s: any) => {
                  const member = membersById[s.staffId];
                  const name = member ? member.name : (s.staffId?.slice(0, 12) + (s.staffId?.length > 12 ? "..." : ""));
                  const avg = s.count > 0 ? s.amount / s.count : 0;
                  return (
                    <tr key={s.staffId} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2">{name || "-"}</td>
                      <td className="py-2">{currency} {Number(s.amount).toFixed(2)}</td>
                      <td className="py-2">{s.count}</td>
                      <td className="py-2">{currency} {Number(avg).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team: permissions & revoke */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
          Team & access
        </h3>
        {loadingMembers ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.user_id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2">{m.name}</td>
                    <td className="py-2">{m.email}</td>
                    <td className="py-2 capitalize">{m.role}</td>
                    <td className="py-2 text-right">
                      {!m.is_owner && (
                        <button
                          onClick={() => handleRevoke(m.user_id, m.name)}
                          className="text-red-600 dark:text-red-400 hover:underline text-sm"
                        >
                          Revoke access
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer ownership */}
      {members.filter((m: any) => !m.is_owner).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-amber-200 dark:border-amber-800">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Transfer ownership
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Make another team member the owner of this shop. You will lose owner access and they will become the sole owner.
          </p>
          <div className="flex flex-wrap gap-2">
            {members
              .filter((m: any) => !m.is_owner)
              .map((m: any) => (
                <button
                  key={m.user_id}
                  onClick={() => handleTransferOwnership(m.user_id, m.name)}
                  disabled={transferring}
                  className="px-3 py-1.5 rounded-lg border border-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 text-sm"
                >
                  Transfer to {m.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Coming soon */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <strong>Coming soon:</strong> Cash discrepancies, shift start/end logs, action logs (who did what), and granular permissions per staff.
        </p>
      </div>
    </div>
  );
}

function ReportsTab() {
  const { currentShop } = useShop();
  const currency = currentShop?.currency || "GHS";
  const [reportType, setReportType] = useState<"daily" | "monthly" | "pl" | "tax">("daily");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ComplianceExportData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const generateReport = async () => {
    setLoading(true);
    setReport(null);
    try {
      const params: Record<string, string> = { type: reportType };
      if (reportType === "daily") params.date = date;
      if (reportType === "monthly") params.month = month;
      if (reportType === "pl" || reportType === "tax") {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await reportsApi.getComplianceExport(params as any);
      setReport(res.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current || !report) return;
    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("Allow popups to print or save as PDF.");
      return;
    }
    const title = report.periodLabel;
    const content = printRef.current.innerHTML;
    printWin.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:sans-serif;padding:24px;color:#111;}table{border-collapse:collapse;}th,td{padding:8px;text-align:left;border-bottom:1px solid #eee;}</style></head><body><h1>${title}</h1>${content}</body></html>`
    );
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 250);
  };

  const handleEmail = () => {
    if (!report) return;
    const subject = encodeURIComponent(`Report: ${report.periodLabel}`);
    const breakdown = report.paymentMethodBreakdown
      ? "\nPayment methods: " + Object.entries(report.paymentMethodBreakdown).map(([k, v]) => `${k}: ${currency} ${Number(v).toFixed(2)}`).join(", ")
      : "";
    const body = encodeURIComponent(
      `${report.periodLabel}\n` +
      `Total sales: ${currency} ${Number(report.totalSales).toFixed(2)}\n` +
      `Total expenses: ${currency} ${Number(report.totalExpenses).toFixed(2)}\n` +
      `Profit: ${currency} ${Number(report.profit).toFixed(2)}\n` +
      `Transactions: ${report.totalTransactions}` +
      breakdown
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Reports & Compliance
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Export-ready: daily report (PDF), monthly summary, P&L, tax-ready. Download or email.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Report type</label>
          <div className="flex flex-wrap gap-2">
            {(["daily", "monthly", "pl", "tax"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  reportType === t
                    ? "btn-primary-gradient"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {t === "daily" ? "Daily (PDF)" : t === "monthly" ? "Monthly summary" : t === "pl" ? "Profit & Loss" : "Tax-ready"}
              </button>
            ))}
          </div>
        </div>
        {reportType === "daily" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        )}
        {reportType === "monthly" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        )}
        {(reportType === "pl" || reportType === "tax") && (
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={generateReport}
          disabled={loading}
          className="px-4 py-2 rounded-lg btn-primary-gradient font-medium disabled:opacity-50"
        >
          {loading ? "Loading..." : "Generate report"}
        </button>
      </div>

      {report && (
        <div ref={printRef} className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 mb-6 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{report.periodLabel}</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total sales</span>
              <span className="font-medium text-gray-900 dark:text-white">{currency} {Number(report.totalSales).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total expenses</span>
              <span className="font-medium text-gray-900 dark:text-white">{currency} {Number(report.totalExpenses).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
              <span className="text-gray-600 dark:text-gray-400">Profit</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{currency} {Number(report.profit).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Transactions</span>
              <span className="font-medium text-gray-900 dark:text-white">{report.totalTransactions}</span>
            </div>
          </dl>
          {report.paymentMethodBreakdown && Object.keys(report.paymentMethodBreakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment methods</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {Object.entries(report.paymentMethodBreakdown).map(([method, amount]) => (
                  <li key={method}>{method.replace("_", " ")}: {currency} {Number(amount).toFixed(2)}</li>
                ))}
              </ul>
            </div>
          )}
          {report.expensesByCategory && report.expensesByCategory.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expenses by category</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {report.expensesByCategory.map((c) => (
                  <li key={c.categoryName}>{c.categoryName}: {currency} {Number(c.amount).toFixed(2)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600"
        >
          <FileText className="h-4 w-4" />
          Download / Print PDF
        </button>
        <button
          type="button"
          onClick={handleEmail}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Email summary
        </button>
      </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { user, setUserFromProfile } = useAuth();
  const { currentShop } = useShop();
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? "", email: user?.email ?? "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const isOwner = currentShop?.role === "owner";
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [clearDataPin, setClearDataPin] = useState("");
  const [clearDataStep, setClearDataStep] = useState<"idle" | "pin_sent" | "edit_open">("idle");
  const [requestPinLoading, setRequestPinLoading] = useState(false);
  const [confirmEditLoading, setConfirmEditLoading] = useState(false);
  const [dashboardEditToken, setDashboardEditToken] = useState<string | null>(null);
  const [editSales, setEditSales] = useState<any[]>([]);
  const [editSalesLoading, setEditSalesLoading] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileForm((f) => ({ ...f, name: user.name ?? "", email: user.email ?? "" }));
    }
  }, [user?.id, user?.name, user?.email]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      const res = await authApi.updateProfile({
        name: profileForm.name.trim() || undefined,
        email: profileForm.email.trim() || undefined,
      });
      const updated = res.data.data;
      if (updated) setUserFromProfile(updated);
      setProfileSuccess(true);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirm do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setPasswordSaving(true);
    setPasswordSuccess(false);
    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRequestClearDataPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearDataPassword.trim()) {
      toast.error("Enter your password");
      return;
    }
    setRequestPinLoading(true);
    try {
      await shopsApi.requestClearDataPin(clearDataPassword);
      setClearDataStep("pin_sent");
      toast.success("PIN sent to your email. Check your inbox (and spam folder).");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to send PIN");
    } finally {
      setRequestPinLoading(false);
    }
  };

  const handleConfirmDashboardEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = clearDataPin.trim();
    if (pin.length !== 6) {
      toast.error("Enter the 6-digit PIN");
      return;
    }
    setConfirmEditLoading(true);
    try {
      const res = await shopsApi.confirmDashboardEdit(pin);
      const token = res.data?.data?.dashboardEditToken;
      if (token) {
        setDashboardEditToken(token);
        sessionStorage.setItem("dashboard_edit_token", token);
        setClearDataStep("edit_open");
        setClearDataPassword("");
        setClearDataPin("");
        toast.success("Dashboard edit opened. You can void sales or clear all data below.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Invalid or expired PIN");
    } finally {
      setConfirmEditLoading(false);
    }
  };

  const loadEditSales = async () => {
    if (!currentShop?.id) return;
    setEditSalesLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const res = await salesApi.getSales({
        startDate: start.toISOString().slice(0, 10) + "T00:00:00.000Z",
        endDate: end.toISOString().slice(0, 10) + "T23:59:59.999Z",
      });
      setEditSales(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setEditSales([]);
    } finally {
      setEditSalesLoading(false);
    }
  };

  useEffect(() => {
    if (clearDataStep === "edit_open" && currentShop?.id) loadEditSales();
  }, [clearDataStep, currentShop?.id]);

  const handleCancelSale = async (saleId: string) => {
    setCancellingId(saleId);
    try {
      await salesApi.cancelSale(saleId);
      toast.success("Sale cancelled (refund/void).");
      loadEditSales();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to cancel sale");
    } finally {
      setCancellingId(null);
    }
  };

  const handleClearAllDashboardData = async () => {
    if (!dashboardEditToken) {
      toast.error("Session expired. Enter password and PIN again.");
      setDashboardEditToken(null);
      sessionStorage.removeItem("dashboard_edit_token");
      setClearDataStep("idle");
      return;
    }
    if (!confirm("Clear all dashboard data? Sales, revenue, profit and transaction counts will only show from today. This cannot be undone.")) return;
    setClearAllLoading(true);
    try {
      await shopsApi.clearDashboardData(dashboardEditToken);
      toast.success("Dashboard cleared. All stats now start from today.");
      setDashboardEditToken(null);
      sessionStorage.removeItem("dashboard_edit_token");
      setClearDataStep("idle");
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "";
      if (err?.response?.status === 403) {
        toast.error("Session expired. Enter password and PIN again.");
        setDashboardEditToken(null);
        sessionStorage.removeItem("dashboard_edit_token");
        setClearDataStep("idle");
      } else {
        toast.error(msg || "Failed to clear dashboard");
      }
    } finally {
      setClearAllLoading(false);
    }
  };

  const closeDashboardEdit = () => {
    setDashboardEditToken(null);
    sessionStorage.removeItem("dashboard_edit_token");
    setClearDataStep("idle");
    setClearDataPin("");
    setClearDataPassword("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>

      {/* Account / profile */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Account</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Update your name and email. This is used for login and display.
        </p>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="px-4 py-2 btn-primary-gradient rounded-lg disabled:opacity-50"
          >
            {profileSaving ? "Saving..." : "Save profile"}
          </button>
          {profileSuccess && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Profile saved.</p>
          )}
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Change password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current password</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm new password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
            className="px-4 py-2 btn-primary-gradient rounded-lg disabled:opacity-50"
          >
            {passwordSaving ? "Changing..." : "Change password"}
          </button>
          {passwordSuccess && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Password changed.</p>
          )}
        </form>
      </div>

      {/* Dashboard edit: password + PIN to open interface (owner only) */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700 border-amber-200 dark:border-amber-900/50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Dashboard edit</h3>
            <Link
              to="/dashboard/edit"
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
            >
              Open full Dashboard Edit page →
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            For refunds, wrong sales, or clearing dashboard data: enter your password to receive a 6-digit PIN by email,
            then enter the PIN to open the edit interface. There you can void/cancel individual sales or clear all dashboard data.
          </p>

          {clearDataStep === "idle" && (
            <form onSubmit={handleRequestClearDataPin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your password</label>
                <input
                  type="password"
                  value={clearDataPassword}
                  onChange={(e) => setClearDataPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter password to receive PIN"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={requestPinLoading || !clearDataPassword.trim()}
                className="px-4 py-2 btn-primary-gradient rounded-lg disabled:opacity-50"
              >
                {requestPinLoading ? "Sending…" : "Send 6-digit PIN"}
              </button>
            </form>
          )}

          {clearDataStep === "pin_sent" && (
            <form onSubmit={handleConfirmDashboardEdit} className="space-y-4">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                PIN sent to your email. Enter it below to open the dashboard edit interface.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">6-digit PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={clearDataPin}
                  onChange={(e) => setClearDataPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-lg tracking-widest"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={confirmEditLoading || clearDataPin.length !== 6}
                  className="px-4 py-2 btn-primary-gradient rounded-lg disabled:opacity-50"
                >
                  {confirmEditLoading ? "Opening…" : "Open dashboard edit"}
                </button>
                <button
                  type="button"
                  onClick={() => { setClearDataStep("idle"); setClearDataPin(""); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {clearDataStep === "edit_open" && dashboardEditToken && (
            <div className="space-y-4">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Dashboard edit is open. Void sales below or clear all dashboard data. Session expires in 15 minutes.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadEditSales}
                  disabled={editSalesLoading}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                >
                  {editSalesLoading ? "Loading…" : "Refresh list"}
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDashboardData}
                  disabled={clearAllLoading}
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                >
                  {clearAllLoading ? "Clearing…" : "Clear all dashboard data"}
                </button>
                <button
                  type="button"
                  onClick={closeDashboardEdit}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                >
                  Close / Lock
                </button>
              </div>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recent sales (last 30 days) – void if refund or wrong sale
                </div>
                {editSalesLoading ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Loading sales…</div>
                ) : editSales.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No sales in this period.</div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-600 max-h-64 overflow-y-auto">
                    {editSales.map((sale: any) => (
                      <li key={sale.id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-900 dark:text-white flex items-center gap-2">
                          <span>
                            {sale.sale_number ?? sale.id?.slice(0, 8)} · {sale.payment_method ?? "—"} · {Number(sale.final_amount ?? 0).toLocaleString()}
                          </span>
                          {String(sale?.notes || "").includes("[CREDIT_REPAYMENT]") && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Credit Repayment
                            </span>
                          )}
                        </span>
                        {sale.status === "completed" ? (
                          <button
                            type="button"
                            onClick={() => handleCancelSale(sale.id)}
                            disabled={cancellingId === sale.id}
                            className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                          >
                            {cancellingId === sale.id ? "Cancelling…" : "Void / Cancel"}
                          </button>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Cancelled</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shop settings placeholder */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <strong>Shop settings</strong> (currency, timezone, receipt template, etc.) coming soon.
        </p>
      </div>
    </div>
  );
}
