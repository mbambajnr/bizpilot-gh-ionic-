import { describe, it, expect } from 'vitest';
import { hasPermission } from './permissions';
import { UserAccessProfile } from './types';
import { ROLE_DEFAULT_PERMISSIONS } from './defaults';

describe('RBAC Logic', () => {
  it('should resolve system administration permissions for Admin by default', () => {
    const admin: UserAccessProfile = {
      userId: '1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: [],
    };
    
    expect(hasPermission(admin, 'users.manage')).toBe(true);
    expect(hasPermission(admin, 'roles.assign')).toBe(true);
    expect(hasPermission(admin, 'permissions.manage')).toBe(true);
    expect(hasPermission(admin, 'business.edit')).toBe(true);
    expect(hasPermission(admin, 'branding.manage')).toBe(true);
    expect(hasPermission(admin, 'inventory.value.view')).toBe(true);
    expect(hasPermission(admin, 'inventory.create')).toBe(false);
    expect(hasPermission(admin, 'accounting.access')).toBe(false);
    expect(hasPermission(admin, 'purchases.approve')).toBe(false);
    expect(hasPermission(admin, 'purchases.receive')).toBe(false);
    expect(hasPermission(admin, 'payables.pay')).toBe(false);
    expect(hasPermission(admin, 'transfers.approve')).toBe(false);
  });

  it('should resolve full operational permissions for General Manager by default', () => {
    const generalManager: UserAccessProfile = {
      userId: 'gm',
      name: 'General Manager',
      email: 'gm@test.com',
      role: 'GeneralManager',
      grantedPermissions: [],
      revokedPermissions: [],
    };

    expect(hasPermission(generalManager, 'reports.financial.view')).toBe(true);
    expect(hasPermission(generalManager, 'inventory.value.view')).toBe(true);
    expect(hasPermission(generalManager, 'purchases.approve')).toBe(true);
    expect(hasPermission(generalManager, 'payables.approve')).toBe(true);
    expect(hasPermission(generalManager, 'transfers.approve')).toBe(true);
    expect(hasPermission(generalManager, 'purchases.receive')).toBe(false);
    expect(hasPermission(generalManager, 'payables.pay')).toBe(false);
    expect(hasPermission(generalManager, 'transfers.dispatch')).toBe(false);
    expect(hasPermission(generalManager, 'transfers.receive')).toBe(false);
    expect(hasPermission(generalManager, 'inventory.adjust')).toBe(false);
    expect(hasPermission(generalManager, 'expenses.create')).toBe(false);
    expect(hasPermission(generalManager, 'expenses.edit')).toBe(false);
    expect(hasPermission(generalManager, 'users.manage')).toBe(false);
    expect(hasPermission(generalManager, 'permissions.manage')).toBe(false);
    expect(hasPermission(generalManager, 'business.edit')).toBe(false);
  });

  it('should resolve partial permissions for SalesManager by default', () => {
    const sales: UserAccessProfile = {
      userId: '2',
      name: 'Sales',
      email: 'sales@test.com',
      role: 'SalesManager',
      grantedPermissions: [],
      revokedPermissions: [],
    };
    
    expect(hasPermission(sales, 'sales.create')).toBe(true);
    expect(hasPermission(sales, 'inventory.view')).toBe(true);
    // Blocked by default
    expect(hasPermission(sales, 'inventory.value.view')).toBe(false);
    expect(hasPermission(sales, 'inventory.create')).toBe(false);
    expect(hasPermission(sales, 'sales.reverse')).toBe(false);
    expect(hasPermission(sales, 'accounting.access')).toBe(false);
  });

  it('should resolve finance-focused permissions for Accountant by default', () => {
    const accountant: UserAccessProfile = {
      userId: '3',
      name: 'Accountant',
      email: 'accountant@test.com',
      role: 'Accountant',
      grantedPermissions: [],
      revokedPermissions: [],
    };
    
    expect(hasPermission(accountant, 'accounting.access')).toBe(true);
    expect(hasPermission(accountant, 'inventory.value.view')).toBe(true);
    expect(hasPermission(accountant, 'customers.ledger.view')).toBe(true);
    expect(hasPermission(accountant, 'payables.view')).toBe(true);
    expect(hasPermission(accountant, 'payables.pay')).toBe(true);
    expect(hasPermission(accountant, 'payments.record')).toBe(true);
    expect(hasPermission(accountant, 'expenses.view')).toBe(true);
    expect(hasPermission(accountant, 'expenses.create')).toBe(true);
    expect(hasPermission(accountant, 'reports.financial.view')).toBe(true);
    expect(hasPermission(accountant, 'sales.view')).toBe(true);
    expect(hasPermission(accountant, 'invoices.view')).toBe(true);
    expect(hasPermission(accountant, 'reports.sales.view')).toBe(true);
    expect(hasPermission(accountant, 'purchases.view')).toBe(true);
    expect(hasPermission(accountant, 'procurement.view')).toBe(false);
    expect(hasPermission(accountant, 'payables.approve')).toBe(false);
    expect(hasPermission(accountant, 'transfers.view')).toBe(false);
  });

  it('should allow Admin to grant specific permissions to SalesManager', () => {
    const sales: UserAccessProfile = {
      userId: '2',
      name: 'Sales',
      email: 'sales@test.com',
      role: 'SalesManager',
      grantedPermissions: ['inventory.create', 'sales.reverse'],
      revokedPermissions: [],
    };
    
    expect(hasPermission(sales, 'inventory.create')).toBe(true);
    expect(hasPermission(sales, 'sales.reverse')).toBe(true);
  });

  it('should allow Admin to revoke specific system permissions from Admin (Deny wins)', () => {
    const admin: UserAccessProfile = {
      userId: '1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: ['business.edit'],
    };
    
    expect(hasPermission(admin, 'business.edit')).toBe(false);
    expect(hasPermission(admin, 'business.view')).toBe(true);
  });

  it('should enforce Deny wins if a permission is both granted and revoked', () => {
    const sales: UserAccessProfile = {
      userId: '2',
      name: 'Sales',
      email: 'sales@test.com',
      role: 'SalesManager',
      grantedPermissions: ['inventory.create'],
      revokedPermissions: ['inventory.create'],
    };
    
    expect(hasPermission(sales, 'inventory.create')).toBe(false);
  });

  it('should give Warehouse Manager warehouse and transfer permissions by default', () => {
    const warehouseManager: UserAccessProfile = {
      userId: '4',
      name: 'Warehouse',
      email: 'warehouse@test.com',
      role: 'WarehouseManager',
      grantedPermissions: [],
      revokedPermissions: [],
    };

    expect(hasPermission(warehouseManager, 'purchases.receive')).toBe(true);
    expect(hasPermission(warehouseManager, 'transfers.dispatch')).toBe(true);
    expect(hasPermission(warehouseManager, 'inventory.value.view')).toBe(false);
    expect(hasPermission(warehouseManager, 'transfers.approve')).toBe(false);
    expect(hasPermission(warehouseManager, 'transfers.receive')).toBe(false);
    expect(hasPermission(warehouseManager, 'inventory.adjust')).toBe(true);
    expect(hasPermission(warehouseManager, 'payables.manage')).toBe(false);
  });

  it('should give Store Manager store operations permissions by default', () => {
    const storeManager: UserAccessProfile = {
      userId: '5',
      name: 'Store',
      email: 'store@test.com',
      role: 'StoreManager',
      grantedPermissions: [],
      revokedPermissions: [],
    };

    expect(hasPermission(storeManager, 'sales.create')).toBe(true);
    expect(hasPermission(storeManager, 'quotations.convert')).toBe(true);
    expect(hasPermission(storeManager, 'accounting.access')).toBe(true);
    expect(hasPermission(storeManager, 'payments.record')).toBe(true);
    expect(hasPermission(storeManager, 'transfers.receive')).toBe(true);
    expect(hasPermission(storeManager, 'inventory.value.view')).toBe(false);
    expect(hasPermission(storeManager, 'restockRequests.create')).toBe(true);
    expect(hasPermission(storeManager, 'vendors.view')).toBe(false);
    expect(hasPermission(storeManager, 'vendors.manage')).toBe(false);
    expect(hasPermission(storeManager, 'purchases.view')).toBe(false);
    expect(hasPermission(storeManager, 'purchases.create')).toBe(false);
    expect(hasPermission(storeManager, 'procurement.view')).toBe(false);
    expect(hasPermission(storeManager, 'procurement.create')).toBe(false);
  });

  it('should give Purchase Manager procurement permissions by default', () => {
    const purchaseManager: UserAccessProfile = {
      userId: '6',
      name: 'Purchase',
      email: 'purchase@test.com',
      role: 'PurchaseManager',
      grantedPermissions: [],
      revokedPermissions: [],
    };

    expect(hasPermission(purchaseManager, 'vendors.manage')).toBe(true);
    expect(hasPermission(purchaseManager, 'inventory.create')).toBe(true);
    expect(hasPermission(purchaseManager, 'inventory.value.view')).toBe(false);
    expect(hasPermission(purchaseManager, 'purchases.receive')).toBe(false);
    expect(hasPermission(purchaseManager, 'purchases.approve')).toBe(false);
    expect(hasPermission(purchaseManager, 'procurement.approve')).toBe(false);
    expect(hasPermission(purchaseManager, 'transfers.view')).toBe(false);
    expect(hasPermission(purchaseManager, 'payables.pay')).toBe(false);
  });

  it('should expose default permission bundles for every supported base role', () => {
    expect(Object.keys(ROLE_DEFAULT_PERMISSIONS).sort()).toEqual([
      'Accountant',
      'Admin',
      'GeneralManager',
      'PurchaseManager',
      'SalesManager',
      'StoreManager',
      'WarehouseManager',
    ]);
  });
});
