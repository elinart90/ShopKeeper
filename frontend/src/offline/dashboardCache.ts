import { offlineDb } from "./db";

export async function cacheDashboardStats(shopId: string, stats: any): Promise<void> {
  await offlineDb.dashboardCache.put({
    key: `${shopId}:stats`,
    shopId,
    data: stats,
    savedAt: new Date().toISOString(),
  });
}

export async function getCachedDashboardStats(shopId: string): Promise<any | null> {
  const row = await offlineDb.dashboardCache.get(`${shopId}:stats`);
  return row?.data ?? null;
}

export async function cacheCustomers(shopId: string, customers: any[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = (customers || []).map((c) => ({
    key: `${shopId}:${c.id}`,
    shopId,
    customerId: String(c.id),
    name: String(c.name || ""),
    phone: c.phone || undefined,
    email: c.email || undefined,
    updatedAt: now,
  }));
  await offlineDb.customersCache.bulkPut(rows);
}

export async function getCachedCustomers(shopId: string, search?: string): Promise<any[]> {
  let rows = await offlineDb.customersCache.where("shopId").equals(shopId).toArray();
  const q = String(search || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
    );
  }
  return rows.map((r) => ({
    id: r.customerId,
    name: r.name,
    phone: r.phone,
    email: r.email,
  }));
}
