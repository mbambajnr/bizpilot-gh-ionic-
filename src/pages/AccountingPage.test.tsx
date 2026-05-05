import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import AccountingPage from './AccountingPage';

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
      vendors: [
        { id: 'vendor-1', vendorCode: 'VEN-0001', name: 'Savannah Supplies', contactEmail: 'ops@savannah.test', location: 'Tamale', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
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
      accountsPayable: [],
      ...overrides,
    },
    addExpense: vi.fn(() => ({ ok: true })),
    approvePayable: vi.fn(async () => ({ ok: true })),
    recordPayablePayment: vi.fn(async () => ({ ok: true })),
    currentUser: {
      userId: 'u-accountant',
      name: 'Accountant',
      email: 'acct@example.com',
      role: 'Accountant',
      grantedPermissions: [],
      revokedPermissions: [],
    },
    hasPermission: vi.fn((permission: string) => Boolean(permissionMap[permission])),
  };
}

describe('AccountingPage ERP discoverability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationSearch = '';
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('shows the Payables segment and supplier settlement workflow to permitted users', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'payables.view': true,
      'payables.manage': true,
      'payables.pay': true,
    }, {
      accountsPayable: [
        {
          id: 'payable-1',
          payableCode: 'AP-0001',
          vendorId: 'vendor-1',
          vendorCode: 'VEN-0001',
          purchaseId: 'purchase-1',
          amountDue: 55,
          amountPaid: 0,
          balance: 55,
          status: 'pendingReview',
          createdBy: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));

    render(<AccountingPage />);

    expect(await screen.findByText('Payables')).toBeInTheDocument();
    expect(screen.getByText('ERP finance')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Payments / Settlements', { selector: 'p' })).toBeInTheDocument();
  });

  it('shows a helpful empty state when there are no unpaid supplier bills', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'payables.view': true,
    }));

    render(<AccountingPage />);

    expect(await screen.findByText('No unpaid supplier bills')).toBeInTheDocument();
  });

  it('opens the payables deep link and keeps Pay Supplier visible for settlement links', async () => {
    mockLocationSearch = '?segment=payables&action=payment';
    mockUseBusiness.mockReturnValue(buildContext({
      'payables.view': true,
      'payables.manage': true,
      'payables.pay': true,
    }, {
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
          createdBy: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));

    render(<AccountingPage />);

    expect(await screen.findByText('Accounts Payable')).toBeInTheDocument();
    expect(screen.getByText("You're managing Accounts Payable")).toBeInTheDocument();
    expect(screen.getByTestId('arrival-payables')).toHaveClass('section-card-highlighted');
    expect(screen.getAllByText('Pay Supplier').length).toBeGreaterThan(0);
    expect(screen.getByTestId('arrival-pay-supplier')).toHaveClass('section-card-highlighted');
  });

  it('emphasizes Accounts Payable when opened with the payables segment deep link', async () => {
    mockLocationSearch = '?segment=payables';
    mockUseBusiness.mockReturnValue(buildContext({
      'payables.view': true,
    }));

    render(<AccountingPage />);

    expect(await screen.findByText("You're managing Accounts Payable")).toBeInTheDocument();
    expect(screen.getByTestId('arrival-payables')).toHaveClass('section-card-highlighted');
  });
});
