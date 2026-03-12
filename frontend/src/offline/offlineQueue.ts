import { api } from "../lib/api";
import { emitQueueChanged, makeOpId, offlineDb, type SyncQueueItem } from "./db";
import { addNotification } from "./notificationsCache";

let processingInFlight: Promise<{ processed: number }> | null = null;

// Items that fail this many times are marked 'dead' and never retried automatically.
const MAX_RETRIES = 5;

function isNetworkError(error: any) {
  if (!error) return false;
  if (error.networkError) return true;
  const code = error.code;
  const msg = String(error.message || "").toLowerCase();
  const status = error?.response?.status;
  // 503 Service Unavailable = Supabase/auth transiently down → keep pending, retry later.
  if (status === 503) return true;
  return code === "ERR_NETWORK" || code === "ECONNABORTED" || msg.includes("network") || msg.includes("timeout");
}

export async function enqueueOperation(input: Omit<SyncQueueItem, "id" | "opId" | "status" | "retries" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const op: SyncQueueItem = {
    ...input,
    opId: makeOpId(input.entity),
    status: "pending",
    retries: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (op.dedupeKey) {
    await offlineDb.syncQueue
      .where("dedupeKey")
      .equals(op.dedupeKey)
      .and((r) => r.status !== "processing")
      .delete();
  }

  await offlineDb.syncQueue.add(op);
  emitQueueChanged();

  // Register a Background Sync tag so the SW can flush the queue even after
  // the tab is closed and the device comes back online.
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        if ("sync" in reg) return (reg as any).sync.register("sk-sync-queue");
      })
      .catch(() => {}); // not fatal — in-app sync engine is the fallback
  }

  return op;
}

export async function getQueueCounts() {
  const [pending, failed, processing, dead] = await Promise.all([
    offlineDb.syncQueue.where("status").equals("pending").count(),
    offlineDb.syncQueue.where("status").equals("failed").count(),
    offlineDb.syncQueue.where("status").equals("processing").count(),
    offlineDb.syncQueue.where("status").equals("dead").count(),
  ]);
  return { pending, failed, processing, dead, total: pending + failed + processing };
}

export async function processQueueOnce() {
  if (processingInFlight) return processingInFlight;
  processingInFlight = processQueueInternal();
  try {
    return await processingInFlight;
  } finally {
    processingInFlight = null;
  }
}

async function processQueueInternal() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { processed: 0 };

  // AFTER — only resets items stuck for more than 2 minutes
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
await offlineDb.syncQueue
  .where("status")
  .equals("processing")
  .and((r) => r.updatedAt < twoMinutesAgo)
  .modify({ status: "pending", updatedAt: new Date().toISOString() });

  const queue = await offlineDb.syncQueue
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("createdAt");

  let processed = 0;

  for (const item of queue) {
    if (!item.id) continue;
    await offlineDb.syncQueue.update(item.id, {
      status: "processing",
      updatedAt: new Date().toISOString(),
    });
    emitQueueChanged();

    try {
      await api.request({
        url: item.url,
        method: item.method,
        data: item.payload,
        headers: item.shopId ? { "x-shop-id": item.shopId } : undefined,
      });
      await offlineDb.syncQueue.delete(item.id);
      processed += 1;
      emitQueueChanged();
    } catch (error: any) {
      const retries = (item.retries || 0) + 1;
      const statusCode = error?.response?.status;
      const message = error?.response?.data?.error?.message || error?.message || "Sync failed";
      const transient = isNetworkError(error);

      // After MAX_RETRIES non-transient failures the item is permanently broken.
      // Mark it 'dead' so it is never retried automatically; the user can clear it manually.
      const newStatus = transient ? "pending" : retries >= MAX_RETRIES ? "dead" : "failed";

      await offlineDb.syncQueue.update(item.id, {
        status: newStatus,
        retries,
        lastError: statusCode === 409 ? `Conflict (LWW): ${message}` : message,
        updatedAt: new Date().toISOString(),
      });
      emitQueueChanged();

      // Notify the user once when an item first becomes dead or fails ≥ 3 times.
      if (!transient && (newStatus === "dead" || retries === 3) && item.shopId) {
        addNotification({
          notifId: `sync-error-${item.opId}`,
          type: "sync_error",
          title: newStatus === "dead" ? "Sync Permanently Failed" : "Background Sync Failed",
          message: `Could not sync ${item.entity} ${item.action}. ${message.slice(0, 80)}`,
          shopId: item.shopId,
          meta: { opId: item.opId, entity: item.entity, action: item.action },
        }).catch(() => {});
      }

      if (transient) {
        break; // network is down — stop processing remaining items
      }
    }
  }

  return { processed };
}

export async function listQueueItems(limit = 100) {
  return offlineDb.syncQueue.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function retryQueueItem(id: number) {
  await offlineDb.syncQueue.update(id, {
    status: "pending",
    lastError: "",
    updatedAt: new Date().toISOString(),
  });
  emitQueueChanged();
  return processQueueOnce();
}

export async function removeQueueItem(id: number) {
  await offlineDb.syncQueue.delete(id);
  emitQueueChanged();
}

export async function clearFailedQueueItems() {
  await offlineDb.syncQueue.where("status").anyOf("failed", "dead").delete();
  emitQueueChanged();
}

export async function clearDeadQueueItems() {
  await offlineDb.syncQueue.where("status").equals("dead").delete();
  emitQueueChanged();
}
