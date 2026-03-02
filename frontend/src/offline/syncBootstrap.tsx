import { useEffect, useRef } from "react";
import { processQueueOnce } from "./offlineQueue";
import { QUEUE_CHANGED_EVENT } from "./db";

export default function SyncBootstrap() {
  const syncingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const run = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        await processQueueOnce();
      } finally {
        syncingRef.current = false;
      }
    };

    const onOnline = () => run();

    // When a new item lands in the queue while the device is online,
    // flush the queue immediately instead of waiting for the 20s poll.
    const onQueueChanged = () => {
      if (typeof navigator !== "undefined" && navigator.onLine) run();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    run();
    timerRef.current = window.setInterval(run, 20000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  return null;
}
