import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Search,
  Package,
  Barcode,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { inventoryApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';

const UNITS = [
  { value: 'piece', label: 'Pcs' },
  { value: 'kg', label: 'Kg' },
  { value: 'liter', label: 'Ltr' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
];

type EntryMode = 'choose' | 'scan' | 'scan-camera' | 'search' | 'manual' | 'form';

function generateInternalBarcode(): string {
  return 'SK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function AddProductPage() {
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  const [entryMode, setEntryMode] = useState<EntryMode>('choose');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    existingByBarcode: any;
    possibleByName: any[];
  } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{ withStock: boolean } | null>(null);

  const [form, setForm] = useState({
    name: '',
    barcode: '',
    selling_price: '',
    cost_price: '',
    stock_quantity: '0',
    unit: 'piece',
    min_stock_level: '0',
    category_id: '',
    sku: '',
    description: '',
    image_url: '',
  });
  const [, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isOwner = currentShop?.role === 'owner';

  const loadCategories = useCallback(async () => {
    if (!currentShop) return;
    try {
      const r = await inventoryApi.getCategories();
      setCategories(r.data.data || []);
    } catch {
      setCategories([]);
    }
  }, [currentShop]);

  useEffect(() => {
    if (currentShop) {
      loadCategories();
    }
  }, [currentShop, loadCategories]);

  useEffect(() => {
    if (entryMode === 'scan') {
      barcodeInputRef.current?.focus();
    }
  }, [entryMode]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      inventoryApi.getProducts({ search: searchQuery }).then((r) => {
        setSearchResults(r.data.data || []);
      }).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannedBarcode(code);
    setForm((f) => ({ ...f, barcode: code }));
    try {
      const res = await inventoryApi.getProductByBarcode(code);
      const product = res.data.data;
      if (product) {
        toast.success('Product found. Redirecting to edit.');
        navigate(`/inventory/${product.id}/edit`);
        return;
      }
    } catch {
      // 404 = not found, new product
    }
    setEntryMode('form');
  }, [navigate]);

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    BrowserCodeReader.releaseAllStreams();
    setEntryMode('scan');
  }, []);

  useEffect(() => {
    if (entryMode !== 'scan-camera' || !videoRef.current) return;

    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getUserMedia) {
      setCameraLoading(false);
      setCameraError(
        'Camera needs HTTPS. On phone: run "npm run dev:https" on your PC, then open https://YOUR_PC_IP:5173 and accept the certificate.'
      );
      return;
    }

    setCameraError(null);
    setCameraLoading(true);
    const codeReader = new BrowserMultiFormatReader();
    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, _error, controls) => {
        if (result) {
          scannerControlsRef.current = controls;
          handleBarcodeDetected(result.getText());
        }
      })
      .then((controls) => {
        scannerControlsRef.current = controls;
        setCameraLoading(false);
      })
      .catch((err: Error) => {
        setCameraLoading(false);
        const msg = (err?.message ?? '').toLowerCase();
        if (msg.includes('getusermedia') || msg.includes('secure context')) {
          setCameraError(
            'Camera needs HTTPS. On phone: run "npm run dev:https", then open https://YOUR_PC_IP:5173 and allow the certificate.'
          );
        } else if (
          msg.includes('requested device not found') ||
          msg.includes('device not found') ||
          msg.includes('no device')
        ) {
          setCameraError(
            'No camera found. Plug in a webcam, or check if the camera is in use by another app.'
          );
        } else {
          setCameraError(err?.message || 'Could not access camera.');
        }
      });
    return () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
      BrowserCodeReader.releaseAllStreams();
    };
  }, [entryMode, handleBarcodeDetected]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

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

  const runDuplicateCheck = async () => {
    try {
      const res = await inventoryApi.checkDuplicate({
        barcode: form.barcode || undefined,
        name: form.name || undefined,
      });
      const data = res.data.data;
      if (data.existingByBarcode || (data.possibleByName && data.possibleByName.length > 0)) {
        setDuplicateCheck(data);
        setShowDuplicateModal(true);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const doSave = async (withStock: boolean) => {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || undefined,
      selling_price: parseFloat(form.selling_price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
      stock_quantity: withStock ? parseFloat(form.stock_quantity) : 0,
      unit: form.unit,
      min_stock_level: parseFloat(form.min_stock_level) || 0,
      category_id: form.category_id || undefined,
      sku: form.sku.trim() || undefined,
      description: form.description.trim() || undefined,
      image_url: form.image_url || undefined,
    };
    setSaving(true);
    try {
      await inventoryApi.createProduct(payload);
      toast.success(withStock ? 'Product saved with initial stock' : 'Product saved');
      navigate('/inventory');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to save';
      toast.error(msg);
      setErrors({ submit: msg });
    } finally {
      setSaving(false);
      setPendingSubmit(null);
      setShowDuplicateModal(false);
    }
  };

  const handleSave = async (withStock: boolean) => {
    if (!validate()) return;
    const hasDuplicate = await runDuplicateCheck();
    if (hasDuplicate) {
      setPendingSubmit({ withStock });
      return;
    }
    await doSave(withStock);
  };

  const handleConfirmSaveAnyway = () => {
    if (pendingSubmit) doSave(pendingSubmit.withStock);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Enter a category name');
      return;
    }
    if (!isOwner) {
      toast.error('Only owner can create categories');
      return;
    }
    setCreatingCategory(true);
    try {
      const res = await inventoryApi.createCategory({ name });
      const category = res.data?.data;
      if (category?.id) {
        await loadCategories();
        setForm((f) => ({ ...f, category_id: category.id }));
        setNewCategoryName('');
        toast.success('Category created');
      } else {
        toast.error('Category created, but could not select it');
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create category';
      toast.error(msg);
    } finally {
      setCreatingCategory(false);
    }
  };

  if (!currentShop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Select a shop first.</p>
      </div>
    );
  }

  if (entryMode === 'choose') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-lg mx-auto">
          <Link to="/inventory" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Add Product</h1>

          <div className="space-y-3">
            <button
              onClick={() => setEntryMode('scan')}
              className="w-full flex items-center gap-4 p-4 rounded-xl btn-primary-gradient text-left shadow"
            >
              <div className="p-3 rounded-lg bg-white/20">
                <Barcode className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <span className="font-semibold block">Scan barcode</span>
                <span className="text-sm opacity-90">Fastest — use scanner or camera</span>
              </div>
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              onClick={() => setEntryMode('search')}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-emerald-400 text-left"
            >
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                <Search className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <span className="font-semibold text-gray-900 dark:text-white block">Search existing</span>
                <span className="text-sm text-gray-500">Product already in inventory?</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>

            <button
              onClick={() => {
                setEntryMode('form');
                setForm((f) => ({ ...f, barcode: scannedBarcode || f.barcode }));
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-emerald-400 text-left"
            >
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                <Package className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <span className="font-semibold text-gray-900 dark:text-white block">Manual add</span>
                <span className="text-sm text-gray-500">Type name and details</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (entryMode === 'scan-camera') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Scan with camera</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Point your camera at a barcode. It will be detected automatically.
          </p>
          <div className="relative aspect-[4/3] max-h-[50vh] rounded-xl overflow-hidden bg-black border border-gray-300 dark:border-gray-600">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            {cameraLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="h-10 w-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-white">Starting camera…</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
                <p className="text-red-400 text-sm">{cameraError}</p>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="mt-3 px-4 py-2 rounded-lg bg-white/20 text-white text-sm"
                >
                  Back
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={stopCamera}
            className="mt-4 w-full py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
          >
            Stop camera
          </button>
        </div>
      </div>
    );
  }

  if (entryMode === 'scan') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-lg mx-auto">
          <Link to="/inventory" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Scan barcode</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Use a USB barcode scanner (focus the field and scan) or type below. If product exists you can edit; otherwise you&apos;ll add a new one.
          </p>
          <input
            ref={barcodeInputRef}
            type="text"
            placeholder="Scan or type barcode..."
            value={scannedBarcode}
            onChange={(e) => setScannedBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBarcodeDetected(scannedBarcode);
            }}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg"
          />
          <button
            onClick={() => handleBarcodeDetected(scannedBarcode)}
            className="mt-4 w-full py-3 btn-primary-gradient rounded-lg"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('scan-camera')}
            className="mt-3 w-full py-3 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Camera className="h-5 w-5" /> Use camera instead
          </button>
          <button
            onClick={() => setEntryMode('choose')}
            className="mt-2 w-full py-2 text-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (entryMode === 'search') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-lg mx-auto">
          <Link to="/inventory" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Search product</h1>
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
          />
          <div className="space-y-2">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/inventory/${p.id}/edit`)}
                className="w-full flex justify-between items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-emerald-400 text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                <span className="text-sm text-gray-500">{p.barcode || p.selling_price}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setEntryMode('choose')} className="mt-4 w-full py-2 text-gray-500">
            Back to options
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24">
      <div className="max-w-lg mx-auto">
        <Link to="/inventory" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Add Product</h1>

        {/* Photo */}
        <div className="flex justify-center mb-6">
          <label className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-emerald-500">
            {photoPreview ? (
              <img src={photoPreview} alt="Product" className="w-full h-full object-cover" />
            ) : (
              <Camera className="h-10 w-10 text-gray-500" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>

        {/* Required fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Coca-Cola 500ml"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Barcode</label>
              <input
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                placeholder="Optional"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, barcode: generateInternalBarcode() }))}
              style={{ backgroundImage: 'linear-gradient(90deg, #2563eb, #f59e0b)' }}
              className="mt-6 px-3 py-2 text-sm text-white rounded-lg font-medium"
            >
              Generate
            </button>
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

        {/* Advanced */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
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
                <p className="text-xs text-gray-500 mt-1">
                  Choose existing category, or create a new one below.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Create new category
                </label>
                <div className="flex gap-2">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={isOwner ? 'e.g. Beverages' : 'Only owner can create category'}
                    disabled={!isOwner || creatingCategory}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!isOwner || creatingCategory}
                    style={{ backgroundImage: 'linear-gradient(90deg, #2563eb, #f59e0b)' }}
                    className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60"
                  >
                    {creatingCategory ? 'Saving...' : 'Add'}
                  </button>
                </div>
                {!isOwner && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Only shop owner can create categories.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="Internal code"
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

        {/* Bottom actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            style={{ backgroundImage: 'linear-gradient(90deg, #2563eb, #f59e0b)' }}
            className="flex-1 py-3 rounded-lg text-white font-medium disabled:opacity-50"
          >
            Save product
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 py-3 rounded-lg btn-primary-gradient disabled:opacity-50"
          >
            Save + Receive stock
          </button>
        </div>
      </div>

      {/* Duplicate modal */}
      {showDuplicateModal && duplicateCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Possible duplicate</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {duplicateCheck.existingByBarcode
                ? `A product with this barcode already exists: ${duplicateCheck.existingByBarcode.name}.`
                : 'Similar product name(s) found.'}
              {' '}Do you want to update that product instead, or save as new?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setPendingSubmit(null);
                  if (duplicateCheck.existingByBarcode) navigate(`/inventory/${duplicateCheck.existingByBarcode.id}/edit`);
                  else if (duplicateCheck.possibleByName?.[0]) navigate(`/inventory/${duplicateCheck.possibleByName[0].id}/edit`);
                }}
                className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600"
              >
                Update existing
              </button>
              <button
                onClick={handleConfirmSaveAnyway}
                disabled={saving}
                className="flex-1 py-2 rounded-lg btn-primary-gradient"
              >
                Save as new
              </button>
            </div>
            <button
              onClick={() => { setShowDuplicateModal(false); setPendingSubmit(null); }}
              className="w-full mt-2 py-2 text-gray-500 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
