import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

// "2 min ago" and Today/Earlier grouping read the clock through state, so renders stay pure.
export function useNow(intervalMs = MINUTE_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
