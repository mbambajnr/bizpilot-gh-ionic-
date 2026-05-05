import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import DashboardPage from './DashboardPage';

const mockUseBusiness = vi.fn();
const mockPush = vi.fn();

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useHistory: () => ({ push: mockPush }),
  };
});

function buildState(overrides: Record<string, unknown> = {}) {
  return {
    ...seedState,
    businessProfile: {
      ...seedState.businessProfile,
      businessName: 'BisaPilot',
      customerClassificationEnabled: true,
      inventoryCategoriesEnabled: true,
    },
    locations: [
      { id: 'loc-store', name: 'Main Store', type: 'store', isDefault: true, isActive: true },
      { id: 'loc-warehouse', name: 'North Warehouse', type: 'warehouse', isDefault: false, isActive: true },
    ],
    vendors: [
      { id: 'vendor-1', vendorCode: 'VEN-0001', name: 'Savannah Supplies', contactEmail: 'ops@savannah.test', location: 'Tamale', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
    purchases: [
      {
        id: 'purchase-0',
        purchaseCode: 'PO-0000',
        vendorId: 'vendor-1',
        vendorCode: 'VEN-0001',
        items: [{ productId: 'p1', productName: 'Rice', quantity: 3, unitCost: 10, totalCost: 30, vendorCode: 'VEN-0001' }],
        totalAmount: 30,
        status: 'draft',
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
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
      {
        id: 'purchase-2',
        purchaseCode: 'PO-0002',
        vendorId: 'vendor-1',
        vendorCode: 'VEN-0001',
        items: [{ productId: 'p1', productName: 'Rice', quantity: 2, unitCost: 10, totalCost: 20, vendorCode: 'VEN-0001' }],
        totalAmount: 20,
        status: 'submitted',
        createdBy: 'u1',
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'purchase-3',
        purchaseCode: 'PO-0003',
        vendorId: 'vendor-1',
        vendorCode: 'VEN-0001',
        items: [{ productId: 'p1', productName: 'Rice', quantity: 1, unitCost: 8, totalCost: 8, vendorCode: 'VEN-0001' }],
        totalAmount: 8,
        status: 'cancelled',
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    accountsPayable: [
      {
        id: 'payable-1',
        payableCode: 'AP-0001',
        vendorId: 'vendor-1',
        vendorCode: 'VEN-0001',
        purchaseId: 'purchase-1',
        amountDue: 55,
        amountPaid: 10,
        balance: 45,
        status: 'approved',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'payable-2',
        payableCode: 'AP-0002',
        vendorId: 'vendor-1',
        vendorCode: 'VEN-0001',
        purchaseId: 'purchase-2',
        amountDue: 20,
        amountPaid: 5,
        balance: 15,
        status: 'partiallyPaid',
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    stockTransfers: [
      {
        id: 'transfer-1',
        transferCode: 'TRF-0001',
        fromWarehouseId: 'loc-warehouse',
        toStoreId: 'loc-store',
        items: [{ productId: 'p1', productName: 'Rice', quantity: 5 }],
        status: 'approved',
        initiatedBy: 'u1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'transfer-2',
        transferCode: 'TRF-0002',
        fromWarehouseId: 'loc-warehouse',
        toStoreId: 'loc-store',
        items: [{ productId: 'p1', productName: 'Rice', quantity: 2 }],
        status: 'dispatched',
        initiatedBy: 'u1',
        createdAt: new Date().toISOString(),
      },
    ],
    stockMovements: [
      { ...seedState.stockMovements[0], id: 'warehouse-open', productId: 'p1', locationId: 'loc-warehouse', quantityDelta: 10, quantityAfter: 10, createdAt: new Date().toISOString() },
      { ...seedState.stockMovements[1], id: 'store-open', productId: 'p1', locationId: 'loc-store', quantityDelta: 4, quantityAfter: 4, createdAt: new Date().toISOString() },
      {
        ...seedState.stockMovements[2],
        id: 'transfer-out',
        productId: 'p1',
        locationId: 'loc-warehouse',
        type: 'transfer',
        quantityDelta: -5,
        quantityAfter: 5,
        transferId: 'transfer-1',
        fromLocationId: 'loc-warehouse',
        toLocationId: 'loc-store',
        referenceNumber: 'TRF-0001',
        createdAt: new Date().toISOString(),
      },
      {
        ...seedState.stockMovements[3],
        id: 'transfer-in',
        productId: 'p1',
        locationId: 'loc-store',
        type: 'transfer',
        quantityDelta: 5,
        quantityAfter: 9,
        transferId: 'transfer-1',
        fromLocationId: 'loc-warehouse',
        toLocationId: 'loc-store',
        referenceNumber: 'TRF-0001',
        createdAt: new Date().toISOString(),
      },
    ],
    quotations: [
      {
        ...seedState.quotations[0],
        id: 'q1',
        quotationNumber: 'QTN-001',
        status: 'open',
      },
    ],
    expenses: [
      {
        ...seedState.expenses[0],
        id: 'exp-1',
        amount: 25,
      },
    ],
    restockRequests: [],
    ...overrides,
  };
}

function renderDashboard(permissionMap: Record<string, boolean>, stateOverrides: Record<string, unknown> = {}) {
  mockUseBusiness.mockReturnValue({
    priorityQuestions: [],
    backendStatus: { source: 'local', loading: false, label: 'Ready', detail: 'Ready' },
    hasPermission: vi.fn((permission: string) => Boolean(permissionMap[permission])),
    state: buildState(stateOverrides),
  });

  render(<DashboardPage />);
}

describe('DashboardPage role-aware widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the full ERP overview for an admin-style user', () => {
    renderDashboard({
      'business.edit': true,
      'users.manage': true,
      'permissions.manage': true,
      'vendors.view': true,
      'vendors.manage': true,
      'purchases.view': true,
      'purchases.create': true,
      'purchases.receive': true,
      'transfers.view': true,
      'payables.view': true,
      'payables.pay': true,
      'reports.dashboard.view': true,
      'reports.sales.view': true,
      'reports.inventory.view': true,
      'reports.financial.view': true,
      'sales.view': true,
      'customers.view': true,
      'quotations.view': true,
      'expenses.view': true,
      'accounting.access': true,
    });

    expect(screen.getByText('Owner / Admin Overview')).toBeInTheDocument();
    expect(screen.getByText('Procurement Desk')).toBeInTheDocument();
    expect(screen.getByText('Warehouse Desk')).toBeInTheDocument();
    expect(screen.getByText('Accounting Desk')).toBeInTheDocument();
    expect(screen.getByText('Users & Permissions')).toBeInTheDocument();
    expect(screen.getByText('Owner priorities')).toBeInTheDocument();
  });

  it('shows procurement widgets for a procurement-focused user', () => {
    renderDashboard({
      'vendors.manage': true,
      'purchases.view': true,
      'purchases.create': true,
    });

    expect(screen.getByText('Procurement Desk')).toBeInTheDocument();
    expect(screen.getByText('Create Purchase')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.queryByText('Warehouse Desk')).not.toBeInTheDocument();
    expect(screen.queryByText('Accounting Desk')).not.toBeInTheDocument();
  });

  it('shows warehouse widgets for a warehouse-focused user', () => {
    renderDashboard({
      'purchases.receive': true,
      'transfers.view': true,
      'transfers.dispatch': true,
      'inventory.view': true,
    });

    expect(screen.getByText('Warehouse Desk')).toBeInTheDocument();
    expect(screen.getByText('Warehouse Receipts')).toBeInTheDocument();
    expect(screen.getByText('Stock Transfers')).toBeInTheDocument();
    expect(screen.getByText('Warehouse stock')).toBeInTheDocument();
  });

  it('shows accounting widgets for an account manager', () => {
    renderDashboard({
      'accounting.access': true,
      'payables.view': true,
      'payables.manage': true,
      'payables.pay': true,
      'expenses.view': true,
      'reports.financial.view': true,
      'customers.ledger.view': true,
    });

    expect(screen.getByText('Accounting Desk')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
    expect(screen.getByText('Pay Supplier')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
  });

  it('shows sales desk and collections visibility for a sales-focused user with receivables access', () => {
    renderDashboard({
      'sales.view': true,
      'sales.create': true,
      'customers.view': true,
      'quotations.view': true,
      'customers.ledger.view': true,
    });

    expect(screen.getByText('Sales Desk')).toBeInTheDocument();
    expect(screen.getByText('New sale')).toBeInTheDocument();
    expect(screen.getByText('Quotations')).toBeInTheDocument();
    expect(screen.getByText('Collections Queue')).toBeInTheDocument();
    expect(screen.queryByText('Accounting Desk')).not.toBeInTheDocument();
  });

  it('renders ERP worklist counts from the current local-first state', () => {
    renderDashboard({
      'vendors.manage': true,
      'purchases.view': true,
      'purchases.create': true,
      'purchases.receive': true,
      'transfers.view': true,
      'transfers.dispatch': true,
      'payables.view': true,
      'payables.manage': true,
      'payables.pay': true,
      'customers.ledger.view': true,
    });

    expect(screen.getByTestId('procurement-worklist-drafts')).toHaveTextContent('1');
    expect(screen.getByTestId('procurement-worklist-awaiting-approval')).toHaveTextContent('1');
    expect(screen.getByTestId('procurement-worklist-cancelled')).toHaveTextContent('1');
    expect(screen.getByTestId('warehouse-worklist-receipts')).toHaveTextContent('1');
    expect(screen.getByTestId('warehouse-worklist-dispatch')).toHaveTextContent('1');
    expect(screen.getByTestId('warehouse-worklist-receive')).toHaveTextContent('1');
    expect(screen.getByTestId('accounting-worklist-open-payables')).toHaveTextContent('2');
    expect(screen.getByTestId('accounting-worklist-awaiting-payment')).toHaveTextContent('1');
    expect(screen.getByTestId('accounting-worklist-partially-paid')).toHaveTextContent('1');
    expect(screen.getByTestId('accounting-worklist-overdue')).toHaveTextContent('1');
  });

  it('shows lightweight urgency cues on worklist rows', () => {
    renderDashboard({
      'vendors.manage': true,
      'purchases.view': true,
      'purchases.create': true,
      'purchases.receive': true,
      'transfers.view': true,
      'transfers.dispatch': true,
      'payables.view': true,
      'payables.manage': true,
      'payables.pay': true,
      'customers.ledger.view': true,
    });

    expect(within(screen.getByTestId('procurement-worklist-awaiting-approval')).getByText('Needs approval')).toBeInTheDocument();
    expect(within(screen.getByTestId('warehouse-worklist-receipts')).getByText('Ready to receive')).toBeInTheDocument();
    expect(within(screen.getByTestId('warehouse-worklist-dispatch')).getByText('Awaiting dispatch')).toBeInTheDocument();
    expect(within(screen.getByTestId('warehouse-worklist-receive')).getByText('Awaiting receipt')).toBeInTheDocument();
    expect(within(screen.getByTestId('accounting-worklist-open-payables')).getByText('Open')).toBeInTheDocument();
    expect(within(screen.getByTestId('accounting-worklist-awaiting-payment')).getByText('Awaiting payment')).toBeInTheDocument();
    expect(within(screen.getByTestId('accounting-worklist-partially-paid')).getByText('Partially paid')).toBeInTheDocument();
    expect(within(screen.getByTestId('accounting-worklist-overdue')).getByText('Overdue')).toBeInTheDocument();
    expect(within(screen.getByTestId('receivables-worklist-c3')).getByText('Outstanding')).toBeInTheDocument();
    expect(within(screen.getByTestId('receivables-worklist-c3')).getByText('High balance')).toBeInTheDocument();
  });

  it('does not show unauthorized dashboard actions for a restricted user', () => {
    renderDashboard({
      'inventory.view': true,
    });

    expect(screen.queryByText('Owner / Admin Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Procurement Desk')).not.toBeInTheDocument();
    expect(screen.queryByText('Accounting Desk')).not.toBeInTheDocument();
    expect(screen.queryByText('Users & Permissions')).not.toBeInTheDocument();
    expect(screen.queryByText('Store Operations')).not.toBeInTheDocument();
  });

  it('shows helpful empty states when worklists have nothing pending', () => {
    renderDashboard(
      {
        'vendors.manage': true,
        'purchases.view': true,
        'purchases.create': true,
        'purchases.receive': true,
        'transfers.view': true,
        'payables.view': true,
        'payables.manage': true,
        'customers.ledger.view': true,
      },
      {
        vendors: [],
        purchases: [],
        stockTransfers: [],
        accountsPayable: [],
        customerLedgerEntries: [],
      }
    );

    expect(screen.getByText('No vendors yet.')).toBeInTheDocument();
    expect(screen.getByText('No warehouse actions waiting.')).toBeInTheDocument();
    expect(screen.getByText('No unpaid supplier bills.')).toBeInTheDocument();
    expect(screen.getByText('No outstanding receivables.')).toBeInTheDocument();
  });

  it('routes cards to the established deep-link URLs', () => {
    renderDashboard({
      'business.edit': true,
      'vendors.view': true,
      'purchases.view': true,
      'purchases.receive': true,
      'transfers.view': true,
      'payables.view': true,
      'payables.pay': true,
    });

    fireEvent.click(screen.getAllByText('Vendors')[0]);
    fireEvent.click(screen.getAllByText('Procurement')[0]);
    fireEvent.click(screen.getAllByText('Warehouse Receipts')[0]);
    fireEvent.click(screen.getAllByText('Stock Transfers')[0]);
    fireEvent.click(screen.getAllByText('Accounts Payable')[0]);
    fireEvent.click(screen.getByText('Payments / Settlements'));

    expect(mockPush).toHaveBeenCalledWith('/vendors');
    expect(mockPush).toHaveBeenCalledWith('/inventory?section=procurement');
    expect(mockPush).toHaveBeenCalledWith('/inventory?section=receipts');
    expect(mockPush).toHaveBeenCalledWith('/inventory?section=transfers');
    expect(mockPush).toHaveBeenCalledWith('/accounting?segment=payables');
    expect(mockPush).toHaveBeenCalledWith('/accounting?segment=payables&action=payment');
  });

  it('routes ERP worklist items into the correct deep-linked queues', () => {
    renderDashboard({
      'vendors.manage': true,
      'purchases.view': true,
      'purchases.create': true,
      'purchases.receive': true,
      'transfers.view': true,
      'transfers.dispatch': true,
      'payables.view': true,
      'payables.manage': true,
      'payables.pay': true,
      'customers.ledger.view': true,
    });

    fireEvent.click(screen.getByTestId('procurement-worklist-awaiting-approval'));
    fireEvent.click(screen.getByTestId('warehouse-worklist-receipts'));
    fireEvent.click(screen.getByTestId('warehouse-worklist-dispatch'));
    fireEvent.click(screen.getByTestId('accounting-worklist-awaiting-payment'));
    fireEvent.click(screen.getByTestId('accounting-worklist-partially-paid'));
    fireEvent.click(screen.getByTestId('receivables-worklist-c1'));

    expect(mockPush).toHaveBeenCalledWith('/inventory?section=procurement');
    expect(mockPush).toHaveBeenCalledWith('/inventory?section=receipts');
    expect(mockPush).toHaveBeenCalledWith('/inventory?section=transfers');
    expect(mockPush).toHaveBeenCalledWith('/accounting?segment=payables');
    expect(mockPush).toHaveBeenCalledWith('/accounting?segment=payables&action=payment');
    expect(mockPush).toHaveBeenCalledWith('/customers');
  });
});
