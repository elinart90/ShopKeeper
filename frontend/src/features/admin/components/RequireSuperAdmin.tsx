import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../../contexts/useAuth';
import { adminApi } from '../../../lib/api';

type RequireSuperAdminProps = {
  children: ReactNode;
};

export default function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    if (!user) {
      setChecking(false);
      setAllowed(false);
      return;
    }

    setChecking(true);
    adminApi
      .getMe()
      .then(() => {
        if (!active) return;
        setAllowed(true);
      })
      .catch(() => {
        if (!active) return;
        setAllowed(false);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, location.pathname]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/sign-in" replace state={{ from: location }} />;
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-amber-300 bg-amber-50 p-4 text-center">
          <h2 className="text-base font-semibold text-amber-900">Super Admin Access Required</h2>
          <p className="mt-2 text-sm text-amber-800">
            This account does not have platform admin access yet. Ask an existing super admin to grant your user role.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
