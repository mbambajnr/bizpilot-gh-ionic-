import { describe, expect, it } from 'vitest';

import { seedState, type BusinessState, type Customer, type Sale } from '../data/seedBusiness';
import { isCustomerOnCreditHold, selectCustomerOutstanding, setCustomerCreditHoldInState, type ActionResult } from './businessLogic';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return { id: 'c-credit', clientId: 'CLI-C', name: 'Northstar Hotels', channel: 'Direct', status: 'active', ...overrides };
}
function creditSale(balance: number): Sale {
  return { ...seedState.sales[0], id: `s-${balance}`, customerId: 'c-credit', status: 'Completed', totalAmount: balance, netReceivableAmount: balance, creditedAmount: 0, paidAmount: 0 };
}

describe('credit control', () => {
  it('sums a customer’s outstanding balance across their sales', () => {
    const state = { ...seedState, sales: [creditSale(600), creditSale(300)] } as BusinessState;
    expect(selectCustomerOutstanding(state, 'c-credit')).toBe(900);
  });

  it('holds a customer over their limit, but not one within it, without a limit, or when released', () => {
    const overState = { ...seedState, sales: [creditSale(1200)] } as BusinessState;
    const underState = { ...seedState, sales: [creditSale(400)] } as BusinessState;
    expect(isCustomerOnCreditHold(overState, customer({ creditLimit: 1000 }))).toBe(true);
    expect(isCustomerOnCreditHold(underState, customer({ creditLimit: 1000 }))).toBe(false);
    expect(isCustomerOnCreditHold(overState, customer())).toBe(false); // no limit set
    expect(isCustomerOnCreditHold(overState, customer({ creditLimit: 1000, creditHoldOverride: true }))).toBe(false); // released
  });

  it('release / re-apply toggles the customer credit-hold override', () => {
    const state = { ...seedState, customers: [customer({ creditLimit: 1000 })] } as BusinessState;
    const released = setCustomerCreditHoldInState(state, { customerId: 'c-credit', released: true });
    expect(released.ok).toBe(true);
    expect(unwrap(released).customers[0].creditHoldOverride).toBe(true);
    const reapplied = setCustomerCreditHoldInState(unwrap(released), { customerId: 'c-credit', released: false });
    expect(unwrap(reapplied).customers[0].creditHoldOverride).toBe(false);
    expect(setCustomerCreditHoldInState(state, { customerId: 'missing', released: true }).ok).toBe(false);
  });
});
