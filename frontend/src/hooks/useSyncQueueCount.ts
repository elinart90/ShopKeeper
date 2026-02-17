import { useEffect, useState } from "react";
import { QUEUE_CHANGED_EVENT } from "../offline/db";
import { getQueueCounts } from "../offline/offlineQueue";

export function useSyncQueueCount() {
  const [counts, setCounts] = useState({ pending: 0, failed: 0, processing: 0, total: 0 });

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const data = await getQueueCounts();
      if (active) setCounts(data);
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
  }, []);

  return counts;
}
