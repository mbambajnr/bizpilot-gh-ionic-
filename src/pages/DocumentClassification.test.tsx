import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import InvoiceDetailPage from './InvoiceDetailPage';
import QuotationDetailPage from './QuotationDetailPage';

const mockUseBusiness = vi.fn();

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

const defaultUser = {
  userId: 'u-owner',
  name: 'Owner',
  email: 'owner@example.com',
  role: 'Admin',
  grantedPermissions: [],
  revokedPermissions: [],
};

function setBusinessState() {
  mockUseBusiness.mockReturnValue({
    state: {
      ...seedState,
      businessProfile: {
        ...seedState.businessProfile,
        customerClassificationEnabled: true,
      },
      customers: [
        {
          ...seedState.customers[0],
          id: 'c1',
          name: 'Changed Customer',
          customerType: 'B2C',
        },
      ],
      sales: [
        {
          ...seedState.sales[0],
          id: 'sale-with-snapshot',
          customerId: 'c1',
          subtotalAmount: 100,
          taxAmount: 0,
          withholdingTaxAmount: 3,
          netReceivableAmount: 97,
          totalAmount: 100,
          customerTypeSnapshot: 'B2B',
          taxSnapshot: {
            enabled: true,
            preset: 'ghana-standard' as const,
            mode: 'exclusive' as const,
            totalRate: 17.5,
            exempt: true,
            exemptionReason: 'Certificate A',
          },
          withholdingTaxSnapshot: {
            enabled: true,
            label: 'WHT',
            rate: 3,
            basis: 'subtotal' as const,
            amount: 3,
          },
        },
      ],
      quotations: [
        {
          id: 'quotation-without-snapshot',
          quotationNumber: 'QTN-009',
          customerId: 'c1',
          customerName: 'Changed Customer',
          clientId: 'CLT-001',
          createdAt: new Date().toISOString(),
          items: [],
          subtotalAmount: 0,
          taxAmount: 0,
          totalAmount: 0,
          status: 'Draft',
          customerTypeSnapshot: undefined,
        },
      ],
      stockMovements: [],
      customerLedgerEntries: [],
      activityLogEntries: [],
    },
    currentUser: defaultUser,
    reverseSale: vi.fn(() => ({ ok: true })),
    hasPermission: vi.fn(() => true),
  });
}

describe('document classification snapshot UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBusinessState();
  });

  it('shows invoice snapshot type instead of the current customer type', () => {
    render(
      <MemoryRouter initialEntries={['/sales/sale-with-snapshot']}>
        <Route path="/sales/:saleId">
          <InvoiceDetailPage />
        </Route>
      </MemoryRouter>
    );

    expect(screen.getByText(/Customer Type Snapshot:/)).toBeInTheDocument();
    expect(screen.getByText('B2B')).toBeInTheDocument();
    expect(screen.getByText('TAX EXEMPT - Certificate A')).toBeInTheDocument();
    expect(screen.getByText('WHT (3%)')).toBeInTheDocument();
    expect(screen.getByText('NET RECEIVABLE')).toBeInTheDocument();
  });

  it('shows Unclassified for a quotation with no snapshot', () => {
    render(
      <MemoryRouter initialEntries={['/quotations/quotation-without-snapshot']}>
        <Route path="/quotations/:quotationId">
          <QuotationDetailPage />
        </Route>
      </MemoryRouter>
    );

    expect(screen.getByText((_, element) =>
      element?.textContent === 'Customer type snapshot: Unclassified'
    )).toBeInTheDocument();
  });
});
