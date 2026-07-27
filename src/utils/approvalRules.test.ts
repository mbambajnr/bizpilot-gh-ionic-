import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import type { BusinessState, Purchase } from '../data/seedBusiness';
import { addExpenseToState, createPayableFromPurchaseInState, type ActionResult } from './businessLogic';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

const log = { recordedByUserId: 'u', recordedByName: 'U' };

function withProfile(over: Partial<BusinessState['businessProfile']>): BusinessState {
  return { ...seedState, expenses: [], businessProfile: { ...seedState.businessProfile, currency: 'GHS', expenseApprovalThreshold: undefined, approvalThresholds: undefined, ...over } };
}

function purchase(id: string, total: number): Purchase {
  return { ...seedState.purchases[0], id, purchaseCode: id.toUpperCase(), totalAmount: total };
}

function payableState(over: Partial<BusinessState['businessProfile']>, total: number): BusinessState {
  const p = purchase('po-x', total);
  return { ...withProfile(over), purchases: [p], accountsPayable: [] };
}

describe('configurable approval thresholds', () => {
  it('expenses honour approvalThresholds.expenses over the legacy field', () => {
    const state = withProfile({ expenseApprovalThreshold: 5000, approvalThresholds: { expenses: 1000 } });
    // Unified config (1000) wins over the legacy 5000, so a 2000 expense must route for approval.
    const result = unwrap(addExpenseToState(state, { category: 'Rent', amount: 2000, ...log }));
    expect(result.expenses[0].status).toBe('pending_approval');
  });

  it('expenses fall back to the legacy field when the unified config is unset', () => {
    const state = withProfile({ expenseApprovalThreshold: 1000 });
    expect(unwrap(addExpenseToState(state, { category: 'Rent', amount: 1500, ...log })).expenses[0].status).toBe('pending_approval');
    expect(unwrap(addExpenseToState(state, { category: 'Rent', amount: 500, ...log })).expenses[0].status).toBe('auto_approved');
  });

  it('a payable below the payables threshold is auto-approved', () => {
    const state = payableState({ approvalThresholds: { payables: 1000 } }, 600);
    const result = unwrap(createPayableFromPurchaseInState(state, { purchaseId: 'po-x', createdBy: 'u' }));
    expect(result.accountsPayable[0].status).toBe('approved');
    expect(result.accountsPayable[0].approvedBy).toBe('system');
  });

  it('a payable at or above the payables threshold still requires approval', () => {
    const state = payableState({ approvalThresholds: { payables: 1000 } }, 1500);
    expect(unwrap(createPayableFromPurchaseInState(state, { purchaseId: 'po-x', createdBy: 'u' })).accountsPayable[0].status).toBe('pendingReview');
  });

  it('keeps the default (every bill requires approval) when no payables threshold is set', () => {
    const state = payableState({}, 50);
    expect(unwrap(createPayableFromPurchaseInState(state, { purchaseId: 'po-x', createdBy: 'u' })).accountsPayable[0].status).toBe('pendingReview');
  });
});
