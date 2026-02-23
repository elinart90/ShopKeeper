import { useCallback, useEffect, useState } from "react";
import { useShop } from "../../../contexts/useShop";
import { customersApi, paymentsApi } from "../../../lib/api";
import type { AutoCreditRemindersData, CreditIntelligenceData, CreditIntelligenceQueryData } from "../../../lib/api";
import { useAuth } from "../../../contexts/useAuth";
import toast from "react-hot-toast";

const PENDING_PAYSTACK_CREDIT_REPAYMENT_KEY = "shoopkeeper_pending_paystack_credit_repayment";

export default function CreditTab({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const currency = currentShop?.currency || "GHS";
  const [data, setData] = useState<{
    totalExposure: number;
    count: number;
    customersOwing: Array<{
      id: string;
      name: string;
      phone?: string;
      email?: string;
      credit_balance: number;
      credit_limit: number;
    }>;
  } | null>(null);
  const [intel, setIntel] = useState<CreditIntelligenceData | null>(null);
  const [lookbackDays, setLookbackDays] = useState(90);
  const [creditQuery, setCreditQuery] = useState("");
  const [creditQueryLoading, setCreditQueryLoading] = useState(false);
  const [creditQueryResult, setCreditQueryResult] = useState<CreditIntelligenceQueryData | null>(null);
  const [autoReminders, setAutoReminders] = useState<AutoCreditRemindersData | null>(null);
  const [autoReminderLoading, setAutoReminderLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'bank_transfer' | 'card'>('cash');
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadCreditSummary = useCallback(() => {
    setLoading(true);
    Promise.all([
      customersApi.getCreditSummary(),
      customersApi.getCreditIntelligence({ lookbackDays }),
    ])
      .then(([summaryRes, intelRes]) => {
        setData(summaryRes.data.data);
        setIntel(intelRes.data.data);
      })
      .catch(() => {
        setData({ totalExposure: 0, count: 0, customersOwing: [] });
        setIntel(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lookbackDays]);

  useEffect(() => {
    loadCreditSummary();
  }, [loadCreditSummary]);

  const runAutoReminders = async (silent = false) => {
    setAutoReminderLoading(true);
    try {
      const res = await customersApi.runAutoCreditReminders({ intervalDays: 3, lookbackDays });
      setAutoReminders(res.data.data || null);
      if (!silent) {
        const due = Number(res.data.data?.dueCount || 0);
        toast.success(due > 0 ? `${due} reminder(s) generated` : "No reminders due today");
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to generate reminders";
      if (!silent) toast.error(msg);
    } finally {
      setAutoReminderLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run reminder cycle; backend enforces 3-day cadence per customer.
    runAutoReminders(true);
  }, [lookbackDays]);

  const askCreditIntelligence = async () => {
    if (!creditQuery.trim()) return;
    setCreditQueryLoading(true);
    try {
      const res = await customersApi.queryCreditIntelligence({
        query: creditQuery.trim(),
        lookbackDays,
      });
      setCreditQueryResult(res.data.data);
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to run credit query";
      toast.error(msg);
    } finally {
      setCreditQueryLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    const customerId = paymentCustomerId || data?.customersOwing?.[0]?.id;
    const amount = Number(paymentAmount);
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setSubmittingPayment(true);
    try {
      if (paymentMethod === "mobile_money" || paymentMethod === "card" || paymentMethod === "bank_transfer") {
        if (!navigator.onLine) {
          toast.error("Internet connection is required for Paystack checkout.");
          return;
        }
        if (!user?.email) {
          toast.error("Add your email in Settings to use Paystack.");
          return;
        }
        const amountMinor = Math.round(amount * 100);
        if (amountMinor < 100) {
          toast.error("Minimum payment amount is 1.00");
          return;
        }
        sessionStorage.setItem(
          PENDING_PAYSTACK_CREDIT_REPAYMENT_KEY,
          JSON.stringify({
            customerId,
            amount,
            payment_method: paymentMethod,
            notes: paymentNote.trim() || undefined,
          })
        );
        const res = await paymentsApi.initializePaystack({
          amount: amountMinor,
          email: user.email,
          purpose: "order",
          metadata: {
            source: "credit_repayment",
            customer_id: customerId,
            payment_method: paymentMethod,
          },
        });
        const url = res.data?.data?.authorization_url;
        if (url) {
          toast.success("Redirecting to Paystack...");
          window.location.href = url;
          return;
        }
        sessionStorage.removeItem(PENDING_PAYSTACK_CREDIT_REPAYMENT_KEY);
        toast.error("Could not start Paystack checkout");
        return;
      }

      await customersApi.recordPayment(customerId, {
        amount,
        payment_method: paymentMethod,
        notes: paymentNote.trim() || undefined,
      });
      toast.success("Payment recorded");
      setPaymentAmount("");
      setPaymentNote("");
      await loadCreditSummary();
    } catch (error: any) {
      sessionStorage.removeItem(PENDING_PAYSTACK_CREDIT_REPAYMENT_KEY);
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to record payment";
      toast.error(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const fmt = (n: number) => `${currency} ${Number(n).toFixed(2)}`;
  const customersRows = intel?.customers || data?.customersOwing || [];

  const normalizePhoneForWhatsApp = (phone?: string | null) => {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/[^\d+]/g, "");
    if (!digits) return "";
    if (digits.startsWith("+")) return digits.slice(1);
    if (digits.startsWith("233")) return digits;
    if (digits.startsWith("0")) return `233${digits.slice(1)}`;
    return digits;
  };

  const handleCopyWhatsAppReminder = async (r: {
    customerName: string;
    phone?: string | null;
    message: string;
  }) => {
    const phone = normalizePhoneForWhatsApp(r.phone);
    if (!phone) {
      toast.error(`No valid phone for ${r.customerName}`);
      return;
    }
    const text = encodeURIComponent(r.message || "");
    const url = `https://wa.me/${phone}?text=${text}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("WhatsApp link copied and opened");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp...");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 sm:p-8 max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Credit & Customer Risk
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
        Customers owing money, total credit exposure, due dates, reminders (SMS/WhatsApp), trust score.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total credit exposure</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {fmt(data?.totalExposure ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Customers owing money</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data?.count ?? 0}</p>
            </div>
          </div>

          {intel && (
            <div className="mb-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Customer & Credit Intelligence</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Window</label>
                  <select
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(Number(e.target.value))}
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days</option>
                  </select>
                  <span className="text-xs text-gray-500">Provider: {intel.providerUsed}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Overdue amount (&gt;30d)</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmt(intel.overdueAmount)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40">
                  <p className="text-xs text-gray-500 dark:text-gray-400">High-risk customers</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{intel.highRiskCount}</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Collection rate ({intel.lookbackDays}d)</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{intel.collectionRateRecent.toFixed(1)}%</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {intel.aiSummary}
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-2 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    AI Auto Reminder (every 3 days)
                  </p>
                  <button
                    type="button"
                    onClick={() => runAutoReminders(false)}
                    disabled={autoReminderLoading}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                  >
                    {autoReminderLoading ? "Generating..." : "Run now"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Due reminders: {Number(autoReminders?.dueCount || 0)}
                </p>
                {(autoReminders?.reminders || []).length > 0 && (
                  <div className="space-y-2">
                    {autoReminders!.reminders.slice(0, 5).map((r) => (
                      <div key={r.customerId} className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-100">
                          {r.customerName} • {fmt(r.balance)} • {r.overdueDays}d overdue
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                          {r.message}
                        </p>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => handleCopyWhatsAppReminder(r)}
                            className="px-2.5 py-1 rounded border border-emerald-500 text-emerald-700 dark:text-emerald-300 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          >
                            Copy WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Customers owing money
            </h3>
            {!customersRows.length ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
                No customers with outstanding credit. Use Sales with payment method Credit and link a
                customer to track credit.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                        Name
                      </th>
                      <th className="text-left px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                        Contact
                      </th>
                      <th className="text-right px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                        Balance
                      </th>
                      <th className="text-right px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                        Limit
                      </th>
                      <th className="text-right px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                        Overdue
                      </th>
                      <th className="text-right px-4 py-2 text-gray-700 dark:text-gray-300 font-medium">
                        Risk
                      </th>
                      <th className="text-right px-4 py-2 text-gray-700 dark:text-gray-300 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {customersRows.map((c: any) => (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">
                          {c.name}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {c.phone || c.email || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-amber-600 dark:text-amber-400">
                          {fmt(c.credit_balance)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {fmt(c.credit_limit)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {typeof c.overdueDays === "number" ? `${c.overdueDays}d` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {typeof c.riskLevel === "string" ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                c.riskLevel === "high"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : c.riskLevel === "medium"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              }`}
                            >
                              {c.riskLevel}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onNavigate("/dashboard")}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline text-sm"
                          >
                            View customer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Record customer payment</h3>
            {!data?.customersOwing?.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No outstanding balances to collect right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Customer</label>
                  <select
                    value={paymentCustomerId}
                    onChange={(e) => setPaymentCustomerId(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select customer</option>
                    {data.customersOwing.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({fmt(c.credit_balance)} due)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Payment method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Note (optional)</label>
                  <input
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Reference or comment"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}
            {(data?.customersOwing?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={submittingPayment}
                className="mt-3 px-4 py-2 rounded-lg btn-primary-gradient disabled:opacity-60"
              >
                {submittingPayment ? "Recording..." : "Record payment"}
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-600 pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ask Credit Intelligence
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={creditQuery}
                  onChange={(e) => setCreditQuery(e.target.value)}
                  placeholder='e.g. Who should I call first for repayment this week?'
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={askCreditIntelligence}
                  disabled={creditQueryLoading || !creditQuery.trim()}
                  className="px-4 py-2 rounded-lg btn-primary-gradient disabled:opacity-60"
                >
                  {creditQueryLoading ? "Asking..." : "Ask"}
                </button>
              </div>
              {creditQueryResult?.answer && (
                <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {creditQueryResult.answer}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
