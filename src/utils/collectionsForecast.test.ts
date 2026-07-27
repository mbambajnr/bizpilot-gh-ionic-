import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Customer, CustomerLedgerEntry, Sale } from '../data/seedBusiness';
import { forecastCollections, NET_TERMS_DAYS } from './collectionsForecast';

const NOW = Date.parse('2026-07-20T12:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

let counter = 0;
function sale(partial: Partial<Sale> & Pick<Sale, 'customerId'>): Sale {
  counter += 1;
  return {
    ...seedState.sales[0],
    id: `s-${counter}`,
    invoiceNumber: `INV-${counter}`,
    status: 'Completed',
    netReceivableAmount: undefined,
    creditedAmount: undefined,
    totalAmount: 1000,
    paidAmount: 0,
    createdAt: daysAgo(5),
    ...partial,
  };
}

function pay(customerId: string, saleId: string, createdAt: string): CustomerLedgerEntry {
  counter += 1;
  return { id: `led-${counter}`, entryNumber: `LED-${counter}`, customerId, type: 'payment_received', amountDelta: 0, createdAt, relatedSaleId: saleId, note: '' };
}

function customer(partial: Partial<Customer> & Pick<Customer, 'id' | 'name'>): Customer {
  return { ...seedState.customers[0], status: 'active', ...partial };
}

function stateWith(customers: Customer[], sales: Sale[], ledger: CustomerLedgerEntry[] = []): BusinessState {
  return { ...seedState, customers, sales, customerLedgerEntries: ledger };
}

describe('AR collections forecast', () => {
  it('rates a reliable, on-time payer as low risk and only monitors', () => {
    const settledA = sale({ customerId: 'c-good', totalAmount: 500, paidAmount: 500, createdAt: daysAgo(40) });
    const settledB = sale({ customerId: 'c-good', totalAmount: 700, paidAmount: 700, createdAt: daysAgo(60) });
    const open = sale({ customerId: 'c-good', totalAmount: 400, paidAmount: 0, createdAt: daysAgo(5) });
    const ledger = [pay('c-good', settledA.id, daysAgo(30)), pay('c-good', settledB.id, daysAgo(52))]; // ~10 & ~8 days -> on time
    const [forecast] = forecastCollections(stateWith([customer({ id: 'c-good', name: 'Ada' })], [settledA, settledB, open], ledger), NOW);
    expect(forecast.riskBand).toBe('low');
    expect(forecast.suggestedAction).toBe('monitor');
    expect(forecast.historicalLateRate).toBe(0);
    expect(forecast.outstanding).toBe(400);
    expect(forecast.signals.join(' ')).toContain('on time');
  });

  it('rates a chronic late payer as high risk and flags a credit-hold review', () => {
    const lateA = sale({ customerId: 'c-bad', totalAmount: 1000, paidAmount: 1000, createdAt: daysAgo(90) });
    const lateB = sale({ customerId: 'c-bad', totalAmount: 1000, paidAmount: 1000, createdAt: daysAgo(120) });
    const open = sale({ customerId: 'c-bad', totalAmount: 2000, paidAmount: 0, createdAt: daysAgo(60) });
    const ledger = [pay('c-bad', lateA.id, daysAgo(40)), pay('c-bad', lateB.id, daysAgo(65))]; // ~50 & ~55 days -> late
    const [forecast] = forecastCollections(stateWith([customer({ id: 'c-bad', name: 'Kojo' })], [lateA, lateB, open], ledger), NOW);
    expect(forecast.riskBand).toBe('high');
    expect(forecast.suggestedAction).toBe('review_credit_hold');
    expect(forecast.historicalLateRate).toBe(1);
    expect(forecast.expectedDaysToPay).toBeGreaterThan(NET_TERMS_DAYS);
    expect(forecast.oldestOpenAgeDays).toBe(60);
  });

  it('escalates the action to a credit-hold review when the customer is over their limit', () => {
    const open = sale({ customerId: 'c-lim', totalAmount: 800, paidAmount: 0, createdAt: daysAgo(10) });
    const [forecast] = forecastCollections(stateWith([customer({ id: 'c-lim', name: 'Esi', creditLimit: 500 })], [open]), NOW);
    expect(forecast.overLimit).toBe(true);
    expect(forecast.onCreditHold).toBe(true);
    expect(forecast.suggestedAction).toBe('review_credit_hold');
  });

  it('handles a customer with no history but an overdue invoice by suggesting a reminder', () => {
    const open = sale({ customerId: 'c-new', totalAmount: 600, paidAmount: 0, createdAt: daysAgo(45) });
    const [forecast] = forecastCollections(stateWith([customer({ id: 'c-new', name: 'Nii' })], [open]), NOW);
    expect(forecast.expectedDaysToPay).toBeUndefined();
    expect(forecast.suggestedAction).toBe('send_reminder');
    expect(forecast.signals.join(' ')).toContain('No settled-invoice history');
  });

  it('excludes customers with nothing outstanding, walk-in sales, and reversed sales', () => {
    const paidOff = sale({ customerId: 'c-clear', totalAmount: 500, paidAmount: 500, createdAt: daysAgo(10) });
    const walkIn = sale({ customerId: undefined, totalAmount: 300, paidAmount: 0, createdAt: daysAgo(10) });
    const reversed = sale({ customerId: 'c-rev', totalAmount: 900, paidAmount: 0, status: 'Reversed', createdAt: daysAgo(10) });
    const forecasts = forecastCollections(stateWith([customer({ id: 'c-clear', name: 'Clear' }), customer({ id: 'c-rev', name: 'Rev' })], [paidOff, walkIn, reversed]), NOW);
    expect(forecasts).toHaveLength(0);
  });

  it('orders the queue by risk-weighted exposure, most urgent first', () => {
    const bigLate = sale({ customerId: 'c-bad', totalAmount: 5000, paidAmount: 0, createdAt: daysAgo(70) });
    const smallFresh = sale({ customerId: 'c-good', totalAmount: 400, paidAmount: 0, createdAt: daysAgo(3) });
    const forecasts = forecastCollections(stateWith([customer({ id: 'c-bad', name: 'Kojo' }), customer({ id: 'c-good', name: 'Ada' })], [bigLate, smallFresh]), NOW);
    expect(forecasts.map((entry) => entry.customerId)).toEqual(['c-bad', 'c-good']);
  });
});
