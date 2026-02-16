import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Package, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';

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
}

export default function InventoryList() {
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  useEffect(() => {
    if (currentShop) {
      loadProducts();
    }
  }, [currentShop, filter]);

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

      const response = await inventoryApi.getProducts(params);
      let productsData = response.data.data || [];

      if (filter === 'out_of_stock') {
        productsData = productsData.filter((p: Product) => p.stock_quantity === 0);
      }

      setProducts(productsData);
    } catch (error: any) {
      toast.error('Failed to load products');
      console.error(error);
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

  const isLowStock = (product: Product) => {
    return product.stock_quantity <= product.min_stock_level;
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {product.name}
                            </div>
                            {isLowStock(product) && (
                              <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mt-1">
                                <AlertTriangle className="h-3 w-3" />
                                Low stock
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {product.barcode || product.sku || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
