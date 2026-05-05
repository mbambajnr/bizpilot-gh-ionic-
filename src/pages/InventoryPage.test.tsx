import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import InventoryPage from './InventoryPage';

const mockUseBusiness = vi.fn();
const mockPush = vi.fn();
let mockLocationSearch = '';

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useHistory: () => ({ push: mockPush }),
    useLocation: () => ({ search: mockLocationSearch }),
  };
});

function buildContext(permissionMap: Record<string, boolean>, overrides: Record<string, unknown> = {}) {
  return {
    state: {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        inventoryCategoriesEnabled: true,
      },
      locations: [
        { id: 'loc-store', name: 'Main Store', type: 'store', isDefault: true, isActive: true },
        { id: 'loc-warehouse', name: 'North Warehouse', type: 'warehouse', isDefault: false, isActive: true },
      ],
      locationSupplyRoutes: [
        { id: 'route-1', fromLocationId: 'loc-warehouse', toLocationId: 'loc-store', isActive: true },
      ],
      vendors: [
        { id: 'vendor-1', vendorCode: 'VEN-0001', name: 'Savannah Supplies', contactEmail: 'ops@savannah.test', location: 'Tamale', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      purchases: [],
      stockTransfers: [],
      productCategories: [
        { id: 'cat-1', name: 'Household', slug: 'household', sortOrder: 0, isActive: true },
      ],
      products: [
        { ...seedState.products[0], id: 'p1', name: 'Rice', categoryId: 'cat-1', cost: 10, reorderLevel: 5 },
      ],
      stockMovements: [
        { ...seedState.stockMovements[0], productId: 'p1', locationId: 'loc-store', quantityDelta: 4, quantityAfter: 4, createdAt: new Date().toISOString() },
        { ...seedState.stockMovements[1], productId: 'p1', locationId: 'loc-warehouse', quantityDelta: 12, quantityAfter: 12, createdAt: new Date().toISOString() },
      ],
      restockRequests: [],
      ...overrides,
    },
    addProduct: vi.fn(() => ({ ok: true })),
    addRestockRequest: vi.fn(() => ({ ok: true })),
    reviewRestockRequest: vi.fn(() => ({ ok: true })),
    createStockTransfer: vi.fn(async () => ({ ok: true })),
    approveStockTransfer: vi.fn(async () => ({ ok: true })),
    dispatchStockTransfer: vi.fn(async () => ({ ok: true })),
    receiveStockTransfer: vi.fn(async () => ({ ok: true })),
    cancelStockTransfer: vi.fn(async () => ({ ok: true })),
    createPurchaseDraft: vi.fn(async () => ({ ok: true })),
    submitPurchase: vi.fn(async () => ({ ok: true })),
    approvePurchase: vi.fn(async () => ({ ok: true })),
    cancelPurchase: vi.fn(async () => ({ ok: true })),
    receivePurchaseInWarehouse: vi.fn(async () => ({ ok: true })),
    currentUser: {
      userId: 'u1',
      name: 'Owner',
      email: 'owner@example.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: [],
    },
    hasPermission: vi.fn((permission: string) => Boolean(permissionMap[permission])),
  };
}

describe('InventoryPage ERP discoverability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationSearch = '';
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('shows Procurement, Purchase Queue, Warehouse Receipts, and Stock Transfers to permitted users', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'purchases.view': true,
      'purchases.create': true,
      'purchases.receive': true,
      'transfers.view': true,
      'transfers.create': true,
      'restockRequests.view': true,
    }, {
      purchases: [
        {
          id: 'purchase-1',
          purchaseCode: 'PO-0001',
          vendorId: 'vendor-1',
          vendorCode: 'VEN-0001',
          items: [{ productId: 'p1', productName: 'Rice', quantity: 5, unitCost: 11, totalCost: 55, vendorCode: 'VEN-0001' }],
          totalAmount: 55,
          status: 'approved',
          createdBy: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));

    render(<InventoryPage />);

    expect(await screen.findByText('ERP operations')).toBeInTheDocument();
    expect(screen.getByText('Procurement')).toBeInTheDocument();
    expect(screen.getByText('Purchase Queue')).toBeInTheDocument();
    expect(screen.getByText('Warehouse Receipts')).toBeInTheDocument();
    expect(screen.getByText('Stock Transfers')).toBeInTheDocument();
  });

  it('renders helpful ERP empty states when there is no procurement or transfer activity', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'purchases.view': true,
      'purchases.receive': true,
      'transfers.view': true,
      'restockRequests.view': true,
    }, {
      vendors: [],
      purchases: [],
      stockTransfers: [],
      locationSupplyRoutes: [],
    }));

    render(<InventoryPage />);

    expect(await screen.findByText('No purchases awaiting receipt')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('No pending stock transfers'))).toBeInTheDocument();
  });

  it('hides unauthorized procurement and transfer action buttons for restricted users', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'purchases.view': true,
      'transfers.view': true,
      'restockRequests.view': true,
    }));

    render(<InventoryPage />);

    expect(await screen.findByText('ERP operations')).toBeInTheDocument();
    expect(screen.queryByText('Warehouse Receipts')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Purchase Order')).not.toBeInTheDocument();
  });

  it('presents purchase order entry with sales-style supplier and item controls', async () => {
    mockLocationSearch = '?section=procurement';
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'purchases.view': true,
      'purchases.create': true,
      'restockRequests.view': true,
    }));

    render(<InventoryPage />);

    expect(await screen.findByText('Items Ordered')).toBeInTheDocument();
    expect(screen.getByText('Savannah Supplies')).toBeInTheDocument();
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(screen.getByText('Purchase order total')).toBeInTheDocument();
    expect(screen.getByText('Create Purchase Order')).toBeInTheDocument();
  });

  it('keeps store balances hidden from purchase officers without transfer access', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'vendors.view': true,
      'vendors.manage': true,
      'purchases.view': true,
      'purchases.create': true,
      'purchases.approve': true,
      'purchases.receive': true,
      'reports.inventory.view': true,
    }));

    render(<InventoryPage />);

    expect(await screen.findByText('Warehouse balances')).toBeInTheDocument();
    expect(screen.queryByText('Store balances')).not.toBeInTheDocument();
    expect(screen.queryByText('Main Store')).not.toBeInTheDocument();
  });

  it('opens the deep-linked inventory section for warehouse receipts', async () => {
    mockLocationSearch = '?section=receipts';
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'purchases.view': true,
      'purchases.receive': true,
      'restockRequests.view': true,
    }));

    render(<InventoryPage />);

    expect(await screen.findByText('Supply workflow')).toBeInTheDocument();
    expect(screen.getByText("You're viewing Warehouse Receipts")).toBeInTheDocument();
    expect(screen.getByTestId('arrival-receipts')).toHaveClass('section-card-highlighted');
    expect(screen.getAllByText('Warehouse Receipts').length).toBeGreaterThan(0);
  });

  it('emphasizes Procurement when opened with the procurement deep link', async () => {
    mockLocationSearch = '?section=procurement';
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'purchases.view': true,
      'purchases.create': true,
      'restockRequests.view': true,
    }));

    render(<InventoryPage />);

    expect(await screen.findByText("You're viewing Procurement")).toBeInTheDocument();
    expect(screen.getByTestId('arrival-procurement')).toHaveClass('section-card-highlighted');
  });

  it('emphasizes Stock Transfers when opened with the transfer deep link', async () => {
    mockLocationSearch = '?section=transfers';
    mockUseBusiness.mockReturnValue(buildContext({
      'inventory.view': true,
      'transfers.view': true,
      'transfers.create': true,
      'restockRequests.view': true,
    }));

    render(<InventoryPage />);

    expect(await screen.findAllByText("You're viewing Stock Transfers")).toHaveLength(2);
    expect(screen.getByTestId('arrival-transfers')).toHaveClass('section-card-highlighted');
  });
});
