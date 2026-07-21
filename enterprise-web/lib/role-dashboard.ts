import type { AppNotification, BusinessState } from '../../src/data/seedBusiness';
import type { AppPermission, AppRole, UserAccessProfile } from '../../src/authz/types';
import {
  selectAccountsPayableWorklist,
  selectDashboardMetrics,
  selectProcurementWorklist,
  selectWarehouseWorklist,
} from '../../src/selectors/businessSelectors';
import { formatCurrency } from '../../src/utils/format';

export type DashboardTone = 'good' | 'warn' | 'risk' | 'neutral';
export type DashboardIconKey = 'access' | 'accounting' | 'customers' | 'inventory' | 'procurement' | 'quotations' | 'sales' | 'transfers';

export type RoleDashboardMetric = {
  label: string;
  value: string;
  note: string;
  tone: DashboardTone;
};

export type RoleDashboardQueue = {
  label: string;
  detail: string;
  value: number;
  status: string;
  tone: DashboardTone;
  href: string;
  icon: DashboardIconKey;
};

export type RoleDashboardModel = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: RoleDashboardMetric[];
  queues: RoleDashboardQueue[];
  focusLabel: string;
  primaryAction?: { label: string; href: string };
  showCommerce: boolean;
  recentMode: 'sales' | 'activity';
};

const ROLE_COPY: Record<AppRole, Pick<RoleDashboardModel, 'eyebrow' | 'title' | 'description' | 'focusLabel'>> = {
  Admin: {
    eyebrow: 'System administration',
    title: 'Workspace control',
    description: 'Govern access, security readiness, locations, and operating standards without entering day-to-day workflows.',
    focusLabel: 'Governance focus',
  },
  GeneralManager: {
    eyebrow: 'Executive operations',
    title: 'Operating overview',
    description: 'Commercial performance, working capital, approvals, and cross-location execution in one control view.',
    focusLabel: 'Management focus',
  },
  SalesManager: {
    eyebrow: 'Commercial desk',
    title: 'Sales command',
    description: 'Revenue, quotations, customer balances, and stock signals that affect today’s selling activity.',
    focusLabel: 'Commercial focus',
  },
  Accountant: {
    eyebrow: 'Finance operations',
    title: 'Financial control',
    description: 'Receivables, supplier obligations, settlement readiness, and recorded expenses requiring finance attention.',
    focusLabel: 'Finance focus',
  },
  WarehouseManager: {
    eyebrow: 'Warehouse operations',
    title: 'Stock movement control',
    description: 'Inbound receipts, transfer dispatch, receiving confirmation, and replenishment exceptions across locations.',
    focusLabel: 'Warehouse focus',
  },
  StoreManager: {
    eyebrow: 'Store operations',
    title: 'Store trading view',
    description: 'Today’s sales, customer obligations, local stock health, and incoming transfers for the trading floor.',
    focusLabel: 'Store focus',
  },
  PurchaseManager: {
    eyebrow: 'Procurement operations',
    title: 'Sourcing workbench',
    description: 'Purchase drafts, approval progress, supplier coverage, and order value moving toward warehouse receipt.',
    focusLabel: 'Procurement focus',
  },
};

export function selectNotificationsForUser(notifications: AppNotification[], user: UserAccessProfile) {
  return notifications
    .filter((notification) => {
      const hasRecipients = Boolean(notification.recipientUserIds?.length || notification.recipientRoles?.length);
      return !hasRecipients
        || notification.recipientUserIds?.includes(user.userId)
        || notification.recipientRoles?.includes(user.role);
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function buildRoleDashboardModel({ state, user, hasPermission }: { state: BusinessState; user: UserAccessProfile; hasPermission: (permission: AppPermission) => boolean }): RoleDashboardModel {
  const currency = state.businessProfile.currency;
  const metrics = selectDashboardMetrics(state);
  const procurement = selectProcurementWorklist(state);
  const payables = selectAccountsPayableWorklist(state);
  const warehouse = selectWarehouseWorklist(state);
  const notifications = selectNotificationsForUser(state.notifications, user);
  const unread = notifications.filter((notification) => !notification.readByUserIds.includes(user.userId)).length;
  const inventoryValue = metrics.inventorySummaries.reduce((total, item) => total + item.quantityOnHand * item.product.cost, 0);
  const unitsOnHand = metrics.inventorySummaries.reduce((total, item) => total + item.quantityOnHand, 0);
  const openQuotations = state.quotations.filter((quotation) => ['Draft', 'draft', 'open', 'Sent', 'sent'].includes(quotation.status)).length;
  const pendingTransfers = state.stockTransfers.filter((transfer) => !['received', 'cancelled'].includes(transfer.status)).length;
  const incomingTransfers = state.stockTransfers.filter((transfer) => ['approved', 'dispatched'].includes(transfer.status)).length;
  const pendingRestocks = state.restockRequests.filter((request) => request.status === 'Pending').length;
  const activeVendors = state.vendors.filter((vendor) => vendor.status === 'active').length;
  const openPurchaseValue = state.purchases.filter((purchase) => !['receivedToWarehouse', 'declined', 'cancelled'].includes(purchase.status)).reduce((sum, purchase) => sum + purchase.totalAmount, 0);
  const expensesToday = state.expenses.filter((expense) => new Date(expense.createdAt).toDateString() === new Date().toDateString()).reduce((sum, expense) => sum + expense.amount, 0);
  const activeUsers = state.users.filter((entry) => entry.accountStatus !== 'deactivated').length;
  const accessExceptions = state.users.filter((entry) => entry.grantedPermissions.length > 0 || entry.revokedPermissions.length > 0).length;
  const temporaryPasswords = state.users.filter((entry) => entry.passwordChangeRequired && entry.accountStatus !== 'deactivated').length;

  const metric = (label: string, value: string, note: string, tone: DashboardTone = 'neutral'): RoleDashboardMetric => ({ label, value, note, tone });
  const queue = (label: string, detail: string, value: number, status: string, tone: DashboardTone, href: string, icon: DashboardIconKey): RoleDashboardQueue => ({ label, detail, value, status, tone, href, icon });

  const models: Record<AppRole, Pick<RoleDashboardModel, 'metrics' | 'queues' | 'primaryAction' | 'showCommerce' | 'recentMode'>> = {
    Admin: {
      metrics: [
        metric('Active users', String(activeUsers), `${state.users.length - activeUsers} deactivated`, 'good'),
        metric('Access exceptions', String(accessExceptions), 'Custom grants or revocations', accessExceptions ? 'warn' : 'good'),
        metric('Active locations', String(state.locations.filter((location) => location.isActive).length), 'Operating workspace coverage', 'neutral'),
        metric('Unread notices', String(unread), `${notifications.length} governance events`, unread ? 'warn' : 'good'),
      ],
      queues: [
        queue('Temporary credentials', 'Employees who must replace a generated password.', temporaryPasswords, temporaryPasswords ? 'Action required' : 'Clear', temporaryPasswords ? 'warn' : 'good', '/settings', 'access'),
        queue('Permission exceptions', 'Profiles with access outside their role defaults.', accessExceptions, accessExceptions ? 'Review' : 'Clear', accessExceptions ? 'warn' : 'good', '/settings', 'access'),
        queue('Operating locations', 'Active stores and warehouses under workspace governance.', state.locations.filter((location) => location.isActive).length, 'Configured', 'good', '/settings', 'inventory'),
        queue('Unread system notices', 'Workspace events addressed to this administrator.', unread, unread ? 'New activity' : 'Clear', unread ? 'warn' : 'good', '/settings', 'access'),
      ],
      primaryAction: { label: 'Open workspace settings', href: '/settings' },
      showCommerce: false,
      recentMode: 'activity',
    },
    GeneralManager: {
      metrics: [
        metric('Sales today', formatCurrency(metrics.salesToday, currency), `${metrics.salesTodayCount} recorded sales`, 'good'),
        metric('Cash position', formatCurrency(metrics.cashInHand + metrics.mobileMoneyReceived, currency), 'Cash and Mobile Money', 'good'),
        metric('Receivables', formatCurrency(metrics.receivables, currency), `${metrics.customersOwingCount} customers owing`, metrics.receivables ? 'warn' : 'good'),
        metric('Inventory value', formatCurrency(inventoryValue, currency), `${metrics.lowStockCount} low-stock items`, metrics.lowStockCount ? 'warn' : 'good'),
      ],
      queues: [
        queue('Purchases awaiting approval', 'Submitted orders requiring management review.', procurement.awaitingApprovalCount, procurement.awaitingApprovalCount ? 'Review' : 'Clear', procurement.awaitingApprovalCount ? 'warn' : 'good', '/procurement', 'procurement'),
        queue('Open supplier payables', 'Outstanding vendor obligations across approved purchases.', payables.openCount, payables.openCount ? formatCurrency(payables.totalOutstandingBalance, currency) : 'Clear', payables.openCount ? 'warn' : 'good', '/accounting?segment=payables', 'accounting'),
        queue('Stock transfers in progress', 'Cross-location movements not yet received or cancelled.', pendingTransfers, pendingTransfers ? 'In progress' : 'Clear', pendingTransfers ? 'warn' : 'good', '/inventory?section=transfers', 'transfers'),
        queue('Open quotations', 'Commercial proposals awaiting conversion or follow-up.', openQuotations, openQuotations ? 'Follow up' : 'Clear', openQuotations ? 'warn' : 'good', '/quotations', 'quotations'),
      ],
      primaryAction: hasPermission('sales.create') ? { label: 'New sale', href: '/pos' } : undefined,
      showCommerce: true,
      recentMode: 'sales',
    },
    SalesManager: {
      metrics: [
        metric('Sales today', formatCurrency(metrics.salesToday, currency), `${metrics.salesTodayCount} completed transactions`, 'good'),
        metric('Open quotations', String(openQuotations), 'Proposals in the active pipeline', openQuotations ? 'warn' : 'good'),
        metric('Receivables', formatCurrency(metrics.receivables, currency), `${metrics.customersOwingCount} customer accounts`, metrics.receivables ? 'warn' : 'good'),
        metric('Stock exceptions', String(metrics.lowStockCount), 'Products below reorder level', metrics.lowStockCount ? 'risk' : 'good'),
      ],
      queues: [
        queue('Quotations to follow up', 'Draft, sent, and open commercial proposals.', openQuotations, openQuotations ? 'Follow up' : 'Clear', openQuotations ? 'warn' : 'good', '/quotations', 'quotations'),
        queue('Customer accounts owing', 'Receivable balances that may affect new credit sales.', metrics.customersOwingCount, metrics.receivables ? formatCurrency(metrics.receivables, currency) : 'Clear', metrics.receivables ? 'warn' : 'good', '/customers', 'customers'),
        queue('Low-stock selling risks', 'Products that may constrain quotations or POS fulfilment.', metrics.lowStockCount, metrics.lowStockCount ? 'Review stock' : 'Clear', metrics.lowStockCount ? 'risk' : 'good', '/reorder', 'inventory'),
        queue('Transfers in progress', 'Stock movements that may replenish selling locations.', pendingTransfers, pendingTransfers ? 'Track' : 'Clear', pendingTransfers ? 'warn' : 'good', '/inventory?section=transfers', 'transfers'),
      ],
      primaryAction: hasPermission('sales.create') ? { label: 'Open POS', href: '/pos' } : undefined,
      showCommerce: hasPermission('inventory.view'),
      recentMode: hasPermission('sales.view') ? 'sales' : 'activity',
    },
    Accountant: {
      metrics: [
        metric('Cash received today', formatCurrency(metrics.cashInHand + metrics.mobileMoneyReceived, currency), `${metrics.todayPayments.length} customer payments`, 'good'),
        metric('Receivables', formatCurrency(metrics.receivables, currency), `${metrics.customersOwingCount} accounts outstanding`, metrics.receivables ? 'warn' : 'good'),
        metric('Supplier obligations', formatCurrency(payables.totalOutstandingBalance, currency), `${payables.openCount} open payables`, payables.openCount ? 'warn' : 'good'),
        metric('Expenses today', formatCurrency(expensesToday, currency), 'Recorded operating expenses', expensesToday ? 'neutral' : 'good'),
      ],
      queues: [
        queue('Approved payables', 'Supplier obligations authorized for settlement.', payables.approvedAwaitingPaymentCount, payables.approvedAwaitingPaymentCount ? 'Ready to pay' : 'Clear', payables.approvedAwaitingPaymentCount ? 'warn' : 'good', '/accounting?segment=payables&action=payment', 'accounting'),
        queue('Part-paid obligations', 'Supplier balances with settlement still outstanding.', payables.partiallyPaidCount, payables.partiallyPaidCount ? 'Balance due' : 'Clear', payables.partiallyPaidCount ? 'warn' : 'good', '/accounting?segment=payables', 'accounting'),
        queue('Overdue payables', 'Past-due supplier balances requiring escalation.', payables.overdueCount, payables.overdueCount ? 'Escalate' : 'Clear', payables.overdueCount ? 'risk' : 'good', '/accounting?segment=payables', 'accounting'),
        queue('Customer accounts owing', 'Receivable balances available for collection follow-up.', metrics.customersOwingCount, metrics.receivables ? formatCurrency(metrics.receivables, currency) : 'Clear', metrics.receivables ? 'warn' : 'good', '/customers', 'customers'),
      ],
      primaryAction: hasPermission('expenses.create') ? { label: 'Record expense', href: '/accounting?segment=expenses' } : { label: 'Open accounting', href: '/accounting' },
      showCommerce: false,
      recentMode: 'activity',
    },
    WarehouseManager: {
      metrics: [
        metric('Units on hand', unitsOnHand.toLocaleString(), `${metrics.inventorySummaries.length} catalog items`, 'neutral'),
        metric('Low-stock items', String(metrics.lowStockCount), 'Below configured reorder levels', metrics.lowStockCount ? 'risk' : 'good'),
        metric('Inbound purchases', String(warehouse.approvedPurchasesAwaitingReceiptCount), 'Approved orders awaiting receipt', warehouse.approvedPurchasesAwaitingReceiptCount ? 'warn' : 'good'),
        metric('Transfers in motion', String(pendingTransfers), 'Pending through dispatched', pendingTransfers ? 'warn' : 'good'),
      ],
      queues: [
        queue('Purchases awaiting receipt', 'Approved supplier deliveries expected at a warehouse.', warehouse.approvedPurchasesAwaitingReceiptCount, warehouse.approvedPurchasesAwaitingReceiptCount ? 'Receive' : 'Clear', warehouse.approvedPurchasesAwaitingReceiptCount ? 'warn' : 'good', '/procurement', 'procurement'),
        queue('Transfers awaiting dispatch', 'Approved movements ready to leave the warehouse.', warehouse.transfersAwaitingDispatchCount, warehouse.transfersAwaitingDispatchCount ? 'Dispatch' : 'Clear', warehouse.transfersAwaitingDispatchCount ? 'warn' : 'good', '/inventory?section=transfers', 'transfers'),
        queue('Transfers awaiting receipt', 'Dispatched stock awaiting destination confirmation.', warehouse.transfersAwaitingReceiptCount, warehouse.transfersAwaitingReceiptCount ? 'Track' : 'Clear', warehouse.transfersAwaitingReceiptCount ? 'warn' : 'good', '/inventory?section=transfers', 'transfers'),
        queue('Replenishment requests', 'Store demand signals awaiting inventory review.', pendingRestocks, pendingRestocks ? 'Review' : 'Clear', pendingRestocks ? 'warn' : 'good', '/reorder', 'inventory'),
      ],
      primaryAction: hasPermission('inventory.view') ? { label: 'Open inventory', href: '/inventory' } : undefined,
      showCommerce: false,
      recentMode: 'activity',
    },
    StoreManager: {
      metrics: [
        metric('Sales today', formatCurrency(metrics.salesToday, currency), `${metrics.salesTodayCount} completed transactions`, 'good'),
        metric('Cash position', formatCurrency(metrics.cashInHand + metrics.mobileMoneyReceived, currency), 'Cash and Mobile Money', 'good'),
        metric('Stock exceptions', String(metrics.lowStockCount), 'Products below reorder level', metrics.lowStockCount ? 'risk' : 'good'),
        metric('Incoming transfers', String(incomingTransfers), 'Approved or dispatched to stores', incomingTransfers ? 'warn' : 'good'),
      ],
      queues: [
        queue('Incoming stock transfers', 'Approved and dispatched stock moving toward stores.', incomingTransfers, incomingTransfers ? 'Receive or track' : 'Clear', incomingTransfers ? 'warn' : 'good', '/inventory?section=transfers', 'transfers'),
        queue('Open quotations', 'Store proposals awaiting conversion or customer follow-up.', openQuotations, openQuotations ? 'Follow up' : 'Clear', openQuotations ? 'warn' : 'good', '/quotations', 'quotations'),
        queue('Customer accounts owing', 'Outstanding balances visible to the store team.', metrics.customersOwingCount, metrics.receivables ? formatCurrency(metrics.receivables, currency) : 'Clear', metrics.receivables ? 'warn' : 'good', '/customers', 'customers'),
        queue('Low-stock selling risks', 'Products that need replenishment before stockout.', metrics.lowStockCount, metrics.lowStockCount ? 'Request stock' : 'Clear', metrics.lowStockCount ? 'risk' : 'good', '/reorder', 'inventory'),
      ],
      primaryAction: hasPermission('sales.create') ? { label: 'Open POS', href: '/pos' } : undefined,
      showCommerce: hasPermission('inventory.view'),
      recentMode: hasPermission('sales.view') ? 'sales' : 'activity',
    },
    PurchaseManager: {
      metrics: [
        metric('Purchase drafts', String(procurement.draftCount), 'Orders still being prepared', procurement.draftCount ? 'warn' : 'good'),
        metric('Awaiting approval', String(procurement.awaitingApprovalCount), 'Submitted to management', procurement.awaitingApprovalCount ? 'warn' : 'good'),
        metric('Active vendors', String(activeVendors), 'Available supplier records', activeVendors ? 'good' : 'risk'),
        metric('Open order value', formatCurrency(openPurchaseValue, currency), 'Not yet received or closed', openPurchaseValue ? 'neutral' : 'good'),
      ],
      queues: [
        queue('Draft purchase orders', 'Orders requiring completion and submission.', procurement.draftCount, procurement.draftCount ? 'Continue' : 'Clear', procurement.draftCount ? 'warn' : 'good', '/procurement', 'procurement'),
        queue('Orders awaiting approval', 'Submitted purchases currently with management.', procurement.awaitingApprovalCount, procurement.awaitingApprovalCount ? 'Monitor' : 'Clear', procurement.awaitingApprovalCount ? 'warn' : 'good', '/procurement', 'procurement'),
        queue('Declined or cancelled orders', 'Closed requests that may need sourcing revision.', procurement.cancelledCount, procurement.cancelledCount ? 'Review' : 'Clear', procurement.cancelledCount ? 'risk' : 'good', '/procurement', 'procurement'),
        queue('Supplier coverage', 'Active vendor records available for purchase orders.', activeVendors, activeVendors ? 'Available' : 'Add vendors', activeVendors ? 'good' : 'risk', '/vendors', 'procurement'),
      ],
      primaryAction: hasPermission('purchases.create') || hasPermission('procurement.create') ? { label: 'Create purchase order', href: '/procurement' } : undefined,
      showCommerce: false,
      recentMode: 'activity',
    },
  };

  const model = models[user.role];
  const canOpen = (href: string) => {
    if (href.startsWith('/settings')) return hasPermission('business.view');
    if (href.startsWith('/pos')) return hasPermission('sales.create');
    if (href.startsWith('/sales')) return hasPermission('sales.view');
    if (href.startsWith('/quotations')) return hasPermission('quotations.view');
    if (href.startsWith('/customers')) return hasPermission('customers.view');
    if (href.startsWith('/vendors')) return hasPermission('vendors.view') || hasPermission('vendors.manage');
    if (href.startsWith('/accounting')) return hasPermission('accounting.access');
    if (href.startsWith('/procurement')) return hasPermission('purchases.view') || hasPermission('procurement.view');
    if (href.startsWith('/inventory') || href.startsWith('/reorder')) return hasPermission('inventory.view');
    return true;
  };

  return {
    ...ROLE_COPY[user.role],
    ...model,
    queues: model.queues.filter((entry) => canOpen(entry.href)),
    primaryAction: model.primaryAction && canOpen(model.primaryAction.href) ? model.primaryAction : undefined,
  };
}
