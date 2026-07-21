import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NETWORK_FAILURE_MESSAGE = 'Supabase sync failed before the request could complete.';

const syncProductMock = vi.fn();
const syncVendorMock = vi.fn();
const syncQuotationMock = vi.fn();
const syncQuotationForUserMock = vi.fn();
const lastErrorMock = vi.fn<[], string | null>(() => null);

vi.mock('../data/supabaseSync', () => ({
  syncProduct: (...args: unknown[]) => syncProductMock(...args),
  syncProductCategory: vi.fn(),
  syncBusinessLocation: vi.fn(),
  syncSupplyRoute: vi.fn(),
  syncVendor: (...args: unknown[]) => syncVendorMock(...args),
  syncEmployeeVendor: vi.fn(),
  syncCustomer: vi.fn(),
  syncSale: vi.fn(),
  syncQuotation: (...args: unknown[]) => syncQuotationMock(...args),
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
  syncQuotationForUser: (...args: unknown[]) => syncQuotationForUserMock(...args),
  syncReceivablePaymentCommand: vi.fn(),
  syncSalesReturnCommand: vi.fn(),
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
    syncVendorMock.mockReset();
    syncQuotationMock.mockReset();
    syncQuotationForUserMock.mockReset();
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

  it('queues vendor changes and replays the latest supplier record', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');
    await mod.syncVendor('b1', { id: 'v1', name: 'Coastal Supply', status: 'active' } as never);
    await mod.syncVendor('b1', { id: 'v1', name: 'Coastal Supply', status: 'inactive' } as never);

    expect(mod.getPendingOfflineSync()).toHaveLength(1);
    expect(mod.getPendingOfflineSync()[0].key).toBe('syncVendor:v1');

    setNavigatorOnline(true);
    syncVendorMock.mockResolvedValue(true);
    const result = await mod.flushOfflineSync();

    expect(result.flushed).toBe(1);
    expect(syncVendorMock).toHaveBeenCalledWith('b1', { id: 'v1', name: 'Coastal Supply', status: 'inactive' });
  });

  it('never persists employee credentials with queued receivable payments', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');
    await mod.syncReceivablePaymentCommand({
      businessId: 'b1',
      user: { userId: 'employee-1', businessId: 'b1', employeeSessionSecret: 'must-not-be-persisted' },
      payment: { id: 'payment-1' },
    } as never);

    const [queued] = mod.getPendingOfflineSync();
    expect(queued.key).toBe('syncReceivablePaymentCommand:payment-1');
    expect(JSON.stringify(queued)).not.toContain('must-not-be-persisted');
    expect((queued.args[0] as { user: { employeeSessionSecret?: string } }).user.employeeSessionSecret).toBeUndefined();
  });

  it('never persists employee credentials with queued sales returns', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');
    await mod.syncSalesReturnCommand({
      businessId: 'b1',
      user: { userId: 'manager-1', businessId: 'b1', employeeSessionSecret: 'return-secret' },
      creditNote: { id: 'credit-note-1' },
    } as never);

    const [queued] = mod.getPendingOfflineSync();
    expect(queued.key).toBe('syncSalesReturnCommand:credit-note-1');
    expect(JSON.stringify(queued)).not.toContain('return-secret');
  });

  it('never persists employee credentials with queued quotation sync and rehydrates on replay', async () => {
    setNavigatorOnline(false);
    const mod = await import('./offlineSync');
    mod.setOfflineSyncUser({ userId: 'sales-1', businessId: 'b1', employeeSessionSecret: 'quote-secret' } as never);
    await mod.syncQuotationForUser(
      'b1',
      { userId: 'sales-1', businessId: 'b1', employeeSessionSecret: 'quote-secret' } as never,
      { id: 'q1', quotationNumber: 'QTN-001' } as never
    );

    const [queued] = mod.getPendingOfflineSync();
    expect(queued.key).toBe('syncQuotationForUser:q1');
    expect(JSON.stringify(queued)).not.toContain('quote-secret');

    setNavigatorOnline(true);
    syncQuotationForUserMock.mockResolvedValue(true);
    const result = await mod.flushOfflineSync();

    expect(result.flushed).toBe(1);
    expect(syncQuotationForUserMock).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ userId: 'sales-1', employeeSessionSecret: 'quote-secret' }),
      { id: 'q1', quotationNumber: 'QTN-001' }
    );
    expect(syncQuotationMock).not.toHaveBeenCalled();
  });

  it('replays legacy queued quotation writes through the active employee session', async () => {
    const mod = await import('./offlineSync');
    mod.setOfflineSyncUser({ userId: 'sales-1', businessId: 'b1', employeeSessionSecret: 'quote-secret' } as never);
    window.localStorage.setItem(
      mod.OFFLINE_SYNC_STORAGE_KEY,
      JSON.stringify([{ op: 'syncQuotation', args: ['b1', { id: 'q-legacy', quotationNumber: 'QTN-OLD' }], key: 'syncQuotation:q-legacy', attempts: 0 }])
    );
    syncQuotationForUserMock.mockResolvedValue(true);

    const result = await mod.flushOfflineSync();

    expect(result.flushed).toBe(1);
    expect(syncQuotationForUserMock).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ userId: 'sales-1', employeeSessionSecret: 'quote-secret' }),
      { id: 'q-legacy', quotationNumber: 'QTN-OLD' }
    );
    expect(syncQuotationMock).not.toHaveBeenCalled();
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
