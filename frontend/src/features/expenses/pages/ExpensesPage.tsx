import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { expensesApi } from '../../../lib/api';
import { useShop } from '../../../contexts/useShop';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartEnd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category_id: '',
    expense_date: todayStr(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const currency = currentShop?.currency || 'GHS';
  const today = todayStr();
  const weekStart = weekStartStr();
  const { start: monthStart, end: monthEnd } = monthStartEnd();

  const loadData = async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        expensesApi.getExpenses({ startDate: monthStart, endDate: monthEnd }),
        expensesApi.getCategories(),
      ]);
      setExpenses(expRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Failed to load');
      setExpenses([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentShop]);

  const todayTotal = expenses
    .filter((e) => (e.expense_date || '').toString().slice(0, 10) === today)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const weekTotal = expenses
    .filter((e) => {
      const d = (e.expense_date || '').toString().slice(0, 10);
      return d >= weekStart && d <= today;
    })
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    const desc = (form.description || '').trim();
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!desc) {
      toast.error('Enter a description');
      return;
    }
    setSubmitting(true);
    try {
      await expensesApi.create({
        amount,
        description: desc,
        expense_date: form.expense_date || today,
        ...(form.category_id ? { category_id: form.category_id } : {}),
      });
      toast.success('Expense recorded');
      setForm((f) => ({ ...f, amount: '', description: '' }));
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async () => {
    const name = (newCategoryName || '').trim();
    if (!name) {
      toast.error('Enter category name');
      return;
    }
    try {
      await expensesApi.createCategory({ name });
      toast.success('Category added');
      setNewCategoryName('');
      setShowAddCategory(false);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to add category');
    }
  };

  if (!currentShop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Please select a shop</p>
      </div>
    );
  }

  const fmt = (n: number) => `${currency} ${Number(n).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  Record daily expenses. Totals update for today, this week, and this month.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Today
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(todayTotal)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">This week (last 7 days)</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(weekTotal)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">This month</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(monthTotal)}</p>
          </div>
        </div>

        {/* Add expense form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" /> Record expense
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description *
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g. Transport, electricity, restock"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">— None —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  >
                    + Category
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 btn-primary-gradient rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save expense'}
            </button>
          </form>
        </div>

        {/* Recent expenses (this month) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            This month&apos;s expenses
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 px-6 py-8 text-center">
              No expenses this month yet. Record one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        {(exp.expense_date || '').toString().slice(0, 10)}
                      </td>
                      <td className="px-6 py-3">{exp.description || '—'}</td>
                      <td className="px-6 py-3">
                        {exp.category?.name || '—'}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">
                        {fmt(Number(exp.amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add category modal */}
      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Add category
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              e.g. Transport, Electricity, Restock, Staff
            </p>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategoryName('');
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-2 btn-primary-gradient rounded-lg"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
