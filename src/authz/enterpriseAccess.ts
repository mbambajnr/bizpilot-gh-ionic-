import type { AppPermission, AppRole } from './types';

export type EnterpriseAccessStatus = 'allowed' | 'unauthorized' | 'setupRequired';

export type EnterpriseAccessResult = {
  status: EnterpriseAccessStatus;
  defaultRoute: string;
  canManageSetup: boolean;
};

type EnterpriseAccessInput = {
  pathname: string;
  workspaceLive: boolean;
  role: AppRole;
  hasPermission: (permission: AppPermission) => boolean;
};

type RouteRule = {
  matches: (pathname: string) => boolean;
  permissions: AppPermission[];
  adminDashboard?: boolean;
};

const documentPackPermissions: AppPermission[] = [
  'invoices.print',
  'invoices.export_pdf',
  'quotations.print',
  'quotations.export_pdf',
];

const reportPermissions: AppPermission[] = [
  'reports.dashboard.view',
  'reports.financial.view',
  'reports.sales.view',
  'reports.inventory.view',
  ...documentPackPermissions,
];

const routeRules: RouteRule[] = [
  { matches: (path) => /^\/sales\/[^/]+(?:\/waybill)?$/.test(path), permissions: ['invoices.view'] },
  { matches: (path) => /^\/quotations\/[^/]+$/.test(path), permissions: ['quotations.view'] },
  { matches: (path) => path === '/dashboard', permissions: ['reports.dashboard.view'], adminDashboard: true },
  { matches: (path) => path === '/sales', permissions: ['sales.view'] },
  { matches: (path) => path === '/pos', permissions: ['sales.create'] },
  { matches: (path) => path === '/inventory', permissions: ['inventory.view'] },
  { matches: (path) => path === '/reorder', permissions: ['inventory.view'] },
  { matches: (path) => path === '/procurement', permissions: ['purchases.view', 'procurement.view', 'payables.manage'] },
  { matches: (path) => path === '/vendors', permissions: ['vendors.view', 'vendors.manage'] },
  { matches: (path) => path === '/customers', permissions: ['customers.view'] },
  { matches: (path) => path === '/quotations', permissions: ['quotations.view'] },
  { matches: (path) => path === '/accounting', permissions: ['accounting.access'] },
  { matches: (path) => path === '/reports', permissions: reportPermissions },
  { matches: (path) => path === '/export/batch', permissions: documentPackPermissions },
  { matches: (path) => path === '/settings', permissions: ['business.view'] },
];

function hasAnyPermission(permissions: AppPermission[], check: EnterpriseAccessInput['hasPermission']) {
  return permissions.some(check);
}

function canUseAdminDashboard(role: AppRole, check: EnterpriseAccessInput['hasPermission']) {
  return role === 'Admin' && hasAnyPermission(['users.manage', 'permissions.manage', 'business.edit'], check);
}

export function resolveEnterpriseDefaultRoute(input: Omit<EnterpriseAccessInput, 'pathname'>) {
  const { hasPermission, role, workspaceLive } = input;
  if (!workspaceLive) return hasPermission('business.edit') ? '/settings' : '/dashboard';
  if (hasPermission('reports.dashboard.view') || canUseAdminDashboard(role, hasPermission)) return '/dashboard';
  if (hasPermission('sales.view')) return '/sales';
  if (hasPermission('sales.create')) return '/pos';
  if (hasPermission('inventory.view')) return '/inventory';
  if (hasAnyPermission(['purchases.view', 'procurement.view', 'payables.manage'], hasPermission)) return '/procurement';
  if (hasAnyPermission(['vendors.view', 'vendors.manage'], hasPermission)) return '/vendors';
  if (hasPermission('customers.view')) return '/customers';
  if (hasPermission('quotations.view')) return '/quotations';
  if (hasPermission('accounting.access')) return '/accounting';
  if (hasAnyPermission(reportPermissions, hasPermission)) return '/reports';
  if (hasPermission('business.view')) return '/settings';
  return '/auth';
}

export function resolveEnterpriseAccess(input: EnterpriseAccessInput): EnterpriseAccessResult {
  const canManageSetup = input.hasPermission('business.edit');
  const defaultRoute = resolveEnterpriseDefaultRoute(input);
  const rule = routeRules.find((candidate) => candidate.matches(input.pathname));

  if (!rule) return { status: 'unauthorized', defaultRoute, canManageSetup };

  const allowedByPermission = hasAnyPermission(rule.permissions, input.hasPermission) ||
    Boolean(rule.adminDashboard && canUseAdminDashboard(input.role, input.hasPermission));
  if (!allowedByPermission) return { status: 'unauthorized', defaultRoute, canManageSetup };

  if (!input.workspaceLive) {
    if (input.pathname === '/settings' && canManageSetup) {
      return { status: 'allowed', defaultRoute, canManageSetup };
    }
    return { status: 'setupRequired', defaultRoute, canManageSetup };
  }

  return { status: 'allowed', defaultRoute, canManageSetup };
}
