import { useEffect, useState } from 'react';

/** Lightweight online heuristic without extra native modules. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return online;
}
