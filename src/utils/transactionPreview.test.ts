import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Customer, Product, Sale, StockMovement } from '../data/seedBusiness';
import { previewSaleImpact } from './transactionPreview';

let counter = 0;
function product(id: string, price: number, reorderLevel: number): Product {
  return { ...seedState.products[0], id, inventoryId: id.toUpperCase(), name: id.toUpperCase(), unit: 'pcs', price, cost: 1, reorderLevel, categoryId: undefined };
}
function opening(productId: string, qty: number): StockMovement {
  counter += 1;
  return { id: `m-${counter}`, movementNumber: `MOV-${counter}`, productId, locationId: 'loc1', type: 'opening', quantityDelta: qty, quantityAfter: qty, createdAt: '2026-06-01T09:00:00.000Z', note: '' };
}
function customer(id: string, creditLimit?: number, creditHoldOverride?: boolean): Customer {
  return { ...seedState.customers[0], id, name: id.toUpperCase(), status: 'active', creditLimit, creditHoldOverride };
}
function unpaidSale(customerId: string, total: number): Sale {
  counter += 1;
  return { ...seedState.sales[0], id: `s-${counter}`, customerId, netReceivableAmount: undefined, creditedAmount: undefined, totalAmount: total, paidAmount: 0, status: 'Completed', createdAt: '2026-06-10T09:00:00.000Z' };
}

// Tax off by default so total == subtotal and the stock/credit logic is isolated.
function stateWith(over: Partial<BusinessState> = {}): BusinessState {
  return {
    ...seedState,
    products: [product('p1', 100, 3), product('p2', 50, 1)],
    stockMovements: [opening('p1', 10), opening('p2', 2)],
    customers: [customer('c1', 500)],
    sales: [unpaidSale('c1', 300)],
    businessProfile: { ...seedState.businessProfile, currency: 'GHS', taxEnabled: false },
    closedAccountingPeriods: [],
    ...over,
  };
}

describe('sale impact preview', () => {
  it('projects stock and receivable movement for a credit sale within the limit', () => {
    const impact = previewSaleImpact(stateWith(), { customerId: 'c1', items: [{ productId: 'p1', quantity: 2 }], paidAmount: 0 });
    expect(impact.total).toBe(200);
    expect(impact.balanceDue).toBe(200);
    expect(impact.items[0]).toMatchObject({ stockBefore: 10, stockAfter: 8, insufficient: false });
    expect(impact.customer).toMatchObject({ balanceBefore: 300, balanceAfter: 500, overLimitAfter: false });
    expect(impact.canPost).toBe(true);
  });

  it('blocks a sale that pushes the customer over their credit limit', () => {
    const impact = previewSaleImpact(stateWith(), { customerId: 'c1', items: [{ productId: 'p1', quantity: 3 }], paidAmount: 0 });
    expect(impact.customer?.balanceAfter).toBe(600);
    expect(impact.customer?.overLimitAfter).toBe(true);
    expect(impact.canPost).toBe(false);
    expect(impact.blockers.join(' ')).toContain('over their credit limit');
  });

  it('allows an over-limit sale when the accountant has released the hold', () => {
    const impact = previewSaleImpact(stateWith({ customers: [customer('c1', 500, true)] }), { customerId: 'c1', items: [{ productId: 'p1', quantity: 3 }], paidAmount: 0 });
    expect(impact.customer?.overLimitAfter).toBe(true);
    expect(impact.canPost).toBe(true); // override lets it through, matching addSaleToState
  });

  it('blocks a sale with insufficient stock', () => {
    const impact = previewSaleImpact(stateWith(), { walkInName: 'Walk-in', items: [{ productId: 'p2', quantity: 5 }], paidAmount: 250 });
    expect(impact.items[0].insufficient).toBe(true);
    expect(impact.canPost).toBe(false);
    expect(impact.blockers.join(' ')).toContain('Not enough stock');
  });

  it('warns without blocking when a product drops to its reorder level', () => {
    const impact = previewSaleImpact(stateWith(), { walkInName: 'Walk-in', items: [{ productId: 'p1', quantity: 8 }], paidAmount: 800 });
    expect(impact.items[0].stockAfter).toBe(2);
    expect(impact.items[0].belowReorderAfter).toBe(true);
    expect(impact.notices.join(' ')).toContain('reorder level');
    expect(impact.canPost).toBe(true);
  });

  it('flags an out-of-stock outcome and a walk-in balance that cannot carry', () => {
    const impact = previewSaleImpact(stateWith(), { walkInName: 'Walk-in', items: [{ productId: 'p1', quantity: 10 }], paidAmount: 0 });
    expect(impact.items[0].stockAfter).toBe(0);
    expect(impact.notices.join(' ')).toContain('out of stock');
    expect(impact.notices.join(' ')).toContain('cannot carry a balance');
  });

  it('blocks a date inside a closed accounting period', () => {
    const impact = previewSaleImpact(
      stateWith({ closedAccountingPeriods: [{ period: '2026-05', closedByUserId: 'u', closedByName: 'U', closedAt: '2026-06-01T00:00:00.000Z' }] }),
      { customerId: 'c1', items: [{ productId: 'p1', quantity: 1 }], paidAmount: 0, createdAt: '2026-05-15T09:00:00.000Z' },
    );
    expect(impact.canPost).toBe(false);
    expect(impact.blockers.join(' ')).toContain('closed accounting period');
  });
});
