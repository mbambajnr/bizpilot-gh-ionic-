import type {
  ActivityLogEntry,
  BusinessState,
  BusinessLocation,
  CustomerLedgerEntry,
  CustomerType,
  LocationSupplyRoute,
  ProductCategory,
  Quotation,
  Sale,
  StockTransfer,
  StockMovement,
  TaxSnapshot,
} from '../data/seedBusiness';
import { getSelectorAnalytics } from './selectorAnalytics';

export type SalePaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Reversed';
export type StatusTone = 'success' | 'warning' | 'danger' | 'medium';

export type StatusDisplay = {
  label: string;
  helper: string;
  tone: StatusTone;
};

export type LedgerEntryDisplay = StatusDisplay & {
  amountLabel: 'Charge' | 'Payment' | 'Adjustment';
};

export type CustomerStatement = {
  openingBalance: number;
  invoiceCharges: number;
  paymentsReceived: number;
  reversals: number;
  closingBalance: number;
};

export type RevenueTrendPoint = {
  label: string;
  shortLabel: string;
  value: number;
};

export type InventoryCategoryFilterValue = 'all' | 'uncategorized' | `category:${string}`;
export type CustomerClassificationFilterValue = 'all' | CustomerType | 'unclassified';
export type InventoryLocationFilterValue = 'all' | `location:${string}`;

export type TransferHistoryEntry = {
  transferId: string;
  referenceNumber?: string;
  productId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  createdAt: string;
  note: string;
  outboundMovement: StockMovement;
  inboundMovement?: StockMovement;
};

export type InventoryCategoryReportEntry = {
  categoryId?: string;
  label: string;
  productCount: number;
  quantityOnHand: number;
  stockValue: number;
};

export type InventoryLocationReportEntry = {
  locationId: string;
  label: string;
  type: BusinessLocation['type'];
  productCount: number;
  quantityOnHand: number;
  stockValue: number;
  lowStockCount: number;
};

export type TransferSummaryEntry = {
  key: string;
  label: string;
  transferCount: number;
  quantityMoved: number;
};

export type WarehouseStockBalanceEntry = {
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantityAvailable: number;
  lastMovementAt?: string;
  vendorCode?: string;
};

export type StoreStockBalanceEntry = {
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  quantityAvailable: number;
  lastMovementAt?: string;
};

export type FastMovingInventoryEntry = {
  productId: string;
  locationId: string;
  quantityMoved: number;
  movementCount: number;
  lastMovedAt?: string;
};

export type StockTransferRecordView = {
  transfer: StockTransfer;
  fromWarehouseName: string;
  toStoreName: string;
  totalItems: number;
  totalQuantity: number;
};

export type ProcurementWorklistSummary = {
  draftCount: number;
  awaitingApprovalCount: number;
  cancelledCount: number;
};

export type WarehouseWorklistSummary = {
  approvedPurchasesAwaitingReceiptCount: number;
  transfersAwaitingDispatchCount: number;
  transfersAwaitingReceiptCount: number;
};

export type AccountsPayableWorklistSummary = {
  openCount: number;
  approvedAwaitingPaymentCount: number;
  partiallyPaidCount: number;
  overdueCount: number;
  totalOutstandingBalance: number;
};

export type ReceivableWorklistEntry = {
  customerId: string;
  customerName: string;
  balance: number;
  lastPayment: string;
};

export type SnapshotSalesSegmentEntry = {
  label: string;
  customerType?: CustomerType;
  transactionCount: number;
  totalAmount: number;
};

export function selectCustomerTypeDisplayLabel(customerType?: CustomerType) {
  return customerType ?? 'Unclassified';
}

export function selectDocumentTaxTotals(document: { subtotalAmount?: number; taxAmount?: number; totalAmount: number; taxSnapshot?: TaxSnapshot }) {
  return {
    subtotalAmount: document.subtotalAmount ?? Math.max(0, document.totalAmount - (document.taxAmount ?? 0)),
    taxAmount: document.taxAmount ?? 0,
    totalAmount: document.totalAmount,
    taxRate: document.taxSnapshot?.totalRate ?? 0,
    hasTax: Boolean(document.taxSnapshot?.enabled),
    isExempt: Boolean(document.taxSnapshot?.exempt),
    exemptionReason: document.taxSnapshot?.exemptionReason,
  };
}

export function selectDocumentWithholdingTotals(document: {
  totalAmount: number;
  withholdingTaxAmount?: number;
  netReceivableAmount?: number;
  withholdingTaxSnapshot?: { enabled: true; rate: number; label: string; amount: number };
}) {
  const withholdingAmount = document.withholdingTaxSnapshot?.amount ?? document.withholdingTaxAmount ?? 0;

  return {
    hasWithholding: Boolean(document.withholdingTaxSnapshot?.enabled),
    label: document.withholdingTaxSnapshot?.label ?? 'Withholding Tax',
    rate: document.withholdingTaxSnapshot?.rate ?? 0,
    amount: withholdingAmount,
    netReceivableAmount: document.netReceivableAmount ?? Number((document.totalAmount - withholdingAmount).toFixed(2)),
  };
}

export function selectCustomerSummariesByClassification(state: BusinessState, filter: CustomerClassificationFilterValue) {
  const summaries = selectCustomerSummaries(state);

  if (filter === 'all') {
    return summaries;
  }

  if (filter === 'unclassified') {
    return summaries.filter(({ customer }) => !customer.customerType);
  }

  return summaries.filter(({ customer }) => customer.customerType === filter);
}

export function selectCustomerClassificationBreakdown(state: BusinessState) {
  return getSelectorAnalytics(state).customerClassificationBreakdown;
}

export function selectSaleBalanceRemaining(sale: Sale) {
  const receivableAmount = sale.netReceivableAmount ?? sale.totalAmount;
  return sale.status === 'Reversed' ? 0 : Math.max(0, receivableAmount - sale.paidAmount);
}

export function selectSalePaymentStatus(sale: Sale): SalePaymentStatus {
  if (sale.status === 'Reversed') {
    return 'Reversed';
  }

  const remaining = selectSaleBalanceRemaining(sale);

  if (remaining === 0) {
    return 'Paid';
  }

  if (sale.paidAmount > 0) {
    return 'Partial';
  }

  return 'Unpaid';
}

export function selectSaleStatusDisplay(sale: Sale): StatusDisplay {
  const paymentStatus = selectSalePaymentStatus(sale);
  const balanceRemaining = selectSaleBalanceRemaining(sale);

  if (paymentStatus === 'Reversed') {
    return {
      label: 'Reversed',
      helper: sale.reversalReason ? `Reversed: ${sale.reversalReason}` : 'Invoice reversed and removed from active totals',
      tone: 'danger',
    };
  }

  if (paymentStatus === 'Paid') {
    return {
      label: 'Paid in full',
      helper: 'No balance remaining',
      tone: 'success',
    };
  }

  if (paymentStatus === 'Partial') {
    return {
      label: 'Partly paid',
      helper: `${balanceRemaining} still due`,
      tone: 'warning',
    };
  }

  return {
    label: 'Unpaid',
    helper: 'Full invoice balance is still due',
    tone: 'danger',
  };
}

export function selectQuotationStatusDisplay(quotation: Quotation): StatusDisplay {
  const normalizedStatus = quotation.status.trim().toLowerCase();
  const validUntilTime = quotation.validUntil ? new Date(quotation.validUntil).getTime() : Number.NaN;
  const isExpired =
    Number.isFinite(validUntilTime) &&
    validUntilTime < Date.now() &&
    ['draft', 'open', 'approved'].includes(normalizedStatus);

  if (normalizedStatus === 'converted') {
    return {
      label: 'Converted to invoice',
      helper: quotation.convertedAt ? 'Invoice records created from this quotation' : 'Converted into invoice records',
      tone: 'success',
    };
  }

  if (isExpired) {
    return {
      label: 'Expired quotation',
      helper: 'Valid period elapsed before conversion',
      tone: 'danger',
    };
  }

  if (normalizedStatus === 'approved') {
    return {
      label: 'Approved quotation',
      helper: 'Ready for conversion into invoice',
      tone: 'success',
    };
  }

  if (normalizedStatus === 'rejected') {
    return {
      label: 'Rejected quotation',
      helper: quotation.rejectionReason || 'Quotation was rejected before conversion',
      tone: 'danger',
    };
  }

  if (normalizedStatus === 'cancelled') {
    return {
      label: 'Cancelled quotation',
      helper: 'Closed without changing stock levels',
      tone: 'medium',
    };
  }

  return {
    label: normalizedStatus === 'open' ? 'Open quotation' : 'Draft quotation',
    helper: 'Ready to review or convert',
    tone: 'warning',
  };
}

export function selectProductMovements(state: BusinessState, productId: string) {
  return getSelectorAnalytics(state).productMovementsByProduct.get(productId) ?? [];
}

export function selectStockMovementDisplay(movement: StockMovement): StatusDisplay {
  if (movement.type === 'opening') {
    return {
      label: 'Opening stock',
      helper: 'Initial quantity loaded for this product',
      tone: 'success',
    };
  }

  if (movement.type === 'sale') {
    return {
      label: 'Sold',
      helper: 'Quantity reduced by a recorded sale',
      tone: 'warning',
    };
  }

  if (movement.type === 'restock') {
    return {
      label: 'Stock replenishment',
      helper: 'Quantity added via fulfilled restock request',
      tone: 'success',
    };
  }

  if (movement.type === 'transfer') {
    return movement.quantityDelta < 0
      ? {
          label: 'Transfer out',
          helper: 'Quantity moved to another location',
          tone: 'warning',
        }
      : {
          label: 'Transfer in',
          helper: 'Quantity received from another location',
          tone: 'success',
        };
  }

  if (movement.type === 'purchase') {
    return {
      label: 'Purchase received',
      helper: 'Quantity added to warehouse from procurement',
      tone: 'success',
    };
  }

  if (movement.type === 'adjustment') {
    return {
      label: 'Adjustment',
      helper: 'Manual inventory correction with source trace',
      tone: 'medium',
    };
  }

  return {
    label: 'Reversal restored stock',
    helper: 'Quantity restored after invoice reversal',
    tone: 'success',
  };
}

export function selectActiveSupplyRoutes(state: BusinessState): LocationSupplyRoute[] {
  return [...(state.locationSupplyRoutes ?? [])]
    .filter((route) => route.isActive)
    .sort((left, right) => {
      const leftFrom = selectLocationDisplayLabel(state, left.fromLocationId);
      const rightFrom = selectLocationDisplayLabel(state, right.fromLocationId);
      return leftFrom.localeCompare(rightFrom) ||
        selectLocationDisplayLabel(state, left.toLocationId).localeCompare(selectLocationDisplayLabel(state, right.toLocationId));
    });
}

export function selectSupplyRoutesForStore(state: BusinessState, storeLocationId: string): LocationSupplyRoute[] {
  return selectActiveSupplyRoutes(state).filter((route) => route.toLocationId === storeLocationId);
}

export function selectSupplyRoutesFromWarehouse(state: BusinessState, warehouseLocationId: string): LocationSupplyRoute[] {
  return selectActiveSupplyRoutes(state).filter((route) => route.fromLocationId === warehouseLocationId);
}

export function selectTransferHistory(state: BusinessState): TransferHistoryEntry[] {
  return getSelectorAnalytics(state).transferHistory;
}

export function selectStockTransfers(state: BusinessState): StockTransferRecordView[] {
  return getSelectorAnalytics(state).stockTransferViews;
}

export function selectWarehouseStockBalances(state: BusinessState): WarehouseStockBalanceEntry[] {
  return getSelectorAnalytics(state).warehouseStockBalances;
}

export function selectStoreStockBalances(state: BusinessState): StoreStockBalanceEntry[] {
  return getSelectorAnalytics(state).storeStockBalances;
}

export function selectProcurementWorklist(state: BusinessState): ProcurementWorklistSummary {
  return state.purchases.reduce<ProcurementWorklistSummary>(
    (summary, purchase) => {
      if (purchase.status === 'draft') {
        summary.draftCount += 1;
      } else if (purchase.status === 'submitted' || purchase.status === 'adminReviewed') {
        summary.awaitingApprovalCount += 1;
      } else if (purchase.status === 'cancelled') {
        summary.cancelledCount += 1;
      }

      return summary;
    },
    {
      draftCount: 0,
      awaitingApprovalCount: 0,
      cancelledCount: 0,
    }
  );
}

export function selectWarehouseWorklist(state: BusinessState): WarehouseWorklistSummary {
  return {
    approvedPurchasesAwaitingReceiptCount: state.purchases.filter((purchase) => purchase.status === 'approved').length,
    transfersAwaitingDispatchCount: state.stockTransfers.filter((transfer) => transfer.status === 'approved').length,
    transfersAwaitingReceiptCount: state.stockTransfers.filter((transfer) => transfer.status === 'dispatched').length,
  };
}

export function selectAccountsPayableWorklist(state: BusinessState): AccountsPayableWorklistSummary {
  const now = Date.now();

  return state.accountsPayable.reduce<AccountsPayableWorklistSummary>(
    (summary, payable) => {
      const hasOutstandingBalance = payable.balance > 0;
      const isClosed = payable.status === 'paid' || payable.status === 'cancelled';

      if (!isClosed && hasOutstandingBalance) {
        summary.openCount += 1;
        summary.totalOutstandingBalance += payable.balance;
      }

      if (payable.status === 'approved' && hasOutstandingBalance) {
        summary.approvedAwaitingPaymentCount += 1;
      }

      if (payable.status === 'partiallyPaid' && hasOutstandingBalance) {
        summary.partiallyPaidCount += 1;
      }

      if (
        payable.dueDate &&
        hasOutstandingBalance &&
        new Date(payable.dueDate).getTime() < now &&
        payable.status !== 'pendingReview' &&
        payable.status !== 'cancelled'
      ) {
        summary.overdueCount += 1;
      }

      return summary;
    },
    {
      openCount: 0,
      approvedAwaitingPaymentCount: 0,
      partiallyPaidCount: 0,
      overdueCount: 0,
      totalOutstandingBalance: 0,
    }
  );
}

export function selectOutstandingReceivables(state: BusinessState, limit = 5): ReceivableWorklistEntry[] {
  return selectCustomerSummaries(state)
    .filter((summary) => summary.balance > 0)
    .sort((left, right) => right.balance - left.balance || left.customer.name.localeCompare(right.customer.name))
    .slice(0, limit)
    .map((summary) => ({
      customerId: summary.customer.id,
      customerName: summary.customer.name,
      balance: summary.balance,
      lastPayment: summary.lastPayment,
    }));
}

export function selectTransferHistoryByLocation(state: BusinessState, locationId: string): TransferHistoryEntry[] {
  return selectTransferHistory(state).filter((entry) =>
    entry.fromLocationId === locationId || entry.toLocationId === locationId
  );
}

export function selectTransferHistoryByProduct(state: BusinessState, productId: string): TransferHistoryEntry[] {
  return selectTransferHistory(state).filter((entry) => entry.productId === productId);
}

export function selectActiveLocations(state: BusinessState): BusinessLocation[] {
  return getSelectorAnalytics(state).activeLocations;
}

export function selectDefaultLocation(state: BusinessState): BusinessLocation {
  return getSelectorAnalytics(state).defaultLocation;
}

export function selectLocationById(state: BusinessState, locationId?: string) {
  if (!locationId) {
    return null;
  }

  return getSelectorAnalytics(state).locationById.get(locationId) ?? null;
}

export function selectLocationDisplayLabel(state: BusinessState, locationId?: string) {
  const location = selectLocationById(state, locationId);
  if (!location) {
    return selectDefaultLocation(state).name;
  }

  return location.isActive ? location.name : `${location.name} (inactive)`;
}

export function selectProductQuantityOnHand(state: BusinessState, productId: string, locationId?: string) {
  const analytics = getSelectorAnalytics(state);
  if (locationId) {
    return analytics.productQuantityByLocation.get(`${productId}:${locationId}`) ?? 0;
  }

  return analytics.productQuantityTotals.get(productId) ?? 0;
}

export function selectActiveProductCategories(state: BusinessState): ProductCategory[] {
  return getSelectorAnalytics(state).activeProductCategories;
}

export function selectProductCategoryById(state: BusinessState, categoryId?: string) {
  if (!categoryId) {
    return null;
  }

  return state.productCategories.find((category) => category.id === categoryId) ?? null;
}

export function selectProductCategoryDisplayLabel(state: BusinessState, categoryId?: string) {
  if (!categoryId) {
    return 'Uncategorized';
  }

  return getSelectorAnalytics(state).productCategoryLabelById.get(categoryId) ?? 'Unknown category';
}

export function selectInventorySummariesByCategory(state: BusinessState, filter: InventoryCategoryFilterValue) {
  const summaries = selectInventorySummaries(state);

  if (filter === 'all') {
    return summaries;
  }

  if (filter === 'uncategorized') {
    return summaries.filter(({ product }) => !product.categoryId);
  }

  if (filter.startsWith('category:')) {
    const categoryId = filter.slice('category:'.length);
    return summaries.filter(({ product }) => product.categoryId === categoryId);
  }

  return summaries;
}

export function selectInventorySummaries(state: BusinessState) {
  return getSelectorAnalytics(state).inventorySummaries;
}

export function selectInventorySummariesByLocation(state: BusinessState, locationId?: string) {
  const analytics = getSelectorAnalytics(state);
  if (!locationId) {
    return analytics.inventorySummaries;
  }

  return analytics.inventorySummariesByLocation.get(locationId) ?? [];
}

export function selectInventoryCategoryReport(state: BusinessState): InventoryCategoryReportEntry[] {
  return getSelectorAnalytics(state).inventoryCategoryReport;
}

export function selectInventoryLocationReport(state: BusinessState): InventoryLocationReportEntry[] {
  return getSelectorAnalytics(state).inventoryLocationReport;
}

export function selectTransferSummaryBySource(state: BusinessState): TransferSummaryEntry[] {
  return getSelectorAnalytics(state).transferSummaryBySource;
}

export function selectTransferSummaryByDestination(state: BusinessState): TransferSummaryEntry[] {
  return getSelectorAnalytics(state).transferSummaryByDestination;
}

export function selectTransferSummaryByProduct(state: BusinessState): TransferSummaryEntry[] {
  return getSelectorAnalytics(state).transferSummaryByProduct;
}

export function selectLowStockByLocation(state: BusinessState, locationId?: string) {
  const entries = getSelectorAnalytics(state).lowStockByLocation;
  return locationId ? entries.filter((entry) => entry.locationId === locationId) : entries;
}

export function selectFastMovingProductsByLocation(state: BusinessState, days = 30): FastMovingInventoryEntry[] {
  const entries = getSelectorAnalytics(state).fastMovingByLocation;
  if (days === 30) {
    return entries;
  }

  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => !entry.lastMovedAt || new Date(entry.lastMovedAt).getTime() >= threshold);
}

export function selectSalesSnapshotSegmentation(state: BusinessState): SnapshotSalesSegmentEntry[] {
  return getSelectorAnalytics(state).salesSegmentation;
}

export function selectCustomerLedgerEntries(state: BusinessState, customerId: string) {
  return state.customerLedgerEntries
    .filter((entry) => entry.customerId === customerId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function selectCustomerStatement(state: BusinessState, customerId: string): CustomerStatement {
  return getSelectorAnalytics(state).customerStatementById.get(customerId) ?? {
    openingBalance: 0,
    invoiceCharges: 0,
    paymentsReceived: 0,
    reversals: 0,
    closingBalance: 0,
  };
}

export function selectLedgerEntryDisplay(entry: CustomerLedgerEntry): LedgerEntryDisplay {
  if (entry.type === 'opening_balance') {
    return {
      label: 'Opening balance',
      helper: 'Balance carried into BisaPilot',
      tone: entry.amountDelta > 0 ? 'warning' : 'success',
      amountLabel: 'Charge',
    };
  }

  if (entry.type === 'sale_charge') {
    return {
      label: 'Invoice added',
      helper: 'Customer balance increased by this invoice',
      tone: 'warning',
      amountLabel: 'Charge',
    };
  }

  if (entry.type === 'payment_received') {
    return {
      label: 'Payment received',
      helper: 'Customer balance reduced by this payment',
      tone: 'success',
      amountLabel: 'Payment',
    };
  }

  return {
    label: 'Invoice reversal',
    helper: 'Customer balance reduced because the invoice was reversed',
    tone: 'success',
    amountLabel: 'Adjustment',
  };
}

export function selectCustomerBalance(state: BusinessState, customerId: string) {
  return getSelectorAnalytics(state).customerBalanceById.get(customerId) ?? 0;
}

function formatRelativePaymentLabel(dateValue: string, paymentMethod: string) {
  const now = new Date();
  const createdAt = new Date(dateValue);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfEntryDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfEntryDay) / (1000 * 60 * 60 * 24));
  const methodLabel =
    paymentMethod === 'Cash'
      ? 'Cash'
      : paymentMethod === 'Mobile Money'
        ? 'MoMo'
        : 'Bank';

  if (diffDays <= 0) {
    return `Today, ${methodLabel}`;
  }

  if (diffDays === 1) {
    return `Yesterday, ${methodLabel}`;
  }

  return `${diffDays} days ago, ${methodLabel}`;
}

export function selectCustomerLastPaymentLabel(state: BusinessState, customerId: string) {
  const paymentEntry = selectCustomerLedgerEntries(state, customerId).find((entry) => entry.type === 'payment_received');

  if (!paymentEntry || !paymentEntry.paymentMethod) {
    return 'No payment recorded';
  }

  return formatRelativePaymentLabel(paymentEntry.createdAt, paymentEntry.paymentMethod);
}

export function selectCustomerSummaries(state: BusinessState) {
  return state.customers.map((customer) => {
    const balance = selectCustomerBalance(state, customer.id);
    const lastPayment = selectCustomerLastPaymentLabel(state, customer.id);
    const accountStatus: StatusDisplay =
      customer.status === 'terminated'
        ? {
            label: 'Terminated',
            helper: 'Historical account preserved',
            tone: 'medium',
          }
        : balance > 0
        ? {
            label: 'Balance due',
            helper: 'Customer needs follow-up',
            tone: 'warning',
          }
        : {
            label: 'Settled',
            helper: 'No outstanding balance',
            tone: 'success',
          };

    return {
      customer,
      balance,
      lastPayment,
      needsFollowUp: balance > 0,
      accountStatus,
    };
  });
}

export function selectDashboardMetrics(state: BusinessState) {
  return getSelectorAnalytics(state).dashboardMetrics;
}

export function selectRecentSales(state: BusinessState) {
  return [...state.sales].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function selectSaleActivityEntries(state: BusinessState, saleId: string) {
  return state.activityLogEntries
    .filter((entry) => entry.entityId === saleId || entry.relatedSaleId === saleId || entry.relatedEntityId === saleId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function selectActivityDisplay(entry: ActivityLogEntry): StatusDisplay {
  if (entry.actionType === 'invoice_created') {
    return {
      label: 'Invoice created',
      helper: 'The sale was saved as an invoice record',
      tone: 'success',
    };
  }

  if (entry.actionType === 'receipt_issued') {
    return {
      label: 'Receipt issued',
      helper: 'Payment proof was generated for this invoice',
      tone: 'success',
    };
  }

  if (entry.actionType === 'invoice_reversed') {
    return {
      label: 'Invoice reversed',
      helper: 'Stock and receivables were reversed without deleting history',
      tone: 'warning',
    };
  }

  if (entry.actionType === 'corrected_copy_created') {
    return {
      label: 'Correction invoice created',
      helper: 'A corrected invoice was linked to this reversed invoice',
      tone: 'success',
    };
  }

  if (entry.actionType === 'quotation_converted') {
    return {
      label: 'Quotation converted',
      helper: 'Invoice records were created from this quotation',
      tone: 'success',
    };
  }

  return {
    label: entry.title,
    helper: entry.detail,
    tone: entry.status === 'warning' ? 'warning' : entry.status === 'success' ? 'success' : 'medium',
  };
}

export function selectLastActivityForProduct(state: BusinessState, productId: string) {
  return selectProductMovements(state, productId)[0] ?? null;
}

export function selectCustomerById(state: BusinessState, customerId: string) {
  return state.customers.find((customer) => customer.id === customerId) ?? null;
}

export function selectProductById(state: BusinessState, productId: string) {
  return state.products.find((product) => product.id === productId) ?? null;
}

export function selectActivityFeed(state: BusinessState) {
  return [...state.activityLogEntries].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
