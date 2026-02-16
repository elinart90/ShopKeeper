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
      const response = await shopsApi.getMyShops();
      const userShops = response.data.data || [];
      setShops(userShops);

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
      setLastError(errMsg);
      console.error('Failed to fetch shops:', error);
      if (status === 401) {
        toast.error('Please sign in again');
      } else if (status !== 402) {
        toast.error('Failed to load shops');
      }
      setShops([]);
      setCurrentShop(null);
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
