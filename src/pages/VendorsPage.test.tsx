import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import VendorsPage from './VendorsPage';

const mockUseBusiness = vi.fn();

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

function buildContext(permissionMap: Record<string, boolean>) {
  return {
    state: {
      ...seedState,
      vendors: [
        {
          id: 'vendor-1',
          vendorCode: 'VEN-0001',
          name: 'Savannah Supplies',
          contactEmail: 'ops@savannah.test',
          location: 'Tamale',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    createVendor: vi.fn(async () => ({ ok: true })),
    updateVendor: vi.fn(async () => ({ ok: true })),
    setVendorStatus: vi.fn(async () => ({ ok: true })),
    hasPermission: vi.fn((permission: string) => Boolean(permissionMap[permission])),
  };
}

describe('VendorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the vendor directory and management actions to permitted users', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'vendors.view': true,
      'vendors.manage': true,
    }));

    render(<VendorsPage />);

    expect(await screen.findByText('Vendor Directory')).toBeInTheDocument();
    expect(screen.getByText('Savannah Supplies')).toBeInTheDocument();
    expect(screen.getByText('Create Vendor')).toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
  });

  it('hides management actions from users who can only view vendors', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'vendors.view': true,
    }));

    render(<VendorsPage />);

    expect(await screen.findByText('Vendor Directory')).toBeInTheDocument();
    expect(screen.getByText('Savannah Supplies')).toBeInTheDocument();
    expect(screen.queryByText('Create Vendor')).not.toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });
});
