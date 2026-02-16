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
  receiveStock: (id: string, data: { quantity: number; note?: string }) =>
    api.post(`/inventory/products/${id}/receive-stock`, data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`),
  getLowStock: () => api.get('/inventory/products/low-stock'),
  getCategories: () => api.get('/inventory/categories'),
  createCategory: (data: any) => api.post('/inventory/categories', data),
};

export const salesApi = {
  create: (data: any) => api.post('/sales', data),
  getSales: (params?: any) => api.get('/sales', { params }),
  getSale: (id: string) => api.get(`/sales/${id}`),
  getSummary: (params?: any) => api.get('/sales/summary', { params }),
  cancelSale: (id: string) => api.post(`/sales/${id}/cancel`),
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
    type: 'daily' | 'monthly' | 'pl' | 'tax';
    date?: string;
    month?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get<{ success: boolean; data: ComplianceExportData }>('/reports/compliance-export', { params }),
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
