import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, CustomerLedgerEntry } from '../data/seedBusiness';
import { selectCustomerStatement, selectCustomerStatementLines } from './businessSelectors';

let counter = 0;
function entry(partial: Partial<CustomerLedgerEntry> & Pick<CustomerLedgerEntry, 'type' | 'amountDelta' | 'createdAt'>): CustomerLedgerEntry {
  counter += 1;
  return { id: `led-${counter}`, entryNumber: `LED-${counter}`, customerId: 'c1', referenceNumber: `REF-${counter}`, note: '', ...partial };
}

function stateWith(entries: CustomerLedgerEntry[]): BusinessState {
  return { ...seedState, customerLedgerEntries: entries };
}

describe('customer statement lines', () => {
  const entries = [
    entry({ type: 'opening_balance', amountDelta: 200, createdAt: '2026-06-01T09:00:00.000Z' }),
    entry({ type: 'sale_charge', amountDelta: 500, createdAt: '2026-06-10T09:00:00.000Z' }),
    entry({ type: 'payment_received', amountDelta: -300, createdAt: '2026-06-20T09:00:00.000Z' }),
    entry({ type: 'sale_charge', amountDelta: 150, createdAt: '2026-06-25T09:00:00.000Z' }),
  ];

  it('orders entries oldest-first and accumulates a running balance', () => {
    const lines = selectCustomerStatementLines(stateWith(entries), 'c1');
    expect(lines.map((line) => line.runningBalance)).toEqual([200, 700, 400, 550]);
    expect(lines[0].entry.type).toBe('opening_balance'); // oldest first
  });

  it('ends at the same closing balance the summary reports', () => {
    const state = stateWith(entries);
    const lines = selectCustomerStatementLines(state, 'c1');
    expect(lines[lines.length - 1].runningBalance).toBe(selectCustomerStatement(state, 'c1').closingBalance);
  });

  it('preserves the signed amount and only includes the requested customer', () => {
    const mixed = [...entries, entry({ type: 'sale_charge', amountDelta: 999, createdAt: '2026-06-05T09:00:00.000Z', customerId: 'c2' })];
    const lines = selectCustomerStatementLines(stateWith(mixed), 'c1');
    expect(lines).toHaveLength(4);
    expect(lines.find((line) => line.entry.type === 'payment_received')?.amountDelta).toBe(-300);
  });

  it('returns an empty statement for a customer with no ledger', () => {
    expect(selectCustomerStatementLines(stateWith(entries), 'nobody')).toEqual([]);
  });
});
