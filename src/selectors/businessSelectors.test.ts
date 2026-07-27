import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  selectActiveProductCategories,
  selectCustomerClassificationBreakdown,
  selectCustomerSummariesByClassification,
  selectCustomerTypeDisplayLabel,
  selectDocumentTaxTotals,
  selectFastMovingProductsByLocation,
  selectInventoryCategoryReport,
  selectInventorySummariesByCategory,
  selectInventorySummariesByLocation,
  selectInventoryLocationReport,
  selectLowStockByLocation,
  selectSalesSnapshotSegmentation,
  selectDefaultLocation,
  selectLocationDisplayLabel,
  selectProductCategoryDisplayLabel,
  selectProductQuantityOnHand,
  selectStockTransfers,
  selectStoreStockBalances,
  selectSupplyRoutesForStore,
  selectSupplyRoutesFromWarehouse,
  selectTransferHistory,
  selectTransferHistoryByLocation,
  selectTransferHistoryByProduct,
  selectTransferSummaryByDestination,
  selectTransferSummaryByProduct,
  selectTransferSummaryBySource,
  selectWarehouseStockBalances,
} from './businessSelectors';

describe('businessSelectors category inventory helpers', () => {
  it('resolves default location and location-scoped stock quantities', () => {
    const state = {
      ...seedState,
      locations: [
        { id: 'loc-main', name: 'Main Store', type: 'store' as const, isDefault: true, isActive: true },
        { id: 'loc-warehouse', name: 'Warehouse', type: 'warehouse' as const, isDefault: false, isActive: true },
      ],
      stockMovements: [
        { ...seedState.stockMovements[0], productId: 'p1', locationId: 'loc-main', quantityDelta: 5, quantityAfter: 5 },
        { ...seedState.stockMovements[1], productId: 'p1', locationId: 'loc-warehouse', quantityDelta: 12, quantityAfter: 12 },
      ],
    };

    expect(selectDefaultLocation(state).id).toBe('loc-main');
    expect(selectLocationDisplayLabel(state, 'loc-warehouse')).toBe('Warehouse');
    expect(selectProductQuantityOnHand(state, 'p1')).toBe(17);
    expect(selectProductQuantityOnHand(state, 'p1', 'loc-main')).toBe(5);
    expect(selectInventorySummariesByLocation(state, 'loc-warehouse').find(({ product }) => product.id === 'p1')?.quantityOnHand).toBe(12);
  });

  it('resolves supply routes and transfer history by location/product', () => {
    const state = {
      ...seedState,
      locations: [
        { id: 'loc-main', name: 'Main Store', type: 'store' as const, isDefault: true, isActive: true },
        { id: 'loc-warehouse', name: 'Warehouse', type: 'warehouse' as const, isDefault: false, isActive: true },
      ],
      locationSupplyRoutes: [
        { id: 'route-1', fromLocationId: 'loc-warehouse', toLocationId: 'loc-main', isActive: true },
        { id: 'route-2', fromLocationId: 'loc-warehouse', toLocationId: 'loc-old', isActive: false },
      ],
      stockMovements: [
        {
          id: 'sm-out',
          movementNumber: 'SMV-001',
          productId: 'p1',
          locationId: 'loc-warehouse',
          type: 'transfer' as const,
          quantityDelta: -4,
          quantityAfter: 8,
          createdAt: '2026-04-23T10:00:00.000Z',
          transferId: 'transfer-1',
          fromLocationId: 'loc-warehouse',
          toLocationId: 'loc-main',
          referenceNumber: 'TRF-1',
          note: 'Supply run',
        },
        {
          id: 'sm-in',
          movementNumber: 'SMV-002',
          productId: 'p1',
          locationId: 'loc-main',
          type: 'transfer' as const,
          quantityDelta: 4,
          quantityAfter: 9,
          createdAt: '2026-04-23T10:00:00.000Z',
          transferId: 'transfer-1',
          fromLocationId: 'loc-warehouse',
          toLocationId: 'loc-main',
          referenceNumber: 'TRF-1',
          note: 'Supply run',
        },
      ],
    };

    expect(selectSupplyRoutesForStore(state, 'loc-main').map((route) => route.id)).toEqual(['route-1']);
    expect(selectSupplyRoutesFromWarehouse(state, 'loc-warehouse').map((route) => route.id)).toEqual(['route-1']);
    expect(selectTransferHistory(state)).toHaveLength(1);
    expect(selectTransferHistoryByLocation(state, 'loc-main')[0].quantity).toBe(4);
    expect(selectTransferHistoryByProduct(state, 'p1')[0].referenceNumber).toBe('TRF-1');
    expect(selectTransferSummaryBySource(state)[0]).toMatchObject({ label: 'Warehouse', quantityMoved: 4 });
    expect(selectTransferSummaryByDestination(state)[0]).toMatchObject({ label: 'Main Store', quantityMoved: 4 });
    expect(selectTransferSummaryByProduct(state)[0]).toMatchObject({ label: 'Sunlight Detergent', quantityMoved: 4 });
  });

  it('builds warehouse and store stock balances from transfer movements', () => {
    const balances = {
      ...seedState,
      stockTransfers: [
        {
          id: 'transfer-1',
          transferCode: 'TRF-0001',
          fromWarehouseId: '00000000-0000-4000-8000-000000000002',
          toStoreId: '00000000-0000-4000-8000-000000000001',
          items: [{ productId: 'p1', productName: 'Sunlight Detergent', quantity: 6 }],
          status: 'received' as const,
          initiatedBy: 'u-admin',
          approvedBy: 'u-admin',
          dispatchedBy: 'u-admin',
          receivedBy: 'u-sales',
          createdAt: '2026-04-23T09:15:00.000Z',
          approvedAt: '2026-04-23T09:20:00.000Z',
          dispatchedAt: '2026-04-23T09:45:00.000Z',
          receivedAt: '2026-04-23T10:00:00.000Z',
        },
      ],
    };

    expect(selectWarehouseStockBalances(balances).find((entry) => entry.productId === 'p1')).toMatchObject({
      warehouseName: 'Central Warehouse',
      quantityAvailable: 18,
      vendorCode: 'VEN-0001',
    });
    expect(selectStoreStockBalances(balances).find((entry) => entry.productId === 'p1')).toMatchObject({
      storeName: 'Main Store',
      quantityAvailable: 18,
    });
    expect(selectStockTransfers(balances)[0]).toMatchObject({
      fromWarehouseName: 'Central Warehouse',
      toStoreName: 'Main Store',
      totalItems: 1,
      totalQuantity: 6,
    });
  });

  it('builds category and location inventory reports with uncategorized products', () => {
    const state = {
      ...seedState,
      locations: [
        { id: 'loc-main', name: 'Main Store', type: 'store' as const, isDefault: true, isActive: true },
        { id: 'loc-warehouse', name: 'Warehouse', type: 'warehouse' as const, isDefault: false, isActive: true },
      ],
      products: [
        { ...seedState.products[0], id: 'p1', cost: 10, categoryId: 'cat-1' },
        { ...seedState.products[1], id: 'p2', cost: 5 },
      ],
      productCategories: [
        { id: 'cat-1', name: 'Household', slug: 'household', sortOrder: 0, isActive: true },
      ],
      stockMovements: [
        { ...seedState.stockMovements[0], productId: 'p1', locationId: 'loc-main', quantityDelta: 3, quantityAfter: 3 },
        { ...seedState.stockMovements[1], productId: 'p1', locationId: 'loc-warehouse', quantityDelta: 7, quantityAfter: 7 },
        { ...seedState.stockMovements[2], productId: 'p2', locationId: 'loc-main', quantityDelta: 4, quantityAfter: 4 },
      ],
    };

    expect(selectInventoryCategoryReport(state)).toEqual([
      expect.objectContaining({ label: 'Household', productCount: 1, quantityOnHand: 10, stockValue: 100 }),
      expect.objectContaining({ label: 'Uncategorized', productCount: 1, quantityOnHand: 4, stockValue: 20 }),
    ]);
    expect(selectInventoryLocationReport(state)[0]).toMatchObject({ label: 'Warehouse', quantityOnHand: 7, stockValue: 70 });
  });

  it('surfaces low-stock and fast-moving items by location', () => {
    const recent = new Date().toISOString();
    const state = {
      ...seedState,
      locations: [
        { id: 'loc-main', name: 'Main Store', type: 'store' as const, isDefault: true, isActive: true },
      ],
      products: [
        { ...seedState.products[0], id: 'p1', reorderLevel: 5 },
      ],
      stockMovements: [
        {
          ...seedState.stockMovements[0],
          productId: 'p1',
          locationId: 'loc-main',
          quantityDelta: 4,
          quantityAfter: 4,
          createdAt: recent,
        },
        {
          ...seedState.stockMovements[1],
          productId: 'p1',
          locationId: 'loc-main',
          type: 'sale' as const,
          quantityDelta: -2,
          quantityAfter: 2,
          createdAt: recent,
        },
      ],
    };

    expect(selectLowStockByLocation(state, 'loc-main')[0]).toMatchObject({ quantityOnHand: 2, reorderLevel: 5 });
    expect(selectFastMovingProductsByLocation(state)[0]).toMatchObject({ productId: 'p1', locationId: 'loc-main', quantityMoved: 2 });
  });

  it('returns only active categories in display order', () => {
    const state = {
      ...seedState,
      productCategories: [
        { id: 'c-2', name: 'Beverages', slug: 'beverages', sortOrder: 2, isActive: true },
        { id: 'c-1', name: 'Household', slug: 'household', sortOrder: 1, isActive: true },
        { id: 'c-3', name: 'Archived', slug: 'archived', sortOrder: 0, isActive: false },
      ],
    };

    expect(selectActiveProductCategories(state).map((category) => category.id)).toEqual(['c-1', 'c-2']);
  });

  it('filters inventory summaries by uncategorized and active category values', () => {
    const state = {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        inventoryCategoriesEnabled: true,
      },
      products: [
        { ...seedState.products[0], id: 'p-1', categoryId: 'c-1' },
        { ...seedState.products[1], id: 'p-2' },
        { ...seedState.products[2], id: 'p-3', categoryId: 'c-2' },
      ],
      productCategories: [
        { id: 'c-1', name: 'Household', slug: 'household', sortOrder: 0, isActive: true },
        { id: 'c-2', name: 'Staples', slug: 'staples', sortOrder: 1, isActive: true },
      ],
    };

    expect(selectInventorySummariesByCategory(state, 'uncategorized').map(({ product }) => product.id)).toEqual(['p-2']);
    expect(selectInventorySummariesByCategory(state, 'category:c-1').map(({ product }) => product.id)).toEqual(['p-1']);
  });

  it('displays safe fallback labels for inactive and missing categories', () => {
    const state = {
      ...seedState,
      productCategories: [
        { id: 'parent-1', name: 'Home', slug: 'home', sortOrder: 0, isActive: true },
        { id: 'c-1', name: 'Household', slug: 'household', parentCategoryId: 'parent-1', sortOrder: 1, isActive: false },
      ],
    };

    expect(selectProductCategoryDisplayLabel(state, undefined)).toBe('Uncategorized');
    expect(selectProductCategoryDisplayLabel(state, 'missing')).toBe('Unknown category');
    expect(selectProductCategoryDisplayLabel(state, 'c-1')).toBe('Home / Household (inactive)');
  });

  it('filters customer summaries by current customer classification', () => {
    const state = {
      ...seedState,
      customers: [
        { ...seedState.customers[0], id: 'c-b2b', customerType: 'B2B' as const },
        { ...seedState.customers[1], id: 'c-b2c', customerType: 'B2C' as const },
        { ...seedState.customers[2], id: 'c-none', customerType: undefined },
      ],
    };

    expect(selectCustomerSummariesByClassification(state, 'all').map(({ customer }) => customer.id)).toEqual(['c-b2b', 'c-b2c', 'c-none']);
    expect(selectCustomerSummariesByClassification(state, 'B2B').map(({ customer }) => customer.id)).toEqual(['c-b2b']);
    expect(selectCustomerSummariesByClassification(state, 'B2C').map(({ customer }) => customer.id)).toEqual(['c-b2c']);
    expect(selectCustomerSummariesByClassification(state, 'unclassified').map(({ customer }) => customer.id)).toEqual(['c-none']);
  });

  it('uses safe display labels for missing customer classification', () => {
    expect(selectCustomerTypeDisplayLabel('B2B')).toBe('B2B');
    expect(selectCustomerTypeDisplayLabel('B2C')).toBe('B2C');
    expect(selectCustomerTypeDisplayLabel(undefined)).toBe('Unclassified');
  });

  it('summarizes customers by current type and sales by document snapshot type', () => {
    const state = {
      ...seedState,
      customers: [
        { ...seedState.customers[0], id: 'c1', customerType: 'B2C' as const },
        { ...seedState.customers[1], id: 'c2', customerType: 'B2B' as const },
        { ...seedState.customers[2], id: 'c3', customerType: undefined },
      ],
      sales: [
        {
          ...seedState.sales[0],
          id: 's-b2b',
          customerId: 'c1',
          totalAmount: 100,
          customerTypeSnapshot: 'B2B' as const,
          status: 'Completed' as const,
        },
        {
          ...seedState.sales[1],
          id: 's-b2c',
          customerId: 'c2',
          totalAmount: 70,
          customerTypeSnapshot: 'B2C' as const,
          status: 'Completed' as const,
        },
        {
          ...seedState.sales[0],
          id: 's-none',
          customerId: 'c3',
          totalAmount: 30,
          customerTypeSnapshot: undefined,
          status: 'Completed' as const,
        },
      ],
    };

    expect(selectCustomerClassificationBreakdown(state)).toEqual({
      customers: {
        B2B: 1,
        B2C: 1,
        unclassified: 1,
      },
      sales: {
        B2B: 100,
        B2C: 70,
        unclassified: 30,
      },
    });
  });

  it('segments sales using historical document snapshots', () => {
    const state = {
      ...seedState,
      sales: [
        { ...seedState.sales[0], id: 'sale-b2b', totalAmount: 200, customerTypeSnapshot: 'B2B' as const, status: 'Completed' as const },
        { ...seedState.sales[1], id: 'sale-b2c', totalAmount: 120, customerTypeSnapshot: 'B2C' as const, status: 'Completed' as const },
        { ...seedState.sales[2], id: 'sale-none', totalAmount: 60, customerTypeSnapshot: undefined, status: 'Completed' as const },
      ],
    };

    expect(selectSalesSnapshotSegmentation(state)).toEqual([
      { label: 'B2B', customerType: 'B2B', transactionCount: 1, totalAmount: 200 },
      { label: 'B2C', customerType: 'B2C', transactionCount: 1, totalAmount: 120 },
      { label: 'Unclassified', customerType: undefined, transactionCount: 1, totalAmount: 60 },
    ]);
  });

  it('returns document tax totals from immutable snapshot fields', () => {
    expect(selectDocumentTaxTotals({
      subtotalAmount: 100,
      taxAmount: 17.5,
      totalAmount: 117.5,
      taxSnapshot: {
        enabled: true,
        preset: 'ghana-standard',
        mode: 'exclusive',
        totalRate: 17.5,
      },
    })).toEqual({
      subtotalAmount: 100,
      taxAmount: 17.5,
      totalAmount: 117.5,
      taxRate: 17.5,
      hasTax: true,
      isExempt: false,
      exemptionReason: undefined,
    });
  });
});
