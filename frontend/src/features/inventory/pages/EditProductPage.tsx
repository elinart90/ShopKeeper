import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { inventoryApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';

const UNITS = [
  { value: 'piece', label: 'Pcs' },
  { value: 'kg', label: 'Kg' },
  { value: 'liter', label: 'Ltr' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
];

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '',
    barcode: '',
    selling_price: '',
    cost_price: '',
    stock_quantity: '',
    unit: 'piece',
    min_stock_level: '',
    category_id: '',
    sku: '',
    description: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    if (currentShop) {
      inventoryApi.getCategories().then((r) => setCategories(r.data.data || []));
    }
  }, [currentShop]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    inventoryApi
      .getProduct(id)
      .then((res) => {
        const p = res.data.data;
        if (!p) {
          toast.error('Product not found');
          navigate('/inventory');
          return;
        }
        setForm({
          name: p.name || '',
          barcode: p.barcode || '',
          selling_price: String(p.selling_price ?? ''),
          cost_price: String(p.cost_price ?? ''),
          stock_quantity: String(p.stock_quantity ?? ''),
          unit: p.unit || 'piece',
          min_stock_level: String(p.min_stock_level ?? ''),
          category_id: p.category_id || '',
          sku: p.sku || '',
          description: p.description || '',
        });
        if (p.image_url) setPhotoPreview(p.image_url);
      })
      .catch(() => {
        toast.error('Failed to load product');
        navigate('/inventory');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Product name is required';
    const selling = parseFloat(form.selling_price);
    if (isNaN(selling) || selling <= 0) e.selling_price = 'Selling price must be greater than 0';
    const cost = parseFloat(form.cost_price);
    if (form.cost_price && !isNaN(cost) && cost > selling) e.cost_price = 'Cost should not be greater than selling price';
    const stock = parseFloat(form.stock_quantity);
    if (form.stock_quantity && (isNaN(stock) || stock < 0)) e.stock_quantity = 'Stock cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!id || !validate()) return;
    setSaving(true);
    try {
      await inventoryApi.updateProduct(id, {
        name: form.name.trim(),
        barcode: form.barcode.trim() || undefined,
        selling_price: parseFloat(form.selling_price),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
        stock_quantity: parseFloat(form.stock_quantity) || 0,
        unit: form.unit,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        category_id: form.category_id || undefined,
        sku: form.sku.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      toast.success('Product updated');
      navigate('/inventory');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to update';
      toast.error(msg);
      setErrors({ submit: msg });
    } finally {
      setSaving(false);
    }
  };

  if (!currentShop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Select a shop first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link to="/inventory" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Inventory
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Product</h1>

        <div className="flex justify-center mb-6">
          {photoPreview ? (
            <img src={photoPreview} alt="Product" className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-500" />
            </div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Barcode</label>
            <input
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selling price *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.selling_price}
                onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {errors.selling_price && <p className="text-red-500 text-sm mt-1">{errors.selling_price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost_price}
                onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {errors.cost_price && <p className="text-red-500 text-sm mt-1">{errors.cost_price}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock qty</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {errors.stock_quantity && <p className="text-red-500 text-sm mt-1">{errors.stock_quantity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Low stock alert level</label>
            <input
              type="number"
              min="0"
              value={form.min_stock_level}
              onChange={(e) => setForm((f) => ({ ...f, min_stock_level: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400"
          >
            <span className={showAdvanced ? 'rotate-90' : ''}>▶</span>
            Advanced (category, SKU)
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-4 pl-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {errors.submit && <p className="text-red-500 text-sm mb-4">{errors.submit}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/inventory')}
            className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-lg btn-primary-gradient disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update product'}
          </button>
        </div>
      </div>
    </div>
  );
}
