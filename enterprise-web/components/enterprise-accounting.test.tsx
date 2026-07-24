import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../../src/data/seedBusiness';
import { ROLE_DEFAULT_PERMISSIONS } from '../../src/authz/defaults';
import { EnterpriseAccounting } from './enterprise-accounting';

const mockUseBusiness = vi.fn();

vi.mock('../../src/context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('./enterprise-app', () => ({ EnterpriseApp: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./enterprise-shell', () => ({ EnterpriseShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const openSale = {
  ...seedState.sales[0],
  id: 'r1',
  invoiceNumber: 'INV-TEST-9',
  status: 'Completed' as const,
  totalAmount: 500,
  netReceivableAmount: 500,
  creditedAmount: 0,
  paidAmount: 200, // balance due = 300
};

function buildContext(permissions: string[]) {
  const granted = new Set(permissions);
  return {
    state: { ...seedState, sales: [openSale] } as typeof seedState,
    currentUser: { userId: 'u-acc', name: 'Accountant', email: 'acc@e.com', role: 'Accountant', roleLabel: 'Accountant', grantedPermissions: permissions, revokedPermissions: [] },
    hasPermission: (permission: string) => granted.has(permission),
    addExpense: vi.fn(),
    approvePayable: vi.fn(),
    recordPayablePayment: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Accounting receivables view', () => {
  it('shows a Receivables tab and lists outstanding invoices for the accountant', () => {
    mockUseBusiness.mockReturnValue(buildContext(ROLE_DEFAULT_PERMISSIONS.Accountant));
    render(<EnterpriseAccounting />);

    const tab = screen.getByRole('button', { name: /^Receivables/ });
    fireEvent.click(tab);

    expect(screen.getByText('Outstanding receivables')).toBeInTheDocument();
    expect(screen.getByText('INV-TEST-9')).toBeInTheDocument();
    // Balance due (500 invoiced - 200 paid = 300) is surfaced.
    expect(screen.getAllByText(/300/).length).toBeGreaterThan(0);
  });

  it('hides the Receivables tab when the role cannot view sales', () => {
    // Accountant permissions minus the sales visibility.
    const noSales = ROLE_DEFAULT_PERMISSIONS.Accountant.filter((p) => p !== 'sales.view' && p !== 'reports.sales.view');
    mockUseBusiness.mockReturnValue(buildContext(noSales));
    render(<EnterpriseAccounting />);

    expect(screen.queryByRole('button', { name: /^Receivables/ })).not.toBeInTheDocument();
  });
});

describe('Accounting approvals audit', () => {
  it('shows a company-wide approval history with who approved what', () => {
    const context = buildContext(ROLE_DEFAULT_PERMISSIONS.Accountant);
    context.state = {
      ...context.state,
      users: [...context.state.users, { userId: 'u-gm', name: 'Grace Manager', email: 'gm@e.com', role: 'GeneralManager', grantedPermissions: [], revokedPermissions: [] }],
      accountsPayable: [{ ...seedState.accountsPayable[0], id: 'ap-audit', payableCode: 'PAY-AUDIT-1', approvedBy: 'u-gm', updatedAt: new Date().toISOString() }],
      purchases: [],
      stockTransfers: [],
    };
    mockUseBusiness.mockReturnValue(context);
    render(<EnterpriseAccounting />);

    fireEvent.click(screen.getByRole('button', { name: 'Approvals' }));

    expect(screen.getByText('Approval history')).toBeInTheDocument();
    expect(screen.getByText('PAY-AUDIT-1')).toBeInTheDocument();
    // The approver is resolved from the user directory, not shown as a raw id.
    expect(screen.getByText('Grace Manager')).toBeInTheDocument();
  });
});

describe('Accounting financial statements', () => {
  it('produces an income statement (P&L) and branch breakdown for the accountant', () => {
    const now = new Date().toISOString();
    const context = buildContext(ROLE_DEFAULT_PERMISSIONS.Accountant);
    context.state = {
      ...context.state,
      // Revenue(net)=435, COGS=2*100=200 => gross 235; expenses 50 => net 185.
      sales: [{ ...seedState.sales[0], id: 's-fin', status: 'Completed' as const, createdAt: now, totalAmount: 500, subtotalAmount: 435, taxAmount: 65, paidAmount: 500, items: [{ productId: 'pX', productName: 'Widget', inventoryId: 'INV-X', quantity: 2, unitPrice: 250, total: 500 }] }],
      products: [{ ...seedState.products[0], id: 'pX', name: 'Widget', price: 250, cost: 100 }],
      expenses: [{ id: 'e-fin', category: 'Rent', amount: 50, note: '', createdAt: now, recordedByUserId: 'u', recordedByName: 'U' }],
      stockMovements: [{ ...seedState.stockMovements[0], id: 'm-fin', relatedSaleId: 's-fin', locationId: 'loc-main', type: 'sale' as const }],
      locations: [{ ...seedState.locations[0], id: 'loc-main', name: 'Main Store', isActive: true }],
    };
    mockUseBusiness.mockReturnValue(context);
    render(<EnterpriseAccounting />);

    fireEvent.click(screen.getByRole('button', { name: 'Financial statements' }));

    expect(screen.getByText('Income statement')).toBeInTheDocument();
    expect(screen.getAllByText(/435/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/235/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/185/).length).toBeGreaterThan(0);
    expect(screen.getByText('Main Store')).toBeInTheDocument();
  });

  it('hides Financial statements without reports.financial.view', () => {
    const noFin = ROLE_DEFAULT_PERMISSIONS.Accountant.filter((p) => p !== 'reports.financial.view');
    mockUseBusiness.mockReturnValue(buildContext(noFin));
    render(<EnterpriseAccounting />);
    expect(screen.queryByRole('button', { name: 'Financial statements' })).not.toBeInTheDocument();
  });
});
