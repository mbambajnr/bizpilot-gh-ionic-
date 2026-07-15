import { describe, expect, it } from 'vitest';

import { createStockTransferInState } from '../utils/businessLogic';

/**
 * Verifies the warehouse->store replenishment the Reorder view creates is a
 * VALID BizPilot transfer for the exact shape ReorderPage builds.
 */
function seededState() {
  return {
    businessProfile: { id: 'demo-biz' },
    products: [
      { id: 'p-fur1', inventoryId: 'FUR-001', name: 'Nordic Oak Bookshelf', unit: 'units', price: 295, cost: 180, reorderLevel: 5, image: '' },
    ],
    locations: [
      { id: 'loc-wh', name: 'Central Warehouse', type: 'warehouse', isDefault: false, isActive: true },
      { id: 'loc-pipe', name: 'Pipe Ano', type: 'store', isDefault: true, isActive: true },
    ],
    locationSupplyRoutes: [{ id: 'rt-1', fromLocationId: 'loc-wh', toLocationId: 'loc-pipe', isActive: true }],
    stockMovements: [
      { id: 'mv-1', movementNumber: 'MV-001', productId: 'p-fur1', locationId: 'loc-wh', type: 'opening', quantityDelta: 50, quantityAfter: 50, createdAt: new Date().toISOString() },
    ],
    stockTransfers: [],
    // fields the reducer touches but we don't exercise here
    users: [], customers: [], sales: [], quotations: [], purchases: [], vendors: [],
    accountsPayable: [], payments: [], productCategories: [], restockRequests: [],
    activityLogEntries: [], notifications: [], customerLedgerEntries: [], expenses: [],
  } as never;
}

describe('Reorder view warehouse->store transfer', () => {
  it('creates a valid pending transfer from the warehouse to the needy store', () => {
    const result = createStockTransferInState(seededState(), {
      fromWarehouseId: 'loc-wh',
      toStoreId: 'loc-pipe',
      items: [{ productId: 'p-fur1', quantity: 4 }],
      initiatedBy: 'demo-admin',
      note: 'Reorder feed replenishment',
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) return;
    const transfer = result.data.stockTransfers.find((t) => t.fromWarehouseId === 'loc-wh');
    expect(transfer).toBeTruthy();
    expect(transfer?.toStoreId).toBe('loc-pipe');
    expect(transfer?.status).toBe('pending');
    expect(transfer?.items[0]).toMatchObject({ productId: 'p-fur1', quantity: 4 });
  });

  it('rejects a store->store transfer (BizPilot is warehouse->store only)', () => {
    const state = seededState() as { locations: Array<{ id: string; type: string }> };
    // add a second store and a bogus route between two stores
    state.locations.push({ id: 'loc-mc', name: 'Market Circle', type: 'store', isDefault: false, isActive: true } as never);
    const result = createStockTransferInState(state as never, {
      fromWarehouseId: 'loc-mc', // a STORE, not a warehouse
      toStoreId: 'loc-pipe',
      items: [{ productId: 'p-fur1', quantity: 1 }],
      initiatedBy: 'demo-admin',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.toLowerCase()).toContain('warehouse');
  });
});
