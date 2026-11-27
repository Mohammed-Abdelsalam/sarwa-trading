import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;
export const SEARCH_DEBOUNCE_MS = 300;

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

// Whole seconds left until `until`; onDone runs once the time is up.
export function useCountdown(until: number | null, onDone: () => void): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= until) onDone();
    };
    // The clock last moved when the screen mounted; catch it up before the first second passes.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until, onDone]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1_000));
}

// Search boxes query the server once typing pauses, not on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}
