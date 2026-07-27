import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Product, Quotation, QuotationLine, StockMovement } from '../data/seedBusiness';
import {
  releaseReservationsForReferenceInState,
  reserveQuotationStockInState,
  selectAvailableQuantity,
  selectReservedQuantity,
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
function line(productId: string, quantity: number): QuotationLine {
  return { productId, productName: productId.toUpperCase(), inventoryId: productId.toUpperCase(), quantity, unitPrice: 10, total: 10 * quantity };
}
function quotation(items: QuotationLine[]): Quotation {
  return { ...seedState.quotations?.[0], id: 'q1', quotationNumber: 'QTN-1', customerName: 'C', clientId: 'CLT', createdAt: '2026-07-10T09:00:00.000Z', items, totalAmount: 100, status: 'open' } as Quotation;
}
function stateWith(quote: Quotation): BusinessState {
  return { ...seedState, products: [product('p1'), product('p2')], stockMovements: [opening('p1', 10), opening('p2', 4)], quotations: [quote], stockReservations: [] };
}

describe('quotation stock hold', () => {
  it('reserves every line at the location, reducing available', () => {
    const state = unwrap(reserveQuotationStockInState(stateWith(quotation([line('p1', 3), line('p2', 2)])), { quotationId: 'q1', locationId: 'loc1' }));
    expect(selectAvailableQuantity(state, 'p1', 'loc1')).toBe(7);
    expect(selectAvailableQuantity(state, 'p2', 'loc1')).toBe(2);
    expect(state.stockReservations.filter((entry) => entry.referenceId === 'q1' && entry.status === 'active')).toHaveLength(2);
  });

  it('is atomic — one short line blocks the whole hold', () => {
    const result = reserveQuotationStockInState(stateWith(quotation([line('p1', 3), line('p2', 9)])), { quotationId: 'q1', locationId: 'loc1' });
    expect(result.ok).toBe(false); // p2 needs 9, only 4 available
    if (result.ok) throw new Error('should not reserve');
  });

  it('aggregates repeated products so a quote cannot oversell itself', () => {
    // Two lines of p2 (3 + 3 = 6) exceed the 4 on hand.
    expect(reserveQuotationStockInState(stateWith(quotation([line('p2', 3), line('p2', 3)])), { quotationId: 'q1', locationId: 'loc1' }).ok).toBe(false);
  });

  it('refuses to double-book a quote that already holds stock', () => {
    const held = unwrap(reserveQuotationStockInState(stateWith(quotation([line('p1', 2)])), { quotationId: 'q1', locationId: 'loc1' }));
    expect(reserveQuotationStockInState(held, { quotationId: 'q1', locationId: 'loc1' }).ok).toBe(false);
  });

  it('releasing the hold returns availability to full', () => {
    let state = unwrap(reserveQuotationStockInState(stateWith(quotation([line('p1', 5)])), { quotationId: 'q1', locationId: 'loc1' }));
    expect(selectReservedQuantity(state, 'p1', 'loc1')).toBe(5);
    state = unwrap(releaseReservationsForReferenceInState(state, 'q1'));
    expect(selectReservedQuantity(state, 'p1', 'loc1')).toBe(0);
    expect(selectAvailableQuantity(state, 'p1', 'loc1')).toBe(10);
  });
});
