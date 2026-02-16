// src/app/routes/AppRoutes.tsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Welcome from "../../features/onboarding/pages/Welcome";
import Header from "../layouts/HeaderForSigninSignup";
import SignInPage from "../../features/auth/pages/SignInPage";
import SignUpPage from "../../features/auth/pages/SignUpPage";
import ForgotPasswordPage from "../../features/auth/pages/ForgotPasswordPage";
import Dashboard from "../../features/dashboard/pages/Home";
import DashboardEditPage from "../../features/dashboard/pages/DashboardEditPage";
import CreateShopPage from "../../features/shops/pages/CreateShopPage";
import NewSale from "../../features/sales/pages/NewSale";
import SaleDetailPage from "../../features/sales/pages/SaleDetailPage";
import InventoryList from "../../features/inventory/pages/InventoryList";
import AddProductPage from "../../features/inventory/pages/AddProductPage";
import EditProductPage from "../../features/inventory/pages/EditProductPage";
import ExpensesPage from "../../features/expenses/pages/ExpensesPage";
import PaymentCallbackPage from "../../features/payments/pages/PaymentCallbackPage";
import SubscriptionPage from "../../features/subscriptions/pages/SubscriptionPage";
import SubscriptionCallbackPage from "../../features/subscriptions/pages/SubscriptionCallbackPage";
import NotFoundPage from "../../features/error/pages/NotFoundPage";
import { useAuth } from "../../contexts/useAuth";
import { subscriptionsApi } from "../../lib/api";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

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
    subscriptionsApi
      .getStatus()
      .then((res) => {
        if (!active) return;
        setHasActiveSubscription(!!res.data?.data?.isActive);
      })
      .catch(() => {
        if (!active) return;
        setHasActiveSubscription(false);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

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

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      {/* Header shows on public pages */}
      <Routes>
        <Route path="*" element={<Header />} />
      </Routes>
      
      <Routes>
        {/* Public routes */}
        <Route 
          path="/" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Welcome />
          } 
        />
        
        <Route path="/sign-in" element={user ? <Navigate to="/dashboard" replace /> : <SignInPage />} />
        <Route path="/sign-up" element={user ? <Navigate to="/dashboard" replace /> : <SignUpPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route
          path="/subscription"
          element={
            <RequireAuth>
              <SubscriptionPage />
            </RequireAuth>
          }
        />
        <Route
          path="/subscription/callback"
          element={
            <RequireAuth>
              <SubscriptionCallbackPage />
            </RequireAuth>
          }
        />
        
        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <RequireAppAccess>
              <Dashboard />
            </RequireAppAccess>
          }
        />
        <Route
          path="/dashboard/edit"
          element={
            <RequireAppAccess>
              <DashboardEditPage />
            </RequireAppAccess>
          }
        />
        <Route
          path="/shops/create"
          element={
            <RequireAppAccess>
              <CreateShopPage />
            </RequireAppAccess>
          }
        />
        <Route 
          path="/sales/new" 
          element={
            <RequireAppAccess>
              <NewSale />
            </RequireAppAccess>
          } 
        />
        <Route 
          path="/sales/:id" 
          element={
            <RequireAppAccess>
              <SaleDetailPage />
            </RequireAppAccess>
          } 
        />
        
        <Route 
          path="/inventory" 
          element={
            <RequireAppAccess>
              <InventoryList />
            </RequireAppAccess>
          } 
        />
        <Route 
          path="/inventory/add" 
          element={
            <RequireAppAccess>
              <AddProductPage />
            </RequireAppAccess>
          } 
        />
        <Route 
          path="/inventory/:id/edit" 
          element={
            <RequireAppAccess>
              <EditProductPage />
            </RequireAppAccess>
          } 
        />
        <Route 
          path="/expenses" 
          element={
            <RequireAppAccess>
              <ExpensesPage />
            </RequireAppAccess>
          } 
        />
        <Route
          path="/payments/callback"
          element={
            <RequireAppAccess>
              <PaymentCallbackPage />
            </RequireAppAccess>
          }
        />
        
        {/* Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}