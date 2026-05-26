import { useEffect, useState } from "react";

/** Returns a Date that ticks at the given interval (default 1s). */
export function useLiveClock(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
