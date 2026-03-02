import { offlineDb } from "./db";

let _lastToken: string | null = null;
let _lastShopId: string | null = null;
let _lastBase: string | null = null;

/**
 * Persist credentials for the service worker to use during Background Sync.
 * Called from the API request interceptor - writes only when values actually change.
 */
export async function syncSwConfig(
  apiBaseUrl: string,
  authToken: string | null,
  shopId: string | null
): Promise<void> {
  if (apiBaseUrl === _lastBase && authToken === _lastToken && shopId === _lastShopId) {
    return;
  }

  const rows: { key: string; value: string }[] = [{ key: "apiBaseUrl", value: apiBaseUrl }];
  if (authToken) rows.push({ key: "authToken", value: authToken });
  if (shopId) rows.push({ key: "shopId", value: shopId });

  await offlineDb.swConfig.bulkPut(rows);
  if (!authToken) await offlineDb.swConfig.delete("authToken").catch(() => {});
  if (!shopId) await offlineDb.swConfig.delete("shopId").catch(() => {});

  _lastBase = apiBaseUrl;
  _lastToken = authToken;
  _lastShopId = shopId;
}
