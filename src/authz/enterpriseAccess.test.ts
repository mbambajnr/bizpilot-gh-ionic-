import { ROLE_DEFAULT_PERMISSIONS } from './defaults';
import { resolveEnterpriseAccess, resolveEnterpriseDefaultRoute } from './enterpriseAccess';
import type { AppPermission, AppRole } from './types';

function permissionsFor(role: AppRole, extra: AppPermission[] = [], revoked: AppPermission[] = []) {
  const permissions = new Set([...ROLE_DEFAULT_PERMISSIONS[role], ...extra]);
  revoked.forEach((permission) => permissions.delete(permission));
  return (permission: AppPermission) => permissions.has(permission);
}

describe('enterprise route access', () => {
  it('allows a system administrator dashboard access without operational report permission', () => {
    expect(resolveEnterpriseAccess({ pathname: '/dashboard', workspaceLive: true, role: 'Admin', hasPermission: permissionsFor('Admin') }).status).toBe('allowed');
  });

  it('blocks direct operational URLs that are not assigned to the role', () => {
    expect(resolveEnterpriseAccess({ pathname: '/sales', workspaceLive: true, role: 'Accountant', hasPermission: permissionsFor('Accountant') }).status).toBe('unauthorized');
    expect(resolveEnterpriseAccess({ pathname: '/pos', workspaceLive: true, role: 'WarehouseManager', hasPermission: permissionsFor('WarehouseManager') }).status).toBe('unauthorized');
    expect(resolveEnterpriseAccess({ pathname: '/inventory', workspaceLive: true, role: 'Admin', hasPermission: permissionsFor('Admin') }).status).toBe('unauthorized');
  });

  it('uses invoice permission for invoice and waybill detail URLs', () => {
    const check = permissionsFor('SalesManager');
    expect(resolveEnterpriseAccess({ pathname: '/sales/sale-1', workspaceLive: true, role: 'SalesManager', hasPermission: check }).status).toBe('allowed');
    expect(resolveEnterpriseAccess({ pathname: '/sales/sale-1/waybill', workspaceLive: true, role: 'SalesManager', hasPermission: check }).status).toBe('allowed');
  });

  it('protects the native reorder workspace with inventory access', () => {
    expect(resolveEnterpriseAccess({ pathname: '/reorder', workspaceLive: true, role: 'SalesManager', hasPermission: permissionsFor('SalesManager') }).status).toBe('allowed');
    expect(resolveEnterpriseAccess({ pathname: '/reorder', workspaceLive: true, role: 'Admin', hasPermission: permissionsFor('Admin') }).status).toBe('unauthorized');
  });

  it('blocks operations until launch while preserving setup access for administrators', () => {
    const admin = permissionsFor('Admin');
    expect(resolveEnterpriseAccess({ pathname: '/dashboard', workspaceLive: false, role: 'Admin', hasPermission: admin }).status).toBe('setupRequired');
    expect(resolveEnterpriseAccess({ pathname: '/settings', workspaceLive: false, role: 'Admin', hasPermission: admin }).status).toBe('allowed');
    expect(resolveEnterpriseAccess({ pathname: '/settings', workspaceLive: false, role: 'GeneralManager', hasPermission: permissionsFor('GeneralManager') }).status).toBe('setupRequired');
  });

  it('chooses a landing page the current role can actually use', () => {
    expect(resolveEnterpriseDefaultRoute({ workspaceLive: true, role: 'Accountant', hasPermission: permissionsFor('Accountant') })).toBe('/dashboard');
    expect(resolveEnterpriseDefaultRoute({ workspaceLive: true, role: 'PurchaseManager', hasPermission: permissionsFor('PurchaseManager', [], ['reports.dashboard.view']) })).toBe('/inventory');
    expect(resolveEnterpriseDefaultRoute({ workspaceLive: false, role: 'Admin', hasPermission: permissionsFor('Admin') })).toBe('/settings');
  });

  it('denies native routes that have no declared access policy', () => {
    expect(resolveEnterpriseAccess({ pathname: '/not-a-module', workspaceLive: true, role: 'GeneralManager', hasPermission: permissionsFor('GeneralManager') }).status).toBe('unauthorized');
  });
});
