/**
 * Small network-awareness helpers shared by the offline sync layer.
 *
 * navigator.onLine is available in browsers and the Capacitor webview alike.
 * It can report false positives (captive portals), so the sync layer never
 * trusts it blindly — a failed request is also treated as a network signal.
 */

export function isOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }
  return navigator.onLine;
}

export function onNetworkChange(listener: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const handleOnline = () => listener(true);
  const handleOffline = () => listener(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/i, // Chromium
  /load failed/i, // WebKit (iOS/Safari)
  /networkerror/i, // Firefox
  /network request failed/i,
  /did not respond/i, // BizPilot server timeout wording
  /service is unavailable/i, // client-lib wording when the server is down
  /fetch failed/i, // Node undici (tests)
];

/** Heuristic: does this error smell like connectivity rather than rejection? */
export function isLikelyNetworkError(error: unknown): boolean {
  if (!isOnline()) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
