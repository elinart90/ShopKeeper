import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store, Package, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useShop } from "../../../contexts/useShop";
import { shopsApi } from "../../../lib/api";
import toast from "react-hot-toast";

export default function CreateShopPage() {
  const navigate = useNavigate();
  const { shops, loading: shopsLoading, refreshShops, selectShop, deleteShop } = useShop();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    address: "",
    phone: "",
    email: "",
    currency: "USD",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formData.name.trim()) {
      setError("Shop name is required.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await shopsApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        currency: formData.currency,
      });
      const newShop = res.data?.data;
      if (newShop) {
        await refreshShops();
        selectShop(newShop);
        toast.success("Shop created successfully");
        navigate("/dashboard", { replace: true });
      } else {
        setError("Shop was created but could not be selected. Go to dashboard.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create shop.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshShops();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-lg mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {shops.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Your shops
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select a shop to use, or create a new one below.
            </p>
            {shopsLoading ? (
              <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="space-y-2">
                {shops.map((shop) => (
                  <div
                    key={shop.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700"
                  >
                    <button
                      onClick={() => {
                        selectShop(shop);
                        toast.success(`Using ${shop.name}`);
                        navigate("/dashboard", { replace: true });
                      }}
                      className="flex-1 flex items-center justify-between px-4 py-3 text-left transition"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{shop.name}</span>
                      </span>
                      <span className="text-sm text-emerald-600 dark:text-emerald-400">Use this shop</span>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Permanently delete "${shop.name}"? This will remove the store and all its products, sales, and data. This cannot be undone.`)) {
                          deleteShop(shop.id);
                        }
                      }}
                      className="p-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-r-lg transition"
                      title="Delete store"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Store className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {shops.length > 0 ? "Create a new shop" : "Create your shop"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {shops.length > 0
                  ? "Add another shop. You will be the owner and can add staff from Dashboard → Staff & Controls."
                  : "You will be the owner. After creating the shop you can add staff and give them the permissions you want."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shop name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. My Store"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description (optional)"
                rows={2}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street, city (optional)"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="NGN">NGN</option>
                <option value="GHS">GHS</option>
                <option value="KES">KES</option>
                <option value="XAF">XAF</option>
                <option value="ZAR">ZAR</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 btn-primary-gradient font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating…" : "Create shop"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
