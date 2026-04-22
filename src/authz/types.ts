export type AppRole = 'Admin' | 'SalesManager' | 'Accountant';

export type AppPermission =
  | 'users.manage'
  | 'roles.assign'
  | 'permissions.manage'
  | 'business.view'
  | 'business.edit'
  | 'sales.view'
  | 'sales.create'
  | 'sales.reverse'
  | 'quotations.view'
  | 'quotations.create'
  | 'quotations.convert'
  | 'invoices.view'
  | 'inventory.view'
  | 'inventory.create'
  | 'inventory.edit'
  | 'inventory.adjust'
  | 'inventory.restock'
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.email.send'
  | 'customers.ledger.view'
  | 'accounting.access'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'reports.financial.view'
  | 'reports.dashboard.view'
  | 'reports.sales.view'
  | 'reports.inventory.view'
  | 'restockRequests.view'
  | 'restockRequests.create'
  | 'restockRequests.manage'
  | 'invoices.print'
  | 'invoices.export_pdf'
  | 'quotations.print'
  | 'quotations.export_pdf'
  | 'branding.view'
  | 'branding.manage';

export interface UserAccessProfile {
  userId: string;
  name: string;
  email: string;
  password?: string;
  accountStatus?: 'active' | 'deactivated';
  deactivatedAt?: string;
  roleLabel?: string;
  customerEmailSenderName?: string;
  customerEmailSenderEmail?: string;
  role: AppRole;
  grantedPermissions: AppPermission[];
  revokedPermissions: AppPermission[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  message?: string;
}
