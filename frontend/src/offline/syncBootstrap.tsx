import { useEffect, useRef } from "react";
import { processQueueOnce } from "./offlineQueue";

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

    const onOnline = () => {
      run();
    };

    window.addEventListener("online", onOnline);
    run();
    timerRef.current = window.setInterval(run, 20000);

    return () => {
      window.removeEventListener("online", onOnline);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  return null;
}
