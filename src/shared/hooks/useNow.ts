import { useEffect, useState } from "react";

/** The current time in milliseconds, updated every `intervalMs` while `enabled`. */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      setNow(Date.now());
    };
    // At once (the time may be old when this is enabled late), then every interval.
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [intervalMs, enabled]);
  return now;
}
