import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import CustomersPage from './CustomersPage';

const mockUseBusiness = vi.fn();

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('../lib/businessEmailConfigClient', () => ({
  loadBusinessEmailConfig: vi.fn(() => Promise.resolve({ config: null })),
}));

vi.mock('../lib/emailClient', () => ({
  sendEmail: vi.fn(),
}));

const defaultUser = {
  userId: 'u-owner',
  name: 'Owner',
  email: 'owner@example.com',
  role: 'Admin',
  grantedPermissions: [],
  revokedPermissions: [],
};

function renderCustomersPage(customerClassificationEnabled = true, taxEnabled = false) {
  const addCustomer = vi.fn(() => ({ ok: true }));
  const updateCustomer = vi.fn(() => ({ ok: true }));
  const state = {
    ...seedState,
    businessProfile: {
      ...seedState.businessProfile,
      customerClassificationEnabled,
      taxEnabled,
    },
    customers: [
      { ...seedState.customers[0], id: 'c-b2b', name: 'Wholesale Buyer', clientId: 'CLT-B2B', customerType: 'B2B' as const, taxExempt: true, taxExemptionReason: 'Certificate A' },
      { ...seedState.customers[1], id: 'c-b2c', name: 'Retail Buyer', clientId: 'CLT-B2C', customerType: 'B2C' as const },
      { ...seedState.customers[2], id: 'c-none', name: 'Mystery Buyer', clientId: 'CLT-NONE', customerType: undefined },
    ],
    sales: [],
    customerLedgerEntries: [],
  };

  mockUseBusiness.mockReturnValue({
    state,
    currentUser: defaultUser,
    addCustomer,
    updateCustomer,
    updateCustomerStatus: vi.fn(() => ({ ok: true })),
    hasPermission: vi.fn(() => true),
  });

  render(<CustomersPage />);

  return { addCustomer, updateCustomer };
}

describe('CustomersPage customer classification UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows customer type badges and filters customers when classification is enabled', () => {
    renderCustomersPage(true);

    expect(screen.getAllByText('B2B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B2C').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unclassified').length).toBeGreaterThan(0);

    fireEvent(
      screen.getByTestId('customer-type-filter'),
      new CustomEvent('ionChange', { detail: { value: 'B2B' }, bubbles: true })
    );

    expect(screen.getAllByText('Wholesale Buyer').length).toBeGreaterThan(0);
    expect(screen.queryByText('Retail Buyer')).not.toBeInTheDocument();
    expect(screen.queryByText('Mystery Buyer')).not.toBeInTheDocument();
  });

  it('keeps classification filters and badges hidden when classification is disabled', () => {
    renderCustomersPage(false);

    expect(screen.queryByText('All Types')).not.toBeInTheDocument();
    expect(screen.queryByText('Unclassified')).not.toBeInTheDocument();
  });

  it('shows tax exemption labels only when Ghana tax is enabled', () => {
    renderCustomersPage(true, true);

    expect(screen.getAllByText('Tax exempt').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tax exemption: Certificate A/).length).toBeGreaterThan(0);
  });
});
