// src/app/routes/AppRoutes.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// ── Always-eager (tiny, needed on first paint) ────────────────────────────
import Header from "../layouts/HeaderForSigninSignup";
import RequireSuperAdmin from "../../features/admin/components/RequireSuperAdmin";
import { useAuth } from "../../contexts/useAuth";
import { authApi, shopsApi, subscriptionsApi } from "../../lib/api";

// ── Lazy-loaded page chunks ───────────────────────────────────────────────
// Auth / public
const Welcome                 = lazy(() => import("../../features/onboarding/pages/Welcome"));
const SignInPage               = lazy(() => import("../../features/auth/pages/SignInPage"));
const SignUpPage               = lazy(() => import("../../features/auth/pages/SignUpPage"));
const ForgotPasswordPage       = lazy(() => import("../../features/auth/pages/ForgotPasswordPage"));
const VerifyReceiptPage        = lazy(() => import("../../features/public/pages/VerifyReceiptPage"));
const SubscriptionPage         = lazy(() => import("../../features/subscriptions/pages/SubscriptionPage"));
const SubscriptionCallbackPage = lazy(() => import("../../features/subscriptions/pages/SubscriptionCallbackPage"));
const NotFoundPage             = lazy(() => import("../../features/error/pages/NotFoundPage"));

// Core app — highest priority (pre-warmed below)
const NewSale        = lazy(() => import("../../features/sales/pages/NewSale"));
const Dashboard      = lazy(() => import("../../features/dashboard/pages/Home"));
const InventoryList  = lazy(() => import("../../features/inventory/pages/InventoryList"));

// Secondary app pages
const DashboardEditPage  = lazy(() => import("../../features/dashboard/pages/DashboardEditPage"));
const CreateShopPage     = lazy(() => import("../../features/shops/pages/CreateShopPage"));
const SaleDetailPage     = lazy(() => import("../../features/sales/pages/SaleDetailPage"));
const AddProductPage     = lazy(() => import("../../features/inventory/pages/AddProductPage"));
const EditProductPage    = lazy(() => import("../../features/inventory/pages/EditProductPage"));
const ExpensesPage       = lazy(() => import("../../features/expenses/pages/ExpensesPage"));
const PaymentCallbackPage = lazy(() => import("../../features/payments/pages/PaymentCallbackPage"));
const SyncCenterPage     = lazy(() => import("../../features/sync/pages/SyncCenterPage"));

// Super-admin (large bundle — only loaded when navigating to /super-admin)
const SuperAdminLayout        = lazy(() => import("../../features/admin/pages/SuperAdminLayout"));
const AdminOverviewPage       = lazy(() => import("../../features/admin/pages/AdminOverviewPage"));
const AdminUsersPage          = lazy(() => import("../../features/admin/pages/AdminUsersPage"));
const AdminAiIntelligencePage = lazy(() => import("../../features/admin/pages/AdminAiIntelligencePage"));
const AdminTransactionsPage   = lazy(() => import("../../features/admin/pages/AdminTransactionsPage"));
const AdminUserDetailPage     = lazy(() => import("../../features/admin/pages/AdminUserDetailPage"));
const AdminShopsPage          = lazy(() => import("../../features/admin/pages/AdminShopsPage"));
const AdminShopDetailPage     = lazy(() => import("../../features/admin/pages/AdminShopDetailPage"));
const AdminAuditLogsPage      = lazy(() => import("../../features/admin/pages/AdminAuditLogsPage"));
const AdminSecurityPage       = lazy(() => import("../../features/admin/pages/AdminSecurityPage"));
const AdminMonetizationPage   = lazy(() => import("../../features/admin/pages/AdminMonetizationPage"));

// ── Shared loading fallback ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Pre-warm the 3 most-visited pages after the app shell loads ───────────
// This fires a background import so the chunks are in the browser cache
// before the user clicks, eliminating the waterfall delay entirely.
function PrewarmCriticalChunks() {
  useEffect(() => {
    // Stagger slightly so we don't compete with the current paint
    const t = window.setTimeout(() => {
      import("../../features/sales/pages/NewSale");
      import("../../features/dashboard/pages/Home");
      import("../../features/inventory/pages/InventoryList");
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return children;
}

function RequireSubscription({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setChecking(false);
      setHasActiveSubscription(false);
      return;
    }

    setChecking(true);
    (async () => {
      try {
        // Determine owner-vs-member from actual shop membership, not global users.role.
        // This avoids stale global role values forcing staff into subscription flow.
        const shopsRes = await shopsApi.getMyShops();
        if (!active) return;
        const myShops = (shopsRes.data?.data || []) as Array<{ role?: string }>;
        const actsAsOwner = myShops.some((s) => String(s?.role || "").toLowerCase() === "owner");
        if (!actsAsOwner) {
          setHasActiveSubscription(true);
          return;
        }

        const res = await subscriptionsApi.getStatus();
        if (!active) return;
        const isActive = !!res.data?.data?.isActive;
        if (isActive) {
          setHasActiveSubscription(true);
          return;
        }
        // Super-admins are exempt from subscription gating.
        const adminStatus = await authApi.getPlatformAdminStatus();
        if (!active) return;
        setHasActiveSubscription(!!adminStatus.data?.data?.isPlatformAdmin);
      } catch {
        if (!active) return;
        try {
          // If subscription status call fails, still allow active super-admins.
          const adminStatus = await authApi.getPlatformAdminStatus();
          if (!active) return;
          setHasActiveSubscription(!!adminStatus.data?.data?.isPlatformAdmin);
        } catch {
          if (!active) return;
          setHasActiveSubscription(false);
        }
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, location.pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasActiveSubscription) {
    return <Navigate to="/subscription" replace state={{ from: location }} />;
  }

  return children;
}

function RequireAppAccess({ children }: { children: ReactElement }) {
  return (
    <RequireAuth>
      <RequireSubscription>{children}</RequireSubscription>
    </RequireAuth>
  );
}

function AuthenticatedHomeRedirect() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [targetPath, setTargetPath] = useState("/dashboard");

  useEffect(() => {
    let active = true;

    if (!user) {
      setChecking(false);
      setTargetPath("/dashboard");
      return;
    }

    setChecking(true);
    authApi
      .getPlatformAdminStatus()
      .then((res) => {
        if (!active) return;
        setTargetPath(res.data?.data?.isPlatformAdmin ? "/super-admin" : "/dashboard");
      })
      .catch(() => {
        if (!active) return;
        setTargetPath("/dashboard");
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <Navigate to={targetPath} replace />;
}

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <PrewarmCriticalChunks />

      {/* Header shows on all pages */}
      <Routes>
        <Route path="*" element={<Header />} />
      </Routes>

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route
            path="/"
            element={user ? <AuthenticatedHomeRedirect /> : <Welcome />}
          />
          <Route path="/sign-in" element={user ? <AuthenticatedHomeRedirect /> : <SignInPage />} />
          <Route path="/sign-up" element={user ? <AuthenticatedHomeRedirect /> : <SignUpPage />} />
          <Route path="/forgot-password" element={user ? <AuthenticatedHomeRedirect /> : <ForgotPasswordPage />} />
          <Route path="/verify/:receiptRef" element={<VerifyReceiptPage />} />
          <Route
            path="/subscription"
            element={<RequireAuth><SubscriptionPage /></RequireAuth>}
          />
          <Route
            path="/subscription/callback"
            element={<RequireAuth><SubscriptionCallbackPage /></RequireAuth>}
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={<RequireAppAccess><Dashboard /></RequireAppAccess>}
          />
          <Route
            path="/dashboard/edit"
            element={<RequireAppAccess><DashboardEditPage /></RequireAppAccess>}
          />
          <Route
            path="/shops/create"
            element={<RequireAppAccess><CreateShopPage /></RequireAppAccess>}
          />
          <Route
            path="/sales/new"
            element={<RequireAppAccess><NewSale /></RequireAppAccess>}
          />
          <Route
            path="/sales/:id"
            element={<RequireAppAccess><SaleDetailPage /></RequireAppAccess>}
          />
          <Route
            path="/inventory"
            element={<RequireAppAccess><InventoryList /></RequireAppAccess>}
          />
          <Route
            path="/inventory/add"
            element={<RequireAppAccess><AddProductPage /></RequireAppAccess>}
          />
          <Route
            path="/inventory/:id/edit"
            element={<RequireAppAccess><EditProductPage /></RequireAppAccess>}
          />
          <Route
            path="/expenses"
            element={<RequireAppAccess><ExpensesPage /></RequireAppAccess>}
          />
          <Route
            path="/payments/callback"
            element={<RequireAppAccess><PaymentCallbackPage /></RequireAppAccess>}
          />
          <Route
            path="/sync-center"
            element={<RequireAppAccess><SyncCenterPage /></RequireAppAccess>}
          />

          {/* Super-admin area — entire bundle loaded only when needed */}
          <Route
            path="/super-admin"
            element={
              <RequireSuperAdmin>
                <SuperAdminLayout />
              </RequireSuperAdmin>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="ai-intelligence" element={<AdminAiIntelligencePage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="shops" element={<AdminShopsPage />} />
            <Route path="shops/:id" element={<AdminShopDetailPage />} />
            <Route path="security" element={<AdminSecurityPage />} />
            <Route path="monetization" element={<AdminMonetizationPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}