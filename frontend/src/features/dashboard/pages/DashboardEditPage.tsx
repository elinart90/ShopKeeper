import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Lock,
  Mail,
  AlertCircle,
} from "lucide-react";
import { useShop } from "../../../contexts/useShop";
import { shopsApi, salesApi } from "../../../lib/api";
import toast from "react-hot-toast";

const DASHBOARD_EDIT_TOKEN_KEY = "dashboard_edit_token";

export default function DashboardEditPage() {
  const { currentShop } = useShop();
  const isOwner = currentShop?.role === "owner";

  const [step, setStep] = useState<"idle" | "pin_sent" | "edit_open">("idle");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [requestPinLoading, setRequestPinLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(DASHBOARD_EDIT_TOKEN_KEY) : null
  );

  const [sales, setSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);
  const [resetViewLoading, setResetViewLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (token) setStep("edit_open");
  }, [token]);

  useEffect(() => {
    if (step === "edit_open" && currentShop?.id) loadSales();
  }, [step, currentShop?.id, dateFrom, dateTo]);

  const loadSales = async () => {
    if (!currentShop?.id) return;
    setSalesLoading(true);
    try {
      const res = await salesApi.getSales({
        startDate: dateFrom + "T00:00:00.000Z",
        endDate: dateTo + "T23:59:59.999Z",
      });
      setSales(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  };

  const handleRequestPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Enter your password");
      return;
    }
    setRequestPinLoading(true);
    try {
      await shopsApi.requestClearDataPin(password);
      setStep("pin_sent");
      toast.success("PIN sent to your email. Check your inbox (and spam folder).");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to send PIN");
    } finally {
      setRequestPinLoading(false);
    }
  };

  const handleConfirmPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pin.trim();
    if (trimmed.length !== 6) {
      toast.error("Enter the 6-digit PIN");
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await shopsApi.confirmDashboardEdit(trimmed);
      const newToken = res.data?.data?.dashboardEditToken;
      if (newToken) {
        setToken(newToken);
        sessionStorage.setItem(DASHBOARD_EDIT_TOKEN_KEY, newToken);
        setStep("edit_open");
        setPassword("");
        setPin("");
        toast.success("Dashboard edit opened. You can void sales or clear all data below.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Invalid or expired PIN");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelSale = async (saleId: string) => {
    setCancellingId(saleId);
    try {
      await salesApi.cancelSale(saleId);
      toast.success("Sale cancelled (refund/void).");
      loadSales();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to cancel sale");
    } finally {
      setCancellingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!token) {
      toast.error("Session expired. Enter password and PIN again.");
      setToken(null);
      sessionStorage.removeItem(DASHBOARD_EDIT_TOKEN_KEY);
      setStep("idle");
      return;
    }
    if (
      !window.confirm(
        "Clear all dashboard data? Sales, revenue, profit and transaction counts will only show from today. This cannot be undone."
      )
    )
      return;
    setClearAllLoading(true);
    try {
      await shopsApi.clearDashboardData(token);
      toast.success("Dashboard cleared. All stats now start from today.");
      setToken(null);
      sessionStorage.removeItem(DASHBOARD_EDIT_TOKEN_KEY);
      setStep("idle");
    } catch (err: any) {
      if (err?.response?.status === 403) {
        toast.error("Session expired. Enter password and PIN again.");
        setToken(null);
        sessionStorage.removeItem(DASHBOARD_EDIT_TOKEN_KEY);
        setStep("idle");
      } else {
        toast.error(err?.response?.data?.error?.message || "Failed to clear dashboard");
      }
    } finally {
      setClearAllLoading(false);
    }
  };

  const closeEdit = () => {
    setToken(null);
    sessionStorage.removeItem(DASHBOARD_EDIT_TOKEN_KEY);
    setStep("idle");
  };

  const handleResetView = async () => {
    if (!token) {
      toast.error("Session expired. Enter password and PIN again.");
      setToken(null);
      sessionStorage.removeItem(DASHBOARD_EDIT_TOKEN_KEY);
      setStep("idle");
      return;
    }
    setResetViewLoading(true);
    try {
      await shopsApi.resetDashboardView(token);
      toast.success("Main dashboard will show all data again. Refresh the main dashboard to see it.");
    } catch (err: any) {
      if (err?.response?.status === 403) {
        toast.error("Session expired. Enter password and PIN again.");
        setToken(null);
        sessionStorage.removeItem(DASHBOARD_EDIT_TOKEN_KEY);
        setStep("idle");
      } else {
        toast.error(err?.response?.data?.error?.message || "Failed to reset dashboard view");
      }
    } finally {
      setResetViewLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso ?? "—";
    }
  };

  const formatPayment = (method: string) => {
    const m = (method || "").toLowerCase();
    if (m === "mobile_money") return "Mobile Money";
    if (m === "credit") return "Credit";
    return (method || "—").replace(/_/g, " ");
  };

  const isCreditRepayment = (sale: any) =>
    String(sale?.notes || "").includes("[CREDIT_REPAYMENT]");

  if (!currentShop) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-500 dark:text-gray-400">Select a shop first.</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Owner only</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Dashboard edit is available only to the shop owner.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <ShieldCheck className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard edit</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Void sales (refunds / wrong sale) or clear all dashboard data. Unlock with password and PIN.
            </p>
          </div>
        </div>

        {/* Unlock flow */}
        {step === "idle" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Step 1: Enter your password</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              A 6-digit PIN will be sent to your email. Use it in the next step to open the edit interface.
            </p>
            <form onSubmit={handleRequestPin} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Your account password"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={requestPinLoading || !password.trim()}
                className="px-4 py-2.5 btn-primary-gradient rounded-lg disabled:opacity-50 font-medium"
              >
                {requestPinLoading ? "Sending…" : "Send 6-digit PIN to email"}
              </button>
            </form>
          </div>
        )}

        {step === "pin_sent" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 md:p-8">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
              <Mail className="h-5 w-5" />
              <span className="font-medium">PIN sent to your email</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Enter the 6-digit PIN below to open the dashboard edit interface.
            </p>
            <form onSubmit={handleConfirmPin} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">6-digit PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xl tracking-widest"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={confirmLoading || pin.length !== 6}
                  className="px-4 py-2.5 btn-primary-gradient rounded-lg disabled:opacity-50 font-medium"
                >
                  {confirmLoading ? "Opening…" : "Open dashboard edit"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("idle"); setPin(""); }}
                  className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit interface (unlocked) */}
        {step === "edit_open" && token && (
          <div className="space-y-6">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                Dashboard edit is open. Void sales below or clear all dashboard data. Session expires in 15 minutes.
              </p>
              <button
                type="button"
                onClick={closeEdit}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Lock className="h-4 w-4" /> Close / Lock
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={loadSales}
                disabled={salesLoading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${salesLoading ? "animate-spin" : ""}`} />
                {salesLoading ? "Loading…" : "Refresh list"}
              </button>
              <button
                type="button"
                onClick={handleResetView}
                disabled={resetViewLoading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-500 dark:border-emerald-600 rounded-lg text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 font-medium"
              >
                {resetViewLoading ? "Resetting…" : "Show all data on main dashboard"}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearAllLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {clearAllLoading ? "Clearing…" : "Clear all dashboard data"}
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Recent sales – void if refund or wrong sale
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm text-gray-500 dark:text-gray-400">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <label className="text-sm text-gray-500 dark:text-gray-400">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              {salesLoading ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Loading sales…
                </div>
              ) : sales.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No sales in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700/50 text-left text-gray-600 dark:text-gray-300">
                        <th className="px-4 py-3 font-medium">Date & time</th>
                        <th className="px-4 py-3 font-medium">Sale #</th>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {sales.map((sale: any) => (
                        <tr key={sale.id} className="text-gray-900 dark:text-white">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatDate(sale.created_at)}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <div className="flex items-center gap-2">
                              <span>{sale.sale_number ?? sale.id?.slice(0, 8)}</span>
                              {isCreditRepayment(sale) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  Credit Repayment
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {formatPayment(sale.payment_method)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {(currentShop?.currency || "USD")} {Number(sale.final_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                sale.status === "completed"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-gray-500 dark:text-gray-400"
                              }
                            >
                              {sale.status === "completed" ? "Completed" : "Cancelled"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {sale.status === "completed" ? (
                              <button
                                type="button"
                                onClick={() => handleCancelSale(sale.id)}
                                disabled={cancellingId === sale.id}
                                className="text-red-600 dark:text-red-400 hover:underline font-medium disabled:opacity-50"
                              >
                                {cancellingId === sale.id ? "Cancelling…" : "Void / Cancel"}
                              </button>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
