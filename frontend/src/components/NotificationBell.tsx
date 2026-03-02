import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, CheckCheck, Package, CreditCard, WifiOff, ShoppingCart,
} from 'lucide-react';
import type { AppNotification, NotifType } from '../offline/db';
import { useNotifications } from '../hooks/useNotifications';
import { checkLowStockNotifications } from '../offline/notificationsCache';

function useRealtimeConnected() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => setConnected((e as CustomEvent<{ connected: boolean }>).detail.connected);
    window.addEventListener('sk:realtime-status', handler);
    return () => window.removeEventListener('sk:realtime-status', handler);
  }, []);
  return connected;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const TYPE_CFG: Record<NotifType, { Icon: React.ElementType; color: string; bg: string }> = {
  low_stock:      { Icon: Package,      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  overdue_credit: { Icon: CreditCard,   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  sync_error:     { Icon: WifiOff,      color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'   },
  new_sale:       { Icon: ShoppingCart, color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
};

function NotifItem({
  notif, onDismiss, onRead,
}: { notif: AppNotification; onDismiss: () => void; onRead: () => void }) {
  const cfg = TYPE_CFG[notif.type] ?? TYPE_CFG.sync_error;
  const { Icon } = cfg;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 transition-colors cursor-default"
      style={{
        background: notif.read ? 'transparent' : 'rgba(99,102,241,0.04)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        opacity: notif.read ? 0.65 : 1,
      }}
      onClick={() => { if (!notif.read) onRead(); }}
    >
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: cfg.bg }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            {notif.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {!notif.read && (
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
            )}
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {relativeTime(notif.createdAt)}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
          {notif.message}
        </p>
      </div>

      <button
        className="mt-0.5 shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        aria-label="Dismiss notification"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function NotificationBell({ shopId }: { shopId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications(shopId);
  const realtimeConnected = useRealtimeConnected();

  // Check low stock on mount and whenever shopId changes
  useEffect(() => {
    if (shopId) checkLowStockNotifications(shopId).catch(() => {});
  }, [shopId]);

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Prevent body scroll on mobile when panel is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[60] bg-black/40 md:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Panel — bottom sheet on mobile, dropdown on desktop */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={[
                // Mobile: fixed bottom sheet
                'fixed bottom-0 left-0 right-0 z-[61]',
                'rounded-t-2xl',
                // Desktop: absolute dropdown
                'md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-2',
                'md:w-96 md:rounded-xl',
                // Shared
                'flex flex-col overflow-hidden shadow-2xl',
                'bg-white dark:bg-gray-900',
                'border border-gray-200/60 dark:border-gray-700/60',
              ].join(' ')}
              style={{ maxHeight: '75vh' }}
            >
              {/* Mobile drag handle */}
              <div className="flex justify-center pt-2 pb-0 md:hidden">
                <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 leading-none">
                      {unreadCount} new
                    </span>
                  )}
                  {/* Realtime live dot */}
                  {realtimeConnected && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <CheckCheck className="h-3 w-3" />
                      All read
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="overflow-y-auto flex-1" style={{ overscrollBehavior: 'contain' }}>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                      <Bell className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      All caught up!
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                      You'll see low stock alerts, credit warnings, and sync issues here.
                    </p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <NotifItem
                      key={notif.notifId}
                      notif={notif}
                      onRead={() => markRead(notif.notifId)}
                      onDismiss={() => dismiss(notif.notifId)}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">
                    {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={async () => {
                      if (shopId) {
                        const { clearReadNotifications } = await import('../offline/notificationsCache');
                        await clearReadNotifications(shopId);
                      }
                    }}
                    className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    Clear read
                  </button>
                </div>
              )}

              {/* Safe area for iOS */}
              <div className="md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}