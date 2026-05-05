import type {
  BusinessLocation,
  BusinessState,
  CustomerLedgerEntry,
  CustomerType,
  Product,
  Sale,
  StockTransfer,
  StockMovement,
} from '../data/seedBusiness';
import type {
  CustomerStatement,
  FastMovingInventoryEntry,
  InventoryCategoryReportEntry,
  InventoryLocationReportEntry,
  RevenueTrendPoint,
  StockTransferRecordView,
  StoreStockBalanceEntry,
  SnapshotSalesSegmentEntry,
  TransferHistoryEntry,
  TransferSummaryEntry,
  WarehouseStockBalanceEntry,
} from './businessSelectors';

type InventorySummary = {
  product: Product;
  quantityOnHand: number;
  latestMovement: StockMovement | null;
  lowStock: boolean;
  stockStatus: 'Restock soon' | 'In stock';
  stockStatusDisplay: {
    label: 'Restock soon' | 'In stock';
    helper: string;
    tone: 'warning' | 'success';
  };
};

type LowStockEntry = {
  locationId: string;
  locationLabel: string;
  product: Product;
  quantityOnHand: number;
  reorderLevel: number;
};

type DashboardMetrics = {
  salesToday: number;
  salesTodayCount: number;
  cashInHand: number;
  mobileMoneyReceived: number;
  receivables: number;
  lowStockCount: number;
  customersOwingCount: number;
  weeklyRevenueTrend: RevenueTrendPoint[];
  monthlyRevenueTrend: RevenueTrendPoint[];
  annualRevenueTrend: RevenueTrendPoint[];
  activeSales: Sale[];
  inventorySummaries: InventorySummary[];
  todayPayments: CustomerLedgerEntry[];
  inventoryCategoryReport: InventoryCategoryReportEntry[];
  inventoryLocationReport: InventoryLocationReportEntry[];
  transferHistory: TransferHistoryEntry[];
  transferSummaryBySource: TransferSummaryEntry[];
  transferSummaryByDestination: TransferSummaryEntry[];
  transferSummaryByProduct: TransferSummaryEntry[];
  stockTransferViews: StockTransferRecordView[];
  warehouseStockBalances: WarehouseStockBalanceEntry[];
  storeStockBalances: StoreStockBalanceEntry[];
  lowStockByLocation: LowStockEntry[];
  fastMovingByLocation: FastMovingInventoryEntry[];
  salesSegmentation: SnapshotSalesSegmentEntry[];
};

export type SelectorAnalyticsSnapshot = {
  activeLocations: BusinessLocation[];
  defaultLocation: BusinessLocation;
  locationById: Map<string, BusinessLocation>;
  activeProductCategories: BusinessState['productCategories'];
  productCategoryLabelById: Map<string, string>;
  productMovementsByProduct: Map<string, StockMovement[]>;
  productQuantityTotals: Map<string, number>;
  productQuantityByLocation: Map<string, number>;
  latestMovementByProduct: Map<string, StockMovement | null>;
  inventorySummaries: InventorySummary[];
  inventorySummariesByLocation: Map<string, InventorySummary[]>;
  transferHistory: TransferHistoryEntry[];
  transferSummaryBySource: TransferSummaryEntry[];
  transferSummaryByDestination: TransferSummaryEntry[];
  transferSummaryByProduct: TransferSummaryEntry[];
  stockTransferViews: StockTransferRecordView[];
  warehouseStockBalances: WarehouseStockBalanceEntry[];
  storeStockBalances: StoreStockBalanceEntry[];
  inventoryCategoryReport: InventoryCategoryReportEntry[];
  inventoryLocationReport: InventoryLocationReportEntry[];
  lowStockByLocation: LowStockEntry[];
  fastMovingByLocation: FastMovingInventoryEntry[];
  customerBalanceById: Map<string, number>;
  customerStatementById: Map<string, CustomerStatement>;
  salesSegmentation: SnapshotSalesSegmentEntry[];
  customerClassificationBreakdown: {
    customers: Record<'B2B' | 'B2C' | 'unclassified', number>;
    sales: Record<'B2B' | 'B2C' | 'unclassified', number>;
  };
  dashboardMetrics: DashboardMetrics;
};

const analyticsCache = new WeakMap<BusinessState, SelectorAnalyticsSnapshot>();
const DEFAULT_LOCATION: BusinessLocation = {
  id: '00000000-0000-4000-8000-000000000001',
  locationCode: 'ST-0001',
  name: 'Main Store',
  type: 'store',
  isDefault: true,
  isActive: true,
};

function sortLocations(locations: BusinessLocation[]) {
  return [...locations]
    .filter((location) => location.isActive)
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
}

function getDefaultLocation(activeLocations: BusinessLocation[]) {
  return activeLocations.find((location) => location.isDefault) ?? activeLocations[0] ?? DEFAULT_LOCATION;
}

function buildLocationLabel(locationById: Map<string, BusinessLocation>, defaultLocation: BusinessLocation, locationId?: string) {
  const location = locationId ? locationById.get(locationId) ?? null : null;
  if (!location) {
    return defaultLocation.name;
  }

  return location.isActive ? location.name : `${location.name} (inactive)`;
}

function buildProductCategoryLabelMap(state: BusinessState) {
  const categories = [...state.productCategories];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const labelById = new Map<string, string>();

  categories.forEach((category) => {
    const parent = category.parentCategoryId ? categoryById.get(category.parentCategoryId) ?? null : null;
    const label = parent ? `${parent.name} / ${category.name}` : category.name;
    labelById.set(category.id, category.isActive ? label : `${label} (inactive)`);
  });

  return labelById;
}

function buildProductMovementMaps(state: BusinessState, defaultLocationId: string) {
  const productMovementsByProduct = new Map<string, StockMovement[]>();
  const productQuantityTotals = new Map<string, number>();
  const productQuantityByLocation = new Map<string, number>();
  const latestMovementByProduct = new Map<string, StockMovement | null>();

  const sortedMovements = [...state.stockMovements].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  sortedMovements.forEach((movement) => {
    const productMovements = productMovementsByProduct.get(movement.productId) ?? [];
    productMovements.push(movement);
    productMovementsByProduct.set(movement.productId, productMovements);

    if (!latestMovementByProduct.has(movement.productId)) {
      latestMovementByProduct.set(movement.productId, movement);
    }

    productQuantityTotals.set(movement.productId, (productQuantityTotals.get(movement.productId) ?? 0) + movement.quantityDelta);
    const locationKey = `${movement.productId}:${movement.locationId ?? defaultLocationId}`;
    productQuantityByLocation.set(locationKey, (productQuantityByLocation.get(locationKey) ?? 0) + movement.quantityDelta);
  });

  return {
    productMovementsByProduct,
    productQuantityTotals,
    productQuantityByLocation,
    latestMovementByProduct,
  };
}

function buildInventorySummary(product: Product, quantityOnHand: number, latestMovement: StockMovement | null): InventorySummary {
  const lowStock = quantityOnHand <= product.reorderLevel;
  return {
    product,
    quantityOnHand,
    latestMovement,
    lowStock,
    stockStatus: lowStock ? 'Restock soon' : 'In stock',
    stockStatusDisplay: lowStock
      ? {
          label: 'Restock soon',
          helper: `At or below reorder level of ${product.reorderLevel}`,
          tone: 'warning',
        }
      : {
          label: 'In stock',
          helper: 'Above reorder level',
          tone: 'success',
        },
  };
}

function buildStockTransferViews(transfers: StockTransfer[], locationById: Map<string, BusinessLocation>, defaultLocation: BusinessLocation): StockTransferRecordView[] {
  return [...transfers]
    .map((transfer) => ({
      transfer,
      fromWarehouseName: buildLocationLabel(locationById, defaultLocation, transfer.fromWarehouseId),
      toStoreName: buildLocationLabel(locationById, defaultLocation, transfer.toStoreId),
      totalItems: transfer.items.length,
      totalQuantity: transfer.items.reduce((sum, item) => sum + item.quantity, 0),
    }))
    .sort((left, right) => new Date(right.transfer.createdAt).getTime() - new Date(left.transfer.createdAt).getTime());
}

function buildWarehouseStockBalances(
  state: BusinessState,
  warehouses: BusinessLocation[],
  movements: StockMovement[]
): WarehouseStockBalanceEntry[] {
  const productById = new Map(state.products.map((product) => [product.id, product]));
  const buckets = new Map<string, WarehouseStockBalanceEntry>();

  movements
    .filter((movement) => movement.locationId && warehouses.some((warehouse) => warehouse.id === movement.locationId))
    .forEach((movement) => {
      const warehouse = warehouses.find((candidate) => candidate.id === movement.locationId);
      const product = productById.get(movement.productId);
      if (!warehouse || !product) {
        return;
      }

      const key = `${movement.productId}:${warehouse.id}`;
      const current = buckets.get(key) ?? {
        productId: product.id,
        productName: product.name,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantityAvailable: 0,
        lastMovementAt: undefined,
        vendorCode: undefined,
      };

      buckets.set(key, {
        ...current,
        quantityAvailable: current.quantityAvailable + movement.quantityDelta,
        lastMovementAt:
          !current.lastMovementAt || new Date(movement.createdAt).getTime() > new Date(current.lastMovementAt).getTime()
            ? movement.createdAt
            : current.lastMovementAt,
        vendorCode: movement.vendorCode ?? current.vendorCode,
      });
    });

  return [...buckets.values()]
    .filter((entry) => entry.quantityAvailable !== 0)
    .sort((left, right) => left.warehouseName.localeCompare(right.warehouseName) || left.productName.localeCompare(right.productName));
}

function buildStoreStockBalances(
  state: BusinessState,
  stores: BusinessLocation[],
  movements: StockMovement[]
): StoreStockBalanceEntry[] {
  const productById = new Map(state.products.map((product) => [product.id, product]));
  const buckets = new Map<string, StoreStockBalanceEntry>();

  movements
    .filter((movement) => movement.locationId && stores.some((store) => store.id === movement.locationId))
    .forEach((movement) => {
      const store = stores.find((candidate) => candidate.id === movement.locationId);
      const product = productById.get(movement.productId);
      if (!store || !product) {
        return;
      }

      const key = `${movement.productId}:${store.id}`;
      const current = buckets.get(key) ?? {
        productId: product.id,
        productName: product.name,
        storeId: store.id,
        storeName: store.name,
        quantityAvailable: 0,
        lastMovementAt: undefined,
      };

      buckets.set(key, {
        ...current,
        quantityAvailable: current.quantityAvailable + movement.quantityDelta,
        lastMovementAt:
          !current.lastMovementAt || new Date(movement.createdAt).getTime() > new Date(current.lastMovementAt).getTime()
            ? movement.createdAt
            : current.lastMovementAt,
      });
    });

  return [...buckets.values()]
    .filter((entry) => entry.quantityAvailable !== 0)
    .sort((left, right) => left.storeName.localeCompare(right.storeName) || left.productName.localeCompare(right.productName));
}

function aggregateTransferSummary(entries: TransferHistoryEntry[], getKey: (entry: TransferHistoryEntry) => string | undefined, getLabel: (entry: TransferHistoryEntry) => string): TransferSummaryEntry[] {
  const buckets = new Map<string, TransferSummaryEntry>();

  entries.forEach((entry) => {
    const key = getKey(entry);
    if (!key) {
      return;
    }

    const current = buckets.get(key) ?? {
      key,
      label: getLabel(entry),
      transferCount: 0,
      quantityMoved: 0,
    };

    buckets.set(key, {
      ...current,
      transferCount: current.transferCount + 1,
      quantityMoved: current.quantityMoved + entry.quantity,
    });
  });

  return [...buckets.values()].sort((left, right) =>
    right.quantityMoved - left.quantityMoved ||
    right.transferCount - left.transferCount ||
    left.label.localeCompare(right.label)
  );
}

function buildWeeklyRevenueTrend(activeSales: Sale[], now: Date): RevenueTrendPoint[] {
  return Array.from({ length: 7 }, (_, offset) => {
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
}

function buildMonthlyRevenueTrend(activeSales: Sale[], now: Date): RevenueTrendPoint[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil(lastDayOfMonth / 7);

  return Array.from({ length: weekCount }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, lastDayOfMonth);
    const value = activeSales
      .filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        const saleDay = saleDate.getDate();
        return saleDate.getFullYear() === year && saleDate.getMonth() === month && saleDay >= startDay && saleDay <= endDay;
      })
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    return {
      label: `Week ${index + 1}`,
      shortLabel: `W${index + 1}`,
      value,
    };
  });
}

function buildAnnualRevenueTrend(activeSales: Sale[], now: Date): RevenueTrendPoint[] {
  const year = now.getFullYear();

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const date = new Date(year, monthIndex, 1);
    const label = new Intl.DateTimeFormat('en-GH', { month: 'short' }).format(date);
    const value = activeSales
      .filter((sale) => {
        const saleDate = new Date(sale.createdAt);
        return saleDate.getFullYear() === year && saleDate.getMonth() === monthIndex;
      })
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    return {
      label,
      shortLabel: label.slice(0, 3),
      value,
    };
  });
}

export function getSelectorAnalytics(state: BusinessState): SelectorAnalyticsSnapshot {
  const cached = analyticsCache.get(state);
  if (cached) {
    return cached;
  }

  const activeLocations = sortLocations(state.locations ?? []);
  const defaultLocation = getDefaultLocation(activeLocations);
  const locationById = new Map((state.locations ?? []).map((location) => [location.id, location]));
  const productCategoryLabelById = buildProductCategoryLabelMap(state);
  const activeProductCategories = [...state.productCategories]
    .filter((category) => category.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

  const {
    productMovementsByProduct,
    productQuantityTotals,
    productQuantityByLocation,
    latestMovementByProduct,
  } = buildProductMovementMaps(state, defaultLocation.id);

  const inventorySummaries = state.products.map((product) =>
    buildInventorySummary(product, productQuantityTotals.get(product.id) ?? 0, latestMovementByProduct.get(product.id) ?? null)
  );

  const inventorySummariesByLocation = new Map<string, InventorySummary[]>();
  activeLocations.forEach((location) => {
    inventorySummariesByLocation.set(
      location.id,
      state.products.map((product) =>
        buildInventorySummary(
          product,
          productQuantityByLocation.get(`${product.id}:${location.id}`) ?? 0,
          latestMovementByProduct.get(product.id) ?? null
        )
      )
    );
  });

  const transferMovements = state.stockMovements
    .filter((movement) => movement.type === 'transfer' && movement.transferId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const transferBuckets = new Map<string, StockMovement[]>();
  transferMovements.forEach((movement) => {
    const transferId = movement.transferId;
    if (!transferId) {
      return;
    }
    transferBuckets.set(transferId, [...(transferBuckets.get(transferId) ?? []), movement]);
  });
  const transferHistory = [...transferBuckets.entries()]
    .map(([transferId, movements]) => {
      const outboundMovement = movements.find((movement) => movement.quantityDelta < 0) ?? movements[0];
      const inboundMovement = movements.find((movement) => movement.quantityDelta > 0);

      return {
        transferId,
        referenceNumber: outboundMovement.referenceNumber,
        productId: outboundMovement.productId,
        fromLocationId: outboundMovement.fromLocationId,
        toLocationId: outboundMovement.toLocationId,
        quantity: Math.abs(outboundMovement.quantityDelta),
        createdAt: outboundMovement.createdAt,
        note: outboundMovement.note,
        outboundMovement,
        inboundMovement,
      };
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const transferSummaryBySource = aggregateTransferSummary(
    transferHistory,
    (entry) => entry.fromLocationId,
    (entry) => buildLocationLabel(locationById, defaultLocation, entry.fromLocationId)
  );
  const transferSummaryByDestination = aggregateTransferSummary(
    transferHistory,
    (entry) => entry.toLocationId,
    (entry) => buildLocationLabel(locationById, defaultLocation, entry.toLocationId)
  );
  const productById = new Map(state.products.map((product) => [product.id, product]));
  const transferSummaryByProduct = aggregateTransferSummary(
    transferHistory,
    (entry) => entry.productId,
    (entry) => productById.get(entry.productId)?.name ?? 'Unknown product'
  );
  const stockTransferViews = buildStockTransferViews(state.stockTransfers ?? [], locationById, defaultLocation);
  const warehouseStockBalances = buildWarehouseStockBalances(
    state,
    activeLocations.filter((location) => location.type === 'warehouse'),
    state.stockMovements
  );
  const storeStockBalances = buildStoreStockBalances(
    state,
    activeLocations.filter((location) => location.type === 'store'),
    state.stockMovements
  );

  const inventoryCategoryBuckets = new Map<string, InventoryCategoryReportEntry>();
  inventorySummaries.forEach((summary) => {
    const categoryId = summary.product.categoryId;
    const key = categoryId ?? 'uncategorized';
    const current = inventoryCategoryBuckets.get(key) ?? {
      categoryId,
      label: categoryId ? (productCategoryLabelById.get(categoryId) ?? 'Unknown category') : 'Uncategorized',
      productCount: 0,
      quantityOnHand: 0,
      stockValue: 0,
    };

    inventoryCategoryBuckets.set(key, {
      ...current,
      productCount: current.productCount + 1,
      quantityOnHand: current.quantityOnHand + summary.quantityOnHand,
      stockValue: current.stockValue + summary.quantityOnHand * summary.product.cost,
    });
  });
  const inventoryCategoryReport = [...inventoryCategoryBuckets.values()].sort((left, right) =>
    right.stockValue - left.stockValue ||
    right.quantityOnHand - left.quantityOnHand ||
    left.label.localeCompare(right.label)
  );

  const inventoryLocationReport = activeLocations.map((location) => {
    const summaries = inventorySummariesByLocation.get(location.id) ?? [];
    const inStock = summaries.filter((summary) => summary.quantityOnHand > 0);

    return {
      locationId: location.id,
      label: location.name,
      type: location.type,
      productCount: inStock.length,
      quantityOnHand: summaries.reduce((sum, summary) => sum + summary.quantityOnHand, 0),
      stockValue: summaries.reduce((sum, summary) => sum + summary.quantityOnHand * summary.product.cost, 0),
      lowStockCount: summaries.filter((summary) => summary.lowStock && summary.quantityOnHand > 0).length,
    };
  }).sort((left, right) =>
    Number(right.type === 'warehouse') - Number(left.type === 'warehouse') ||
    right.stockValue - left.stockValue ||
    left.label.localeCompare(right.label)
  );

  const lowStockByLocation = activeLocations.flatMap((location) =>
    (inventorySummariesByLocation.get(location.id) ?? [])
      .filter((summary) => summary.lowStock)
      .map((summary) => ({
        locationId: location.id,
        locationLabel: location.name,
        product: summary.product,
        quantityOnHand: summary.quantityOnHand,
        reorderLevel: summary.product.reorderLevel,
      }))
  ).sort((left, right) =>
    left.quantityOnHand - right.quantityOnHand ||
    left.product.name.localeCompare(right.product.name)
  );

  const fastMovingThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const fastMovingBuckets = new Map<string, FastMovingInventoryEntry>();
  state.stockMovements
    .filter((movement) => movement.type === 'sale' && movement.locationId)
    .filter((movement) => new Date(movement.createdAt).getTime() >= fastMovingThreshold)
    .forEach((movement) => {
      const locationId = movement.locationId!;
      const key = `${movement.productId}:${locationId}`;
      const current = fastMovingBuckets.get(key) ?? {
        productId: movement.productId,
        locationId,
        quantityMoved: 0,
        movementCount: 0,
        lastMovedAt: movement.createdAt,
      };

      fastMovingBuckets.set(key, {
        ...current,
        quantityMoved: current.quantityMoved + Math.abs(movement.quantityDelta),
        movementCount: current.movementCount + 1,
        lastMovedAt:
          current.lastMovedAt && new Date(current.lastMovedAt).getTime() > new Date(movement.createdAt).getTime()
            ? current.lastMovedAt
            : movement.createdAt,
      });
    });
  const fastMovingByLocation = [...fastMovingBuckets.values()].sort((left, right) =>
    right.quantityMoved - left.quantityMoved || right.movementCount - left.movementCount
  );

  const customerBalanceById = new Map<string, number>();
  const customerStatementSeeds = new Map<string, CustomerStatement>();
  state.customers.forEach((customer) => {
    customerBalanceById.set(customer.id, 0);
    customerStatementSeeds.set(customer.id, {
      openingBalance: 0,
      invoiceCharges: 0,
      paymentsReceived: 0,
      reversals: 0,
      closingBalance: 0,
    });
  });
  state.customerLedgerEntries.forEach((entry) => {
    customerBalanceById.set(entry.customerId, (customerBalanceById.get(entry.customerId) ?? 0) + entry.amountDelta);
    const seed = customerStatementSeeds.get(entry.customerId) ?? {
      openingBalance: 0,
      invoiceCharges: 0,
      paymentsReceived: 0,
      reversals: 0,
      closingBalance: 0,
    };
    if (entry.type === 'opening_balance') seed.openingBalance += entry.amountDelta;
    if (entry.type === 'sale_charge') seed.invoiceCharges += entry.amountDelta;
    if (entry.type === 'payment_received') seed.paymentsReceived += Math.abs(entry.amountDelta);
    if (entry.type === 'reversal') seed.reversals += Math.abs(entry.amountDelta);
    seed.closingBalance += entry.amountDelta;
    customerStatementSeeds.set(entry.customerId, seed);
  });

  const activeSales = state.sales.filter((sale) => sale.status !== 'Reversed');
  const salesSegmentation: SnapshotSalesSegmentEntry[] = ([
    { label: 'B2B', customerType: 'B2B' },
    { label: 'B2C', customerType: 'B2C' },
    { label: 'Unclassified', customerType: undefined },
  ] as Array<{ label: string; customerType?: CustomerType }>).map((group) => {
    const matchingSales = activeSales.filter((sale) => sale.customerTypeSnapshot === group.customerType);
    return {
      label: group.label,
      customerType: group.customerType,
      transactionCount: matchingSales.length,
      totalAmount: matchingSales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    };
  });

  const customerClassificationBreakdown = {
    customers: {
      B2B: state.customers.filter((customer) => customer.customerType === 'B2B').length,
      B2C: state.customers.filter((customer) => customer.customerType === 'B2C').length,
      unclassified: state.customers.filter((customer) => !customer.customerType).length,
    },
    sales: {
      B2B: salesSegmentation.find((segment) => segment.customerType === 'B2B')?.totalAmount ?? 0,
      B2C: salesSegmentation.find((segment) => segment.customerType === 'B2C')?.totalAmount ?? 0,
      unclassified: salesSegmentation.find((segment) => segment.customerType === undefined)?.totalAmount ?? 0,
    },
  };

  const todayKey = new Date().toDateString();
  const activeSaleIds = new Set(activeSales.map((sale) => sale.id));
  const todayPayments = state.customerLedgerEntries.filter(
    (entry) =>
      entry.type === 'payment_received' &&
      entry.relatedSaleId &&
      activeSaleIds.has(entry.relatedSaleId) &&
      new Date(entry.createdAt).toDateString() === todayKey
  );
  const salesToday = activeSales
    .filter((sale) => new Date(sale.createdAt).toDateString() === todayKey)
    .reduce((sum, sale) => sum + sale.totalAmount, 0);
  const cashInHand = todayPayments
    .filter((entry) => entry.paymentMethod === 'Cash')
    .reduce((sum, entry) => sum + Math.abs(entry.amountDelta), 0);
  const mobileMoneyReceived = todayPayments
    .filter((entry) => entry.paymentMethod === 'Mobile Money')
    .reduce((sum, entry) => sum + Math.abs(entry.amountDelta), 0);
  const receivables = [...customerBalanceById.values()].reduce((sum, balance) => sum + balance, 0);
  const customersOwingCount = [...customerBalanceById.values()].filter((balance) => balance > 0).length;
  const now = new Date();
  const dashboardMetrics: DashboardMetrics = {
    salesToday,
    salesTodayCount: activeSales.filter((sale) => new Date(sale.createdAt).toDateString() === todayKey).length,
    cashInHand,
    mobileMoneyReceived,
    receivables,
    lowStockCount: inventorySummaries.filter((summary) => summary.lowStock).length,
    customersOwingCount,
    weeklyRevenueTrend: buildWeeklyRevenueTrend(activeSales, now),
    monthlyRevenueTrend: buildMonthlyRevenueTrend(activeSales, now),
    annualRevenueTrend: buildAnnualRevenueTrend(activeSales, now),
    activeSales,
    inventorySummaries,
    todayPayments,
    inventoryCategoryReport,
    inventoryLocationReport,
    transferHistory,
    transferSummaryBySource,
    transferSummaryByDestination,
    transferSummaryByProduct,
    stockTransferViews,
    warehouseStockBalances,
    storeStockBalances,
    lowStockByLocation,
    fastMovingByLocation,
    salesSegmentation,
  };

  const snapshot: SelectorAnalyticsSnapshot = {
    activeLocations,
    defaultLocation,
    locationById,
    activeProductCategories,
    productCategoryLabelById,
    productMovementsByProduct,
    productQuantityTotals,
    productQuantityByLocation,
    latestMovementByProduct,
    inventorySummaries,
    inventorySummariesByLocation,
    transferHistory,
    transferSummaryBySource,
    transferSummaryByDestination,
    transferSummaryByProduct,
    stockTransferViews,
    warehouseStockBalances,
    storeStockBalances,
    inventoryCategoryReport,
    inventoryLocationReport,
    lowStockByLocation,
    fastMovingByLocation,
    customerBalanceById,
    customerStatementById: customerStatementSeeds,
    salesSegmentation,
    customerClassificationBreakdown,
    dashboardMetrics,
  };

  analyticsCache.set(state, snapshot);
  return snapshot;
}
