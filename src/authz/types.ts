export type AppRole =
  | 'Admin'
  | 'GeneralManager'
  | 'SalesManager'
  | 'Accountant'
  | 'WarehouseManager'
  | 'StoreManager'
  | 'PurchaseManager';

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
  | 'vendors.view'
  | 'vendors.manage'
  | 'vendors.create'
  | 'vendors.edit'
  | 'purchases.view'
  | 'purchases.create'
  | 'purchases.approve'
  | 'purchases.receive'
  | 'procurement.view'
  | 'procurement.create'
  | 'procurement.approve'
  | 'payables.view'
  | 'payables.manage'
  | 'payables.approve'
  | 'payables.pay'
  | 'payments.view'
  | 'payments.record'
  | 'transfers.view'
  | 'transfers.create'
  | 'transfers.approve'
  | 'transfers.dispatch'
  | 'transfers.receive'
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
  businessId?: string;
  name: string;
  email: string;
  username?: string;
  temporaryPassword?: string;
  credentialsGeneratedAt?: string;
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
