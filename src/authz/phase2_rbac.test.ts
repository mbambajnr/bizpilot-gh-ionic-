import { describe, it, expect } from 'vitest';
import { hasPermission } from './permissions';
import { UserAccessProfile } from './types';
import { ROLE_DEFAULT_PERMISSIONS } from './defaults';

describe('Phase 2 RBAC Enforcement', () => {
  const admin: UserAccessProfile = {
    userId: 'admin',
    name: 'Admin',
    email: 'admin@test.com',
    role: 'Admin',
    grantedPermissions: ROLE_DEFAULT_PERMISSIONS.Admin,
    revokedPermissions: [],
  };

  const salesManager: UserAccessProfile = {
    userId: 'sales',
    name: 'Sales Manager',
    email: 'sales@test.com',
    role: 'SalesManager',
    grantedPermissions: ROLE_DEFAULT_PERMISSIONS.SalesManager,
    revokedPermissions: [],
  };

  const accountant: UserAccessProfile = {
    userId: 'accountant',
    name: 'Accountant',
    email: 'accountant@test.com',
    role: 'Accountant',
    grantedPermissions: ROLE_DEFAULT_PERMISSIONS.Accountant,
    revokedPermissions: [],
  };

  it('Admin should have all Phase 2 permissions', () => {
    expect(hasPermission(admin, 'restockRequests.create')).toBe(true);
    expect(hasPermission(admin, 'restockRequests.manage')).toBe(true);
    expect(hasPermission(admin, 'branding.manage')).toBe(true);
    expect(hasPermission(admin, 'invoices.print')).toBe(true);
    expect(hasPermission(admin, 'quotations.export_pdf')).toBe(true);
  });

  it('Sales Manager should have restricted Phase 2 permissions', () => {
    // Enabled
    expect(hasPermission(salesManager, 'restockRequests.create')).toBe(true);
    expect(hasPermission(salesManager, 'restockRequests.view')).toBe(true);
    expect(hasPermission(salesManager, 'invoices.print')).toBe(true);
    expect(hasPermission(salesManager, 'quotations.export_pdf')).toBe(true);

    // Disabled
    expect(hasPermission(salesManager, 'restockRequests.manage')).toBe(false);
    expect(hasPermission(salesManager, 'branding.manage')).toBe(false);
  });

  it('Accountant should have no Phase 2 permissions by default', () => {
    expect(hasPermission(accountant, 'restockRequests.create')).toBe(false);
    expect(hasPermission(accountant, 'invoices.print')).toBe(false);
    expect(hasPermission(accountant, 'branding.view')).toBe(false);
  });
});
