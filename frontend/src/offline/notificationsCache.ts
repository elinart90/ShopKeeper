import { offlineDb, type AppNotification, type NotifType } from './db';

export async function addNotification(
  notif: Omit<AppNotification, 'id' | 'read' | 'createdAt'>,
): Promise<void> {
  if (notif.notifId) {
    const existing = await offlineDb.notifications.where('notifId').equals(notif.notifId).count();
    if (existing > 0) return;
  }
  await offlineDb.notifications.add({
    ...notif,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

export async function markNotifRead(notifId: string): Promise<void> {
  await offlineDb.notifications.where('notifId').equals(notifId).modify({ read: true });
}

export async function markAllNotifsRead(shopId: string): Promise<void> {
  await offlineDb.notifications.where('shopId').equals(shopId).modify({ read: true });
}

export async function dismissNotification(notifId: string): Promise<void> {
  await offlineDb.notifications.where('notifId').equals(notifId).delete();
}

export async function clearReadNotifications(shopId: string): Promise<void> {
  await offlineDb.notifications
    .where('shopId').equals(shopId)
    .filter(n => n.read)
    .delete();
}

/** Check Dexie products cache for items at or below min_stock_level and create notifications. */
export async function checkLowStockNotifications(shopId: string): Promise<void> {
  const products = await offlineDb.productsCache
    .where('shopId').equals(shopId)
    .filter(p => p.is_active && p.min_stock_level > 0 && p.stock_quantity <= p.min_stock_level)
    .toArray();

  const today = new Date().toISOString().slice(0, 10);

  for (const product of products) {
    await addNotification({
      notifId: `low-stock-${product.productId}-${today}`,
      type: 'low_stock',
      title: 'Low Stock Alert',
      message: `${product.name} is running low — ${product.stock_quantity} ${product.unit || 'units'} left (min: ${product.min_stock_level})`,
      shopId,
      meta: {
        productId: product.productId,
        quantity: product.stock_quantity,
        minLevel: product.min_stock_level,
      },
    });
  }
}

/** Check credit customers that are at or over their credit limit and create notifications. */
export async function checkCreditNotifications(
  shopId: string,
  customers: Array<{ id: string; name: string; credit_balance: number; credit_limit: number }>,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  for (const customer of customers) {
    if (customer.credit_balance <= 0) continue;

    const isOverLimit =
      customer.credit_limit > 0 && customer.credit_balance >= customer.credit_limit;
    const isHighBalance =
      customer.credit_limit === 0 && customer.credit_balance >= 500;

    if (!isOverLimit && !isHighBalance) continue;

    await addNotification({
      notifId: `credit-${customer.id}-${today}`,
      type: 'overdue_credit',
      title: 'Credit Limit Reached',
      message: isOverLimit
        ? `${customer.name} has reached their credit limit — GHS ${customer.credit_balance.toFixed(2)} of GHS ${customer.credit_limit.toFixed(2)}`
        : `${customer.name} has a high outstanding balance — GHS ${customer.credit_balance.toFixed(2)}`,
      shopId,
      meta: {
        customerId: customer.id,
        balance: customer.credit_balance,
        limit: customer.credit_limit,
      },
    });
  }
}

export type { AppNotification, NotifType };
