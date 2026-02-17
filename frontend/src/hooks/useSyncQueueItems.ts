import { useEffect, useState } from "react";
import { QUEUE_CHANGED_EVENT, type SyncQueueItem } from "../offline/db";
import { listQueueItems } from "../offline/offlineQueue";

export function useSyncQueueItems(limit = 100) {
  const [items, setItems] = useState<SyncQueueItem[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const data = await listQueueItems(limit);
      if (active) setItems(data);
    };
    refresh();

    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      active = false;
      window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [limit]);

  return items;
}
