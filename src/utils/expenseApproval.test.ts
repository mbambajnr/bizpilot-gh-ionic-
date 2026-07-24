import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import { hasPermission } from '../authz/permissions';
import type { AppPermission, UserAccessProfile } from '../authz/types';
import {
  addExpenseToState,
  approveExpenseInState,
  rejectExpenseInState,
  canApproveCategory,
  assignApprovalDelegateInState,
  type ActionResult,
} from './businessLogic';
import type { BusinessState } from '../data/seedBusiness';

function unwrap(result: ActionResult<BusinessState>): BusinessState {
  if (!result.ok || !result.data) throw new Error(result.ok ? 'expected data' : result.message);
  return result.data;
}

const gm: UserAccessProfile = { userId: 'u-gm', name: 'Grace', email: 'gm@e.com', role: 'GeneralManager', grantedPermissions: [], revokedPermissions: [] };
const accountant: UserAccessProfile = { userId: 'u-acc', name: 'Ama', email: 'acc@e.com', role: 'Accountant', grantedPermissions: [], revokedPermissions: [] };
const bound = (user: UserAccessProfile) => (permission: AppPermission) => hasPermission(user, permission);

const withThreshold = (threshold?: number): BusinessState => ({
  ...seedState,
  users: [gm, accountant],
  approvalDelegations: [],
  expenses: [],
  businessProfile: { ...seedState.businessProfile, expenseApprovalThreshold: threshold },
});

const log = { recordedByUserId: 'u-clerk', recordedByName: 'Clerk' };

describe('expense approval routing', () => {
  it('auto-approves every expense when no threshold is set', () => {
    const state = unwrap(addExpenseToState(withThreshold(undefined), { category: 'Rent', amount: 5000, ...log }));
    expect(state.expenses[0].status).toBe('auto_approved');
  });

  it('auto-approves below the threshold and routes at/above it for approval', () => {
    const state = withThreshold(1000);
    expect(unwrap(addExpenseToState(state, { category: 'Rent', amount: 999, ...log })).expenses[0].status).toBe('auto_approved');
    expect(unwrap(addExpenseToState(state, { category: 'Rent', amount: 1000, ...log })).expenses[0].status).toBe('pending_approval');
    expect(unwrap(addExpenseToState(state, { category: 'Rent', amount: 2500, ...log })).expenses[0].status).toBe('pending_approval');
  });

  it('approves a pending expense and stamps the decider', () => {
    const submitted = unwrap(addExpenseToState(withThreshold(1000), { category: 'Repairs', amount: 1500, ...log }));
    const approved = unwrap(approveExpenseInState(submitted, { expenseId: submitted.expenses[0].id, decidedByUserId: gm.userId, decidedByName: gm.name }));
    const expense = approved.expenses[0];
    expect(expense.status).toBe('approved');
    expect(expense.decidedByName).toBe('Grace');
    expect(expense.decidedAt).toBeTruthy();
  });

  it('requires a reason to reject, and records it', () => {
    const submitted = unwrap(addExpenseToState(withThreshold(1000), { category: 'Marketing', amount: 3000, ...log }));
    const id = submitted.expenses[0].id;
    expect(rejectExpenseInState(submitted, { expenseId: id, decidedByUserId: gm.userId, decidedByName: gm.name, reason: '   ' }).ok).toBe(false);
    const rejected = unwrap(rejectExpenseInState(submitted, { expenseId: id, decidedByUserId: gm.userId, decidedByName: gm.name, reason: 'Not budgeted' }));
    expect(rejected.expenses[0].status).toBe('rejected');
    expect(rejected.expenses[0].rejectionReason).toBe('Not budgeted');
  });

  it('will not decide an expense that is not awaiting approval', () => {
    const autoApproved = unwrap(addExpenseToState(withThreshold(1000), { category: 'Rent', amount: 100, ...log }));
    expect(approveExpenseInState(autoApproved, { expenseId: autoApproved.expenses[0].id, decidedByUserId: gm.userId, decidedByName: gm.name }).ok).toBe(false);
  });

  it('lets a delegate approve expenses within their amount limit, escalating larger ones to the GM', () => {
    const state = unwrap(assignApprovalDelegateInState(withThreshold(1000), { delegateUserId: 'u-acc', categories: ['expenses'], assignedByUserId: 'u-gm', amountLimit: 2000 }));
    expect(canApproveCategory(state, accountant, 'expenses', bound(accountant), 1500)).toBe(true);
    expect(canApproveCategory(state, accountant, 'expenses', bound(accountant), 2500)).toBe(false);
    expect(canApproveCategory(state, gm, 'expenses', bound(gm), 2500)).toBe(true);
  });
});
