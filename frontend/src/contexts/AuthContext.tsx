import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { setAuthToken, getApiBaseUrl } from '../lib/api';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUserFromProfile: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'shoopkeeper_auth';

type StoredAuth = { user: AuthUser; token: string };

function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.user?.id || !parsed?.user?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredAuth(payload: StoredAuth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setUser(stored.user);
      setToken(stored.token);
      setAuthToken(stored.token);
    } else {
      clearStoredAuth();
    }
    setLoading(false);
  }, []);

  const saveAuth = (newUser: AuthUser, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    setAuthToken(newToken);
    writeStoredAuth({ user: newUser, token: newToken });
  };

  const login: AuthContextType['login'] = async ({ email, password }) => {
    // Check if offline - don't even try to login
    if (!navigator.onLine) {
      throw new Error('You are offline. Please connect to the internet to sign in.');
    }

    const apiUrl = getApiBaseUrl() + '/auth/login';
    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      throw new Error(
        'Cannot reach server. Make sure the backend is running (e.g. run "npm run dev" in the backend folder) and the URL is correct.'
      );
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error(body?.error?.message || body?.message || 'Invalid email or password');
      }
      if (res.status >= 500) {
        throw new Error('Server is unavailable. Please try again in a moment.');
      }
      throw new Error(body?.error?.message || body?.message || 'Sign in failed. Please try again.');
    }

    const body = await res.json();
    const { user: newUser, token: newToken } = body.data;
    saveAuth(newUser, newToken);
  };

  const register: AuthContextType['register'] = async ({ name, email, password }) => {
    // Check if offline - don't even try to register
    if (!navigator.onLine) {
      throw new Error('You are offline. Please connect to the internet to create an account.');
    }

    const apiUrl = getApiBaseUrl() + '/auth/register';
    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
    } catch (err) {
      throw new Error(
        'Cannot reach server. Make sure the backend is running (e.g. run "npm run dev" in the backend folder) and the URL is correct.'
      );
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || body?.message || 'Failed to register');
    }

    const body = await res.json();
    const { user: newUser, token: newToken } = body.data;
    saveAuth(newUser, newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken('');
    clearStoredAuth();
    localStorage.removeItem('currentShopId');
  };

  const refreshUser = async () => {
    if (!token) return;
    
    // CRITICAL FIX: If offline, don't try to refresh - just keep using cached user
    if (!navigator.onLine) {
      console.log('📴 Offline - using cached user data');
      return;
    }

    const apiUrl = getApiBaseUrl() + '/auth/me';
    try {
      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const body = await res.json();
        const newUser = body.data;
        if (newUser) {
          setUser(newUser);
          const stored = readStoredAuth();
          if (stored?.token) writeStoredAuth({ user: newUser, token: stored.token });
        }
      } else if (res.status === 401) {
        // Only log out on 401 (unauthorized) - token is actually invalid
        console.warn('Token invalid - logging out');
        logout();
      }
      // For other errors (500, network issues), keep the cached user
    } catch (err) {
      // CRITICAL FIX: Network error does NOT mean user is logged out
      // Just keep using the cached credentials
      console.log('📴 Network error during refresh - keeping cached user');
    }
  };

  const setUserFromProfile = (newUser: AuthUser) => {
    setUser(newUser);
    const stored = readStoredAuth();
    if (stored?.token) writeStoredAuth({ user: newUser, token: stored.token });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, setUserFromProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
