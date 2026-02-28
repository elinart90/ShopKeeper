import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, CalendarRange } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';
import { cacheProducts, getCachedProducts } from '../../../offline/inventoryCache';
import { useOfflineStatus } from '../../../hooks/useOfflineStatus';

interface Product {
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
  created_at?: string;
  updated_at?: string;
}

export default function InventoryList() {
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { online } = useOfflineStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'out_of_stock' | 'deleted'>('all');
  const [usingCache, setUsingCache] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(today);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const totalQtyAdded = useMemo(
    () => movements.filter((m) => m.action === 'purchase' || Number(m.quantity) > 0)
                   .reduce((s, m) => s + Number(m.quantity || 0), 0),
    [movements]
  );

  const loadMovements = async (from: string, to: string) => {
    if (!currentShop) return;
    setMovementsLoading(true);
    try {
      const res = await inventoryApi.getStockMovements({ from, to });
      setMovements((res.data as any)?.data || []);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements(rangeFrom, rangeTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFrom, rangeTo, currentShop]);

  useEffect(() => {
    if (currentShop) {
      loadProducts();
    }
  }, [currentShop, filter]);

  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter === 'low_stock' || urlFilter === 'out_of_stock' || urlFilter === 'all' || urlFilter === 'deleted') {
      setFilter(urlFilter);
    }
  }, [searchParams]);

  const loadProducts = async () => {
    if (!currentShop) return;

    setLoading(true);
    try {
      const params: any = {};
      if (searchQuery) {
        params.search = searchQuery;
      }
      if (filter === 'low_stock') {
        params.low_stock = true;
      }
      if (filter === 'deleted') {
        params.is_active = false;
      } else {
        params.is_active = true;
      }

      const response = await inventoryApi.getProducts(params);
      let productsData = response.data.data || [];
      if (filter !== 'deleted') {
        productsData = productsData.filter((p: Product) => p.is_active !== false);
      }

      if (filter === 'out_of_stock') {
        productsData = productsData.filter((p: Product) => p.stock_quantity === 0);
      }

      setProducts(productsData);
      setUsingCache(false);
      await cacheProducts(currentShop.id, productsData);
    } catch (error: any) {
      const cached = await getCachedProducts(currentShop.id, {
        search: searchQuery,
        lowStock: filter === 'low_stock',
        outOfStock: filter === 'out_of_stock',
      });
      if (cached.length > 0 || !online) {
        setProducts(cached as Product[]);
        setUsingCache(true);
        if (!online) {
          toast('Offline: showing cached inventory');
        } else {
          toast('Using cached inventory (sync pending)');
        }
      } else {
        toast.error('Failed to load products');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentShop) {
        loadProducts();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await inventoryApi.deleteProduct(productId);
      toast.success('Product deleted');
      loadProducts();
    } catch (error: any) {
      toast.error('Failed to delete product');
      console.error(error);
    }
  };

  const handleRestore = async (productId: string) => {
    if (!confirm('Restore this product?')) return;
    try {
      await inventoryApi.restoreProduct(productId);
      toast.success('Product restored');
      loadProducts();
    } catch (error: any) {
      toast.error('Failed to restore product');
      console.error(error);
    }
  };

  const isLowStock = (product: Product) => {
    return product.stock_quantity <= product.min_stock_level;
  };

  const isOutOfStock = (product: Product) => {
    return product.stock_quantity <= 0;
  };

  if (!currentShop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Please select a shop</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Inventory
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage your products and stock levels
              </p>
              {usingCache && (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">
                  Offline cache mode
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/inventory/add')}
              className="px-4 py-2 btn-primary-gradient rounded-lg flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Product
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'all'
                  ? 'btn-primary-gradient'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('low_stock')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                filter === 'low_stock'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Low Stock
            </button>
            <button
              onClick={() => setFilter('out_of_stock')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'out_of_stock'
                  ? 'bg-red-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
              }`}
            >
              Out of Stock
            </button>
            <button
              onClick={() => setFilter('deleted')}
              className={`px-4 py-2 rounded-lg transition ${
                filter === 'deleted'
                  ? 'bg-gray-700 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
              }`}
            >
              Deleted
            </button>
          </div>
        </div>

        {/* Products List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No products found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Get started by adding your first product'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/inventory/add')}
                className="px-6 py-3 btn-primary-gradient rounded-lg"
              >
                Add Product
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Barcode/SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date Added
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        isOutOfStock(product)
                          ? 'bg-red-50/60 dark:bg-red-900/10'
                          : isLowStock(product)
                          ? 'bg-amber-50/60 dark:bg-amber-900/10'
                          : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {product.name}
                            </div>
                            {isOutOfStock(product) ? (
                              <div className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-300 mt-1 px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30">
                                <AlertTriangle className="h-3 w-3" />
                                Out of stock
                              </div>
                            ) : isLowStock(product) ? (
                              <div className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 mt-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30">
                                <AlertTriangle className="h-3 w-3" />
                                Low stock
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {product.barcode || product.sku || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            isOutOfStock(product)
                              ? 'text-red-700 dark:text-red-300'
                              : isLowStock(product)
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {product.stock_quantity} {product.unit}
                        </div>
                        {product.min_stock_level > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Min: {product.min_stock_level}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentShop.currency} {product.selling_price.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Cost: {currentShop.currency} {product.cost_price.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.created_at ? (
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {new Date(product.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 dark:text-gray-500">—</div>
                        )}
                        {product.updated_at && product.updated_at !== product.created_at && (
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Updated: {new Date(product.updated_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-4">
                          {filter === 'deleted' ? (
                            <button
                              onClick={() => handleRestore(product.id)}
                              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 text-xs font-medium"
                            >
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => navigate(`/inventory/${product.id}/edit`)}
                                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock Movement History */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Stock movement history
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Shows each stock-in event: the quantity that was left before, how much was added, and the new total after.
          </p>

          {/* Date pickers */}
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={rangeFrom}
                max={rangeTo}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={rangeTo}
                min={rangeFrom}
                onChange={(e) => setRangeTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <button
              onClick={() => { setRangeFrom(today); setRangeTo(today); }}
              className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Today
            </button>
          </div>

          {movementsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading movements…
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No stock movements recorded between {new Date(rangeFrom + 'T00:00:00').toLocaleDateString()} and {new Date(rangeTo + 'T00:00:00').toLocaleDateString()}.
            </p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-600 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stock events</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{movements.length}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Total units added</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalQtyAdded}</p>
                </div>
              </div>

              {/* Movement breakdown table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Product name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item left before</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Qty added</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {movements.map((m, idx) => {
                      const qtyAdded = Number(m.quantity || 0);
                      const prevQty  = Number(m.previous_quantity ?? 0);
                      const newQty   = Number(m.new_quantity ?? 0);
                      const isInflow = qtyAdded > 0;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {m.product?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {new Date(m.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {prevQty} {m.product?.unit ?? ''}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${isInflow ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isInflow ? '+' : ''}{qtyAdded} {m.product?.unit ?? ''}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                            {newQty} {m.product?.unit ?? ''}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                              m.action === 'purchase' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : m.action === 'sale'   ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {m.action}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total added
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-300">
                        +{totalQtyAdded}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
