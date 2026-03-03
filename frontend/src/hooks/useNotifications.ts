import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '../offline/db';
import { markNotifRead, markAllNotifsRead, dismissNotification } from '../offline/notificationsCache';

export function useNotifications(shopId: string | undefined) {
  const notifications = useLiveQuery(
    async () => {
      if (!shopId) return [];
      const all = await offlineDb.notifications.where('shopId').equals(shopId).toArray();
      // Guard against accidental duplicate notifId rows from previous builds/races.
      // Keep the newest row per notifId so UI keys remain unique and stable.
      const deduped = new Map<string, (typeof all)[number]>();
      for (const n of all) {
        const existing = deduped.get(n.notifId);
        if (!existing || String(n.createdAt).localeCompare(String(existing.createdAt)) > 0) {
          deduped.set(n.notifId, n);
        }
      }
      return Array.from(deduped.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 80);
    },
    [shopId],
    [],
  );

  const unreadCount = (notifications ?? []).filter(n => !n.read).length;

  return {
    notifications: notifications ?? [],
    unreadCount,
    markRead: (notifId: string) => markNotifRead(notifId),
    markAllRead: () => (shopId ? markAllNotifsRead(shopId) : Promise.resolve()),
    dismiss: (notifId: string) => dismissNotification(notifId),
  };
}