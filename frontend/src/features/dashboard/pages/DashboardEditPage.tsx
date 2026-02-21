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
  ClipboardList,
  Camera,
  Download,
  Send,
  MapPin,
  Truck,
  ArrowRightLeft,
} from "lucide-react";
import { useShop } from "../../../contexts/useShop";
import { controlsApi, inventoryApi, shopsApi, salesApi } from "../../../lib/api";
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
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [variances, setVariances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [reasonCodes, setReasonCodes] = useState<Record<string, string[]>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [recordingVariance, setRecordingVariance] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductLabel, setSelectedProductLabel] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [reasonCode, setReasonCode] = useState("counting_error");
  const [reasonNote, setReasonNote] = useState("");
  const [countSessions, setCountSessions] = useState<any[]>([]);
  const [activeCountSessionId, setActiveCountSessionId] = useState("");
  const [countProgress, setCountProgress] = useState<any | null>(null);
  const [countItems, setCountItems] = useState<any[]>([]);
  const [countReminders, setCountReminders] = useState<any[]>([]);
  const [countScopeType, setCountScopeType] = useState<"all" | "category" | "section" | "product_list">("all");
  const [countScopeValue, setCountScopeValue] = useState("");
  const [countSessionTitle, setCountSessionTitle] = useState("");
  const [startingCountSession, setStartingCountSession] = useState(false);
  const [countingItem, setCountingItem] = useState(false);
  const [submittingCountSession, setSubmittingCountSession] = useState(false);
  const [countPhotoUrl, setCountPhotoUrl] = useState("");
  const [goodsSoldRows, setGoodsSoldRows] = useState<any[]>([]);
  const [goodsSoldLoading, setGoodsSoldLoading] = useState(false);
  const [adjustSaleId, setAdjustSaleId] = useState("");
  const [adjustSaleItemId, setAdjustSaleItemId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [returningItem, setReturningItem] = useState(false);
  const [creatingRefund, setCreatingRefund] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationBalances, setLocationBalances] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [supplierScorecard, setSupplierScorecard] = useState<any[]>([]);
  const [patternAlerts, setPatternAlerts] = useState<any[]>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationType, setNewLocationType] = useState("store");
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [balanceLocationId, setBalanceLocationId] = useState("");
  const [balanceProductId, setBalanceProductId] = useState("");
  const [balanceQty, setBalanceQty] = useState("");
  const [savingLocationBalance, setSavingLocationBalance] = useState(false);
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferringStock, setTransferringStock] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [supplierProductId, setSupplierProductId] = useState("");
  const [supplierExpectedQty, setSupplierExpectedQty] = useState("");
  const [supplierReceivedQty, setSupplierReceivedQty] = useState("");
  const [supplierUnitCost, setSupplierUnitCost] = useState("");
  const [supplierLocationId, setSupplierLocationId] = useState("");
  const [supplierDeliveryPerson, setSupplierDeliveryPerson] = useState("");
  const [supplierPhotoUrl, setSupplierPhotoUrl] = useState("");
  const [recordingSupplierDelivery, setRecordingSupplierDelivery] = useState(false);

  useEffect(() => {
    if (token) setStep("edit_open");
  }, [token]);

  useEffect(() => {
    if (step === "edit_open" && currentShop?.id) {
      loadSales();
      loadGoodsSoldSummary();
    }
  }, [step, currentShop?.id, dateFrom, dateTo]);

  useEffect(() => {
    if (step === "edit_open" && currentShop?.id) {
      loadStockControls();
    }
  }, [step, currentShop?.id]);

  useEffect(() => {
    if (step !== "edit_open" || !activeCountSessionId) {
      setCountProgress(null);
      setCountItems([]);
      return;
    }
    loadCountSessionDetails(activeCountSessionId);
  }, [step, activeCountSessionId]);

  useEffect(() => {
    if (step !== "edit_open") return;
    const query = productSearch.trim();
    if (query.length < 2) {
      setProductResults([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const res = await inventoryApi.getProducts({ search: query, is_active: true });
        const list = Array.isArray(res.data?.data) ? res.data.data.slice(0, 8) : [];
        setProductResults(list);
      } catch {
        setProductResults([]);
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [productSearch, step]);

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

  const loadGoodsSoldSummary = async () => {
    setGoodsSoldLoading(true);
    try {
      const res = await salesApi.getGoodsSoldSummary({
        startDate: dateFrom + "T00:00:00.000Z",
        endDate: dateTo + "T23:59:59.999Z",
      });
      setGoodsSoldRows(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setGoodsSoldRows([]);
    } finally {
      setGoodsSoldLoading(false);
    }
  };

  const loadStockControls = async () => {
    setStockLoading(true);
    try {
      const [snapRes, varRes, movRes, cfgRes, sessionRes, reminderRes, locRes, balRes, transferRes, scoreRes, alertRes] = await Promise.all([
        controlsApi.getStockSnapshots({ limit: 8 }),
        controlsApi.getStockVariances({ limit: 8 }),
        controlsApi.getStockMovements({ limit: 8 }),
        controlsApi.getStockConfig(),
        controlsApi.getStockCountSessions({ limit: 8 }),
        controlsApi.getStockReminders({ thresholdDays: 14 }),
        controlsApi.getStockLocations(),
        controlsApi.getLocationBalances(),
        controlsApi.getStockTransfers({ limit: 8 }),
        controlsApi.getSupplierScorecard(),
        controlsApi.getPatternAlerts(),
      ]);
      setSnapshots(Array.isArray(snapRes.data?.data) ? snapRes.data.data : []);
      setVariances(Array.isArray(varRes.data?.data) ? varRes.data.data : []);
      setMovements(Array.isArray(movRes.data?.data) ? movRes.data.data : []);
      setReasonCodes((cfgRes.data?.data?.reasonCodes as Record<string, string[]>) || {});
      const sessions = Array.isArray(sessionRes.data?.data) ? sessionRes.data.data : [];
      setCountSessions(sessions);
      setCountReminders(Array.isArray(reminderRes.data?.data) ? reminderRes.data.data : []);
      setLocations(Array.isArray(locRes.data?.data) ? locRes.data.data : []);
      setLocationBalances(Array.isArray(balRes.data?.data) ? balRes.data.data : []);
      setTransfers(Array.isArray(transferRes.data?.data) ? transferRes.data.data : []);
      setSupplierScorecard(Array.isArray(scoreRes.data?.data) ? scoreRes.data.data : []);
      setPatternAlerts(Array.isArray(alertRes.data?.data) ? alertRes.data.data : []);
      if (!activeCountSessionId) {
        const openSession = sessions.find((s: any) => s.status === "open") || sessions[0];
        if (openSession?.id) setActiveCountSessionId(openSession.id);
      }
    } catch {
      setSnapshots([]);
      setVariances([]);
      setMovements([]);
      setReasonCodes({});
      setCountSessions([]);
      setCountReminders([]);
      setLocations([]);
      setLocationBalances([]);
      setTransfers([]);
      setSupplierScorecard([]);
      setPatternAlerts([]);
    } finally {
      setStockLoading(false);
    }
  };

  const loadCountSessionDetails = async (sessionId: string) => {
    try {
      const [progressRes, itemsRes] = await Promise.all([
        controlsApi.getStockCountProgress(sessionId),
        controlsApi.getStockCountItems(sessionId),
      ]);
      setCountProgress(progressRes.data?.data || null);
      setCountItems(Array.isArray(itemsRes.data?.data) ? itemsRes.data.data : []);
    } catch {
      setCountProgress(null);
      setCountItems([]);
    }
  };

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      await controlsApi.createStockSnapshot({ periodType: "daily" });
      toast.success("Daily stock snapshot created and locked.");
      loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to create stock snapshot");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleRecordVariance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error("Select a product first");
      return;
    }
    const qty = Number(countedQty);
    if (!Number.isFinite(qty)) {
      toast.error("Enter counted quantity");
      return;
    }
    if (!reasonCode) {
      toast.error("Select a reason code");
      return;
    }
    setRecordingVariance(true);
    try {
      await controlsApi.recordStockVariance({
        productId: selectedProductId,
        countedQty: qty,
        reasonCode,
        reasonNote: reasonNote.trim() || undefined,
      });
      toast.success("Variance recorded.");
      setCountedQty("");
      setReasonNote("");
      setSelectedProductId("");
      setSelectedProductLabel("");
      setProductSearch("");
      setProductResults([]);
      loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to record variance");
    } finally {
      setRecordingVariance(false);
    }
  };

  const handleStartCountSession = async () => {
    setStartingCountSession(true);
    try {
      const res = await controlsApi.startStockCountSession({
        title: countSessionTitle.trim() || undefined,
        scopeType: countScopeType,
        scopeValue: countScopeValue.trim() || undefined,
      });
      const newSessionId = res.data?.data?.id;
      toast.success("Stock count session started.");
      setCountSessionTitle("");
      setCountScopeType("all");
      setCountScopeValue("");
      await loadStockControls();
      if (newSessionId) setActiveCountSessionId(newSessionId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to start count session");
    } finally {
      setStartingCountSession(false);
    }
  };

  const handleRecordCountItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCountSessionId) {
      toast.error("Select a stock count session first");
      return;
    }
    if (!selectedProductId) {
      toast.error("Select a product first");
      return;
    }
    const qty = Number(countedQty);
    if (!Number.isFinite(qty)) {
      toast.error("Enter counted quantity");
      return;
    }
    setCountingItem(true);
    try {
      await controlsApi.recordStockCountItem(activeCountSessionId, {
        productId: selectedProductId,
        countedQty: qty,
        photoUrl: countPhotoUrl.trim() || undefined,
        notes: reasonNote.trim() || undefined,
      });
      toast.success("Count saved.");
      setCountedQty("");
      setCountPhotoUrl("");
      await loadCountSessionDetails(activeCountSessionId);
      await loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to save count");
    } finally {
      setCountingItem(false);
    }
  };

  const handleSubmitCountSession = async () => {
    if (!activeCountSessionId) {
      toast.error("Select a stock count session first");
      return;
    }
    setSubmittingCountSession(true);
    try {
      const res = await controlsApi.submitStockCountSession(activeCountSessionId);
      const data = res.data?.data;
      if (data?.needsReconciliation) {
        toast.error("Session needs reconciliation: pending second counts or mismatches.");
      } else {
        toast.success(`Count submitted. ${data?.variancesCreated || 0} variance record(s) created.`);
      }
      await loadStockControls();
      await loadCountSessionDetails(activeCountSessionId);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to submit count session");
    } finally {
      setSubmittingCountSession(false);
    }
  };

  const handleExportExcel = () => {
    const rows = variances.map((v: any) => ({
      product: v.product_name,
      expected_qty: Number(v.expected_qty || 0),
      counted_qty: Number(v.counted_qty || 0),
      variance_qty: Number(v.variance_qty || 0),
      variance_value: Number(v.variance_value || 0),
      variance_percent: Number(v.variance_percent || 0),
      severity: v.severity,
      reason_code: v.reason_code,
      status: v.status,
      created_at: v.created_at,
    }));
    const header = Object.keys(rows[0] || {
      product: "",
      expected_qty: "",
      counted_qty: "",
      variance_qty: "",
      variance_value: "",
      variance_percent: "",
      severity: "",
      reason_code: "",
      status: "",
      created_at: "",
    });
    const csv = [
      header.join(","),
      ...rows.map((r: any) =>
        header
          .map((k) => `"${String((r as any)[k] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-variance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const currency = currentShop?.currency || "GHS";
    const totalProducts = variances.length;
    const totalValue = variances.reduce((sum, v) => sum + Number(v.variance_value || 0), 0);
    const rows = variances
      .map(
        (v: any) =>
          `<tr>
            <td>${v.product_name || ""}</td>
            <td>${Number(v.expected_qty || 0).toFixed(2)}</td>
            <td>${Number(v.counted_qty || 0).toFixed(2)}</td>
            <td>${Number(v.variance_qty || 0).toFixed(2)}</td>
            <td>${currency} ${Number(v.variance_value || 0).toFixed(2)}</td>
            <td>${v.reason_code || ""}</td>
            <td>${v.status || ""}</td>
          </tr>`
      )
      .join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <html><head><title>Stock Variance Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #f5f5f5; }
      </style>
      </head><body>
        <h2>Stock Variance Report - ${new Date().toISOString().slice(0, 10)}</h2>
        <p>Total products with variance: ${totalProducts}</p>
        <p>Total variance value: ${currency} ${totalValue.toFixed(2)}</p>
        <table>
          <thead><tr><th>Product</th><th>Expected</th><th>Actual</th><th>Variance Qty</th><th>Variance Value</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;font-size:11px;color:#666;">Generated by ShoopKeeper</p>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleWhatsappShare = () => {
    const currency = currentShop?.currency || "GHS";
    const negative = variances.filter((v: any) => Number(v.variance_value || 0) < 0);
    const positive = variances.filter((v: any) => Number(v.variance_value || 0) > 0);
    const net = variances.reduce((sum, v) => sum + Number(v.variance_value || 0), 0);
    const message = [
      "Stock Variance Report",
      `- ${negative.length} products short`,
      `- ${positive.length} products over`,
      `- Net: ${currency} ${net.toFixed(2)}`,
      `- Date: ${new Date().toLocaleDateString()}`,
    ].join("\n");
    const link = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(link, "_blank");
  };

  

  const handleCreateLocation = async () => {
    const name = newLocationName.trim();
    if (!name) {
      toast.error("Enter location name");
      return;
    }
    setCreatingLocation(true);
    try {
      await controlsApi.createStockLocation({ name, locationType: newLocationType });
      toast.success("Stock location created.");
      setNewLocationName("");
      await loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to create location");
    } finally {
      setCreatingLocation(false);
    }
  };

  const handleSetLocationBalance = async () => {
    if (!balanceLocationId || !balanceProductId) {
      toast.error("Location ID and Product ID are required");
      return;
    }
    const qty = Number(balanceQty);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Quantity must be 0 or more");
      return;
    }
    setSavingLocationBalance(true);
    try {
      await controlsApi.setLocationBalance({
        locationId: balanceLocationId,
        productId: balanceProductId,
        quantity: qty,
      });
      toast.success("Location stock updated.");
      setBalanceQty("");
      await loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to update location stock");
    } finally {
      setSavingLocationBalance(false);
    }
  };

  const handleTransferStock = async () => {
    if (!transferFromId || !transferToId || !transferProductId) {
      toast.error("From, To and Product IDs are required");
      return;
    }
    const qty = Number(transferQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter valid transfer quantity");
      return;
    }
    setTransferringStock(true);
    try {
      await controlsApi.createStockTransfer({
        fromLocationId: transferFromId,
        toLocationId: transferToId,
        productId: transferProductId,
        quantity: qty,
        notes: transferNote.trim() || undefined,
      });
      toast.success("Stock transfer completed.");
      setTransferQty("");
      setTransferNote("");
      await loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to transfer stock");
    } finally {
      setTransferringStock(false);
    }
  };

  const handleRecordSupplierDelivery = async () => {
    if (!supplierName.trim() || !supplierProductId) {
      toast.error("Supplier name and product ID are required");
      return;
    }
    const expectedQty = Number(supplierExpectedQty);
    const receivedQty = Number(supplierReceivedQty);
    const unitCost = supplierUnitCost.trim() ? Number(supplierUnitCost) : undefined;
    if (!Number.isFinite(expectedQty) || expectedQty <= 0) {
      toast.error("Expected qty must be > 0");
      return;
    }
    if (!Number.isFinite(receivedQty) || receivedQty < 0) {
      toast.error("Received qty must be 0 or more");
      return;
    }
    if (supplierUnitCost.trim() && (!Number.isFinite(unitCost as number) || Number(unitCost) < 0)) {
      toast.error("Unit cost must be valid");
      return;
    }
    setRecordingSupplierDelivery(true);
    try {
      const res = await controlsApi.recordSupplierDelivery({
        supplierName: supplierName.trim(),
        invoiceNumber: supplierInvoice.trim() || undefined,
        productId: supplierProductId,
        expectedQuantity: expectedQty,
        receivedQuantity: receivedQty,
        unitCost,
        deliveryPersonName: supplierDeliveryPerson.trim() || undefined,
        photoUrl: supplierPhotoUrl.trim() || undefined,
        locationId: supplierLocationId || undefined,
      });
      const shortageFlag = !!res.data?.data?.shortageFlag;
      toast.success(shortageFlag ? "Delivery recorded with shortage flag." : "Delivery recorded.");
      setSupplierInvoice("");
      setSupplierExpectedQty("");
      setSupplierReceivedQty("");
      setSupplierUnitCost("");
      setSupplierDeliveryPerson("");
      setSupplierPhotoUrl("");
      await loadStockControls();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to record supplier delivery");
    } finally {
      setRecordingSupplierDelivery(false);
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

  const handleReturnItem = async () => {
    if (!adjustSaleId || !adjustSaleItemId) {
      toast.error("Sale ID and Sale Item ID are required");
      return;
    }
    const qty = Number(returnQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid return quantity");
      return;
    }
    setReturningItem(true);
    try {
      await salesApi.returnItem(adjustSaleId, {
        sale_item_id: adjustSaleItemId,
        quantity: qty,
        reason: adjustReason.trim() || undefined,
      });
      toast.success("Item return recorded and stock restored.");
      setReturnQty("");
      setAdjustReason("");
      await Promise.all([loadSales(), loadGoodsSoldSummary()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to return item");
    } finally {
      setReturningItem(false);
    }
  };

  const handlePartialRefund = async () => {
    if (!adjustSaleId) {
      toast.error("Sale ID is required");
      return;
    }
    const amount = Number(partialRefundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    setCreatingRefund(true);
    try {
      await salesApi.partialRefund(adjustSaleId, {
        amount,
        reason: adjustReason.trim() || undefined,
      });
      toast.success("Partial refund recorded.");
      setPartialRefundAmount("");
      setAdjustReason("");
      await Promise.all([loadSales(), loadGoodsSoldSummary()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to create partial refund");
    } finally {
      setCreatingRefund(false);
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

  const allReasonCodes = Object.values(reasonCodes).flat();

  const prettyReason = (value?: string | null) =>
    (value || "unknown").replace(/_/g, " ");

  const severityBadgeClass = (severity?: string) => {
    const s = String(severity || "");
    if (s === "severe") return "bg-black text-white";
    if (s === "critical") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    if (s === "moderate") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
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

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4 md:p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Stock control foundation
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Opening stock snapshots, variance severity, reason codes, approvals, and movement logs.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadStockControls}
                    disabled={stockLoading}
                    className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    {stockLoading ? "Loading..." : "Refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSnapshot}
                    disabled={creatingSnapshot}
                    className="px-3 py-1.5 text-xs btn-primary-gradient rounded-lg disabled:opacity-50"
                  >
                    {creatingSnapshot ? "Creating..." : "Take daily snapshot"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    <Download className="h-3.5 w-3.5" /> Export Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleWhatsappShare}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-emerald-400 dark:border-emerald-700 rounded-lg text-emerald-700 dark:text-emerald-300"
                  >
                    <Send className="h-3.5 w-3.5" /> WhatsApp share
                  </button>
                </div>
              </div>

              <form onSubmit={handleRecordVariance} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
                <div className="md:col-span-2">
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Search product (name/barcode)"
                  />
                  {productResults.length > 0 && (
                    <div className="mt-1 max-h-32 overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                      {productResults.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setSelectedProductLabel(`${p.name}${p.barcode ? ` (${p.barcode})` : ""}`);
                            setProductResults([]);
                            setProductSearch(p.name || "");
                          }}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                          {p.name} {p.barcode ? `- ${p.barcode}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  value={selectedProductLabel}
                  readOnly
                  className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
                  placeholder="Selected product"
                />
                <input
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  type="number"
                  step="0.001"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  placeholder="Counted qty"
                />
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                >
                  {allReasonCodes.length === 0 ? (
                    <option value="counting_error">counting_error</option>
                  ) : (
                    allReasonCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))
                  )}
                </select>
                <input
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  className="md:col-span-5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  placeholder="Note (optional)"
                />
                <button
                  type="submit"
                  disabled={recordingVariance}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {recordingVariance ? "Saving..." : "Record variance"}
                </button>
              </form>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-4">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Physical count workflow</p>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {countProgress?.progressText || "Start a count session"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
                  <input
                    value={countSessionTitle}
                    onChange={(e) => setCountSessionTitle(e.target.value)}
                    className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Session title (optional)"
                  />
                  <select
                    value={countScopeType}
                    onChange={(e) => setCountScopeType(e.target.value as any)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="all">All products</option>
                    <option value="category">By category</option>
                    <option value="section">By section</option>
                    <option value="product_list">Product list</option>
                  </select>
                  <input
                    value={countScopeValue}
                    onChange={(e) => setCountScopeValue(e.target.value)}
                    className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Scope value (category id/section)"
                  />
                  <button
                    type="button"
                    onClick={handleStartCountSession}
                    disabled={startingCountSession}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {startingCountSession ? "Starting..." : "Start stock count"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
                  <select
                    value={activeCountSessionId}
                    onChange={(e) => setActiveCountSessionId(e.target.value)}
                    className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                  >
                    <option value="">Select active session</option>
                    {countSessions.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.title} - {s.status}
                      </option>
                    ))}
                  </select>
                  <input
                    value={countPhotoUrl}
                    onChange={(e) => setCountPhotoUrl(e.target.value)}
                    className="md:col-span-3 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Photo URL (optional evidence)"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitCountSession}
                    disabled={submittingCountSession || !activeCountSessionId}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {submittingCountSession ? "Submitting..." : "Submit count"}
                  </button>
                </div>

                <form onSubmit={handleRecordCountItem} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="md:col-span-2 text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2">
                    Step: scan/search product {"->"} enter qty {"->"} save count.
                    <div className="flex items-center gap-1 mt-1 text-gray-500 dark:text-gray-400">
                      <Camera className="h-3.5 w-3.5" /> Optional photo evidence supported.
                    </div>
                  </div>
                  <input
                    value={selectedProductLabel}
                    readOnly
                    className="md:col-span-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
                    placeholder="Selected product from search above"
                  />
                  <input
                    value={countedQty}
                    onChange={(e) => setCountedQty(e.target.value)}
                    type="number"
                    step="0.001"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Count qty"
                  />
                  <button
                    type="submit"
                    disabled={countingItem || !activeCountSessionId}
                    className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {countingItem ? "Saving..." : "Save count"}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Recent snapshots</p>
                  <div className="space-y-2">
                    {snapshots.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No snapshot yet.</p>
                    ) : (
                      snapshots.slice(0, 5).map((row: any) => (
                        <div key={row.id} className="text-xs text-gray-700 dark:text-gray-300">
                          <span className="font-medium">{row.period_type}</span> {row.period_key} - {formatDate(row.created_at)}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Recent variances</p>
                  <div className="space-y-2">
                    {variances.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No variance recorded.</p>
                    ) : (
                      variances.slice(0, 5).map((row: any) => (
                        <div key={row.id} className="text-xs text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded ${severityBadgeClass(row.severity)}`}>
                              {row.severity}
                            </span>
                            <span className="font-medium">{row.product_name}</span>
                          </div>
                          <p>
                            {Number(row.expected_qty || 0).toFixed(2)} expected / {Number(row.counted_qty || 0).toFixed(2)} counted
                            {" - "} {prettyReason(row.reason_code)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Stock movement trail</p>
                  <div className="space-y-2">
                    {movements.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No movement in trail.</p>
                    ) : (
                      movements.slice(0, 5).map((row: any) => {
                        const before = Number(row.quantity_before ?? row.previous_quantity ?? 0);
                        const change = Number(row.quantity_change ?? row.quantity ?? 0);
                        const after = Number(row.quantity_after ?? row.new_quantity ?? 0);
                        return (
                          <div key={row.id} className="text-xs text-gray-700 dark:text-gray-300">
                            <p className="font-medium">{row.product_name || "Unknown product"}</p>
                            <p>{before.toFixed(2)} + ({change.toFixed(2)}) = {after.toFixed(2)}</p>
                            <p className="text-gray-500 dark:text-gray-400">{formatDate(row.created_at)}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Count reminders</p>
                  {countReminders.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No reminders right now.</p>
                  ) : (
                    <div className="space-y-2">
                      {countReminders.map((r: any, idx: number) => (
                        <div key={`${r.type}-${idx}`} className="text-xs text-gray-700 dark:text-gray-300">
                          {r.severity === "warning" ? "⚠️" : "🔔"} {r.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Two-person verification</p>
                  {countItems.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No counted items yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-auto">
                      {countItems.slice(0, 8).map((item: any) => (
                        <div key={item.id} className="text-xs text-gray-700 dark:text-gray-300">
                          <p className="font-medium">{item.product_name}</p>
                          <p>
                            Primary: {Number(item.counted_qty_primary || 0).toFixed(2)}
                            {item.requires_verification && (
                              <> | Secondary: {item.counted_qty_secondary == null ? "-" : Number(item.counted_qty_secondary).toFixed(2)}</>
                            )}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">Status: {item.verification_status}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Multiple locations
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <input
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Location name"
                    />
                    <input
                      value={newLocationType}
                      onChange={(e) => setNewLocationType(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Type (store/warehouse)"
                    />
                    <button
                      type="button"
                      onClick={handleCreateLocation}
                      disabled={creatingLocation}
                      className="px-2 py-1.5 rounded bg-indigo-600 text-white text-xs disabled:opacity-50"
                    >
                      {creatingLocation ? "Saving..." : "Add location"}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-auto">
                    {locations.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No location yet.</p>
                    ) : (
                      locations.slice(0, 8).map((loc: any) => (
                        <p key={loc.id} className="text-xs text-gray-700 dark:text-gray-300">
                          {loc.name} ({loc.location_type}) - {loc.id}
                        </p>
                      ))
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                    <input
                      value={balanceLocationId}
                      onChange={(e) => setBalanceLocationId(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Location ID"
                    />
                    <input
                      value={balanceProductId}
                      onChange={(e) => setBalanceProductId(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Product ID"
                    />
                    <input
                      value={balanceQty}
                      onChange={(e) => setBalanceQty(e.target.value)}
                      type="number"
                      step="0.001"
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      onClick={handleSetLocationBalance}
                      disabled={savingLocationBalance}
                      className="px-2 py-1.5 rounded bg-sky-600 text-white text-xs disabled:opacity-50"
                    >
                      {savingLocationBalance ? "Saving..." : "Set balance"}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Transfers and expected stock by location
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
                    <input
                      value={transferFromId}
                      onChange={(e) => setTransferFromId(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="From location ID"
                    />
                    <input
                      value={transferToId}
                      onChange={(e) => setTransferToId(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="To location ID"
                    />
                    <input
                      value={transferProductId}
                      onChange={(e) => setTransferProductId(e.target.value)}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Product ID"
                    />
                    <input
                      value={transferQty}
                      onChange={(e) => setTransferQty(e.target.value)}
                      type="number"
                      step="0.001"
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      onClick={handleTransferStock}
                      disabled={transferringStock}
                      className="px-2 py-1.5 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
                    >
                      {transferringStock ? "Transferring..." : "Transfer"}
                    </button>
                  </div>
                  <input
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs mb-2"
                    placeholder="Transfer note (optional)"
                  />
                  <div className="space-y-1 max-h-24 overflow-auto mb-2">
                    {(locationBalances || []).slice(0, 8).map((b: any) => (
                      <p key={b.id} className="text-xs text-gray-700 dark:text-gray-300">
                        {b.location?.name || b.location_id}: {b.product?.name || b.product_id} = {Number(b.quantity || 0).toFixed(2)}
                      </p>
                    ))}
                  </div>
                  <div className="space-y-1 max-h-20 overflow-auto">
                    {(transfers || []).slice(0, 6).map((t: any) => (
                      <p key={t.id} className="text-xs text-gray-700 dark:text-gray-300">
                        {t.fromLocation?.name || t.from_location_id} {"->"} {t.toLocation?.name || t.to_location_id} | {t.product?.name || t.product_id} | {Number(t.quantity || 0).toFixed(2)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Supplier accountability
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Supplier name" />
                    <input value={supplierInvoice} onChange={(e) => setSupplierInvoice(e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Invoice no." />
                    <input value={supplierProductId} onChange={(e) => setSupplierProductId(e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Product ID" />
                    <input value={supplierExpectedQty} onChange={(e) => setSupplierExpectedQty(e.target.value)} type="number" step="0.001" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Expected qty" />
                    <input value={supplierReceivedQty} onChange={(e) => setSupplierReceivedQty(e.target.value)} type="number" step="0.001" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Received qty" />
                    <input value={supplierUnitCost} onChange={(e) => setSupplierUnitCost(e.target.value)} type="number" step="0.0001" className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Unit cost" />
                    <input value={supplierLocationId} onChange={(e) => setSupplierLocationId(e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Location ID (optional)" />
                    <input value={supplierDeliveryPerson} onChange={(e) => setSupplierDeliveryPerson(e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Delivery person" />
                    <input value={supplierPhotoUrl} onChange={(e) => setSupplierPhotoUrl(e.target.value)} className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" placeholder="Photo URL (optional)" />
                  </div>
                  <button
                    type="button"
                    onClick={handleRecordSupplierDelivery}
                    disabled={recordingSupplierDelivery}
                    className="mt-2 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs disabled:opacity-50"
                  >
                    {recordingSupplierDelivery ? "Saving..." : "Record delivery"}
                  </button>
                  <div className="space-y-1 max-h-24 overflow-auto mt-2">
                    {(supplierScorecard || []).slice(0, 6).map((s: any) => (
                      <p key={s.supplierName} className="text-xs text-gray-700 dark:text-gray-300">
                        {s.supplierName}: {Number(s.deliveryAccuracyPercent || 0).toFixed(1)}% accuracy, shortage {Number(s.averageShortagePercent || 0).toFixed(2)}%
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Pattern detection and red flags</p>
                  {patternAlerts.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No red flags currently detected.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {patternAlerts.map((a: any, idx: number) => (
                        <div key={`${a.type}-${idx}`} className="text-xs text-gray-700 dark:text-gray-300">
                          {a.severity === "critical" ? "🚨" : a.severity === "warning" ? "⚠️" : "🔍"} {a.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Goods sold (FIFO cost basis)</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Net sales account for returns. Cost basis uses FIFO layers for more accurate profit.
                </p>
              </div>
              {goodsSoldLoading ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading goods sold summary...</div>
              ) : goodsSoldRows.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No sold items in selected period.</div>
              ) : (
                <div className="overflow-x-auto border-b border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700/50 text-left text-gray-600 dark:text-gray-300">
                        <th className="px-3 py-2 font-medium">Product</th>
                        <th className="px-3 py-2 font-medium text-right">Gross sold</th>
                        <th className="px-3 py-2 font-medium text-right">Returned</th>
                        <th className="px-3 py-2 font-medium text-right">Net sold</th>
                        <th className="px-3 py-2 font-medium">FIFO basis</th>
                        <th className="px-3 py-2 font-medium text-right">Avg cost</th>
                        <th className="px-3 py-2 font-medium text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {goodsSoldRows.slice(0, 10).map((row: any) => {
                        const basisText = (row.costBreakdown || [])
                          .slice(0, 3)
                          .map((b: any) => `${Number(b.quantity || 0).toFixed(2)} @ ${Number(b.unitCost || 0).toFixed(2)}`)
                          .join(", ");
                        return (
                          <tr key={row.productId} className="text-gray-800 dark:text-gray-100">
                            <td className="px-3 py-2">{row.productName}</td>
                            <td className="px-3 py-2 text-right">{Number(row.grossSoldQty || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{Number(row.returnedQty || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{Number(row.netSoldQty || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-[11px] text-gray-600 dark:text-gray-300">{basisText || "-"}</td>
                            <td className="px-3 py-2 text-right">{Number(row.avgCost || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{(currentShop?.currency || "GHS")} {Number(row.netProfit || 0).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Example: 10 units sold - 5 @ 8.00, 5 @ 10.00 = Avg cost 9.00
                </p>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <input
                    value={adjustSaleId}
                    onChange={(e) => setAdjustSaleId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Sale ID"
                  />
                  <input
                    value={adjustSaleItemId}
                    onChange={(e) => setAdjustSaleItemId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Sale Item ID (for returns)"
                  />
                  <input
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    type="number"
                    step="0.001"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Return qty"
                  />
                  <input
                    value={partialRefundAmount}
                    onChange={(e) => setPartialRefundAmount(e.target.value)}
                    type="number"
                    step="0.01"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Partial refund amount"
                  />
                  <input
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    placeholder="Reason (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReturnItem}
                      disabled={returningItem}
                      className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      {returningItem ? "Saving..." : "Return item"}
                    </button>
                    <button
                      type="button"
                      onClick={handlePartialRefund}
                      disabled={creatingRefund}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      {creatingRefund ? "Saving..." : "Partial refund"}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                  Returns add back to stock and reduce net sales. Partial refunds reduce revenue only.
                </p>
              </div>
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
                            {(currentShop?.currency || "GHS")} {Number(sale.final_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
