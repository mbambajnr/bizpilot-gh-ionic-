import { describe, expect, it } from 'vitest';

import { DEFAULT_ORDER_TYPES, seedState } from '../data/seedBusiness';
import type { BusinessState, Product, Quotation, QuotationLine, StockMovement, StockReservation } from '../data/seedBusiness';
import { addQuotationToState, convertQuotationToSalesState, setQuotationHoldInState } from './businessLogic';
import type { ActionResult } from './businessLogic';
import { isQuotationStockAllocated, reserveQuotationStockInState } from './inventoryAvailability';
import { defaultOrderTypeHoldsOnEntry, defaultOrderTypeRequiresAllocation } from './orderTypes';
import { describeConversionBlock, selectQuotesForAutoReserve } from './orderProcessing';

const NOW = Date.parse('2026-07-20T12:00:00.000Z');

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
function prospectQuote(items: QuotationLine[], overrides: Partial<Quotation> = {}): Quotation {
  return {
    ...seedState.quotations?.[0], id: 'q1', quotationNumber: 'QTN-1', customerName: 'Prospect Co', clientId: 'PROSPECT',
    createdAt: '2026-07-10T09:00:00.000Z', items, totalAmount: 100, status: 'open',
    customerType: 'prospect', prospect: { name: 'Prospect Co', phone: '0240001122' }, ...overrides,
  } as Quotation;
}
/** Seed-derived state with crafted stock at loc1 and the default (SO) order type patched. */
function stateWith(quote: Quotation, soPatch: Partial<(typeof DEFAULT_ORDER_TYPES)[number]> = {}): BusinessState {
  return {
    ...seedState,
    products: [product('p1'), product('p2')],
    stockMovements: [opening('p1', 10), opening('p2', 4)],
    quotations: [quote],
    stockReservations: [],
    orderTypes: DEFAULT_ORDER_TYPES.map((type) => (type.code === 'SO' ? { ...type, ...soPatch } : type)),
  };
}

describe('holdOnEntry enforcement', () => {
  it('parks a new quotation on hold when the default order type holds on entry', () => {
    const state = { ...seedState, orderTypes: DEFAULT_ORDER_TYPES.map((type) => (type.code === 'SO' ? { ...type, holdOnEntry: true } : type)) };
    const quoted = unwrap(addQuotationToState(state, { customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }] }));
    expect(quoted.quotations[0].onHold).toBe(true);
  });

  it('leaves new quotations off hold by default', () => {
    const quoted = unwrap(addQuotationToState(seedState, { customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }] }));
    expect(quoted.quotations[0].onHold).toBeUndefined();
  });

  it('blocks converting an order that is on hold', () => {
    const result = convertQuotationToSalesState(stateWith(prospectQuote([line('p1', 1)], { onHold: true })), { quotationId: 'q1', paymentMethod: 'Cash', amountPaid: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/on hold/i);
  });

  it('releases the hold and lets the order convert again', () => {
    const held = stateWith(prospectQuote([line('p1', 1)], { onHold: true }));
    const released = unwrap(setQuotationHoldInState(held, { quotationId: 'q1', onHold: false }));
    expect(released.quotations[0].onHold).toBeUndefined();
    expect(setQuotationHoldInState(released, { quotationId: 'q1', onHold: false }).ok).toBe(false); // already off hold
    expect(describeConversionBlock(released, released.quotations[0])).toBeNull();
  });
});

describe('requireAllocation enforcement', () => {
  it('blocks conversion when allocation is required but stock is not held', () => {
    const result = convertQuotationToSalesState(stateWith(prospectQuote([line('p1', 1)]), { requireAllocation: true }), { quotationId: 'q1', paymentMethod: 'Cash', amountPaid: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/allocation/i);
  });

  it('clears the gate once every line is held', () => {
    const base = stateWith(prospectQuote([line('p1', 2)]), { requireAllocation: true });
    const held = unwrap(reserveQuotationStockInState(base, { quotationId: 'q1', locationId: 'loc1' }));
    expect(isQuotationStockAllocated(held, held.quotations[0])).toBe(true);
    expect(describeConversionBlock(held, held.quotations[0])).toBeNull();
  });

  it('treats a partially-held line as not allocated', () => {
    const base = stateWith(prospectQuote([line('p1', 5)]));
    const reservation: StockReservation = { id: 'r1', productId: 'p1', locationId: 'loc1', quantity: 3, status: 'active', reason: 'quotation', referenceId: 'q1', createdAt: '2026-07-11T09:00:00.000Z' };
    const partial = { ...base, stockReservations: [reservation] };
    expect(isQuotationStockAllocated(partial, partial.quotations[0])).toBe(false);
  });
});

describe('order-type policy helpers', () => {
  it('reads the default order type policy flags', () => {
    expect(defaultOrderTypeHoldsOnEntry(stateWith(prospectQuote([line('p1', 1)]), { holdOnEntry: true }))).toBe(true);
    expect(defaultOrderTypeRequiresAllocation(stateWith(prospectQuote([line('p1', 1)]), { requireAllocation: true }))).toBe(true);
    expect(defaultOrderTypeHoldsOnEntry(seedState)).toBe(false);
    expect(defaultOrderTypeRequiresAllocation(seedState)).toBe(false);
  });

  it('describes each conversion-block reason', () => {
    const onHold = stateWith(prospectQuote([line('p1', 1)], { onHold: true }));
    expect(describeConversionBlock(onHold, onHold.quotations[0])?.reason).toBe('onHold');
    const alloc = stateWith(prospectQuote([line('p1', 1)]), { requireAllocation: true });
    expect(describeConversionBlock(alloc, alloc.quotations[0])?.reason).toBe('allocation');
    const clear = stateWith(prospectQuote([line('p1', 1)]));
    expect(describeConversionBlock(clear, clear.quotations[0])).toBeNull();
  });

  it('auto-reserve skips on-hold orders', () => {
    const orderTypes = DEFAULT_ORDER_TYPES.map((type) => ({ ...type, isDefault: type.code === 'SA' })); // SA auto-reserves
    const state: BusinessState = {
      ...seedState, products: [product('p1')], stockMovements: [opening('p1', 10)],
      quotations: [prospectQuote([line('p1', 2)], { onHold: true })], stockReservations: [], orderTypes,
    };
    expect(selectQuotesForAutoReserve(state, NOW)).toEqual([]);
  });
});
