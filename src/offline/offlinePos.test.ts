import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOrderMock = vi.fn();
const loadCatalogMock = vi.fn();

vi.mock('../lib/magentoClient', () => ({
  createMagentoPosOrder: (...args: unknown[]) => createOrderMock(...args),
  loadMagentoCatalog: (...args: unknown[]) => loadCatalogMock(...args),
}));

vi.mock('../data/supabaseSync', () => ({
  getLastSupabaseSyncErrorMessage: () => null,
  verifyEmployeeCredential: vi.fn(),
  rotateEmployeePassword: vi.fn(),
  ...Object.fromEntries(
    [
      'syncProduct', 'syncProductCategory', 'syncBusinessLocation', 'syncSupplyRoute', 'syncVendor',
      'syncEmployeeVendor', 'syncCustomer',
      'syncSale', 'syncQuotation', 'syncPurchase', 'syncEmployeePurchase', 'syncEmployeeCredential',
      'syncBusinessProfile', 'syncActivityLogEntry', 'syncAppNotification', 'syncAppNotificationRead',
      'syncExpenseForUser', 'syncStockMovementForUser', 'syncAccountsPayableForUser', 'syncPaymentForUser',
      'syncRestockRequestForUser', 'syncStockTransferForUser',
    ].map((name) => [name, vi.fn()])
  ),
}));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

const SALE_INPUT = {
  branchId: 1,
  clientRef: 'BISA-test-ref-123',
  customer: { name: 'Ama', email: '', phone: '' },
  paymentMethod: 'Cash' as const,
  items: [{ sku: 'FUR-001', quantity: 2 }],
};

describe('offlinePos', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    createOrderMock.mockReset();
    loadCatalogMock.mockReset();
    setNavigatorOnline(true);
  });

  it('places the sale normally when online', async () => {
    createOrderMock.mockResolvedValue({ ok: true, order: { orderNumber: '42' } });
    const mod = await import('./offlinePos');

    const result = await mod.placePosOrderWithOfflineSupport(SALE_INPUT);

    expect(result).toEqual({ status: 'placed', order: { orderNumber: '42' } });
  });

  it('queues the sale when offline — cashier can keep working', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlinePos');
    const sync = await import('./offlineSync');

    const result = await mod.placePosOrderWithOfflineSupport(SALE_INPUT);

    expect(result).toEqual({ status: 'queued', clientRef: 'BISA-test-ref-123' });
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(sync.getPendingOfflineSync()).toHaveLength(1);
  });

  it('replays the queued sale on flush with the SAME clientRef (idempotent on Magento)', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlinePos');
    const sync = await import('./offlineSync');
    await mod.placePosOrderWithOfflineSupport(SALE_INPUT);

    setNavigatorOnline(true);
    createOrderMock.mockResolvedValue({ ok: true, order: { orderNumber: '43' } });
    const result = await sync.flushOfflineSync();

    expect(result.flushed).toBe(1);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientRef: 'BISA-test-ref-123' })
    );
    expect(sync.getPendingOfflineSync()).toHaveLength(0);
  });

  it('queues when the request dies mid-flight (server unreachable)', async () => {
    createOrderMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const mod = await import('./offlinePos');
    const sync = await import('./offlineSync');

    const result = await mod.placePosOrderWithOfflineSupport(SALE_INPUT);

    expect(result.status).toBe('queued');
    expect(sync.getPendingOfflineSync()).toHaveLength(1);
  });

  it('re-throws real rejections (bad SKU etc.) instead of queueing', async () => {
    createOrderMock.mockRejectedValue(new Error('Product NOPE-1 is not available for sale.'));
    const mod = await import('./offlinePos');
    const sync = await import('./offlineSync');

    await expect(mod.placePosOrderWithOfflineSupport(SALE_INPUT)).rejects.toThrow('NOPE-1');
    expect(sync.getPendingOfflineSync()).toHaveLength(0);
  });

  it('keeps a queued sale (retry) when replay hits the network again, drops after server rejection limit', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlinePos');
    const sync = await import('./offlineSync');
    await mod.placePosOrderWithOfflineSupport(SALE_INPUT);

    setNavigatorOnline(true);
    createOrderMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const retryResult = await sync.flushOfflineSync();

    expect(retryResult.stoppedForNetwork).toBe(true);
    expect(sync.getPendingOfflineSync()).toHaveLength(1);
    expect(sync.getPendingOfflineSync()[0].attempts).toBe(0); // network ≠ attempt
  });

  it('serves the cached catalog when offline and marks it as cached', async () => {
    loadCatalogMock.mockResolvedValue({
      ok: true,
      catalog: { products: [{ sku: 'FUR-001' }], branches: [{ id: 1 }] },
    });
    const mod = await import('./offlinePos');
    const live = await mod.loadPosCatalogWithOfflineSupport();
    expect(live.cachedAt).toBeUndefined();

    setNavigatorOnline(false);
    loadCatalogMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const cached = await mod.loadPosCatalogWithOfflineSupport();

    expect(cached.cachedAt).toBeTruthy();
    expect(cached.catalog.products[0]).toEqual({ sku: 'FUR-001' });
  });
});
