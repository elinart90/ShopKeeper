import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useOfflineStatus } from "../../../hooks/useOfflineStatus";
import { useSyncQueueCount } from "../../../hooks/useSyncQueueCount";
import { useSyncQueueItems } from "../../../hooks/useSyncQueueItems";
import { clearFailedQueueItems, processQueueOnce, removeQueueItem, retryQueueItem } from "../../../offline/offlineQueue";

type StatusFilter = "all" | "pending" | "processing" | "failed";
type EntityFilter = "all" | "sale" | "inventory";

export default function SyncCenterPage() {
  const navigate = useNavigate();
  const { online } = useOfflineStatus();
  const counts = useSyncQueueCount();
  const items = useSyncQueueItems(2000);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [search, setSearch] = useState("");
  const [syncingNow, setSyncingNow] = useState(false);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (entityFilter !== "all" && item.entity !== entityFilter) return false;
      if (!q) return true;
      return (
        String(item.url || "").toLowerCase().includes(q) ||
        String(item.opId || "").toLowerCase().includes(q) ||
        String(item.lastError || "").toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, entityFilter, search]);

  const syncNow = async () => {
    setSyncingNow(true);
    try {
      const result = await processQueueOnce();
      toast.success(`Sync complete: ${result.processed} processed`);
    } finally {
      setSyncingNow(false);
    }
  };

  const retryOne = async (id?: number) => {
    if (!id) return;
    await retryQueueItem(id);
    toast.success("Sync job re-queued");
  };

  const discardOne = async (id?: number) => {
    if (!id) return;
    await removeQueueItem(id);
    toast.success("Sync job discarded");
  };

  const clearFailed = async () => {
    await clearFailedQueueItems();
    toast.success("Failed sync jobs cleared");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Sync Center</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Large queue view with retry/discard controls and sync diagnostics.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  online
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {online ? "Online" : "Offline"}
              </span>
              <button
                type="button"
                onClick={syncNow}
                disabled={!online || syncingNow}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${syncingNow ? "animate-spin" : ""}`} />
                {syncingNow ? "Syncing..." : "Sync now"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Pending" value={counts.pending} />
          <StatCard label="Failed" value={counts.failed} danger />
          <StatCard label="Processing" value={counts.processing} />
          <StatCard label="Total" value={counts.total} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by URL, op id, or error..."
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="all">All entities</option>
              <option value="sale">Sale</option>
              <option value="inventory">Inventory</option>
            </select>
            <button
              type="button"
              onClick={clearFailed}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              <Trash2 className="h-4 w-4" />
              Clear failed
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/60">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Entity</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Action</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">URL</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Retries</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Error</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Created</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No queue items match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id || item.opId} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            item.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : item.status === "processing"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{item.entity}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{item.action}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.url}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.retries}</td>
                      <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400 max-w-[260px]">
                        {item.lastError || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.status !== "processing" && (
                            <button
                              type="button"
                              onClick={() => retryOne(item.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => discardOne(item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                            Discard
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
        {value}
      </p>
    </div>
  );
}
