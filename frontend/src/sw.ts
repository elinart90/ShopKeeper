/// <reference lib="WebWorker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Precache all static assets (manifest injected by VitePWA at build time).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Network-first for all API calls - same policy as before.
registerRoute(
  ({ url }) => /\/api\//.test(url.href),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 10,
    plugins: [{ cacheWillUpdate: async ({ response }) => (response.status === 200 ? response : null) }],
  })
);

// ---------------------------------------------------------------------------
// Background Sync - flush the Dexie syncQueue when the browser wakes the SW.
// This fires even when all app tabs are closed.
// ---------------------------------------------------------------------------
self.addEventListener("sync", (event) => {
  if ((event as any).tag === "sk-sync-queue") {
    (event as any).waitUntil(processQueue());
  }
});

// Raw IndexedDB helpers (no Dexie - keep the SW self-contained).
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("shoopkeeper-offline-db");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetConfig(db: IDBDatabase, key: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("swConfig", "readonly");
      const req = tx.objectStore("swConfig").get(key);
      req.onsuccess = () => resolve((req.result as any)?.value);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbGetAllByIndex(db: IDBDatabase, store: string, index: string, value: string): Promise<any[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).index(index).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function idbDelete(db: IDBDatabase, store: string, key: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbPatch(db: IDBDatabase, store: string, key: number, patch: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const getReq = os.get(key);
    getReq.onsuccess = () => {
      const updated = { ...getReq.result, ...patch };
      const putReq = os.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function processQueue(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }

  // Read credentials saved by the main thread.
  const apiBaseUrl = await idbGetConfig(db, "apiBaseUrl");
  const authToken = await idbGetConfig(db, "authToken");
  const defaultShopId = await idbGetConfig(db, "shopId");

  if (!apiBaseUrl) {
    db.close();
    return;
  }

  // Collect pending + failed items, oldest first.
  const [pending, failed] = await Promise.all([
    idbGetAllByIndex(db, "syncQueue", "status", "pending"),
    idbGetAllByIndex(db, "syncQueue", "status", "failed"),
  ]);
  const items = [...pending, ...failed].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt))
  );

  for (const item of items) {
    if (!item.id) continue;

    await idbPatch(db, "syncQueue", item.id, {
      status: "processing",
      updatedAt: new Date().toISOString(),
    });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const shopId = item.shopId || defaultShopId;
      if (shopId) headers["x-shop-id"] = shopId;

      const res = await fetch(`${apiBaseUrl}${item.url}`, {
        method: String(item.method).toUpperCase(),
        headers,
        body: item.payload ? JSON.stringify(item.payload) : undefined,
      });

      if (res.ok || res.status === 409) {
        // 409 = last-write-wins conflict; treat as consumed.
        await idbDelete(db, "syncQueue", item.id);
      } else {
        await idbPatch(db, "syncQueue", item.id, {
          status: "failed",
          retries: (item.retries || 0) + 1,
          lastError: `HTTP ${res.status}`,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Network still unavailable - reset to pending so the next sync retries.
      await idbPatch(db, "syncQueue", item.id, {
        status: "pending",
        updatedAt: new Date().toISOString(),
      });
      break; // stop; the browser will re-fire the sync event when online again
    }
  }

  db.close();
}
