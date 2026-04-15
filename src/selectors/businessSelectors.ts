import type {
  ActivityLogEntry,
  BusinessState,
  CustomerLedgerEntry,
  Quotation,
  Sale,
  StockMovement,
} from '../data/seedBusiness';

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

export function selectSaleBalanceRemaining(sale: Sale) {
  return sale.status === 'Reversed' ? 0 : Math.max(0, sale.totalAmount - sale.paidAmount);
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
  if (quotation.status === 'Converted') {
    return {
      label: 'Converted to invoice',
      helper: quotation.convertedAt ? 'Invoice records created from this quotation' : 'Converted into invoice records',
      tone: 'success',
    };
  }

  return {
    label: 'Draft quotation',
    helper: 'Ready to review or convert',
    tone: 'warning',
  };
}

export function selectProductMovements(state: BusinessState, productId: string) {
  return state.stockMovements
    .filter((movement) => movement.productId === productId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
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

  return {
    label: 'Reversal restored stock',
    helper: 'Quantity restored after invoice reversal',
    tone: 'success',
  };
}

export function selectProductQuantityOnHand(state: BusinessState, productId: string) {
  return state.stockMovements
    .filter((movement) => movement.productId === productId)
    .reduce((sum, movement) => sum + movement.quantityDelta, 0);
}

export function selectInventorySummaries(state: BusinessState) {
  return state.products.map((product) => {
    const quantityOnHand = selectProductQuantityOnHand(state, product.id);
    const latestMovement = selectProductMovements(state, product.id)[0] ?? null;
    const lowStock = quantityOnHand <= product.reorderLevel;
    const stockStatus = lowStock ? 'Restock soon' : 'In stock';
    const stockStatusDisplay: StatusDisplay = lowStock
      ? {
          label: 'Restock soon',
          helper: `At or below reorder level of ${product.reorderLevel}`,
          tone: 'warning',
        }
      : {
          label: 'In stock',
          helper: 'Above reorder level',
          tone: 'success',
        };

    return {
      product,
      quantityOnHand,
      latestMovement,
      lowStock,
      stockStatus,
      stockStatusDisplay,
    };
  });
}

export function selectCustomerLedgerEntries(state: BusinessState, customerId: string) {
  return state.customerLedgerEntries
    .filter((entry) => entry.customerId === customerId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function selectCustomerStatement(state: BusinessState, customerId: string): CustomerStatement {
  const entries = state.customerLedgerEntries.filter((entry) => entry.customerId === customerId);

  return {
    openingBalance: entries
      .filter((entry) => entry.type === 'opening_balance')
      .reduce((sum, entry) => sum + entry.amountDelta, 0),
    invoiceCharges: entries
      .filter((entry) => entry.type === 'sale_charge')
      .reduce((sum, entry) => sum + entry.amountDelta, 0),
    paymentsReceived: Math.abs(
      entries
        .filter((entry) => entry.type === 'payment_received')
        .reduce((sum, entry) => sum + entry.amountDelta, 0)
    ),
    reversals: Math.abs(
      entries
        .filter((entry) => entry.type === 'reversal')
        .reduce((sum, entry) => sum + entry.amountDelta, 0)
    ),
    closingBalance: entries.reduce((sum, entry) => sum + entry.amountDelta, 0),
  };
}

export function selectLedgerEntryDisplay(entry: CustomerLedgerEntry): LedgerEntryDisplay {
  if (entry.type === 'opening_balance') {
    return {
      label: 'Opening balance',
      helper: 'Balance carried into BizPilot',
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
  return state.customerLedgerEntries
    .filter((entry) => entry.customerId === customerId)
    .reduce((sum, entry) => sum + entry.amountDelta, 0);
}

function formatRelativePaymentLabel(dateValue: string, paymentMethod: string) {
  const now = new Date();
  const createdAt = new Date(dateValue);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfEntryDay = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfEntryDay) / (1000 * 60 * 60 * 24));
  const methodLabel = paymentMethod === 'Cash' ? 'Cash' : 'MoMo';

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
      balance > 0
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
  const todayKey = new Date().toDateString();
  const activeSales = state.sales.filter((sale) => sale.status !== 'Reversed');
  const salesToday = activeSales
    .filter((sale) => new Date(sale.createdAt).toDateString() === todayKey)
    .reduce((sum, sale) => sum + sale.totalAmount, 0);

  const activeSaleIds = new Set(activeSales.map((sale) => sale.id));
  const todayPayments = state.customerLedgerEntries.filter(
    (entry) =>
      entry.type === 'payment_received' &&
      entry.relatedSaleId &&
      activeSaleIds.has(entry.relatedSaleId) &&
      new Date(entry.createdAt).toDateString() === todayKey
  );

  const cashInHand = todayPayments
    .filter((entry) => entry.paymentMethod === 'Cash')
    .reduce((sum, entry) => sum + Math.abs(entry.amountDelta), 0);

  const mobileMoneyReceived = todayPayments
    .filter((entry) => entry.paymentMethod === 'Mobile Money')
    .reduce((sum, entry) => sum + Math.abs(entry.amountDelta), 0);

  const receivables = state.customers.reduce((sum, customer) => sum + selectCustomerBalance(state, customer.id), 0);
  const inventorySummaries = selectInventorySummaries(state);
  const lowStockCount = inventorySummaries.filter((item) => item.lowStock).length;
  const customersOwingCount = state.customers.filter((customer) => selectCustomerBalance(state, customer.id) > 0).length;
  const now = new Date();
  const weeklyRevenueTrend = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - offset));
    const dayKey = date.toDateString();
    const label = new Intl.DateTimeFormat('en-GH', { weekday: 'short' }).format(date);
    const value = activeSales
      .filter((sale) => new Date(sale.createdAt).toDateString() === dayKey)
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    return {
      label,
      shortLabel: label.slice(0, 2),
      value,
    };
  });

  return {
    salesToday,
    cashInHand,
    mobileMoneyReceived,
    receivables,
    lowStockCount,
    customersOwingCount,
    weeklyRevenueTrend,
    activeSales,
    inventorySummaries,
    todayPayments,
  };
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
