import { describe, it, expect } from 'vitest';
import { hasPermission } from './permissions';
import { UserAccessProfile } from './types';
import { ROLE_DEFAULT_PERMISSIONS } from './defaults';

describe('RBAC Logic', () => {
  it('should resolve full permissions for Admin by default', () => {
    const admin: UserAccessProfile = {
      userId: '1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: [],
    };
    
    expect(hasPermission(admin, 'inventory.create')).toBe(true);
    expect(hasPermission(admin, 'accounting.access')).toBe(true);
    expect(hasPermission(admin, 'users.manage')).toBe(true);
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
    expect(hasPermission(sales, 'inventory.create')).toBe(false);
    expect(hasPermission(sales, 'sales.reverse')).toBe(false);
    expect(hasPermission(sales, 'accounting.access')).toBe(false);
  });

  it('should resolve no permissions for Accountant by default', () => {
    const accountant: UserAccessProfile = {
      userId: '3',
      name: 'Accountant',
      email: 'accountant@test.com',
      role: 'Accountant',
      grantedPermissions: [],
      revokedPermissions: [],
    };
    
    expect(hasPermission(accountant, 'accounting.access')).toBe(true);
    expect(hasPermission(accountant, 'sales.view')).toBe(true);
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

  it('should allow Admin to revoke specific permissions from Admin (Deny wins)', () => {
    const admin: UserAccessProfile = {
      userId: '1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: ['inventory.create'],
    };
    
    expect(hasPermission(admin, 'inventory.create')).toBe(false);
    expect(hasPermission(admin, 'inventory.view')).toBe(true);
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
    expect(hasPermission(storeManager, 'transfers.receive')).toBe(true);
    expect(hasPermission(storeManager, 'restockRequests.create')).toBe(true);
    expect(hasPermission(storeManager, 'vendors.manage')).toBe(false);
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
    expect(hasPermission(purchaseManager, 'purchases.approve')).toBe(true);
    expect(hasPermission(purchaseManager, 'procurement.approve')).toBe(true);
    expect(hasPermission(purchaseManager, 'transfers.view')).toBe(false);
    expect(hasPermission(purchaseManager, 'payables.pay')).toBe(false);
  });

  it('should expose default permission bundles for every supported base role', () => {
    expect(Object.keys(ROLE_DEFAULT_PERMISSIONS).sort()).toEqual([
      'Accountant',
      'Admin',
      'PurchaseManager',
      'SalesManager',
      'StoreManager',
      'WarehouseManager',
    ]);
  });
});
