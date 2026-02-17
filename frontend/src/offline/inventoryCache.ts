import { offlineDb } from "./db";

type ProductLike = {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  is_active: boolean;
};

function normalizeProduct(p: any): ProductLike {
  return {
    id: String(p.id),
    name: String(p.name || ""),
    barcode: p.barcode || undefined,
    sku: p.sku || undefined,
    selling_price: Number(p.selling_price || 0),
    cost_price: Number(p.cost_price || 0),
    stock_quantity: Number(p.stock_quantity || 0),
    min_stock_level: Number(p.min_stock_level || 0),
    unit: p.unit || "unit",
    is_active: p.is_active !== false,
  };
}

export async function cacheProducts(shopId: string, products: any[]) {
  const now = new Date().toISOString();
  const rows = (products || []).map((p) => {
    const n = normalizeProduct(p);
    return {
      key: `${shopId}:${n.id}`,
      shopId,
      productId: n.id,
      ...n,
      updatedAt: now,
    };
  });
  await offlineDb.productsCache.bulkPut(rows);
}

export async function getCachedProducts(shopId: string, opts?: { search?: string; lowStock?: boolean; outOfStock?: boolean }) {
  let rows = await offlineDb.productsCache.where("shopId").equals(shopId).toArray();
  rows = rows.filter((r) => r.is_active !== false);

  const search = String(opts?.search || "").trim().toLowerCase();
  if (search) {
    rows = rows.filter((r) =>
      String(r.name || "").toLowerCase().includes(search) ||
      String(r.barcode || "").toLowerCase().includes(search) ||
      String(r.sku || "").toLowerCase().includes(search)
    );
  }

  if (opts?.lowStock) {
    rows = rows.filter((r) => Number(r.stock_quantity) <= Number(r.min_stock_level || 0));
  }

  if (opts?.outOfStock) {
    rows = rows.filter((r) => Number(r.stock_quantity) === 0);
  }

  return rows.map((r) => ({
    id: r.productId,
    name: r.name,
    barcode: r.barcode,
    sku: r.sku,
    selling_price: Number(r.selling_price),
    cost_price: Number(r.cost_price),
    stock_quantity: Number(r.stock_quantity),
    min_stock_level: Number(r.min_stock_level),
    unit: r.unit,
    is_active: r.is_active,
  }));
}
