import { describe, expect, it } from 'vitest';

import { ROLE_DEFAULT_PERMISSIONS, ROLE_LABELS } from '../../src/authz/defaults';
import { hasPermission } from '../../src/authz/permissions';
import type { AppRole, UserAccessProfile } from '../../src/authz/types';
import { seedState } from '../../src/data/seedBusiness';
import { buildRoleDashboardModel, selectNotificationsForUser } from './role-dashboard';

const roles = Object.keys(ROLE_DEFAULT_PERMISSIONS) as AppRole[];

function userFor(role: AppRole): UserAccessProfile {
  return {
    userId: `user-${role}`,
    name: ROLE_LABELS[role],
    email: `${role.toLowerCase()}@example.com`,
    role,
    roleLabel: ROLE_LABELS[role],
    grantedPermissions: [],
    revokedPermissions: [],
  };
}

describe('role dashboard models', () => {
  it.each(roles)('builds a complete, role-specific dashboard for %s', (role) => {
    const user = userFor(role);
    const model = buildRoleDashboardModel({ state: seedState, user, hasPermission: (permission) => hasPermission(user, permission) });

    expect(model.title).toBeTruthy();
    expect(model.description).toBeTruthy();
    // The accountant carries a richer financial snapshot (6 tiles); other roles use 4.
    expect(model.metrics).toHaveLength(role === 'Accountant' ? 6 : 4);
    expect(model.queues.length).toBeGreaterThan(0);
    expect(model.queues.every((queue) => queue.href.startsWith('/'))).toBe(true);
  });

  it('gives the accountant revenue and net cash movement on the dashboard', () => {
    const user = userFor('Accountant');
    const model = buildRoleDashboardModel({ state: seedState, user, hasPermission: (permission) => hasPermission(user, permission) });
    const labels = model.metrics.map((metric) => metric.label);
    expect(labels).toEqual(['Revenue today', 'Cash received today', 'Receivables', 'Supplier obligations', 'Expenses today', 'Net cash movement']);
  });

  it('removes revoked workflow links from the dashboard', () => {
    const user = { ...userFor('SalesManager'), revokedPermissions: ['inventory.view' as const] };
    const model = buildRoleDashboardModel({ state: seedState, user, hasPermission: (permission) => hasPermission(user, permission) });

    expect(model.queues.some((queue) => queue.href.startsWith('/inventory') || queue.href.startsWith('/reorder'))).toBe(false);
    expect(model.showCommerce).toBe(false);
  });
});

describe('enterprise notification targeting', () => {
  it('returns public, directly addressed, and role-addressed notifications only', () => {
    const user = userFor('Accountant');
    const notifications = [
      { id: 'public', title: 'Public', message: 'For all', createdAt: '2026-07-16T09:00:00Z', readByUserIds: [], entityType: 'business' as const, entityId: 'biz' },
      { id: 'direct', title: 'Direct', message: 'For user', createdAt: '2026-07-16T10:00:00Z', recipientUserIds: [user.userId], readByUserIds: [], entityType: 'business' as const, entityId: 'biz' },
      { id: 'role', title: 'Role', message: 'For accountants', createdAt: '2026-07-16T11:00:00Z', recipientRoles: ['Accountant' as const], readByUserIds: [], entityType: 'payable' as const, entityId: 'payable' },
      { id: 'hidden', title: 'Hidden', message: 'For warehouse', createdAt: '2026-07-16T12:00:00Z', recipientRoles: ['WarehouseManager' as const], readByUserIds: [], entityType: 'business' as const, entityId: 'biz' },
    ];

    expect(selectNotificationsForUser(notifications, user).map((notification) => notification.id)).toEqual(['role', 'direct', 'public']);
  });
});
