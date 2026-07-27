import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Payment } from '../data/seedBusiness';
import { buildBankReconciliation, reconciliationDifference } from './bankReconciliation';
import { setPaymentReconciledInState, type ActionResult } from './businessLogic';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

let counter = 0;
function payment(partial: Partial<Payment> & Pick<Payment, 'sourceType' | 'amount' | 'method'>): Payment {
  counter += 1;
  return { id: `pay-${counter}`, paymentCode: `PMT-${counter}`, sourceId: `src-${counter}`, reference: `REF-${counter}`, recordedBy: 'u', createdAt: `2026-07-${10 + counter}T09:00:00.000Z`, ...partial };
}

function stateWith(payments: Payment[]): BusinessState {
  return { ...seedState, payments, businessProfile: { ...seedState.businessProfile, currency: 'GHS' } };
}

describe('bank reconciliation', () => {
  const payments = [
    payment({ sourceType: 'invoice', amount: 500, method: 'bank' }), // in
    payment({ sourceType: 'sale', amount: 200, method: 'bank' }), // in
    payment({ sourceType: 'payable', amount: 300, method: 'bank' }), // out
    payment({ sourceType: 'sale', amount: 80, method: 'cash' }), // separate account
  ];

  it('groups payments into per-account cashbooks with a signed book balance', () => {
    const accounts = buildBankReconciliation(stateWith(payments));
    expect(accounts.map((account) => account.channel)).toEqual(['bank', 'cash']); // bank-first ordering
    const bank = accounts.find((account) => account.channel === 'bank')!;
    expect(bank.bookBalance).toBe(400); // +500 +200 -300
    expect(bank.movements.find((movement) => movement.sourceType === 'payable')?.direction).toBe('out');
    expect(bank.unreconciledCount).toBe(3);
  });

  it('tracks the cleared balance as movements are reconciled', () => {
    let state = stateWith(payments);
    const bankBefore = buildBankReconciliation(state).find((account) => account.channel === 'bank')!;
    expect(bankBefore.clearedBalance).toBe(0);

    // Clear the two inflows only.
    state = unwrap(setPaymentReconciledInState(state, { paymentId: payments[0].id, reconciled: true, reconciledByUserId: 'u' }));
    state = unwrap(setPaymentReconciledInState(state, { paymentId: payments[1].id, reconciled: true, reconciledByUserId: 'u' }));
    const bank = buildBankReconciliation(state).find((account) => account.channel === 'bank')!;
    expect(bank.clearedBalance).toBe(700); // +500 +200 cleared
    expect(bank.unreconciledCount).toBe(1); // the -300 payable
    expect(bank.unreconciledTotal).toBe(-300);
  });

  it('un-reconciles a movement back to uncleared', () => {
    let state = stateWith(payments);
    state = unwrap(setPaymentReconciledInState(state, { paymentId: payments[0].id, reconciled: true, reconciledByUserId: 'u' }));
    state = unwrap(setPaymentReconciledInState(state, { paymentId: payments[0].id, reconciled: false, reconciledByUserId: 'u' }));
    expect(state.payments.find((entry) => entry.id === payments[0].id)?.reconciledAt).toBeUndefined();
    expect(buildBankReconciliation(state).find((account) => account.channel === 'bank')!.clearedBalance).toBe(0);
  });

  it('computes the statement difference, zero when it reconciles', () => {
    expect(reconciliationDifference(700, 700)).toBe(0);
    expect(reconciliationDifference(700, 650)).toBe(-50);
    expect(reconciliationDifference(700, undefined)).toBeNull();
  });

  it('rejects reconciling an unknown payment', () => {
    expect(setPaymentReconciledInState(stateWith(payments), { paymentId: 'nope', reconciled: true, reconciledByUserId: 'u' }).ok).toBe(false);
  });
});
