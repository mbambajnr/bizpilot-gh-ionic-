import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NETWORK_FAILURE_MESSAGE = 'Supabase sync failed before the request could complete.';

const syncProductMock = vi.fn();
const lastErrorMock = vi.fn<[], string | null>(() => null);

vi.mock('../data/supabaseSync', () => ({
  syncProduct: (...args: unknown[]) => syncProductMock(...args),
  syncProductCategory: vi.fn(),
  syncBusinessLocation: vi.fn(),
  syncSupplyRoute: vi.fn(),
  syncCustomer: vi.fn(),
  syncSale: vi.fn(),
  syncQuotation: vi.fn(),
  syncPurchase: vi.fn(),
  syncEmployeePurchase: vi.fn(),
  syncEmployeeCredential: vi.fn(),
  syncBusinessProfile: vi.fn(),
  syncActivityLogEntry: vi.fn(),
  syncAppNotification: vi.fn(),
  syncAppNotificationRead: vi.fn(),
  syncExpenseForUser: vi.fn(),
  syncStockMovementForUser: vi.fn(),
  syncAccountsPayableForUser: vi.fn(),
  syncPaymentForUser: vi.fn(),
  syncRestockRequestForUser: vi.fn(),
  syncStockTransferForUser: vi.fn(),
  getLastSupabaseSyncErrorMessage: () => lastErrorMock(),
  verifyEmployeeCredential: vi.fn(),
  rotateEmployeePassword: vi.fn(),
}));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

describe('offlineSync wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    syncProductMock.mockReset();
    lastErrorMock.mockReset();
    lastErrorMock.mockReturnValue(null);
    setNavigatorOnline(true);
  });

  afterEach(() => {
    setNavigatorOnline(true);
  });

  it('passes through and does not queue when online and successful', async () => {
    syncProductMock.mockResolvedValue(true);
    const mod = await import('./offlineSync');

    const ok = await mod.syncProduct('b1', { id: 'p1' } as never);

    expect(ok).toBe(true);
    expect(syncProductMock).toHaveBeenCalledTimes(1);
    expect(mod.getPendingOfflineSync()).toHaveLength(0);
  });

  it('queues instead of calling the network when offline, and reports success', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');

    const ok = await mod.syncProduct('b1', { id: 'p1', name: 'Chair' } as never);

    expect(ok).toBe(true);
    expect(syncProductMock).not.toHaveBeenCalled();
    const pending = mod.getPendingOfflineSync();
    expect(pending).toHaveLength(1);
    expect(pending[0].op).toBe('syncProduct');
    expect(pending[0].key).toBe('syncProduct:p1');
  });

  it('queues when the request dies on the network mid-flight', async () => {
    syncProductMock.mockResolvedValue(false);
    lastErrorMock.mockReturnValue(NETWORK_FAILURE_MESSAGE);
    const mod = await import('./offlineSync');

    const ok = await mod.syncProduct('b1', { id: 'p1' } as never);

    expect(ok).toBe(true);
    expect(mod.getPendingOfflineSync()).toHaveLength(1);
  });

  it('does NOT queue real server rejections — they surface as before', async () => {
    syncProductMock.mockResolvedValue(false);
    lastErrorMock.mockReturnValue('Supabase denied this save. Check RLS.');
    const mod = await import('./offlineSync');

    const ok = await mod.syncProduct('b1', { id: 'p1' } as never);

    expect(ok).toBe(false);
    expect(mod.getPendingOfflineSync()).toHaveLength(0);
  });

  it('replays queued writes on flush once back online', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');
    await mod.syncProduct('b1', { id: 'p1', name: 'v1' } as never);
    await mod.syncProduct('b1', { id: 'p1', name: 'v2' } as never); // LWW replace

    setNavigatorOnline(true);
    syncProductMock.mockResolvedValue(true);
    const result = await mod.flushOfflineSync();

    expect(result.flushed).toBe(1); // de-duped to one op
    expect(syncProductMock).toHaveBeenCalledTimes(1);
    expect(syncProductMock).toHaveBeenCalledWith('b1', { id: 'p1', name: 'v2' });
    expect(mod.getPendingOfflineSync()).toHaveLength(0);
  });

  it('flush is a no-op while still offline', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');
    await mod.syncProduct('b1', { id: 'p1' } as never);

    const result = await mod.flushOfflineSync();

    expect(result.stoppedForNetwork).toBe(true);
    expect(syncProductMock).not.toHaveBeenCalled();
    expect(mod.getPendingOfflineSync()).toHaveLength(1);
  });
});
