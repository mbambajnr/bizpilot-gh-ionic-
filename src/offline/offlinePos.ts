/**
 * Offline-capable POS checkout.
 *
 * A counter sale made without connectivity is captured in the shared offline
 * queue and replayed against Magento when the network returns. This is SAFE
 * because every sale carries a stable clientRef and the Magento endpoint is
 * idempotent on it: however many times a queued sale is replayed (flaky
 * reconnects, app restarts), Magento records it exactly once.
 */

import {
  createMagentoPosOrder,
  loadMagentoCatalog,
  type MagentoCatalog,
  type MagentoPosOrder,
  type MagentoPosOrderInput,
} from '../lib/magentoClient';
import { isLikelyNetworkError, isOnline } from './networkStatus';
import { offlineSyncQueue, registerOfflineOperation } from './offlineSync';

const OP_NAME = 'magentoPosSale';
const CATALOG_CACHE_KEY = 'bizpilot-pos-catalog-cache-v1';

/** Wordings that mean "couldn't reach the server", not "the server said no". */
const RETRYABLE_POS_PATTERNS = [
  /sign in to use this feature/i, // auth token was stale mid-flush; retry after refresh
];

registerOfflineOperation(OP_NAME, async (...args: never[]) => {
  const input = args[0] as unknown as MagentoPosOrderInput;
  if (!isOnline()) {
    return { outcome: 'retry', error: 'Device is offline.' };
  }
  try {
    await createMagentoPosOrder(input);
    return { outcome: 'done' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isLikelyNetworkError(error) || RETRYABLE_POS_PATTERNS.some((p) => p.test(message))) {
      return { outcome: 'retry', error: message };
    }
    return { outcome: 'reject', error: message };
  }
});

export type PosCatalogResult = {
  catalog: MagentoCatalog;
  /** Set when the catalog came from the local cache instead of Magento. */
  cachedAt?: string;
};

/**
 * Loads the POS catalog, caching every good response so the register still
 * opens (with the last known products, prices, and branches) when offline.
 * Queued offline sales are re-validated by Magento at replay time anyway, so
 * a slightly stale catalog can never corrupt anything server-side.
 */
export async function loadPosCatalogWithOfflineSupport(): Promise<PosCatalogResult> {
  try {
    const result = await loadMagentoCatalog();
    try {
      window.localStorage.setItem(
        CATALOG_CACHE_KEY,
        JSON.stringify({ catalog: result.catalog, cachedAt: new Date().toISOString() })
      );
    } catch {
      // Cache write failure must never break a successful load.
    }
    return { catalog: result.catalog };
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      try {
        const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { catalog: MagentoCatalog; cachedAt: string };
          if (cached?.catalog?.products) {
            return { catalog: cached.catalog, cachedAt: cached.cachedAt };
          }
        }
      } catch {
        // Fall through to the original error.
      }
    }
    throw error;
  }
}

export type PosCheckoutResult =
  | { status: 'placed'; order: MagentoPosOrder }
  | { status: 'queued'; clientRef: string };

/**
 * Places a POS sale, falling back to the offline queue when the network is
 * down. A 'queued' result means the sale IS recorded (locally, durably) and
 * the cashier can move on — the cart must be cleared exactly as on success.
 */
export async function placePosOrderWithOfflineSupport(
  input: MagentoPosOrderInput
): Promise<PosCheckoutResult> {
  if (!isOnline()) {
    offlineSyncQueue.enqueue(OP_NAME, [input], `${OP_NAME}:${input.clientRef}`);
    return { status: 'queued', clientRef: input.clientRef };
  }

  try {
    const result = await createMagentoPosOrder(input);
    return { status: 'placed', order: result.order };
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      offlineSyncQueue.enqueue(OP_NAME, [input], `${OP_NAME}:${input.clientRef}`);
      return { status: 'queued', clientRef: input.clientRef };
    }
    throw error; // Real rejection (bad SKU, auth, validation) — show it.
  }
}
