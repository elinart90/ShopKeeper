import Dexie, { type Table } from "dexie";

export type QueueStatus = "pending" | "processing" | "failed";

export interface SyncQueueItem {
  id?: number;
  opId: string;
  entity: "sale" | "inventory";
  action: "create" | "update" | "delete";
  method: "post" | "patch" | "delete";
  url: string;
  payload?: any;
  shopId?: string;
  dedupeKey?: string;
  status: QueueStatus;
  retries: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedProduct {
  key: string; // `${shopId}:${productId}`
  shopId: string;
  productId: string;
  name: string;
  barcode?: string;
  sku?: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  is_active: boolean;
  updatedAt: string;
}

export interface CachedDashboard {
  key: string; // `${shopId}:stats`
  shopId: string;
  data: any;
  savedAt: string;
}

export interface CachedCustomer {
  key: string; // `${shopId}:${customerId}`
  shopId: string;
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  updatedAt: string;
}

/** Key-value store used to pass credentials to the service worker (Background Sync). */
export interface SwConfigEntry {
  key: string;
  value: string;
}

export type NotifType = 'low_stock' | 'overdue_credit' | 'sync_error' | 'new_sale';

export interface AppNotification {
  id?: number;
  notifId: string;
  type: NotifType;
  title: string;
  message: string;
  shopId: string;
  read: boolean;
  createdAt: string;
  meta?: Record<string, any>;
}

class ShoopkeeperOfflineDB extends Dexie {
  syncQueue!: Table<SyncQueueItem, number>;
  productsCache!: Table<CachedProduct, string>;
  dashboardCache!: Table<CachedDashboard, string>;
  customersCache!: Table<CachedCustomer, string>;
  swConfig!: Table<SwConfigEntry, string>;
  notifications!: Table<AppNotification, number>;

  constructor() {
    super("shoopkeeper-offline-db");
    this.version(1).stores({
      syncQueue: "++id, opId, status, entity, action, shopId, dedupeKey, createdAt, updatedAt",
      productsCache: "key, shopId, productId, name, barcode, sku, updatedAt",
    });
    this.version(2).stores({
      syncQueue: "++id, opId, status, entity, action, shopId, dedupeKey, createdAt, updatedAt",
      productsCache: "key, shopId, productId, name, barcode, sku, updatedAt",
      dashboardCache: "key, shopId, savedAt",
      customersCache: "key, shopId, customerId, name, updatedAt",
    });
    this.version(3).stores({
      syncQueue: "++id, opId, status, entity, action, shopId, dedupeKey, createdAt, updatedAt",
      productsCache: "key, shopId, productId, name, barcode, sku, updatedAt",
      dashboardCache: "key, shopId, savedAt",
      customersCache: "key, shopId, customerId, name, updatedAt",
      swConfig: "key",
    });
    this.version(4).stores({
      syncQueue: "++id, opId, status, entity, action, shopId, dedupeKey, createdAt, updatedAt",
      productsCache: "key, shopId, productId, name, barcode, sku, updatedAt",
      dashboardCache: "key, shopId, savedAt",
      customersCache: "key, shopId, customerId, name, updatedAt",
      swConfig: "key",
      notifications: "++id, notifId, type, shopId, read, createdAt",
    });
  }
}

export const offlineDb = new ShoopkeeperOfflineDB();

export const QUEUE_CHANGED_EVENT = "shoopkeeper:queue-changed";

export function emitQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

export function makeOpId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}
