import { describe, expect, it } from 'vitest';

import { seedState, DEFAULT_ORDER_TYPES } from '../data/seedBusiness';
import type { BusinessState, Quotation, QuotationLine, StockReservation } from '../data/seedBusiness';
import { defaultOrderTypeAutoReserves, selectProcessableQuotes, selectQuotesForAutoReserve } from './orderProcessing';

const NOW = Date.parse('2026-07-20T12:00:00.000Z');

function line(quantity: number): QuotationLine {
  return { productId: 'p1', productName: 'P1', inventoryId: 'P1', quantity, unitPrice: 10, total: 10 * quantity };
}
function quote(id: string, status: Quotation['status'], items: QuotationLine[], validUntil?: string): Quotation {
  return { ...seedState.quotations?.[0], id, quotationNumber: id.toUpperCase(), customerName: 'C', clientId: 'CLT', createdAt: '2026-07-10T09:00:00.000Z', items, totalAmount: 100, status, validUntil } as Quotation;
}
function reservation(quotationId: string, quantity: number): StockReservation {
  return { id: `res-${quotationId}`, productId: 'p1', locationId: 'loc1', quantity, status: 'active', reason: 'quotation', referenceId: quotationId, createdAt: '2026-07-11T09:00:00.000Z' };
}
function stateWith(quotations: Quotation[], reservations: StockReservation[] = [], autoReserveDefault = false): BusinessState {
  const orderTypes = DEFAULT_ORDER_TYPES.map((type) => ({ ...type, isDefault: autoReserveDefault ? type.code === 'SA' : type.code === 'SO' }));
  return { ...seedState, quotations, stockReservations: reservations, orderTypes };
}

describe('batch order processing', () => {
  it('lists only open, unexpired quotations with their hold status', () => {
    const state = stateWith(
      [
        quote('q-open', 'open', [line(4)]),
        quote('q-converted', 'converted', [line(2)]),
        quote('q-expired', 'open', [line(3)], '2026-07-01T00:00:00.000Z'),
      ],
      [reservation('q-open', 4)],
    );
    const processable = selectProcessableQuotes(state, NOW);
    expect(processable.map((entry) => entry.quotation.id)).toEqual(['q-open']); // converted + expired excluded
    expect(processable[0]).toMatchObject({ held: true, heldUnits: 4, canHold: false });
  });

  it('marks an unheld quote with stock lines as holdable', () => {
    const [entry] = selectProcessableQuotes(stateWith([quote('q1', 'draft', [line(5)])]), NOW);
    expect(entry.canHold).toBe(true);
    expect(entry.held).toBe(false);
  });

  it('reports auto-reserve only when the default order type auto-reserves', () => {
    expect(defaultOrderTypeAutoReserves(stateWith([]))).toBe(false); // SO default
    expect(defaultOrderTypeAutoReserves(stateWith([], [], true))).toBe(true); // SA default
  });

  it('picks the holdable open quotes for auto-reserve only when enabled', () => {
    const quotes = [quote('q1', 'open', [line(2)]), quote('q2', 'open', [line(3)])];
    expect(selectQuotesForAutoReserve(stateWith(quotes), NOW)).toEqual([]); // SO default → nothing
    const eligible = selectQuotesForAutoReserve(stateWith(quotes, [], true), NOW);
    expect(eligible.map((quotation) => quotation.id).sort()).toEqual(['q1', 'q2']);
  });

  it('excludes already-held quotes from auto-reserve', () => {
    const eligible = selectQuotesForAutoReserve(stateWith([quote('q1', 'open', [line(2)])], [reservation('q1', 2)], true), NOW);
    expect(eligible).toEqual([]);
  });
});
