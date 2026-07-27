import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Product, StockMovement } from '../data/seedBusiness';
import {
  releaseReservationInState,
  releaseReservationsForReferenceInState,
  reserveStockInState,
  selectAvailableQuantity,
  selectReservedQuantity,
  type ReserveStockInput,
} from './inventoryAvailability';
import type { ActionResult } from './businessLogic';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

let counter = 0;
function product(id: string): Product {
  return { ...seedState.products[0], id, inventoryId: id.toUpperCase(), name: id.toUpperCase(), unit: 'pcs' };
}
function opening(productId: string, qty: number): StockMovement {
  counter += 1;
  return { id: `m-${counter}`, movementNumber: `MOV-${counter}`, productId, locationId: 'loc1', type: 'opening', quantityDelta: qty, quantityAfter: qty, createdAt: '2026-07-01T09:00:00.000Z', note: '' };
}
function baseState(): BusinessState {
  return { ...seedState, products: [product('p1')], stockMovements: [opening('p1', 10)], stockReservations: [] };
}
const reserve = (over: Partial<ReserveStockInput> = {}): ReserveStockInput => ({ productId: 'p1', locationId: 'loc1', quantity: 3, ...over });

describe('inventory availability & reservations', () => {
  it('available starts equal to on-hand with no reservations', () => {
    const state = baseState();
    expect(selectAvailableQuantity(state, 'p1', 'loc1')).toBe(10);
    expect(selectReservedQuantity(state, 'p1', 'loc1')).toBe(0);
  });

  it('a reservation reduces available without touching on-hand', () => {
    const state = unwrap(reserveStockInState(baseState(), reserve({ quantity: 4 })));
    expect(selectReservedQuantity(state, 'p1', 'loc1')).toBe(4);
    expect(selectAvailableQuantity(state, 'p1', 'loc1')).toBe(6); // 10 on-hand − 4 reserved
  });

  it('blocks reserving more than is available (prevents overselling)', () => {
    let state = unwrap(reserveStockInState(baseState(), reserve({ quantity: 8 })));
    // 2 left available; a 3-unit reservation must fail.
    const result = reserveStockInState(state, reserve({ quantity: 3 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('available to reserve');
    // But exactly the remaining 2 succeeds and drives available to 0.
    state = unwrap(reserveStockInState(state, reserve({ quantity: 2 })));
    expect(selectAvailableQuantity(state, 'p1', 'loc1')).toBe(0);
  });

  it('releasing a reservation returns the stock to available', () => {
    const reserved = unwrap(reserveStockInState(baseState(), reserve({ quantity: 5 })));
    const reservationId = reserved.stockReservations[0].id;
    const released = unwrap(releaseReservationInState(reserved, { reservationId }));
    expect(selectReservedQuantity(released, 'p1', 'loc1')).toBe(0);
    expect(selectAvailableQuantity(released, 'p1', 'loc1')).toBe(10);
    expect(releaseReservationInState(released, { reservationId }).ok).toBe(false); // already released
  });

  it('releases every active reservation for an order reference', () => {
    let state = unwrap(reserveStockInState(baseState(), reserve({ quantity: 2, referenceId: 'sale-1' })));
    state = unwrap(reserveStockInState(state, reserve({ quantity: 3, referenceId: 'sale-1' })));
    state = unwrap(reserveStockInState(state, reserve({ quantity: 1, referenceId: 'sale-2' })));
    state = unwrap(releaseReservationsForReferenceInState(state, 'sale-1'));
    expect(selectReservedQuantity(state, 'p1', 'loc1')).toBe(1); // only sale-2 remains
  });

  it('rejects non-positive quantities and unknown products', () => {
    expect(reserveStockInState(baseState(), reserve({ quantity: 0 })).ok).toBe(false);
    expect(reserveStockInState(baseState(), reserve({ productId: 'nope' })).ok).toBe(false);
  });
});
