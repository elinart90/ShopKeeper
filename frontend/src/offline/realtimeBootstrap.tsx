import { useContext, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { ShopContext } from '../contexts/ShopContext';
import { useAuth } from '../contexts/useAuth';
import { supabase } from '../lib/supabase';
import { addNotification } from './notificationsCache';

const AUTH_STORAGE_KEY = 'shoopkeeper_auth';

/**
 * Mounts Supabase Realtime subscriptions for the current shop.
 * Fires in-app notifications + toasts for:
 *   - New sales completed by other cashiers (INSERT on `sales`)
 *   - Product stock dropping to / below min_stock_level (UPDATE on `products`)
 *
 * No-ops silently when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.
 *
 * Dispatch a CustomEvent `sk:realtime-status` on window with `{ connected: boolean }`
 * to let UI components (e.g. NotificationBell) show a live indicator.
 */
export default function RealtimeBootstrap() {
  const shopCtx = useContext(ShopContext);
  const { user } = useAuth();
  const shopId = shopCtx?.currentShop?.id;
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!supabase || !shopId) return;

    // Authenticate the Supabase Realtime connection with the app's JWT.
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    if (token) supabase.realtime.setAuth(token);

    // ── Sales channel ────────────────────────────────────────────────────────
    const salesCh = supabase
      .channel(`sk-sales:${shopId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales', filter: `shop_id=eq.${shopId}` },
        (payload) => {
          const sale = payload.new as Record<string, any>;

          // Skip sales the current user just submitted (optimistic update already handled it)
          if (user?.id && sale.created_by === user.id) return;

          const amount = Number(sale.final_amount ?? 0).toFixed(2);
          const cashier = (sale.cashier_name as string | undefined) ?? 'A cashier';

          addNotification({
            notifId: `new-sale-${sale.id as string}`,
            type: 'new_sale',
            title: 'New Sale Completed',
            message: `${cashier} completed a GHS ${amount} sale`,
            shopId,
            meta: { saleId: sale.id, amount: sale.final_amount },
          }).catch(() => {});

          toast.success(`New sale — GHS ${amount}`, { duration: 3000 });
        },
      )
      .on('system', {}, (status) => {
        window.dispatchEvent(
          new CustomEvent('sk:realtime-status', { detail: { connected: status === 'SUBSCRIBED' } }),
        );
      })
      .subscribe();

    // ── Products channel ─────────────────────────────────────────────────────
    const productsCh = supabase
      .channel(`sk-products:${shopId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `shop_id=eq.${shopId}` },
        (payload) => {
          const p = payload.new as Record<string, any>;
          if (!p.is_active) return;

          const minLevel = Number(p.min_stock_level ?? 0);
          const qty = Number(p.stock_quantity ?? 0);
          if (minLevel <= 0 || qty > minLevel) return;

          const today = new Date().toISOString().slice(0, 10);
          addNotification({
            notifId: `low-stock-${p.id as string}-${today}`,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${p.name as string} is running low — ${qty} ${(p.unit as string) || 'units'} left`,
            shopId,
            meta: { productId: p.id, quantity: qty, minLevel },
          }).catch(() => {});
        },
      )
      .subscribe();

    channelsRef.current = [salesCh, productsCh];

    return () => {
      channelsRef.current.forEach((ch) => supabase?.removeChannel(ch));
      channelsRef.current = [];
      window.dispatchEvent(
        new CustomEvent('sk:realtime-status', { detail: { connected: false } }),
      );
    };
  }, [shopId, user?.id]);

  return null;
}