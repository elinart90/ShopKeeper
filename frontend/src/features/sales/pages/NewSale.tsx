import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard,
  DollarSign,
  Smartphone,
  X,
  Scan,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi, salesApi, paymentsApi, customersApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';
import { useAuth } from '../../../contexts/useAuth';
import { enqueueOperation } from '../../../offline/offlineQueue';
import { useOfflineStatus } from '../../../hooks/useOfflineStatus';
import { useSyncQueueCount } from '../../../hooks/useSyncQueueCount';

const PENDING_PAYSTACK_SALE_KEY = 'shoopkeeper_pending_paystack_sale';

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  barcode?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  stock_quantity: number;
}

type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'card' | 'credit';

export default function NewSale() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const { online } = useOfflineStatus();
  const queue = useSyncQueueCount();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrCodeRegionId = 'qr-reader';

  // Credit: customer selection
  const [creditCustomerId, setCreditCustomerId] = useState<string | null>(null);
  const [creditCustomerDisplay, setCreditCustomerDisplay] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Array<{ id: string; name: string; phone?: string; email?: string }>>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  useEffect(() => {
    if (searchQuery) {
      searchProducts();
    } else {
      setProducts([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (paymentMethod !== 'credit') return;
    if (!customerSearch.trim()) {
      setCustomerSearchResults([]);
      customersApi.getCustomers().then((r) => setCustomerSearchResults((r.data.data || []).slice(0, 20))).catch(() => setCustomerSearchResults([]));
      return;
    }
    const t = setTimeout(() => {
      setLoadingCustomers(true);
      customersApi.getCustomers({ search: customerSearch }).then((r) => {
        setCustomerSearchResults(r.data.data || []);
      }).catch(() => setCustomerSearchResults([])).finally(() => setLoadingCustomers(false));
    }, 300);
    return () => clearTimeout(t);
  }, [paymentMethod, customerSearch]);

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await inventoryApi.getProducts({ search: searchQuery });
      setProducts(response.data.data || []);
    } catch (error: any) {
      toast.error('Failed to search products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const scanBarcode = async () => {
    if (scanning) {
      stopScanning();
      return;
    }

    setScanning(true);
    try {
      scannerRef.current = new Html5Qrcode(qrCodeRegionId);
      
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await handleBarcodeScanned(decodedText);
          stopScanning();
        },
        (_errorMessage) => {
          // Ignore scanning errors
        }
      );
    } catch (error) {
      console.error('Failed to start scanner:', error);
      toast.error('Failed to start camera');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const response = await inventoryApi.getProductByBarcode(barcode);
      const product = response.data.data;
      
      if (product) {
        addToCart(product);
        toast.success(`Added ${product.name}`);
      } else {
        toast.error('Product not found');
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('Product not found');
      } else {
        toast.error('Failed to fetch product');
      }
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    const stock = Number(product.stock_quantity ?? 0);
    
    if (existingItem) {
      if (stock > 0 && existingItem.quantity >= stock) {
        toast.error('Insufficient stock');
        return;
      }
      updateCartItem(existingItem.id, { quantity: existingItem.quantity + 1 });
    } else {
      const newItem: CartItem = {
        id: `item-${Date.now()}`,
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unit_price: Number(product.selling_price ?? 0),
        discount: 0,
        total: Number(product.selling_price ?? 0),
        stock_quantity: stock,
      };
      setCart([...cart, newItem]);
    }
  };

  const updateCartItem = (itemId: string, updates: Partial<CartItem>) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, ...updates };
        updated.total = (updated.unit_price * updated.quantity) - updated.discount;
        return updated;
      }
      return item;
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = subtotal - discount;
    return { subtotal, discount, total: finalTotal };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const { total } = calculateTotals();
    if (paymentMethod === 'credit' && !creditCustomerId) {
      toast.error('Select or add a customer for credit sales. They will appear in Dashboard → Credit & Risk.');
      return;
    }
    const saleData: Record<string, unknown> = {
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount,
      })),
      discount_amount: discount,
      payment_method: paymentMethod,
    };
    if (paymentMethod === 'credit' && creditCustomerId) {
      saleData.customer_id = creditCustomerId;
    }

    // Mobile Money / Card: Paystack takes over (customer number + PIN prompt on phone)
    if (paymentMethod === 'mobile_money' || paymentMethod === 'card') {
      if (!online) {
        toast.error('Mobile money/card payments need internet connection.');
        return;
      }
      if (!user?.email) {
        toast.error('Add your email in Settings so we can use Paystack for this payment.');
        return;
      }
      setProcessing(true);
      try {
        const amountMinor = Math.round(total * 100); // pesewas/cents
        if (amountMinor < 100) {
          toast.error('Minimum payment amount is 1.00');
          setProcessing(false);
          return;
        }
        sessionStorage.setItem(PENDING_PAYSTACK_SALE_KEY, JSON.stringify(saleData));
        const res = await paymentsApi.initializePaystack({
          amount: amountMinor,
          email: user.email,
          purpose: 'order',
          metadata: { source: 'pos_sale' },
        });
        const url = res.data?.data?.authorization_url;
        if (url) {
          toast.success('Redirecting to Paystack… Enter customer number and approve on their phone.');
          window.location.href = url;
          return;
        }
        toast.error('Could not start payment');
        sessionStorage.removeItem(PENDING_PAYSTACK_SALE_KEY);
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || 'Failed to start payment';
        toast.error(msg);
        sessionStorage.removeItem(PENDING_PAYSTACK_SALE_KEY);
      } finally {
        setProcessing(false);
      }
      return;
    }

    setProcessing(true);
    try {
      const response = await salesApi.create(saleData as any);
      const sale = response.data.data;
      toast.success('Sale completed successfully!');
      navigate(`/sales/${sale.id}`);
    } catch (error: any) {
      const isNetworkFailure = !!error?.networkError || !error?.response;
      if (isNetworkFailure && currentShop?.id) {
        await enqueueOperation({
          entity: 'sale',
          action: 'create',
          method: 'post',
          url: '/sales',
          payload: saleData,
          shopId: currentShop.id,
          dedupeKey: `sale:create:${Date.now()}`,
        });
        toast.success('Sale saved offline. It will sync automatically when online.');
        setCart([]);
        setDiscount(0);
        setSearchQuery('');
        setProducts([]);
        setCreditCustomerId(null);
        setCreditCustomerDisplay('');
        setCustomerSearch('');
        setCustomerSearchResults([]);
        return;
      }
      const message = error.response?.data?.error?.message || 'Failed to complete sale';
      toast.error(message);
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const { subtotal, total } = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                New Sale
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {currentShop?.name || 'Select a shop'}
              </p>
              {!online && (
                <p className="text-xs mt-1 font-medium text-red-600 dark:text-red-400">
                  Offline mode: sales will be queued for sync
                </p>
              )}
              {queue.total > 0 && (
                <p className="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                  {queue.total} pending sync
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Product Search & Selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products by name, barcode, or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={scanBarcode}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    scanning
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'btn-primary-gradient'
                  }`}
                >
                  <Scan className="h-5 w-5" />
                </button>
              </div>

              {/* QR Scanner */}
              {scanning && (
                <div className="mt-4">
                  <div id={qrCodeRegionId} className="w-full"></div>
                  <button
                    onClick={stopScanning}
                    className="mt-2 w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Stop Scanning
                  </button>
                </div>
              )}

              {/* Search Results */}
              {searchQuery && products.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        addToCart(product);
                        setSearchQuery('');
                        setProducts([]);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {product.barcode && `Barcode: ${product.barcode}`}
                            {product.stock_quantity !== undefined && 
                              ` • Stock: ${product.stock_quantity} ${product.unit || 'pcs'}`
                            }
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {currentShop?.currency || 'USD'} {product.selling_price?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && !loading && products.length === 0 && (
                <p className="mt-4 text-center text-gray-500 dark:text-gray-400">
                  No products found
                </p>
              )}
            </div>

            {/* Cart Items */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Cart ({cart.length})
                </h2>
              </div>

              {cart.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Your cart is empty. Search and add products to get started.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {cart.map((item) => (
                    <div key={item.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {currentShop?.currency || 'USD'} {item.unit_price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (item.quantity > 1) {
                                  updateCartItem(item.id, { quantity: item.quantity - 1 });
                                }
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.stock_quantity > 0 ? item.stock_quantity : undefined}
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Math.floor(parseFloat(e.target.value) || 1));
                                const max = Number(item.stock_quantity) || Infinity;
                                const qty = item.stock_quantity > 0 ? Math.min(val, max) : val;
                                updateCartItem(item.id, { quantity: qty });
                              }}
                              className="w-14 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                            />
                            <button
                              onClick={() => {
                                const stock = Number(item.stock_quantity) || 0;
                                if (stock > 0 && item.quantity >= stock) {
                                  toast.error('Insufficient stock');
                                  return;
                                }
                                updateCartItem(item.id, { quantity: item.quantity + 1 });
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                              disabled={item.stock_quantity > 0 && item.quantity >= item.stock_quantity}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {currentShop?.currency || 'USD'} {item.total.toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Checkout */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow sticky top-4">
              <div className="p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Checkout
                </h2>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cash', 'mobile_money', 'card', 'credit'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`p-3 rounded-lg border-2 transition ${
                          paymentMethod === method
                            ? 'btn-tab-gradient border-transparent text-white'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-900 dark:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {method === 'cash' && <DollarSign className="h-4 w-4" />}
                          {method === 'mobile_money' && <Smartphone className="h-4 w-4" />}
                          {method === 'card' && <CreditCard className="h-4 w-4" />}
                          {method === 'credit' && <CreditCard className="h-4 w-4" />}
                          <span className="text-sm font-medium capitalize">
                            {method.replace('_', ' ')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Credit: Customer (required) */}
                {paymentMethod === 'credit' && (
                  <div className="space-y-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Customer (required for credit – shows in Credit & Risk tab)
                    </label>
                    {creditCustomerId ? (
                      <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <span className="text-gray-900 dark:text-white font-medium">{creditCustomerDisplay}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCreditCustomerId(null);
                            setCreditCustomerDisplay('');
                          }}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Search by name, phone, or email..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        {loadingCustomers && (
                          <p className="text-xs text-gray-500">Searching...</p>
                        )}
                        {customerSearchResults.length > 0 && (
                          <ul className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                            {customerSearchResults.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreditCustomerId(c.id);
                                    setCreditCustomerDisplay([c.name, c.phone, c.email].filter(Boolean).join(' · '));
                                    setCustomerSearch('');
                                    setCustomerSearchResults([]);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {c.name} {c.phone && ` · ${c.phone}`} {c.email && ` · ${c.email}`}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {!showNewCustomerForm ? (
                          <button
                            type="button"
                            onClick={() => setShowNewCustomerForm(true)}
                            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            + Add new customer
                          </button>
                        ) : (
                          <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                            <input
                              type="text"
                              placeholder="Customer name"
                              value={newCustomerName}
                              onChange={(e) => setNewCustomerName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Phone (optional)"
                              value={newCustomerPhone}
                              onChange={(e) => setNewCustomerPhone(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!newCustomerName.trim()) {
                                    toast.error('Enter customer name');
                                    return;
                                  }
                                  try {
                                    const res = await customersApi.create({
                                      name: newCustomerName.trim(),
                                      phone: newCustomerPhone.trim() || undefined,
                                    });
                                    const c = res.data.data;
                                    setCreditCustomerId(c.id);
                                    setCreditCustomerDisplay([c.name, c.phone].filter(Boolean).join(' · '));
                                    setShowNewCustomerForm(false);
                                    setNewCustomerName('');
                                    setNewCustomerPhone('');
                                    toast.success('Customer added');
                                  } catch (err: any) {
                                    toast.error(err.response?.data?.error?.message || 'Failed to add customer');
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg btn-primary-gradient text-sm"
                              >
                                Add & use
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNewCustomerForm(false);
                                  setNewCustomerName('');
                                  setNewCustomerPhone('');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Discount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Discount ({currentShop?.currency || 'USD'})
                  </label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Totals */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="text-gray-900 dark:text-white">
                      {currentShop?.currency || 'USD'} {subtotal.toFixed(2)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Discount</span>
                      <span className="text-red-600 dark:text-red-400">
                        -{currentShop?.currency || 'USD'} {discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {currentShop?.currency || 'USD'} {total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || processing || (paymentMethod === 'credit' && !creditCustomerId)}
                  className={`w-full py-3 rounded-lg font-semibold text-white transition ${
                    cart.length === 0 || processing || (paymentMethod === 'credit' && !creditCustomerId)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'btn-primary-gradient'
                  }`}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Complete Sale
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
