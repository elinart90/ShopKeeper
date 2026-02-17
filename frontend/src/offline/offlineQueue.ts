import { api } from "../lib/api";
import { emitQueueChanged, makeOpId, offlineDb, type SyncQueueItem } from "./db";

let processingInFlight: Promise<{ processed: number }> | null = null;

function isNetworkError(error: any) {
  if (!error) return false;
  if (error.networkError) return true;
  const code = error.code;
  const msg = String(error.message || "").toLowerCase();
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
  return op;
}

export async function getQueueCounts() {
  const [pending, failed, processing] = await Promise.all([
    offlineDb.syncQueue.where("status").equals("pending").count(),
    offlineDb.syncQueue.where("status").equals("failed").count(),
    offlineDb.syncQueue.where("status").equals("processing").count(),
  ]);
  return { pending, failed, processing, total: pending + failed + processing };
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

      // Last-write-wins policy: for 409 conflicts, keep latest local operation and retry later.
      // We mark as failed and preserve it for next sync cycles.
      await offlineDb.syncQueue.update(item.id, {
        status: isNetworkError(error) ? "pending" : "failed",
        retries,
        lastError: statusCode === 409 ? `Conflict (LWW): ${message}` : message,
        updatedAt: new Date().toISOString(),
      });
      emitQueueChanged();

      if (isNetworkError(error)) {
        break;
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
  await offlineDb.syncQueue.where("status").equals("failed").delete();
  emitQueueChanged();
}
