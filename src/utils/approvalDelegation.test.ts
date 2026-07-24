import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import { hasPermission } from '../authz/permissions';
import type { AppPermission, UserAccessProfile } from '../authz/types';
import { assignApprovalDelegateInState, canApproveCategory, revokeApprovalDelegateInState } from './businessLogic';

const gm: UserAccessProfile = { userId: 'u-gm', name: 'Grace', email: 'gm@e.com', role: 'GeneralManager', grantedPermissions: [], revokedPermissions: [] };
const accountant: UserAccessProfile = { userId: 'u-acc', name: 'Ama', email: 'acc@e.com', role: 'Accountant', grantedPermissions: [], revokedPermissions: [] };
const bound = (user: UserAccessProfile) => (permission: AppPermission) => hasPermission(user, permission);
const base = { ...seedState, users: [gm, accountant], approvalDelegations: [] };
const categories = ['payables', 'purchases', 'transfers'] as const;

describe('approval delegation', () => {
  it('lets the GM approve every category, and no one else by default', () => {
    for (const category of categories) {
      expect(canApproveCategory(base, gm, category, bound(gm))).toBe(true);
      expect(canApproveCategory(base, accountant, category, bound(accountant))).toBe(false);
    }
  });

  it('grants a delegate only the categories they were assigned', () => {
    const result = assignApprovalDelegateInState(base, { delegateUserId: 'u-acc', categories: ['payables'], assignedByUserId: 'u-gm' });
    expect(result.ok).toBe(true);
    const state = result.data!;
    expect(canApproveCategory(state, accountant, 'payables', bound(accountant))).toBe(true);
    expect(canApproveCategory(state, accountant, 'purchases', bound(accountant))).toBe(false);
    expect(canApproveCategory(state, accountant, 'transfers', bound(accountant))).toBe(false);
  });

  it('rejects self-delegation, an empty category set, and inactive delegates', () => {
    expect(assignApprovalDelegateInState(base, { delegateUserId: 'u-gm', categories: ['payables'], assignedByUserId: 'u-gm' }).ok).toBe(false);
    expect(assignApprovalDelegateInState(base, { delegateUserId: 'u-acc', categories: [], assignedByUserId: 'u-gm' }).ok).toBe(false);
    const withInactive = { ...base, users: [gm, { ...accountant, accountStatus: 'deactivated' as const }] };
    expect(assignApprovalDelegateInState(withInactive, { delegateUserId: 'u-acc', categories: ['payables'], assignedByUserId: 'u-gm' }).ok).toBe(false);
  });

  it('reassigning replaces the delegate’s prior delegation rather than stacking', () => {
    const first = assignApprovalDelegateInState(base, { delegateUserId: 'u-acc', categories: ['payables'], assignedByUserId: 'u-gm' }).data!;
    const second = assignApprovalDelegateInState(first, { delegateUserId: 'u-acc', categories: ['purchases'], assignedByUserId: 'u-gm' }).data!;
    expect(second.approvalDelegations).toHaveLength(1);
    expect(canApproveCategory(second, accountant, 'payables', bound(accountant))).toBe(false);
    expect(canApproveCategory(second, accountant, 'purchases', bound(accountant))).toBe(true);
  });

  it('revokes a delegation, removing the delegate’s authority', () => {
    const assigned = assignApprovalDelegateInState(base, { delegateUserId: 'u-acc', categories: ['payables'], assignedByUserId: 'u-gm' }).data!;
    const revoked = revokeApprovalDelegateInState(assigned, { delegationId: assigned.approvalDelegations[0].id }).data!;
    expect(revoked.approvalDelegations).toHaveLength(0);
    expect(canApproveCategory(revoked, accountant, 'payables', bound(accountant))).toBe(false);
  });
});
