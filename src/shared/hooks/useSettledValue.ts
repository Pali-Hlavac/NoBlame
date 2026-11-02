import { useEffect, useState } from "react";

/**
 * `value` once it has stayed the same for `delayMs`; until then the previous settled value.
 * For work worth doing only when the user stops moving (arrow-key browsing).
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}
