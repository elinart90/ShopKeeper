import axios from 'axios';
import toast from 'react-hot-toast';

/** Same host as the page, so phone at http://192.168.x.x:5173 calls API at http://192.168.x.x:3001/api */
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:3001/api`;
  return 'http://localhost:3001/api';
}

const API_BASE_URL = getApiBaseUrl();

/** Request timeout (ms). Prevents hanging when server is unreachable. */
const REQUEST_TIMEOUT_MS = 30_000;

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** True when the error is due to network (no response, timeout, connection refused, etc.). */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const message = (error.message || '').toLowerCase();
  if (code === 'ERR_NETWORK' || code === 'ECONNABORTED') return true;
  if (!error.response && (message.includes('network') || message.includes('failed') || message.includes('timeout'))) return true;
  return false;
}

const AUTH_STORAGE_KEY = 'shoopkeeper_auth';

// ─── Retry config ────────────────────────────────────────────────────────────
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Request interceptor — attach token, shop ID, retry counter ───────────────
api.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { token?: string };
          if (parsed.token) config.headers.Authorization = `Bearer ${parsed.token}`;
        }
      } catch {
        // malformed storage — ignore
      }
    }
    const shopId = localStorage.getItem('currentShopId');
    if (shopId) (config.headers as any)['x-shop-id'] = shopId;
    (config as any).__retryCount = (config as any).__retryCount ?? 0;
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor — retry on network error, 401 redirect, toast ────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // 1. Network / timeout error → retry up to MAX_RETRIES times
    if (isNetworkError(error) && config && (config as any).__retryCount < MAX_RETRIES) {
      (config as any).__retryCount += 1;
      await wait(RETRY_DELAY_MS * (config as any).__retryCount); // back-off: 1s, 2s
      return api(config);
    }

    // 2. Still failing after retries (or hard network failure with no config)
    if (isNetworkError(error)) {
      if (typeof window !== 'undefined') {
        toast.error('Check your network connectivity.', {
          id: 'network-error',
          duration: 6000,
        });
      }
      const err = error as any;
      err.networkError = true;
      err.userMessage = 'Check your network connectivity.';
      return Promise.reject(error);
    }

    // 3. 401 — token expired or invalid → clear auth and redirect to sign-in
    if (error.response?.status === 401) {
      // If device is offline, keep local session and let app continue in offline mode.
      // This avoids forced sign-out when connectivity drops.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return Promise.reject(error);
      }

      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('currentShopId');
      delete (api.defaults.headers.common as Record<string, unknown>)['Authorization'];
      delete (api.defaults.headers.common as Record<string, unknown>)['x-shop-id'];
      if (typeof window !== 'undefined') toast.error('Session expired. Please log in again.');
      window.location.href = '/sign-in';
      return Promise.reject(error);
    }

    // 4. All other HTTP errors — let the caller handle them
    return Promise.reject(error);
  }
);

// API functions
export const authApi = {
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: { name?: string; email?: string }) => api.patch('/auth/me', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
  forgotPasswordRequest: (email: string) =>
    api.post<{ success: boolean; data: { message: string } }>('/auth/forgot-password-request', { email }),
  verifyForgotPasswordPin: (data: { email: string; pin: string }) =>
    api.post<{ success: boolean; data: { valid: boolean } }>('/auth/verify-forgot-password-pin', data),
  forgotPasswordReset: (data: { email: string; pin: string; newPassword: string }) =>
    api.post('/auth/forgot-password-reset', data),
};

export const shopsApi = {
  create: (data: any) => api.post('/shops', data),
  getMyShops: () => api.get('/shops/my-shops'),
  getById: (id: string) => api.get(`/shops/${id}`),
  update: (id: string, data: any) => api.patch(`/shops/${id}`, data),
  delete: (id: string) => api.delete(`/shops/${id}`),
  addMember: (data: { email: string; name?: string; password: string; role: string }) =>
    api.post('/shops/members', data),
  getMembers: () => api.get('/shops/members'),
  removeMember: (userId: string) => api.delete(`/shops/members/${userId}`),
  transferOwnership: (data: { newOwnerUserId: string }) =>
    api.post('/shops/transfer-ownership', data),
  requestClearDataPin: (password: string) =>
    api.post<{ success: boolean; data: { message: string } }>('/shops/request-clear-data-pin', { password }),
  confirmDashboardEdit: (pin: string) =>
    api.post<{ success: boolean; data: { dashboardEditToken: string; expiresIn: number } }>('/shops/confirm-dashboard-edit', { pin }),
  clearDashboardData: (dashboardEditToken: string) =>
    api.post<{ success: boolean; data: { cleared: boolean } }>('/shops/clear-dashboard-data', {}, {
      headers: { 'X-Dashboard-Edit-Token': dashboardEditToken },
    }),
  resetDashboardView: (dashboardEditToken: string) =>
    api.post<{ success: boolean; data: { reset: boolean } }>('/shops/reset-dashboard-view', {}, {
      headers: { 'X-Dashboard-Edit-Token': dashboardEditToken },
    }),
};

export const inventoryApi = {
  getProducts: (params?: any) => api.get('/inventory/products', { params }),
  getProduct: (id: string) => api.get(`/inventory/products/${id}`),
  getProductByBarcode: (barcode: string) => api.get(`/inventory/products/barcode/${barcode}`),
  checkDuplicate: (params: { barcode?: string; name?: string }) =>
    api.get('/inventory/products/check-duplicate', { params }),
  createProduct: (data: any) => api.post('/inventory/products', data),
  updateProduct: (id: string, data: any) => api.patch(`/inventory/products/${id}`, data),
  receiveStock: (id: string, data: { quantity: number; note?: string; unit_cost?: number }) =>
    api.post(`/inventory/products/${id}/receive-stock`, data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`),
  restoreProduct: (id: string) => api.post(`/inventory/products/${id}/restore`),
  getLowStock: () => api.get('/inventory/products/low-stock'),
  getCategories: () => api.get('/inventory/categories'),
  createCategory: (data: any) => api.post('/inventory/categories', data),
};

export const salesApi = {
  create: (data: any) => api.post('/sales', data),
  getSales: (params?: any) => api.get('/sales', { params }),
  getSale: (id: string) => api.get(`/sales/${id}`),
  getSummary: (params?: any) => api.get('/sales/summary', { params }),
  getGoodsSoldSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<{ success: boolean; data: Array<{
      productId: string;
      productName: string;
      grossSoldQty: number;
      returnedQty: number;
      netSoldQty: number;
      revenueGross: number;
      costTotal: number;
      avgCost: number;
      netProfit: number;
      costBreakdown: Array<{ quantity: number; unitCost: number }>;
    }> }>('/sales/goods-sold-summary', { params }),
  cancelSale: (id: string) => api.post(`/sales/${id}/cancel`),
  returnItem: (id: string, data: { sale_item_id: string; quantity: number; reason?: string }) =>
    api.post(`/sales/${id}/return-item`, data),
  partialRefund: (id: string, data: { amount: number; reason?: string }) =>
    api.post(`/sales/${id}/partial-refund`, data),
};

export const customersApi = {
  create: (data: any) => api.post('/customers', data),
  getCustomers: (params?: any) => api.get('/customers', { params }),
  getCustomer: (id: string) => api.get(`/customers/${id}`),
  update: (id: string, data: any) => api.patch(`/customers/${id}`, data),
  recordPayment: (
    id: string,
    payload: { amount: number; payment_method: 'cash' | 'mobile_money' | 'bank_transfer' | 'card'; notes?: string }
  ) => api.post(`/customers/${id}/record-payment`, payload),
  getCreditSummary: () => api.get<{ success: boolean; data: CreditSummary }>('/customers/credit-summary'),
};

export interface CreditSummary {
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
}

export const expensesApi = {
  create: (data: any) => api.post('/expenses', data),
  getExpenses: (params?: { startDate?: string; endDate?: string; category_id?: string }) =>
    api.get('/expenses', { params }),
  getCategories: () => api.get('/expenses/categories'),
  createCategory: (data: { name: string; description?: string }) =>
    api.post('/expenses/categories', data),
};

export const reportsApi = {
  getDashboardStats: (params?: any) => api.get('/reports/dashboard', { params }),
  getSalesIntelligence: (params?: any) => api.get('/reports/sales-intelligence', { params }),
  getInventoryFinance: (params?: { days?: number }) => api.get('/reports/inventory-finance', { params }),
  getExpensesProfit: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/reports/expenses-profit', { params }),
  getComplianceExport: (params: {
    type: 'daily' | 'weekly' | 'monthly' | 'pl' | 'tax';
    date?: string;
    week?: string;
    month?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get<{ success: boolean; data: ComplianceExportData }>('/reports/compliance-export', { params }),
};

export interface ShiftSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string | null;
  opening_cash: number;
  expected_cash?: number | null;
  closing_cash?: number | null;
  discrepancy?: number | null;
  status: 'open' | 'closed' | 'approved' | 'rejected';
  notes?: string | null;
}

export interface CashDiscrepancy {
  id: string;
  shift_id: string;
  user_id: string;
  amount: number;
  reason?: string | null;
  status: 'open' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  before_json?: unknown;
  after_json?: unknown;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface StockSnapshot {
  id: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_key: string;
  locked: boolean;
  notes?: string | null;
  created_by: string;
  created_at: string;
  itemsCount?: number;
}

export interface StockMovement {
  id: string;
  product_id?: string | null;
  product_name: string;
  movement_type: string;
  quantity_before?: number | null;
  quantity_change: number;
  quantity_after?: number | null;
  reason_code?: string | null;
  reason_note?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  created_by: string;
  created_at: string;
}

export interface StockVariance {
  id: string;
  product_id?: string | null;
  product_name: string;
  expected_qty: number;
  counted_qty: number;
  variance_qty: number;
  unit_cost: number;
  variance_value: number;
  variance_percent: number;
  severity: 'minor' | 'moderate' | 'critical' | 'severe';
  reason_code: string;
  reason_note?: string | null;
  evidence_url?: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'auto_approved';
  approval_level: 'auto' | 'supervisor' | 'owner';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_by: string;
  created_at: string;
}

export interface StockCountSession {
  id: string;
  title: string;
  scope_type: 'all' | 'category' | 'section' | 'product_list';
  scope_value?: string | null;
  status: 'open' | 'submitted' | 'reconciliation_required' | 'completed' | 'cancelled';
  started_by: string;
  started_at: string;
  submitted_at?: string | null;
  completed_at?: string | null;
}

export interface StockCountItem {
  id: string;
  session_id: string;
  product_id: string;
  product_name: string;
  expected_qty: number;
  counted_qty_primary?: number | null;
  counted_qty_secondary?: number | null;
  requires_verification: boolean;
  verification_status: 'not_required' | 'pending_second_count' | 'matched' | 'mismatch';
  counted_by_primary?: string | null;
  counted_by_secondary?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface StockLocation {
  id: string;
  name: string;
  location_type: string;
  is_active: boolean;
  created_at: string;
}

export interface StockLocationBalance {
  id: string;
  location_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  location?: { id: string; name: string; location_type: string };
  product?: { id: string; name: string; barcode?: string; sku?: string };
}

export interface StockTransfer {
  id: string;
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  quantity: number;
  notes?: string | null;
  status: string;
  created_at: string;
  fromLocation?: { id: string; name: string; location_type: string };
  toLocation?: { id: string; name: string; location_type: string };
  product?: { id: string; name: string; barcode?: string; sku?: string };
}

export const controlsApi = {
  startShift: (data: { opening_cash: number; notes?: string }) =>
    api.post<{ success: boolean; data: ShiftSession }>('/controls/shifts/start', data),
  endShift: (id: string, data: { closing_cash: number; notes?: string }) =>
    api.post<{ success: boolean; data: { shift: ShiftSession; discrepancy?: CashDiscrepancy | null } }>(`/controls/shifts/${id}/end`, data),
  getShifts: (params?: { userId?: string; status?: string; limit?: number }) =>
    api.get<{ success: boolean; data: ShiftSession[] }>('/controls/shifts', { params }),
  getDiscrepancies: (params?: { status?: string }) =>
    api.get<{ success: boolean; data: CashDiscrepancy[] }>('/controls/discrepancies', { params }),
  reviewDiscrepancy: (id: string, data: { status: 'approved' | 'rejected'; reason?: string }) =>
    api.post<{ success: boolean; data: CashDiscrepancy }>(`/controls/discrepancies/${id}/review`, data),
  getAuditLogs: (params?: { userId?: string; action?: string; limit?: number }) =>
    api.get<{ success: boolean; data: AuditLog[] }>('/controls/audit-logs', { params }),
  createStockSnapshot: (data: { periodType: 'daily' | 'weekly' | 'monthly'; periodKey?: string; notes?: string }) =>
    api.post<{ success: boolean; data: StockSnapshot }>('/controls/stock/snapshots', data),
  getStockSnapshots: (params?: { limit?: number }) =>
    api.get<{ success: boolean; data: StockSnapshot[] }>('/controls/stock/snapshots', { params }),
  getStockMovements: (params?: { productId?: string; limit?: number }) =>
    api.get<{ success: boolean; data: StockMovement[] }>('/controls/stock/movements', { params }),
  getStockVariances: (params?: { status?: string; severity?: string; limit?: number }) =>
    api.get<{ success: boolean; data: StockVariance[] }>('/controls/stock/variances', { params }),
  recordStockVariance: (data: {
    productId: string;
    countedQty: number;
    expectedQty?: number;
    reasonCode: string;
    reasonNote?: string;
    evidenceUrl?: string;
  }) => api.post<{ success: boolean; data: StockVariance }>('/controls/stock/variances', data),
  reviewStockVariance: (id: string, data: { status: 'approved' | 'rejected'; note?: string }) =>
    api.post<{ success: boolean; data: StockVariance }>(`/controls/stock/variances/${id}/review`, data),
  getStockConfig: () =>
    api.get<{
      success: boolean;
      data: {
        reasonCodes: Record<string, string[]>;
        thresholds: {
          autoApprove: { maxUnitsExclusive: number; maxValueExclusive: number };
          ownerReview: { minUnitsInclusive: number; minValueExclusive: number };
        };
        severity: Record<string, string>;
      };
    }>('/controls/stock/config'),
  startStockCountSession: (data: {
    title?: string;
    scopeType?: 'all' | 'category' | 'section' | 'product_list';
    scopeValue?: string;
  }) => api.post<{ success: boolean; data: StockCountSession }>('/controls/stock/count-sessions', data),
  getStockCountSessions: (params?: { limit?: number }) =>
    api.get<{ success: boolean; data: StockCountSession[] }>('/controls/stock/count-sessions', { params }),
  getStockCountProgress: (id: string) =>
    api.get<{
      success: boolean;
      data: {
        session: StockCountSession;
        totalProducts: number;
        countedProducts: number;
        remainingProducts: number;
        progressPercent: number;
        mismatches: number;
        pendingSecondCount: number;
        progressText: string;
      };
    }>(`/controls/stock/count-sessions/${id}/progress`),
  getStockCountItems: (id: string) =>
    api.get<{ success: boolean; data: StockCountItem[] }>(`/controls/stock/count-sessions/${id}/items`),
  recordStockCountItem: (id: string, data: { productId: string; countedQty: number; photoUrl?: string; notes?: string }) =>
    api.post<{ success: boolean; data: StockCountItem }>(`/controls/stock/count-sessions/${id}/items`, data),
  submitStockCountSession: (id: string) =>
    api.post<{ success: boolean; data: { session: StockCountSession; variancesCreated: number; needsReconciliation: boolean } }>(
      `/controls/stock/count-sessions/${id}/submit`
    ),
  getStockReminders: (params?: { thresholdDays?: number }) =>
    api.get<{ success: boolean; data: Array<{ type: string; message: string; severity: 'info' | 'warning'; daysSinceLastCount?: number }> }>(
      '/controls/stock/reminders',
      { params }
    ),
  createStockLocation: (data: { name: string; locationType?: string }) =>
    api.post<{ success: boolean; data: StockLocation }>('/controls/stock/locations', data),
  getStockLocations: () =>
    api.get<{ success: boolean; data: StockLocation[] }>('/controls/stock/locations'),
  setLocationBalance: (data: { locationId: string; productId: string; quantity: number }) =>
    api.put<{ success: boolean; data: StockLocationBalance }>('/controls/stock/location-balances', data),
  getLocationBalances: (params?: { locationId?: string }) =>
    api.get<{ success: boolean; data: StockLocationBalance[] }>('/controls/stock/location-balances', { params }),
  createStockTransfer: (data: { fromLocationId: string; toLocationId: string; productId: string; quantity: number; notes?: string }) =>
    api.post<{ success: boolean; data: StockTransfer }>('/controls/stock/transfers', data),
  getStockTransfers: (params?: { limit?: number }) =>
    api.get<{ success: boolean; data: StockTransfer[] }>('/controls/stock/transfers', { params }),
  recordSupplierDelivery: (data: {
    supplierName: string;
    invoiceNumber?: string;
    productId: string;
    expectedQuantity: number;
    receivedQuantity: number;
    unitCost?: number;
    deliveryPersonName?: string;
    deliverySignature?: string;
    photoUrl?: string;
    notes?: string;
    locationId?: string;
  }) => api.post('/controls/stock/supplier-deliveries', data),
  getSupplierScorecard: (params?: { supplierName?: string }) =>
    api.get<{
      success: boolean;
      data: Array<{
        supplierName: string;
        deliveryAccuracyPercent: number;
        averageShortagePercent: number;
        deliveries: number;
        perfectDeliveries: number;
        shortDeliveries: number;
      }>;
    }>('/controls/stock/supplier-scorecard', { params }),
  getPatternAlerts: () =>
    api.get<{
      success: boolean;
      data: Array<{ type: string; severity: 'info' | 'warning' | 'critical'; message: string; metadata?: Record<string, unknown> }>;
    }>('/controls/stock/pattern-alerts'),
  getPermissions: (userId: string, role?: string) =>
    api.get<{ success: boolean; data: { defaults: string[]; overrides: Record<string, boolean> } }>(`/controls/permissions/${userId}`, {
      params: role ? { role } : undefined,
    }),
  setPermissions: (userId: string, entries: Array<{ permissionKey: string; allowed: boolean }>) =>
    api.put<{ success: boolean; data: { updated: boolean } }>(`/controls/permissions/${userId}`, { entries }),
};

export interface ComplianceExportData {
  type: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  totalTransactions: number;
  paymentMethodBreakdown?: Record<string, number>;
  expensesByCategory?: Array<{ categoryName: string; amount: number; count: number }>;
  dailyNetProfit?: Array<{ date: string; revenue: number; expenses: number; profit: number }>;
  monthlyTrend?: Array<{ monthLabel: string; revenue: number; expenses: number; profit: number }>;
}

export const walletsApi = {
  getWallets: () => api.get('/wallets'),
  getTransactions: (params?: { walletId?: string }) => api.get('/wallets/transactions', { params }),
  adjust: (data: { wallet_id: string; amount: number; type: 'inflow' | 'outflow'; description?: string }) =>
    api.post('/wallets/adjust', data),
  transfer: (data: { from_wallet_id: string; to_wallet_id: string; amount: number; description?: string }) =>
    api.post('/wallets/transfer', data),
};

export const dailyCloseApi = {
  create: (data: { close_date?: string; expected_cash: number; actual_cash: number; notes?: string }) =>
    api.post('/daily-close', data),
  getRecent: () => api.get('/daily-close'),
  getByDate: (date: string) => api.get('/daily-close/by-date', { params: { date } }),
  approve: (id: string) => api.post(`/daily-close/${id}/approve`),
  reject: (id: string) => api.post(`/daily-close/${id}/reject`),
};

export const paymentsApi = {
  initializePaystack: (data: {
    amount: number;
    email: string;
    purpose?: 'subscription' | 'topup' | 'invoice' | 'order';
    metadata?: Record<string, unknown>;
  }) => api.post<{ success: boolean; data: { authorization_url: string; access_code: string; reference: string } }>(
    '/payments/paystack/initialize',
    data
  ),
  verifyPaystack: (reference: string) =>
    api.post<{ success: boolean; data?: { payment?: Record<string, unknown> }; error?: { message: string } }>(
      '/payments/paystack/verify',
      { reference }
    ),
};

export interface SubscriptionPlan {
  code: 'small' | 'medium' | 'big' | 'enterprise';
  name: string;
  monthlyAmount: number;
  yearlyAmount: number;
  yearlyDiscountPercent: number;
  currency: string;
  interval: 'monthly';
}

export interface SubscriptionStatus {
  hasPlan: boolean;
  status: 'inactive' | 'active' | 'past_due' | 'expired' | 'cancelled';
  isActive: boolean;
  planCode?: SubscriptionPlan['code'];
  planName?: string;
  amount?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'yearly';
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}

export const subscriptionsApi = {
  getPlans: () =>
    api.get<{ success: boolean; data: SubscriptionPlan[] }>('/subscriptions/plans'),
  getStatus: () =>
    api.get<{ success: boolean; data: SubscriptionStatus }>('/subscriptions/status'),
  initialize: (data: { planCode: SubscriptionPlan['code']; billingCycle?: 'monthly' | 'yearly'; email?: string }) =>
    api.post<{ success: boolean; data: { authorization_url: string; reference: string } }>(
      '/subscriptions/initialize',
      data
    ),
  verify: (reference: string) =>
    api.post<{ success: boolean; data: SubscriptionStatus; error?: { message?: string } }>(
      '/subscriptions/verify',
      { reference }
    ),
};

// Helper to set auth token from custom auth
export function setAuthToken(token: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// Helper to set shop ID
export function setShopId(shopId: string) {
  localStorage.setItem('currentShopId', shopId);
  api.defaults.headers.common['x-shop-id'] = shopId;
}

export function clearShopId() {
  localStorage.removeItem('currentShopId');
  delete (api.defaults.headers.common as Record<string, unknown>)['x-shop-id'];
}

export function getShopId(): string | null {
  return localStorage.getItem('currentShopId');
}
