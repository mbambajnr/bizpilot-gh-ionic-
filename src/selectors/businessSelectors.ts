import type {
  ActivityLogEntry,
  BusinessState,
  Customer,
  CustomerLedgerEntry,
  Product,
  Sale,
  StockMovement,
} from '../data/seedBusiness';

export type SalePaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'Reversed';

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

export function selectProductMovements(state: BusinessState, productId: string) {
  return state.stockMovements
    .filter((movement) => movement.productId === productId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
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
    const stockStatus = lowStock ? 'Low stock' : 'Healthy';

    return {
      product,
      quantityOnHand,
      latestMovement,
      lowStock,
      stockStatus,
    };
  });
}

export function selectCustomerLedgerEntries(state: BusinessState, customerId: string) {
  return state.customerLedgerEntries
    .filter((entry) => entry.customerId === customerId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
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

    return {
      customer,
      balance,
      lastPayment,
      needsFollowUp: balance > 0,
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
