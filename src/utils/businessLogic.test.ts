import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import {
  selectCustomerBalance,
  selectDashboardMetrics,
  selectProductQuantityOnHand,
  selectSaleBalanceRemaining,
  selectSalePaymentStatus,
} from '../selectors/businessSelectors';
import {
  addCustomerToState,
  addProductToState,
  addQuotationToState,
  addSaleToState,
  approveStockTransferInState,
  buildTaxSnapshot,
  calculateTaxComponentTotalRate,
  calculateTaxTotals,
  createStockTransferInState,
  createPurchaseDraftInState,
  createVendorInState,
  convertQuotationToSalesState,
  createBusinessLocationInState,
  createProductCategoryInState,
  createSupplyRouteInState,
  dispatchStockTransferInState,
  getBusinessLaunchState,
  approvePayableInState,
  approvePurchaseInState,
  cancelPurchaseInState,
  isBusinessSetupComplete,
  isBusinessWorkspaceLive,
  launchBusinessWorkspaceInState,
  recordPayablePaymentInState,
  receivePurchaseInWarehouseInState,
  receiveStockTransferInState,
  restoreBusinessState,
  reverseSaleInState,
  setBusinessTaxSettingsInState,
  setCustomerClassificationEnabledInState,
  setInventoryCategoriesEnabledInState,
  setProductCategoryActiveInState,
  submitPurchaseInState,
  updateBusinessProfileInState,
  updateBusinessLocationInState,
  updateCustomerStatusInState,
  updateCustomerInState,
  updateProductCategoryInState,
  updateVendorInState,
} from './businessLogic';

describe('businessLogic', () => {
  it('derives the business launch state from setup completeness and required branding', () => {
    expect(getBusinessLaunchState(seedState.businessProfile)).toBe('setupIncomplete');

    const readyProfile = {
      ...seedState.businessProfile,
      businessName: 'BisaPilot',
      businessType: 'General Retail',
      currency: 'GHS',
      country: 'Ghana',
      receiptPrefix: 'RCP-',
      invoicePrefix: 'INV-',
      phone: '0240000000',
      email: 'owner@example.com',
      address: 'Accra',
      logoUrl: '',
    };
    expect(getBusinessLaunchState(readyProfile)).toBe('readyToLaunch');
    expect(isBusinessSetupComplete(readyProfile)).toBe(true);
    expect(isBusinessWorkspaceLive(readyProfile)).toBe(false);

    const liveProfile = {
      ...readyProfile,
      launchedAt: '2026-05-03T10:00:00.000Z',
    };
    expect(getBusinessLaunchState(liveProfile)).toBe('live');
    expect(isBusinessSetupComplete(liveProfile)).toBe(true);
    expect(isBusinessWorkspaceLive(liveProfile)).toBe(true);
  });

  it('launches the workspace only after setup is complete', () => {
    const blocked = launchBusinessWorkspaceInState(seedState);
    expect(blocked.ok).toBe(false);

    const readyState = {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        businessName: 'BisaPilot',
        businessType: 'General Retail',
        currency: 'GHS',
        country: 'Ghana',
        receiptPrefix: 'RCP-',
        invoicePrefix: 'INV-',
        phone: '0240000000',
        email: 'owner@example.com',
        address: 'Accra',
        logoUrl: '',
      },
    };

    const launched = launchBusinessWorkspaceInState(readyState, {
      launchedAt: '2026-05-03T10:00:00.000Z',
    });
    expect(launched.ok).toBe(true);
    if (launched.ok && launched.data) {
      expect(launched.data.businessProfile.launchedAt).toBe('2026-05-03T10:00:00.000Z');
      expect(getBusinessLaunchState(launched.data.businessProfile)).toBe('live');
    }
  });

  it('normalizes legacy state with a default location and maps legacy movements there', () => {
    const restored = restoreBusinessState({
      ...seedState,
      locations: undefined,
      stockMovements: [
        {
          id: 'sm-legacy',
          movementNumber: 'SMV-LEGACY',
          productId: 'p1',
          type: 'opening',
          quantityDelta: 5,
          quantityAfter: 5,
          createdAt: new Date().toISOString(),
          note: 'Legacy movement',
        },
      ],
    });

    expect(restored.locations).toHaveLength(1);
    expect(restored.locations[0]).toMatchObject({ name: 'Main Store', type: 'store', isDefault: true });
    expect(restored.stockMovements[0].locationId).toBe(restored.locations[0].id);
  });

  it('creates and updates locations while keeping one default', () => {
    const created = createBusinessLocationInState(seedState, {
      name: 'Warehouse A',
      type: 'warehouse',
      isDefault: true,
    });

    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) {
      return;
    }

    const defaults = created.data.locations.filter((location) => location.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe('Warehouse A');

    const updated = updateBusinessLocationInState(created.data, {
      locationId: defaults[0].id,
      name: 'Warehouse North',
      type: 'warehouse',
      isDefault: true,
      isActive: true,
    });

    expect(updated.ok).toBe(true);
    if (updated.ok && updated.data) {
      expect(updated.data.locations.find((location) => location.id === defaults[0].id)?.name).toBe('Warehouse North');
      expect(updated.data.locations.filter((location) => location.isDefault)).toHaveLength(1);
    }
  });

  it('rejects invalid location values and duplicate names', () => {
    const duplicate = createBusinessLocationInState(seedState, {
      name: 'Main Store',
      type: 'store',
    });
    expect(duplicate.ok).toBe(false);

    const invalid = createBusinessLocationInState(seedState, {
      name: 'Ghost',
      type: 'invalid' as 'store',
    });
    expect(invalid.ok).toBe(false);
  });

  it('creates warehouse-to-store routes and transfer drafts before receipt', () => {
    const withWarehouse = createBusinessLocationInState(seedState, {
      name: 'North Warehouse',
      type: 'warehouse',
    });
    expect(withWarehouse.ok).toBe(true);
    if (!withWarehouse.ok || !withWarehouse.data) {
      return;
    }

    const warehouse = withWarehouse.data.locations.find((location) => location.name === 'North Warehouse')!;
    const store = withWarehouse.data.locations.find((location) => location.isDefault)!;
    const withWarehouseStock = addProductToState(withWarehouse.data, {
      name: 'Bulk Rice',
      unit: 'bags',
      price: 200,
      cost: 150,
      reorderLevel: 5,
      quantity: 20,
      locationId: warehouse.id,
    });
    expect(withWarehouseStock.ok).toBe(true);
    if (!withWarehouseStock.ok || !withWarehouseStock.data) {
      return;
    }

    const product = withWarehouseStock.data.products.find((item) => item.name === 'Bulk Rice')!;
    const withRoute = createSupplyRouteInState(withWarehouseStock.data, {
      fromLocationId: warehouse.id,
      toLocationId: store.id,
    });
    expect(withRoute.ok).toBe(true);
    if (!withRoute.ok || !withRoute.data) {
      return;
    }

    const transferred = createStockTransferInState(withRoute.data, {
      fromWarehouseId: warehouse.id,
      toStoreId: store.id,
      initiatedBy: 'u-admin',
      items: [{ productId: product.id, quantity: 6 }],
    });

    expect(transferred.ok).toBe(true);
    if (!transferred.ok || !transferred.data) {
      return;
    }
    expect(selectProductQuantityOnHand(transferred.data, product.id, warehouse.id)).toBe(20);
    expect(selectProductQuantityOnHand(transferred.data, product.id, store.id)).toBe(0);
    expect(transferred.data.stockTransfers[0]).toMatchObject({
      status: 'pending',
      fromWarehouseId: warehouse.id,
      toStoreId: store.id,
    });
  });

  it('rejects invalid transfer routes and insufficient source stock', () => {
    const withWarehouse = createBusinessLocationInState(seedState, {
      name: 'North Warehouse',
      type: 'warehouse',
    });
    expect(withWarehouse.ok).toBe(true);
    if (!withWarehouse.ok || !withWarehouse.data) {
      return;
    }

    const warehouse = withWarehouse.data.locations.find((location) => location.name === 'North Warehouse')!;
    const store = withWarehouse.data.locations.find((location) => location.isDefault)!;
    const noRouteTransfer = createStockTransferInState(withWarehouse.data, {
      fromWarehouseId: warehouse.id,
      toStoreId: store.id,
      initiatedBy: 'u-admin',
      items: [{ productId: 'p1', quantity: 1 }],
    });
    expect(noRouteTransfer.ok).toBe(false);

    const badRoute = createSupplyRouteInState(withWarehouse.data, {
      fromLocationId: store.id,
      toLocationId: warehouse.id,
    });
    expect(badRoute.ok).toBe(false);

    const withRoute = createSupplyRouteInState(withWarehouse.data, {
      fromLocationId: warehouse.id,
      toLocationId: store.id,
    });
    expect(withRoute.ok).toBe(true);
    if (!withRoute.ok || !withRoute.data) {
      return;
    }

    const sameLocationTransfer = createStockTransferInState(withRoute.data, {
      fromWarehouseId: warehouse.id,
      toStoreId: warehouse.id,
      initiatedBy: 'u-admin',
      items: [{ productId: 'p1', quantity: 1 }],
    });
    expect(sameLocationTransfer.ok).toBe(false);

    const tooMuch = createStockTransferInState(withRoute.data, {
      fromWarehouseId: warehouse.id,
      toStoreId: store.id,
      initiatedBy: 'u-admin',
      items: [{ productId: 'p1', quantity: 999 }],
    });
    expect(tooMuch.ok).toBe(false);
  });

  it('receiving transfer creates warehouse stock-out and store stock-in movements', () => {
    const created = createStockTransferInState(seedState, {
      fromWarehouseId: '00000000-0000-4000-8000-000000000002',
      toStoreId: '00000000-0000-4000-8000-000000000001',
      initiatedBy: 'u-admin',
      items: [{ productId: 'p1', quantity: 3 }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) return;
    const transferId = created.data.stockTransfers[0].id;

    const approved = approveStockTransferInState(created.data, {
      transferId,
      performedBy: 'u-admin',
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || !approved.data) return;

    const dispatched = dispatchStockTransferInState(approved.data, {
      transferId,
      performedBy: 'u-admin',
    });
    expect(dispatched.ok).toBe(true);
    if (!dispatched.ok || !dispatched.data) return;

    const received = receiveStockTransferInState(dispatched.data, {
      transferId,
      performedBy: 'u-sales',
    });
    expect(received.ok).toBe(true);
    if (!received.ok || !received.data) return;

    const transferMovements = received.data.stockMovements.filter(
      (movement) => movement.transferId === transferId
    );
    expect(transferMovements).toHaveLength(2);
    expect(transferMovements.some((movement) => movement.locationId === '00000000-0000-4000-8000-000000000002' && movement.quantityDelta === -3)).toBe(true);
    expect(transferMovements.some((movement) => movement.locationId === '00000000-0000-4000-8000-000000000001' && movement.quantityDelta === 3)).toBe(true);
    expect(selectProductQuantityOnHand(received.data, 'p1', '00000000-0000-4000-8000-000000000002')).toBe(15);
    expect(selectProductQuantityOnHand(received.data, 'p1', '00000000-0000-4000-8000-000000000001')).toBe(21);
  });

  it('transfer cannot be received twice', () => {
    const received = receiveStockTransferInState(
      {
        ...seedState,
        stockTransfers: [{ ...seedState.stockTransfers[0], status: 'received' }],
      },
      {
        transferId: seedState.stockTransfers[0].id,
        performedBy: 'u-sales',
      }
    );

    expect(received.ok).toBe(false);
  });

  it('rejects invalid product numbers', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      unit: 'bags',
      price: Number.NaN,
      cost: 50,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Selling price');
    }
  });

  it('adds a product with the next inventory id', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      unit: 'bags',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.products[0].inventoryId).toBe('INV-005');
      expect(selectProductQuantityOnHand(result.data, result.data.products[0].id)).toBe(10);
    }
  });

  it('uses a custom inventory id when provided', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      inventoryId: 'INV-CUSTOM-01',
      unit: 'bags',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.products[0].inventoryId).toBe('INV-CUSTOM-01');
    }
  });

  it('allows uncategorized products even when inventory categories are enabled', () => {
    const result = addProductToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          inventoryCategoriesEnabled: true,
        },
      },
      {
        name: 'Rice Bag',
        unit: 'bags',
        price: 80,
        cost: 60,
        reorderLevel: 4,
        quantity: 10,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.products[0].categoryId).toBeUndefined();
    }
  });

  it('rejects a product when the selected category is inactive', () => {
    const result = addProductToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          inventoryCategoriesEnabled: true,
        },
        productCategories: [
          {
            id: 'pc-1',
            name: 'Household',
            slug: 'household',
            sortOrder: 0,
            isActive: false,
          },
        ],
      },
      {
        name: 'Rice Bag',
        unit: 'bags',
        price: 80,
        cost: 60,
        reorderLevel: 4,
        quantity: 10,
        categoryId: 'pc-1',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('inactive');
    }
  });

  it('rejects a product when the selected category cannot be found', () => {
    const result = addProductToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          inventoryCategoriesEnabled: true,
        },
        productCategories: [],
      },
      {
        name: 'Rice Bag',
        unit: 'bags',
        price: 80,
        cost: 60,
        reorderLevel: 4,
        quantity: 10,
        categoryId: 'unknown',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('could not be found');
    }
  });

  it('rejects a product when categories are disabled but categoryId is supplied', () => {
    const result = addProductToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          inventoryCategoriesEnabled: false,
        },
        productCategories: [
          {
            id: 'pc-1',
            name: 'Household',
            slug: 'household',
            sortOrder: 0,
            isActive: true,
          },
        ],
      },
      {
        name: 'Rice Bag',
        unit: 'bags',
        price: 80,
        cost: 60,
        reorderLevel: 4,
        quantity: 10,
        categoryId: 'pc-1',
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Enable inventory categories');
    }
  });

  it('rejects a duplicate custom inventory id after trimming', () => {
    const result = addProductToState(seedState, {
      name: 'Rice Bag',
      inventoryId: '  INV-001  ',
      unit: 'bags',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Inventory ID already exists');
    }
  });

  it('rejects sale input with invalid paid amount', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: Number.NaN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('valid number');
    }
  });

  it('sale creates correct stock movements and customer ledger entries', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p2', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: 40,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const recordedSale = result.data.sales[0];
      const latestMovement = result.data.stockMovements[0];
      const latestLedgerEntries = result.data.customerLedgerEntries.slice(0, 2);

      expect(recordedSale.receiptId).toBe('RCP-003');
      expect(recordedSale.invoiceNumber).toBe('INV-003');
      expect(selectProductQuantityOnHand(result.data, 'p2')).toBe(7);
      expect(latestMovement.relatedSaleId).toBe(recordedSale.id);
      expect(latestMovement.quantityDelta).toBe(-1);
      expect(latestLedgerEntries.some((entry) => entry.type === 'sale_charge' && entry.amountDelta === 42)).toBe(true);
      expect(latestLedgerEntries.some((entry) => entry.type === 'payment_received' && entry.amountDelta === -40)).toBe(true);
      expect(selectCustomerBalance(result.data, 'c1')).toBe(382);
    }
  });

  it('partial payment status is correct', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p2', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: 40,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const recordedSale = result.data.sales[0];
      expect(selectSalePaymentStatus(recordedSale)).toBe('Partial');
      expect(selectSaleBalanceRemaining(recordedSale)).toBe(2);
    }
  });

  it('restores missing business ids and migrates legacy local state', () => {
    const restored = restoreBusinessState({
      ...seedState,
      products: seedState.products.map((product, index) => ({
        ...product,
        inventoryId: undefined,
        quantity: [12, 8, 19, 16][index],
      })),
      customers: seedState.customers.map((customer, index) => ({
        ...customer,
        clientId: undefined,
        balance: [380, 0, 1040, 0][index],
      })),
      stockMovements: [],
      customerLedgerEntries: [],
      activityLogEntries: [],
    } as unknown as typeof seedState);

    expect(restored.products[0].inventoryId).toBe('INV-001');
    expect(restored.customers[0].clientId).toBe('CLT-001');
    expect(restored.stockMovements.length).toBeGreaterThan(0);
    expect(restored.customerLedgerEntries.length).toBeGreaterThan(0);
  });

  it('restores category plumbing with safe defaults for legacy state', () => {
    const restored = restoreBusinessState({
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        inventoryCategoriesEnabled: undefined,
      },
      products: [
        {
          ...seedState.products[0],
          categoryId: 'pc-001',
        },
      ],
      productCategories: [
        {
          id: 'pc-001',
          name: 'Household',
          slug: 'household',
          description: undefined,
          sortOrder: 2,
          isActive: undefined,
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.businessProfile.inventoryCategoriesEnabled).toBe(false);
    expect(restored.products[0].categoryId).toBe('pc-001');
    expect(restored.productCategories[0].slug).toBe('household');
    expect(restored.productCategories[0].isActive).toBe(true);
  });

  it('restores customer classification plumbing with safe defaults for legacy state', () => {
    const restored = restoreBusinessState({
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        customerClassificationEnabled: undefined,
      },
      customers: [
        {
          ...seedState.customers[0],
          customerType: undefined,
        },
      ],
      sales: [
        {
          ...seedState.sales[0],
          customerTypeSnapshot: undefined,
        },
      ],
      quotations: [
        {
          id: 'qtn-1',
          quotationNumber: 'QTN-001',
          customerId: seedState.customers[0].id,
          customerName: seedState.customers[0].name,
          clientId: seedState.customers[0].clientId,
          createdAt: new Date().toISOString(),
          items: [],
          totalAmount: 0,
          status: 'Draft',
          customerTypeSnapshot: undefined,
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.businessProfile.customerClassificationEnabled).toBe(false);
    expect(restored.customers[0].customerType).toBeUndefined();
    expect(restored.sales[0].customerTypeSnapshot).toBeUndefined();
    expect(restored.quotations[0].customerTypeSnapshot).toBeUndefined();
  });

  it('preserves customer classification fields when present in restored state', () => {
    const restored = restoreBusinessState({
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        customerClassificationEnabled: true,
      },
      customers: [
        {
          ...seedState.customers[0],
          customerType: 'B2B',
        },
      ],
      sales: [
        {
          ...seedState.sales[0],
          customerTypeSnapshot: 'B2C',
        },
      ],
      quotations: [
        {
          id: 'qtn-2',
          quotationNumber: 'QTN-002',
          customerId: seedState.customers[0].id,
          customerName: seedState.customers[0].name,
          clientId: seedState.customers[0].clientId,
          createdAt: new Date().toISOString(),
          items: [],
          totalAmount: 0,
          status: 'Draft',
          customerTypeSnapshot: 'B2B',
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.businessProfile.customerClassificationEnabled).toBe(true);
    expect(restored.customers[0].customerType).toBe('B2B');
    expect(restored.sales[0].customerTypeSnapshot).toBe('B2C');
    expect(restored.quotations[0].customerTypeSnapshot).toBe('B2B');
  });

  it('prevents duplicate category names regardless of case and spacing', () => {
    const withExistingCategory = {
      ...seedState,
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
      ],
    };

    const result = createProductCategoryInState(withExistingCategory, {
      name: '  houseHold  ',
      description: 'Duplicate with different spacing',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('already exists');
    }
  });

  it('supports a shallow parent category without requiring it for assignment', () => {
    const withParent = {
      ...seedState,
      productCategories: [
        {
          id: 'pc-parent',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
      ],
    };

    const result = createProductCategoryInState(withParent, {
      name: 'Cleaning',
      parentCategoryId: 'pc-parent',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.productCategories[1].parentCategoryId).toBe('pc-parent');
    }
  });

  it('rejects unsafe parent category references', () => {
    const state = {
      ...seedState,
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
          parentCategoryId: 'pc-2',
        },
        {
          id: 'pc-2',
          name: 'Cleaning',
          slug: 'cleaning',
          sortOrder: 1,
          isActive: true,
        },
      ],
    };

    const selfParent = updateProductCategoryInState(state, {
      categoryId: 'pc-1',
      name: 'Household',
      parentCategoryId: 'pc-1',
    });
    expect(selfParent.ok).toBe(false);

    const loop = updateProductCategoryInState(state, {
      categoryId: 'pc-2',
      name: 'Cleaning',
      parentCategoryId: 'pc-1',
    });
    expect(loop.ok).toBe(false);
  });

  it('archives and reactivates a category without breaking linked products', () => {
    const withCategory = {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        inventoryCategoriesEnabled: true,
      },
      products: [
        {
          ...seedState.products[0],
          categoryId: 'pc-1',
        },
      ],
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
      ],
    };

    const archived = setProductCategoryActiveInState(withCategory, {
      categoryId: 'pc-1',
      isActive: false,
    });

    expect(archived.ok).toBe(true);
    if (!archived.ok || !archived.data) {
      return;
    }

    expect(archived.data.productCategories[0].isActive).toBe(false);
    expect(archived.data.products[0].categoryId).toBe('pc-1');

    const reactivated = setProductCategoryActiveInState(archived.data, {
      categoryId: 'pc-1',
      isActive: true,
    });

    expect(reactivated.ok).toBe(true);
    if (reactivated.ok && reactivated.data) {
      expect(reactivated.data.productCategories[0].isActive).toBe(true);
      expect(reactivated.data.products[0].categoryId).toBe('pc-1');
    }
  });

  it('renames a category while keeping it unique and updates the slug safely', () => {
    const state = {
      ...seedState,
      productCategories: [
        {
          id: 'pc-1',
          name: 'Household',
          slug: 'household',
          sortOrder: 0,
          isActive: true,
        },
        {
          id: 'pc-2',
          name: 'Health Beauty',
          slug: 'health-beauty',
          sortOrder: 1,
          isActive: true,
        },
      ],
    };

    const result = updateProductCategoryInState(state, {
      categoryId: 'pc-1',
      name: 'Health & Beauty',
      description: 'Updated category',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const updated = result.data.productCategories.find((category) => category.id === 'pc-1');
      expect(updated?.slug).toBe('health-beauty-2');
      expect(updated?.description).toBe('Updated category');
    }
  });

  it('preserves inventory category setting when other business settings are updated', () => {
    const result = updateBusinessProfileInState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          inventoryCategoriesEnabled: true,
        },
      },
      {
        businessName: 'BisaPilot Retail',
        businessType: 'Retail',
        currency: 'GHS',
        country: 'Ghana',
        receiptPrefix: 'RCP-',
        invoicePrefix: 'INV-',
        phone: '+233000000000',
        email: 'owner@example.com',
        address: 'Accra',
        website: 'https://example.com',
        waybillPrefix: 'WAY-',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.businessProfile.inventoryCategoriesEnabled).toBe(true);
    }
  });

  it('toggles inventory category enablement without requiring a full business profile rewrite', () => {
    const enabled = setInventoryCategoriesEnabledInState(seedState, {
      enabled: true,
    });

    expect(enabled.ok).toBe(true);
    if (!enabled.ok || !enabled.data) {
      return;
    }

    expect(enabled.data.businessProfile.inventoryCategoriesEnabled).toBe(true);

    const disabled = setInventoryCategoriesEnabledInState(enabled.data, {
      enabled: false,
    });

    expect(disabled.ok).toBe(true);
    if (disabled.ok && disabled.data) {
      expect(disabled.data.businessProfile.inventoryCategoriesEnabled).toBe(false);
    }
  });

  it('toggles customer classification enablement without requiring a full business profile rewrite', () => {
    const enabled = setCustomerClassificationEnabledInState(seedState, {
      enabled: true,
    });

    expect(enabled.ok).toBe(true);
    if (!enabled.ok || !enabled.data) {
      return;
    }

    expect(enabled.data.businessProfile.customerClassificationEnabled).toBe(true);

    const disabled = setCustomerClassificationEnabledInState(enabled.data, {
      enabled: false,
    });

    expect(disabled.ok).toBe(true);
    if (disabled.ok && disabled.data) {
      expect(disabled.data.businessProfile.customerClassificationEnabled).toBe(false);
    }
  });

  it('toggles Ghana tax settings without wiping stored configuration', () => {
    const enabled = setBusinessTaxSettingsInState(seedState, {
      enabled: true,
      mode: 'exclusive',
      applyTaxByDefault: true,
    });

    expect(enabled.ok).toBe(true);
    if (!enabled.ok || !enabled.data) {
      return;
    }

    expect(enabled.data.businessProfile.taxEnabled).toBe(true);
    expect(enabled.data.businessProfile.taxPreset).toBe('ghana-standard');
    expect(enabled.data.businessProfile.taxMode).toBe('exclusive');

    const disabled = setBusinessTaxSettingsInState(enabled.data, {
      enabled: false,
    });

    expect(disabled.ok).toBe(true);
    if (disabled.ok && disabled.data) {
      expect(disabled.data.businessProfile.taxEnabled).toBe(false);
      expect(disabled.data.businessProfile.taxPreset).toBe('ghana-standard');
      expect(disabled.data.businessProfile.taxMode).toBe('exclusive');
    }
  });

  it('stores editable tax component defaults and derives total from enabled components', () => {
    const result = setBusinessTaxSettingsInState(seedState, {
      enabled: true,
      mode: 'exclusive',
      applyTaxByDefault: true,
      taxComponents: [
        { key: 'vat', label: 'VAT', rate: 15, enabled: true },
        { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: false },
        { key: 'getfund', label: 'GETFund', rate: 3, enabled: true },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) {
      return;
    }

    expect(result.data.businessProfile.taxComponents).toEqual([
      { key: 'vat', label: 'VAT', rate: 15, enabled: true },
      { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: false },
      { key: 'getfund', label: 'GETFund', rate: 3, enabled: true },
    ]);
    expect(calculateTaxComponentTotalRate(result.data.businessProfile.taxComponents)).toBe(18);
  });

  it('builds new tax snapshots from editable business component rates', () => {
    const snapshot = buildTaxSnapshot({
      ...seedState.businessProfile,
      taxEnabled: true,
      applyTaxByDefault: true,
      taxComponents: [
        { key: 'vat', label: 'VAT', rate: 15, enabled: true },
        { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: false },
        { key: 'getfund', label: 'GETFund', rate: 3, enabled: true },
      ],
    });

    expect(snapshot?.totalRate).toBe(18);
    expect(snapshot?.components).toEqual([
      { key: 'vat', label: 'VAT', rate: 15, enabled: true },
      { key: 'getfund', label: 'GETFund', rate: 3, enabled: true },
    ]);
    expect(calculateTaxTotals(100, snapshot)).toEqual({
      subtotalAmount: 100,
      taxAmount: 18,
      totalAmount: 118,
      hasTax: true,
    });
  });

  it('restores legacy customers while preserving phone, whatsapp, and email when present', () => {
    const restored = restoreBusinessState({
      ...seedState,
      customers: [
        {
          ...seedState.customers[0],
          phone: '+233555000111',
          whatsapp: '+233555000222',
          email: 'legacy@example.com',
        },
        {
          ...seedState.customers[1],
          phone: '+233555000333',
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.customers[0].phone).toBe('+233555000111');
    expect(restored.customers[0].whatsapp).toBe('+233555000222');
    expect(restored.customers[0].email).toBe('legacy@example.com');
    expect(restored.customers[1].phone).toBe('+233555000333');
    expect(restored.customers[1].whatsapp).toBe('');
    expect(restored.customers[1].email).toBe('');
  });

  it('restores legacy customers with active status by default', () => {
    const restored = restoreBusinessState({
      ...seedState,
      customers: [
        {
          ...seedState.customers[0],
          status: undefined,
          terminatedAt: undefined,
          terminationReason: undefined,
        },
      ],
    } as unknown as typeof seedState);

    expect(restored.customers[0].status).toBe('active');
    expect(restored.customers[0].terminatedAt).toBeUndefined();
  });

  it('rejects a sale when requested quantity exceeds stock on hand', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p2', quantity: 99 }],
      paymentMethod: 'Cash',
      paidAmount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Not enough stock');
    }
  });

  it('rejects a product with a blank trimmed name', () => {
    const result = addProductToState(seedState, {
      name: '   ',
      unit: 'boxes',
      price: 80,
      cost: 60,
      reorderLevel: 4,
      quantity: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Item name');
    }
  });

  it('adds a customer with the next client id when blank', () => {
    const result = addCustomerToState(seedState, {
      name: 'New Buyer',
      clientId: '   ',
      phone: '+233555000111',
      whatsapp: '+233555000222',
      email: 'buyer@example.com',
      channel: 'WhatsApp follow-up',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.customers[0].clientId).toBe('CLT-005');
      expect(result.data?.customers[0].phone).toBe('+233555000111');
      expect(result.data?.customers[0].whatsapp).toBe('+233555000222');
      expect(result.data?.customers[0].email).toBe('buyer@example.com');
    }
  });

  it('updates a customer without changing the customer id or client id', () => {
    const existingCustomer = seedState.customers[0];
    const result = updateCustomerInState(seedState, {
      customerId: existingCustomer.id,
      name: 'Updated Buyer',
      phone: '+233555000333',
      whatsapp: '+233555000444',
      email: 'updated@example.com',
      channel: 'Email follow-up',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const updatedCustomer = result.data.customers.find((customer) => customer.id === existingCustomer.id);
      expect(updatedCustomer?.id).toBe(existingCustomer.id);
      expect(updatedCustomer?.clientId).toBe(existingCustomer.clientId);
      expect(updatedCustomer?.name).toBe('Updated Buyer');
      expect(updatedCustomer?.phone).toBe('+233555000333');
      expect(updatedCustomer?.whatsapp).toBe('+233555000444');
      expect(updatedCustomer?.email).toBe('updated@example.com');
    }
  });

  it('terminates a customer without deleting their record', () => {
    const existingCustomer = seedState.customers[0];
    const result = updateCustomerStatusInState(seedState, {
      customerId: existingCustomer.id,
      status: 'terminated',
      terminationReason: 'Account closed',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const terminatedCustomer = result.data.customers.find((customer) => customer.id === existingCustomer.id);
      expect(terminatedCustomer?.id).toBe(existingCustomer.id);
      expect(terminatedCustomer?.status).toBe('terminated');
      expect(terminatedCustomer?.terminationReason).toBe('Account closed');
      expect(result.data.sales.some((sale) => sale.customerId === existingCustomer.id)).toBe(true);
    }
  });

  it('blocks new sales for terminated customers', () => {
    const terminatedStateResult = updateCustomerStatusInState(seedState, {
      customerId: 'c1',
      status: 'terminated',
      terminationReason: 'Inactive account',
    });

    expect(terminatedStateResult.ok).toBe(true);
    if (!terminatedStateResult.ok || !terminatedStateResult.data) {
      return;
    }

    const result = addSaleToState(terminatedStateResult.data, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
      paymentMethod: 'Cash',
      paidAmount: 35,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('terminated');
    }
  });

  it('blocks new quotations for terminated customers', () => {
    const terminatedStateResult = updateCustomerStatusInState(seedState, {
      customerId: 'c1',
      status: 'terminated',
      terminationReason: 'Inactive account',
    });

    expect(terminatedStateResult.ok).toBe(true);
    if (!terminatedStateResult.ok || !terminatedStateResult.data) {
      return;
    }

    const result = addQuotationToState(terminatedStateResult.data, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('terminated');
    }
  });

  it('rejects a duplicate custom client id after trimming', () => {
    const result = addCustomerToState(seedState, {
      name: 'New Buyer',
      clientId: '  CLT-001 ',
      channel: 'WhatsApp follow-up',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Client ID already exists');
    }
  });

  it('accepts a valid customer type when customer classification is enabled', () => {
    const result = addCustomerToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          customerClassificationEnabled: true,
        },
      },
      {
        name: 'Wholesale Buyer',
        channel: 'Email follow-up',
        customerType: 'B2B',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.customers[0].customerType).toBe('B2B');
    }
  });

  it('rejects an invalid customer type when customer classification is enabled', () => {
    const result = addCustomerToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          customerClassificationEnabled: true,
        },
      },
      {
        name: 'Broken Buyer',
        channel: 'Email follow-up',
        customerType: 'Other' as never,
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Customer type must be either B2B or B2C');
    }
  });

  it('does not force customer classification when the setting is disabled', () => {
    const result = addCustomerToState(seedState, {
      name: 'Simple Buyer',
      channel: 'Email follow-up',
      customerType: 'B2B',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.customers[0].customerType).toBeUndefined();
    }
  });

  it('updates customer classification only when the setting is enabled', () => {
    const result = updateCustomerInState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          customerClassificationEnabled: true,
        },
      },
      {
        customerId: 'c1',
        name: 'Ama Beauty Supplies',
        channel: 'WhatsApp follow-up',
        customerType: 'B2C',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.customers.find((customer) => customer.id === 'c1')?.customerType).toBe('B2C');
    }
  });

  it('preserves an existing customer type when the setting is disabled', () => {
    const result = updateCustomerInState(
      {
        ...seedState,
        customers: seedState.customers.map((customer) =>
          customer.id === 'c1' ? { ...customer, customerType: 'B2B' } : customer
        ),
      },
      {
        customerId: 'c1',
        name: 'Ama Beauty Supplies',
        channel: 'WhatsApp follow-up',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.customers.find((customer) => customer.id === 'c1')?.customerType).toBe('B2B');
    }
  });

  it('creates a quotation with a generated quotation number and totals', () => {
    const result = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.quotations[0].quotationNumber).toBe('QTN-001');
      expect(result.data?.quotations[0].totalAmount).toBe(112);
      expect(result.data?.quotations[0].items).toHaveLength(2);
      expect(result.data?.quotations[0].customerTypeSnapshot).toBeUndefined();
    }
  });

  it('captures quotation customer type snapshot from the selected customer when classification is enabled', () => {
    const result = addQuotationToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          customerClassificationEnabled: true,
        },
        customers: seedState.customers.map((customer) =>
          customer.id === 'c1' ? { ...customer, customerType: 'B2B' } : customer
        ),
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 2 }],
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.quotations[0].customerTypeSnapshot).toBe('B2B');
    }
  });

  it('does not force tax when Ghana tax is disabled', () => {
    const result = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 2 }],
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.quotations[0].taxSnapshot).toBeUndefined();
      expect(result.data.quotations[0].taxAmount).toBeUndefined();
      expect(result.data.quotations[0].totalAmount).toBe(70);
    }
  });

  it('captures Ghana tax snapshot and exclusive totals on new quotations', () => {
    const result = addQuotationToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 2 }],
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.quotations[0].taxSnapshot?.preset).toBe('ghana-standard');
      expect(result.data.quotations[0].taxSnapshot?.totalRate).toBe(17.5);
      expect(result.data.quotations[0].subtotalAmount).toBe(70);
      expect(result.data.quotations[0].taxAmount).toBe(12.25);
      expect(result.data.quotations[0].totalAmount).toBe(82.25);
    }
  });

  it('captures current editable tax rates on new quotations', () => {
    const result = addQuotationToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
          taxComponents: [
            { key: 'vat', label: 'VAT', rate: 15, enabled: true },
            { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: false },
            { key: 'getfund', label: 'GETFund', rate: 3, enabled: true },
          ],
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 2 }],
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.quotations[0].taxSnapshot?.totalRate).toBe(18);
      expect(result.data.quotations[0].taxSnapshot?.components).toHaveLength(2);
      expect(result.data.quotations[0].taxAmount).toBe(12.6);
      expect(result.data.quotations[0].totalAmount).toBe(82.6);
    }
  });

  it('rejects a quotation with no line items', () => {
    const result = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Add at least one item');
    }
  });

  it('quotation conversion links correctly', () => {
    const withQuotation = addQuotationToState(seedState, {
      customerId: 'c1',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    });

    expect(withQuotation.ok).toBe(true);
    if (!withQuotation.ok || !withQuotation.data) {
      return;
    }

    const quotationId = withQuotation.data.quotations[0].id;
    const converted = convertQuotationToSalesState(withQuotation.data, {
      quotationId,
      paymentMethod: 'Cash',
      amountPaid: 100,
    });

    expect(converted.ok).toBe(true);
    if (converted.ok && converted.data) {
      expect(converted.data.receipts).toHaveLength(1);
      expect(converted.data.data.sales).toHaveLength(3);
      expect(converted.data.data.quotations[0].status).toBe('Converted');
      expect(converted.data.data.quotations[0].relatedSaleIds).toHaveLength(1);
      expect(converted.data.data.sales[0].quotationId).toBe(quotationId);
      expect(converted.data.data.sales[0].customerTypeSnapshot).toBeUndefined();
    }
  });

  it('captures converted quotation sale customer type snapshot from the selected customer when classification is enabled', () => {
    const classifiedState = {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        customerClassificationEnabled: true,
      },
      customers: seedState.customers.map((customer) =>
        customer.id === 'c1' ? { ...customer, customerType: 'B2B' as const } : customer
      ),
    };
    const withQuotation = addQuotationToState(classifiedState, {
      customerId: 'c1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    expect(withQuotation.ok).toBe(true);
    if (!withQuotation.ok || !withQuotation.data) {
      return;
    }

    const converted = convertQuotationToSalesState(withQuotation.data, {
      quotationId: withQuotation.data.quotations[0].id,
      paymentMethod: 'Cash',
      amountPaid: 35,
    });

    expect(converted.ok).toBe(true);
    if (converted.ok && converted.data) {
      expect(converted.data.data.sales[0].customerTypeSnapshot).toBe('B2B');
    }
  });

  it('captures sale customer type snapshot from the selected customer when classification is enabled', () => {
    const result = addSaleToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          customerClassificationEnabled: true,
        },
        customers: seedState.customers.map((customer) =>
          customer.id === 'c1' ? { ...customer, customerType: 'B2C' } : customer
        ),
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 28,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.sales[0].customerTypeSnapshot).toBe('B2C');
    }
  });

  it('captures Ghana tax snapshot and exclusive totals on new sales', () => {
    const result = addSaleToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 32.9,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.sales[0].taxSnapshot?.preset).toBe('ghana-standard');
      expect(result.data.sales[0].subtotalAmount).toBe(28);
      expect(result.data.sales[0].taxAmount).toBe(4.9);
      expect(result.data.sales[0].totalAmount).toBe(32.9);
      expect(result.data.customerLedgerEntries[0].amountDelta).toBe(-32.9);
      expect(result.data.customerLedgerEntries[1].amountDelta).toBe(32.9);
    }
  });

  it('captures current editable tax rates on new sales', () => {
    const result = addSaleToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
          taxComponents: [
            { key: 'vat', label: 'VAT', rate: 15, enabled: true },
            { key: 'nhil', label: 'NHIL', rate: 2.5, enabled: false },
            { key: 'getfund', label: 'GETFund', rate: 3, enabled: true },
          ],
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 33.04,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.sales[0].taxSnapshot?.totalRate).toBe(18);
      expect(result.data.sales[0].taxAmount).toBe(5.04);
      expect(result.data.sales[0].totalAmount).toBe(33.04);
    }
  });

  it('captures tax exemption snapshots from exempt customers and produces zero tax', () => {
    const result = addQuotationToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
        },
        customers: seedState.customers.map((customer) =>
          customer.id === 'c1'
            ? { ...customer, taxExempt: true, taxExemptionReason: 'Exemption certificate' }
            : customer
        ),
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p1', quantity: 2 }],
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const quotation = result.data.quotations[0];
      expect(quotation.taxSnapshot?.exempt).toBe(true);
      expect(quotation.taxSnapshot?.exemptionReason).toBe('Exemption certificate');
      expect(quotation.subtotalAmount).toBe(70);
      expect(quotation.taxAmount).toBe(0);
      expect(quotation.totalAmount).toBe(70);
    }
  });

  it('captures withholding snapshots and net receivable on new sales', () => {
    const startingBalance = selectCustomerBalance(seedState, 'c1');
    const result = addSaleToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
          withholdingTaxEnabled: true,
          defaultWithholdingTaxRate: 3,
          defaultWithholdingTaxLabel: 'WHT',
          defaultWithholdingTaxBasis: 'taxInclusiveTotal',
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 31.91,
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const sale = result.data.sales[0];
      expect(sale.totalAmount).toBe(32.9);
      expect(sale.withholdingTaxSnapshot).toMatchObject({
        enabled: true,
        rate: 3,
        label: 'WHT',
        basis: 'taxInclusiveTotal',
        amount: 0.99,
      });
      expect(sale.withholdingTaxAmount).toBe(0.99);
      expect(sale.netReceivableAmount).toBe(31.91);
      expect(selectSaleBalanceRemaining(sale)).toBe(0);
      expect(selectCustomerBalance(result.data, 'c1')).toBe(startingBalance);
    }
  });

  it('preserves quotation tax and withholding snapshots when converting to sale after settings change', () => {
    const withQuotation = addQuotationToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
          withholdingTaxEnabled: true,
          defaultWithholdingTaxRate: 3,
          defaultWithholdingTaxLabel: 'WHT',
          defaultWithholdingTaxBasis: 'taxInclusiveTotal',
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
      }
    );

    expect(withQuotation.ok).toBe(true);
    if (!withQuotation.ok || !withQuotation.data) {
      return;
    }

    const changedSettings = {
      ...withQuotation.data,
      businessProfile: {
        ...withQuotation.data.businessProfile,
        taxMode: 'inclusive' as const,
        defaultWithholdingTaxRate: 10,
        defaultWithholdingTaxLabel: 'Changed WHT',
      },
    };

    const converted = convertQuotationToSalesState(changedSettings, {
      quotationId: withQuotation.data.quotations[0].id,
      paymentMethod: 'Cash',
      amountPaid: 31.91,
    });

    expect(converted.ok).toBe(true);
    if (converted.ok && converted.data) {
      const sale = converted.data.data.sales[0];
      expect(sale.taxSnapshot?.mode).toBe('exclusive');
      expect(sale.taxAmount).toBe(4.9);
      expect(sale.withholdingTaxSnapshot?.label).toBe('WHT');
      expect(sale.withholdingTaxSnapshot?.rate).toBe(3);
      expect(sale.withholdingTaxAmount).toBe(0.99);
      expect(sale.netReceivableAmount).toBe(31.91);
    }
  });

  it('calculates inclusive Ghana tax without changing the customer-facing total', () => {
    expect(calculateTaxTotals(117.5, {
      enabled: true,
      preset: 'ghana-standard',
      mode: 'inclusive',
      totalRate: 17.5,
    })).toEqual({
      subtotalAmount: 100,
      taxAmount: 17.5,
      totalAmount: 117.5,
      hasTax: true,
    });
  });

  it('preserves existing quotation and sale snapshots when customer type changes later', () => {
    const classifiedState = {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        customerClassificationEnabled: true,
      },
      customers: seedState.customers.map((customer) =>
        customer.id === 'c1' ? { ...customer, customerType: 'B2B' as const } : customer
      ),
    };
    const withQuotation = addQuotationToState(classifiedState, {
      customerId: 'c1',
      items: [{ productId: 'p4', quantity: 1 }],
    });

    expect(withQuotation.ok).toBe(true);
    if (!withQuotation.ok || !withQuotation.data) {
      return;
    }

    const createdQuotationId = withQuotation.data.quotations[0].id;
    const withSnapshots = addSaleToState(
      withQuotation.data,
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 28,
      }
    );

    expect(withSnapshots.ok).toBe(true);
    if (!withSnapshots.ok || !withSnapshots.data) {
      return;
    }
    const createdSaleId = withSnapshots.data.sales[0].id;

    const updated = updateCustomerInState(withSnapshots.data, {
      customerId: 'c1',
      name: 'Ama Beauty Supplies',
      channel: 'WhatsApp follow-up',
      customerType: 'B2C',
    });

    expect(updated.ok).toBe(true);
    if (updated.ok && updated.data) {
      expect(updated.data.customers.find((customer) => customer.id === 'c1')?.customerType).toBe('B2C');
      expect(updated.data.sales.find((sale) => sale.id === createdSaleId)?.customerTypeSnapshot).toBe('B2B');
      expect(updated.data.quotations.find((quotation) => quotation.id === createdQuotationId)?.customerTypeSnapshot).toBe('B2B');
    }
  });

  it('preserves existing tax snapshots when business tax settings change later', () => {
    const withTax = addSaleToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
        },
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 32.9,
      }
    );

    expect(withTax.ok).toBe(true);
    if (!withTax.ok || !withTax.data) {
      return;
    }
    const saleId = withTax.data.sales[0].id;

    const taxChanged = setBusinessTaxSettingsInState(withTax.data, {
      enabled: true,
      mode: 'inclusive',
      applyTaxByDefault: false,
    });

    expect(taxChanged.ok).toBe(true);
    if (taxChanged.ok && taxChanged.data) {
      const sale = taxChanged.data.sales.find((item) => item.id === saleId);
      expect(sale?.taxSnapshot?.mode).toBe('exclusive');
      expect(sale?.taxAmount).toBe(4.9);
      expect(sale?.totalAmount).toBe(32.9);
    }
  });

  it('preserves existing exemption snapshots when customer exemption changes later', () => {
    const withExemptSale = addSaleToState(
      {
        ...seedState,
        businessProfile: {
          ...seedState.businessProfile,
          taxEnabled: true,
          taxPreset: 'ghana-standard',
          taxMode: 'exclusive',
          applyTaxByDefault: true,
        },
        customers: seedState.customers.map((customer) =>
          customer.id === 'c1'
            ? { ...customer, taxExempt: true, taxExemptionReason: 'Certificate A' }
            : customer
        ),
      },
      {
        customerId: 'c1',
        items: [{ productId: 'p4', quantity: 1 }],
        paymentMethod: 'Cash',
        paidAmount: 28,
      }
    );

    expect(withExemptSale.ok).toBe(true);
    if (!withExemptSale.ok || !withExemptSale.data) {
      return;
    }

    const saleId = withExemptSale.data.sales[0].id;
    const updatedCustomer = updateCustomerInState(withExemptSale.data, {
      customerId: 'c1',
      name: 'Ama Beauty Supplies',
      channel: 'WhatsApp follow-up',
      taxExempt: false,
    });

    expect(updatedCustomer.ok).toBe(true);
    if (updatedCustomer.ok && updatedCustomer.data) {
      const sale = updatedCustomer.data.sales.find((item) => item.id === saleId);
      expect(sale?.taxSnapshot?.exempt).toBe(true);
      expect(sale?.taxSnapshot?.exemptionReason).toBe('Certificate A');
      expect(sale?.taxAmount).toBe(0);
      expect(sale?.totalAmount).toBe(28);
    }
  });

  it('blocks quotation conversion when stock is not sufficient for any line', () => {
    const quotationState = {
      ...seedState,
      quotations: [
        {
          id: 'q1',
          quotationNumber: 'QTN-001',
          customerId: 'c1',
          customerName: 'Ama Beauty Supplies',
          clientId: 'CLT-001',
          createdAt: new Date().toISOString(),
          items: [
            {
              productId: 'p2',
              productName: 'Paracetamol 500mg',
              inventoryId: 'INV-002',
              quantity: 99,
              unitPrice: 42,
              total: 4158,
            },
          ],
          totalAmount: 4158,
          status: 'Draft' as const,
        },
      ],
    };

    const result = convertQuotationToSalesState(quotationState, {
      quotationId: 'q1',
      paymentMethod: 'Cash',
      amountPaid: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Not enough stock');
    }
  });

  it('reversal restores stock correctly', () => {
    const result = reverseSaleInState(seedState, {
      saleId: 's1',
      reason: 'Duplicate invoice',
      actor: 'Owner',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const reversedSale = result.data.data.sales.find((sale) => sale.id === 's1');
      expect(reversedSale?.status).toBe('Reversed');
      expect(reversedSale?.reversalReason).toBe('Duplicate invoice');
      expect(selectProductQuantityOnHand(result.data.data, 'p4')).toBe(22);
      expect(result.data.data.customerLedgerEntries[0].type).toBe('reversal');
    }
  });

  it('prevents reversing the same invoice twice', () => {
    const firstPass = reverseSaleInState(seedState, {
      saleId: 's1',
      reason: 'Duplicate invoice',
    });

    expect(firstPass.ok).toBe(true);
    if (!firstPass.ok || !firstPass.data) {
      return;
    }

    const secondPass = reverseSaleInState(firstPass.data.data, {
      saleId: 's1',
      reason: 'Duplicate invoice again',
    });

    expect(secondPass.ok).toBe(false);
    if (!secondPass.ok) {
      expect(secondPass.message).toContain('already been reversed');
    }
  });

  it('creates a correction invoice only from a reversed invoice and links both records', () => {
    const reversed = reverseSaleInState(seedState, {
      saleId: 's2',
      reason: 'Wrong quantity entered',
    });

    expect(reversed.ok).toBe(true);
    if (!reversed.ok || !reversed.data) {
      return;
    }

    const corrected = addSaleToState(reversed.data.data, {
      customerId: 'c2',
      items: [{ productId: 'p1', quantity: 3 }],
      paymentMethod: 'Cash',
      paidAmount: 105,
      correctionOfSaleId: 's2',
    });

    expect(corrected.ok).toBe(true);
    if (corrected.ok && corrected.data) {
      const replacementSale = corrected.data.sales[0];
      const originalSale = corrected.data.sales.find((sale) => sale.id === 's2');

      expect(replacementSale.correctionOfSaleId).toBe('s2');
      expect(originalSale?.correctedBySaleId).toBe(replacementSale.id);
      expect(corrected.data.activityLogEntries[0].actionType).toBe('corrected_copy_created');
    }
  });

  it('blocks creating a correction invoice from an invoice that was not reversed', () => {
    const result = addSaleToState(seedState, {
      customerId: 'c2',
      items: [{ productId: 'p1', quantity: 3 }],
      paymentMethod: 'Cash',
      paidAmount: 105,
      correctionOfSaleId: 's2',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Only reversed invoices');
    }
  });

  it('creates, updates, and filters vendors for procurement use', () => {
    const created = createVendorInState(seedState, {
      name: 'Savannah Supplies',
      contactEmail: 'ops@savannah.test',
      location: 'Tamale',
    });

    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) {
      return;
    }

    const vendor = created.data.vendors[0];
    expect(vendor.vendorCode).toMatch(/^VEN-\d{4}$/);

    const updated = updateVendorInState(created.data, {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      name: 'Savannah Supplies Limited',
      contactEmail: vendor.contactEmail,
      location: vendor.location,
    });
    expect(updated.ok).toBe(true);

    const inactiveDraft = createPurchaseDraftInState({
      ...created.data,
      vendors: created.data.vendors.map((entry) => entry.id === vendor.id ? { ...entry, status: 'inactive' } : entry),
    }, {
      vendorId: vendor.id,
      createdBy: 'u-admin',
      items: [{ productId: 'p1', quantity: 2, unitCost: 11 }],
    });
    expect(inactiveDraft.ok).toBe(false);
  });

  it('supports purchase draft, approval, warehouse receipt, and payable settlement', () => {
    const purchaseDraft = createPurchaseDraftInState(seedState, {
      vendorId: seedState.vendors[0].id,
      createdBy: 'u-purchase',
      items: [
        { productId: 'p1', quantity: 4, unitCost: 15 },
        { productId: 'p2', quantity: 2, unitCost: 12.5 },
      ],
    });
    expect(purchaseDraft.ok).toBe(true);
    if (!purchaseDraft.ok || !purchaseDraft.data) {
      return;
    }

    const draft = purchaseDraft.data.purchases[0];
    expect(draft.totalAmount).toBe(85);

    const submitted = submitPurchaseInState(purchaseDraft.data, {
      purchaseId: draft.id,
      performedBy: 'u-purchase',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok || !submitted.data) {
      return;
    }
    expect(submitted.data.notifications[0]).toMatchObject({
      title: 'Purchase order submitted',
      recipientUserIds: ['u-purchase'],
      referenceNumber: draft.purchaseCode,
      actionUrl: '/inventory?section=procurement',
    });
    expect(submitted.data.notifications[0].message).toContain('awaiting Admin approval');

    const approved = approvePurchaseInState(submitted.data, {
      purchaseId: draft.id,
      performedBy: 'u-admin',
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || !approved.data) {
      return;
    }

    const payable = approved.data.accountsPayable.find((entry) => entry.purchaseId === draft.id);
    expect(payable).toBeDefined();
    expect(payable?.amountDue).toBe(85);
    expect(approved.data.notifications.some((notification) =>
      notification.recipientUserIds?.includes('u-purchase') &&
      notification.referenceNumber === draft.purchaseCode
    )).toBe(true);
    expect(approved.data.notifications.some((notification) =>
      notification.recipientRoles?.includes('Accountant') &&
      notification.actionUrl === '/accounting?segment=payables'
    )).toBe(true);

    const approvedPayable = approvePayableInState(approved.data, {
      payableId: payable!.id,
      approvedBy: 'u-accountant',
    });
    expect(approvedPayable.ok).toBe(true);
    if (!approvedPayable.ok || !approvedPayable.data) {
      return;
    }

    const received = receivePurchaseInWarehouseInState(approvedPayable.data, {
      purchaseId: draft.id,
      warehouseId: '00000000-0000-4000-8000-000000000002',
      performedBy: 'u-warehouse',
      receivedItems: [
        { productId: 'p1', quantity: 4 },
        { productId: 'p2', quantity: 2 },
      ],
    });
    expect(received.ok).toBe(true);
    if (!received.ok || !received.data) {
      return;
    }

    const purchaseMovements = received.data.stockMovements.filter((movement) => movement.sourceType === 'purchase' && movement.sourceId === draft.id);
    expect(purchaseMovements).toHaveLength(2);
    expect(purchaseMovements.every((movement) => movement.vendorCode === seedState.vendors[0].vendorCode)).toBe(true);
    expect(selectProductQuantityOnHand(received.data, 'p1', '00000000-0000-4000-8000-000000000002')).toBeGreaterThan(
      selectProductQuantityOnHand(seedState, 'p1', '00000000-0000-4000-8000-000000000002')
    );

    const partialPayment = recordPayablePaymentInState(received.data, {
      payableId: payable!.id,
      amount: 35,
      method: 'bank',
      reference: 'BANK-123',
      paidBy: 'u-accountant',
    });
    expect(partialPayment.ok).toBe(true);
    if (!partialPayment.ok || !partialPayment.data) {
      return;
    }

    const partiallyPaid = partialPayment.data.accountsPayable.find((entry) => entry.id === payable!.id);
    expect(partiallyPaid?.status).toBe('partiallyPaid');
    expect(partiallyPaid?.balance).toBe(50);

    const overPayment = recordPayablePaymentInState(partialPayment.data, {
      payableId: payable!.id,
      amount: 999,
      method: 'cash',
      paidBy: 'u-accountant',
    });
    expect(overPayment.ok).toBe(false);

    const finalPayment = recordPayablePaymentInState(partialPayment.data, {
      payableId: payable!.id,
      amount: 50,
      method: 'mobileMoney',
      paidBy: 'u-accountant',
    });
    expect(finalPayment.ok).toBe(true);
    if (finalPayment.ok && finalPayment.data) {
      expect(finalPayment.data.accountsPayable.find((entry) => entry.id === payable!.id)?.status).toBe('paid');
      expect(finalPayment.data.payments.some((payment) => payment.sourceId === payable!.id && payment.sourceType === 'payable')).toBe(true);
    }
  });

  it('prevents receiving cancelled or unapproved purchases and blocks duplicate receipt', () => {
    const draft = createPurchaseDraftInState(seedState, {
      vendorId: seedState.vendors[0].id,
      createdBy: 'u-purchase',
      items: [{ productId: 'p1', quantity: 2, unitCost: 10 }],
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok || !draft.data) {
      return;
    }

    const purchaseId = draft.data.purchases[0].id;
    const unapprovedReceipt = receivePurchaseInWarehouseInState(draft.data, {
      purchaseId,
      warehouseId: '00000000-0000-4000-8000-000000000002',
      performedBy: 'u-warehouse',
    });
    expect(unapprovedReceipt.ok).toBe(false);

    const cancelled = cancelPurchaseInState(draft.data, {
      purchaseId,
      performedBy: 'u-admin',
      note: 'Vendor quote is above budget.',
    });
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok || !cancelled.data) {
      return;
    }
    expect(cancelled.data.purchases[0].status).toBe('declined');
    expect(cancelled.data.purchases[0].declineNote).toBe('Vendor quote is above budget.');
    expect(cancelled.data.notifications[0].message).toContain('Vendor quote is above budget.');

    const cancelledReceipt = receivePurchaseInWarehouseInState(cancelled.data, {
      purchaseId,
      warehouseId: '00000000-0000-4000-8000-000000000002',
      performedBy: 'u-warehouse',
    });
    expect(cancelledReceipt.ok).toBe(false);

    const submitted = submitPurchaseInState(draft.data, {
      purchaseId,
      performedBy: 'u-purchase',
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok || !submitted.data) {
      return;
    }
    const approved = approvePurchaseInState(submitted.data, {
      purchaseId,
      performedBy: 'u-admin',
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok || !approved.data) {
      return;
    }
    const firstReceipt = receivePurchaseInWarehouseInState(approved.data, {
      purchaseId,
      warehouseId: '00000000-0000-4000-8000-000000000002',
      performedBy: 'u-warehouse',
    });
    expect(firstReceipt.ok).toBe(true);
    if (!firstReceipt.ok || !firstReceipt.data) {
      return;
    }
    const secondReceipt = receivePurchaseInWarehouseInState(firstReceipt.data, {
      purchaseId,
      warehouseId: '00000000-0000-4000-8000-000000000002',
      performedBy: 'u-warehouse',
    });
    expect(secondReceipt.ok).toBe(false);
  });

  it('dashboard derivations are correct', () => {
    const metrics = selectDashboardMetrics(seedState);

    expect(metrics.salesToday).toBe(168);
    expect(metrics.cashInHand).toBe(0);
    expect(metrics.mobileMoneyReceived).toBe(168);
    expect(metrics.receivables).toBe(1420);
    expect(metrics.lowStockCount).toBe(1);
  });
});
