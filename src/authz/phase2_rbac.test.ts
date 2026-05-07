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

  const generalManager: UserAccessProfile = {
    userId: 'gm',
    name: 'General Manager',
    email: 'gm@test.com',
    role: 'GeneralManager',
    grantedPermissions: ROLE_DEFAULT_PERMISSIONS.GeneralManager,
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
    expect(hasPermission(admin, 'vendors.manage')).toBe(true);
    expect(hasPermission(admin, 'purchases.create')).toBe(true);
    expect(hasPermission(admin, 'purchases.approve')).toBe(true);
    expect(hasPermission(admin, 'purchases.receive')).toBe(true);
    expect(hasPermission(admin, 'payables.manage')).toBe(true);
    expect(hasPermission(admin, 'payables.pay')).toBe(true);
    expect(hasPermission(admin, 'restockRequests.create')).toBe(true);
    expect(hasPermission(admin, 'restockRequests.manage')).toBe(true);
    expect(hasPermission(admin, 'transfers.create')).toBe(true);
    expect(hasPermission(admin, 'transfers.approve')).toBe(true);
    expect(hasPermission(admin, 'transfers.dispatch')).toBe(true);
    expect(hasPermission(admin, 'transfers.receive')).toBe(true);
    expect(hasPermission(admin, 'branding.manage')).toBe(true);
    expect(hasPermission(admin, 'invoices.print')).toBe(true);
    expect(hasPermission(admin, 'quotations.export_pdf')).toBe(true);
  });

  it('General Manager should have all approval and reporting permissions', () => {
    expect(hasPermission(generalManager, 'purchases.approve')).toBe(true);
    expect(hasPermission(generalManager, 'procurement.approve')).toBe(true);
    expect(hasPermission(generalManager, 'payables.approve')).toBe(true);
    expect(hasPermission(generalManager, 'transfers.approve')).toBe(true);
    expect(hasPermission(generalManager, 'restockRequests.manage')).toBe(true);
    expect(hasPermission(generalManager, 'reports.dashboard.view')).toBe(true);
    expect(hasPermission(generalManager, 'reports.financial.view')).toBe(true);
    expect(hasPermission(generalManager, 'reports.sales.view')).toBe(true);
    expect(hasPermission(generalManager, 'reports.inventory.view')).toBe(true);
  });

  it('Sales Manager should have restricted Phase 2 permissions', () => {
    // Enabled
    expect(hasPermission(salesManager, 'purchases.view')).toBe(true);
    expect(hasPermission(salesManager, 'purchases.create')).toBe(true);
    expect(hasPermission(salesManager, 'restockRequests.create')).toBe(true);
    expect(hasPermission(salesManager, 'restockRequests.view')).toBe(true);
    expect(hasPermission(salesManager, 'transfers.view')).toBe(true);
    expect(hasPermission(salesManager, 'transfers.create')).toBe(true);
    expect(hasPermission(salesManager, 'invoices.print')).toBe(true);
    expect(hasPermission(salesManager, 'quotations.export_pdf')).toBe(true);

    // Disabled
    expect(hasPermission(salesManager, 'vendors.manage')).toBe(false);
    expect(hasPermission(salesManager, 'purchases.approve')).toBe(false);
    expect(hasPermission(salesManager, 'purchases.receive')).toBe(false);
    expect(hasPermission(salesManager, 'payables.view')).toBe(false);
    expect(hasPermission(salesManager, 'restockRequests.manage')).toBe(false);
    expect(hasPermission(salesManager, 'transfers.approve')).toBe(false);
    expect(hasPermission(salesManager, 'transfers.dispatch')).toBe(false);
    expect(hasPermission(salesManager, 'transfers.receive')).toBe(false);
    expect(hasPermission(salesManager, 'branding.manage')).toBe(false);
  });

  it('Accountant should have no Phase 2 permissions by default', () => {
    expect(hasPermission(accountant, 'purchases.view')).toBe(true);
    expect(hasPermission(accountant, 'purchases.create')).toBe(false);
    expect(hasPermission(accountant, 'payables.view')).toBe(true);
    expect(hasPermission(accountant, 'payables.manage')).toBe(true);
    expect(hasPermission(accountant, 'payables.pay')).toBe(true);
    expect(hasPermission(accountant, 'restockRequests.create')).toBe(false);
    expect(hasPermission(accountant, 'transfers.view')).toBe(true);
    expect(hasPermission(accountant, 'transfers.create')).toBe(false);
    expect(hasPermission(accountant, 'transfers.receive')).toBe(false);
    expect(hasPermission(accountant, 'invoices.print')).toBe(false);
    expect(hasPermission(accountant, 'branding.view')).toBe(false);
  });
});
