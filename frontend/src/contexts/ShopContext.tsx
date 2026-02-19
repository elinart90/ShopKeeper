import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { shopsApi, setShopId, clearShopId, getShopId } from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth';

interface Shop {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  role?: string;
}

interface ShopContextType {
  currentShop: Shop | null;
  shops: Shop[];
  loading: boolean;
  lastError: string | null;
  selectShop: (shop: Shop) => void;
  refreshShops: () => Promise<void>;
  deleteShop: (shopId: string) => Promise<void>;
}

export const ShopContext = createContext<ShopContextType | undefined>(undefined);

// Cache shops in localStorage
const SHOPS_CACHE_KEY = 'shoopkeeper_shops_cache';

function getCachedShops(): Shop[] {
  try {
    const cached = localStorage.getItem(SHOPS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function setCachedShops(shops: Shop[]) {
  try {
    localStorage.setItem(SHOPS_CACHE_KEY, JSON.stringify(shops));
  } catch (err) {
    console.warn('Failed to cache shops', err);
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const selectShop = (shop: Shop) => {
    setCurrentShop(shop);
    setShopId(shop.id);
    localStorage.setItem('currentShopId', shop.id);
  };

  const deleteShop = async (shopId: string) => {
    try {
      await shopsApi.delete(shopId);
      if (currentShop?.id === shopId) {
        setCurrentShop(null);
        clearShopId();
      }
      await refreshShops();
      toast.success('Store deleted permanently');
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message || 'Failed to delete store';
      toast.error(msg);
    }
  };

  const refreshShops = async () => {
    try {
      if (!user) return;
      
      setLoading(true);
      setLastError(null);
      
      // CRITICAL FIX: If offline, use cached shops
      if (!navigator.onLine) {
        console.log('📴 Offline - loading shops from cache');
        const cachedShops = getCachedShops();
        setShops(cachedShops);
        
        const savedShopId = getShopId();
        const shopToSelect = savedShopId
          ? cachedShops.find((s: Shop) => String(s.id) === String(savedShopId))
          : null;
        
        if (shopToSelect) {
          selectShop(shopToSelect);
        }
        
        setLoading(false);
        return;
      }
      
      // Online - fetch from server
      const response = await shopsApi.getMyShops();
      const userShops = response.data.data || [];
      setShops(userShops);
      setCachedShops(userShops); // Cache for offline use

      const savedShopId = getShopId();
      const shopToSelect = savedShopId
        ? userShops.find((s: Shop) => String(s.id) === String(savedShopId))
        : null;

      if (shopToSelect) {
        selectShop(shopToSelect);
      } else {
        setCurrentShop(null);
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.error?.message || error.message || 'Unknown error';
      const status = error?.response?.status;
      
      // CRITICAL FIX: Only clear shops on 401, otherwise use cache
      if (status === 401) {
        setLastError('Please sign in again');
        toast.error('Please sign in again');
        setShops([]);
        setCurrentShop(null);
      } else {
        // Network error or other error - use cached shops
        console.log('📴 Failed to fetch shops - using cache');
        const cachedShops = getCachedShops();
        if (cachedShops.length > 0) {
          setShops(cachedShops);
          const savedShopId = getShopId();
          const shopToSelect = savedShopId
            ? cachedShops.find((s: Shop) => String(s.id) === String(savedShopId))
            : null;
          if (shopToSelect) {
            selectShop(shopToSelect);
          }
          toast('Using cached shops - offline mode', { icon: '📴' });
        } else {
          setLastError(errMsg);
          if (status !== 402) {
            toast.error('Failed to load shops');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setShops([]);
      setCurrentShop(null);
      setLastError(null);
      setLoading(false);
      return;
    }
    refreshShops();
  }, [user, authLoading]);

  return (
    <ShopContext.Provider
      value={{
        currentShop,
        shops,
        loading,
        lastError,
        selectShop,
        refreshShops,
        deleteShop,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}
