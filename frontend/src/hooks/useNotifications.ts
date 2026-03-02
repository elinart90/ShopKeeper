import { useLiveQuery } from 'dexie-react-hooks';
import { offlineDb } from '../offline/db';
import { markNotifRead, markAllNotifsRead, dismissNotification } from '../offline/notificationsCache';

export function useNotifications(shopId: string | undefined) {
  const notifications = useLiveQuery(
    async () => {
      if (!shopId) return [];
      const all = await offlineDb.notifications.where('shopId').equals(shopId).toArray();
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80);
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