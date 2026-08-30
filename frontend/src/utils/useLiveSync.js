import { useEffect, useRef } from 'react';

/**
 * useLiveSync - Non-disruptive silent background sync hook.
 * Runs periodically only when the browser tab is active/visible.
 * Does not reset form inputs, scroll position, or trigger disruptive loaders.
 *
 * @param {Function} fetchCallback - Async or sync function to refresh data in background
 * @param {number} intervalMs - Polling interval in milliseconds (default: 6000ms)
 * @param {boolean} enabled - Whether syncing is enabled
 */
export function useLiveSync(fetchCallback, intervalMs = 6000, enabled = true) {
  const savedCallback = useRef(fetchCallback);

  useEffect(() => {
    savedCallback.current = fetchCallback;
  }, [fetchCallback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible' && savedCallback.current) {
        try {
          savedCallback.current();
        } catch (err) {
          console.debug("Silent live sync skipped on network blip:", err);
        }
      }
    };

    const id = setInterval(tick, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}

export default useLiveSync;
