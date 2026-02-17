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

class ShoopkeeperOfflineDB extends Dexie {
  syncQueue!: Table<SyncQueueItem, number>;
  productsCache!: Table<CachedProduct, string>;

  constructor() {
    super("shoopkeeper-offline-db");
    this.version(1).stores({
      syncQueue: "++id, opId, status, entity, action, shopId, dedupeKey, createdAt, updatedAt",
      productsCache: "key, shopId, productId, name, barcode, sku, updatedAt",
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
