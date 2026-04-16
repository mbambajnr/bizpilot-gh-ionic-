import { describe, it, expect } from 'vitest';
import { hasPermission } from './permissions';
import { UserAccessProfile } from './types';

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
    
    expect(hasPermission(accountant, 'accounting.access')).toBe(false);
    expect(hasPermission(accountant, 'sales.view')).toBe(false);
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
});
