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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { user: AuthUser; token: string };
        setUser(parsed.user);
        setToken(parsed.token);
        setAuthToken(parsed.token);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const saveAuth = (newUser: AuthUser, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    setAuthToken(newToken);
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ user: newUser, token: newToken })
    );
  };

  const login: AuthContextType['login'] = async ({ email, password }) => {
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
      throw new Error(body?.error?.message || body?.message || 'Invalid email or password');
    }

    const body = await res.json();
    const { user: newUser, token: newToken } = body.data;
    saveAuth(newUser, newToken);
  };

  const register: AuthContextType['register'] = async ({ name, email, password }) => {
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
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('currentShopId');
  };

  const refreshUser = async () => {
    if (!token) return;
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
          const stored = localStorage.getItem(AUTH_STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as { user: AuthUser; token: string };
              localStorage.setItem(
                AUTH_STORAGE_KEY,
                JSON.stringify({ user: newUser, token: parsed.token })
              );
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const setUserFromProfile = (newUser: AuthUser) => {
    setUser(newUser);
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { user: AuthUser; token: string };
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ user: newUser, token: parsed.token })
        );
      } catch {
        // ignore
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, setUserFromProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
