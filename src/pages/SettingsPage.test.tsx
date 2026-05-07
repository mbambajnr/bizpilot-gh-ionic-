import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../data/seedBusiness';
import SettingsPage from './SettingsPage';

const mockUseBusiness = vi.fn();

vi.mock('../context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'owner-id', email: 'owner@example.com' },
    businessBootstrapStatus: { loading: false, label: 'Ready', detail: 'Ready' },
    signOut: vi.fn(),
  }),
}));

vi.mock('../lib/businessEmailConfigClient', () => ({
  loadBusinessEmailConfig: vi.fn(() => Promise.resolve({ config: null })),
  saveBusinessEmailConfig: vi.fn(() => Promise.resolve({ config: { smtpHost: '', smtpPort: 587, smtpUser: '', fromEmail: '', fromName: '', hasPassword: false } })),
}));

function buildContext(permissionMap: Record<string, boolean>, overrides: Record<string, unknown> = {}) {
  return {
    state: {
      ...seedState,
      vendors: [
        { id: 'vendor-1', vendorCode: 'VEN-0001', name: 'Savannah Supplies', contactEmail: 'ops@savannah.test', location: 'Tamale', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
      ...overrides,
    },
    currentUser: {
      userId: 'u-admin',
      name: 'Owner',
      email: 'owner@example.com',
      role: 'Admin',
      grantedPermissions: [],
      revokedPermissions: [],
    },
    backendStatus: { source: 'local', loading: false, label: 'Ready', detail: 'Ready' },
    updateBusinessProfile: vi.fn(async () => ({ ok: true })),
    launchBusinessWorkspace: vi.fn(async () => ({ ok: true })),
    switchUser: vi.fn(),
    updateUserPermissions: vi.fn(() => ({ ok: true })),
    updateUserProfile: vi.fn(() => ({ ok: true })),
    addUserAccount: vi.fn(() => ({ ok: true })),
    resetEmployeeTemporaryPassword: vi.fn(() => ({ ok: true })),
    updateEmployeeAccount: vi.fn(() => ({ ok: true })),
    reviewRestockRequest: vi.fn(() => ({ ok: true })),
    updateBranding: vi.fn(async () => ({ ok: true })),
    updateThemePreference: vi.fn(),
    createProductCategory: vi.fn(async () => ({ ok: true })),
    updateProductCategory: vi.fn(async () => ({ ok: true })),
    setProductCategoryActive: vi.fn(async () => ({ ok: true })),
    setInventoryCategoriesEnabled: vi.fn(async () => ({ ok: true })),
    createBusinessLocation: vi.fn(async () => ({ ok: true })),
    updateBusinessLocation: vi.fn(async () => ({ ok: true })),
    createSupplyRoute: vi.fn(async () => ({ ok: true })),
    setSupplyRouteActive: vi.fn(async () => ({ ok: true })),
    createVendor: vi.fn(async () => ({ ok: true })),
    updateVendor: vi.fn(async () => ({ ok: true })),
    setVendorStatus: vi.fn(async () => ({ ok: true })),
    setCustomerClassificationEnabled: vi.fn(async () => ({ ok: true })),
    setBusinessTaxSettings: vi.fn(async () => ({ ok: true })),
    hasPermission: vi.fn((permission: string) => Boolean(permissionMap[permission])),
  };
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('shows setup incomplete when the business profile is still missing required setup details', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'business.view': true,
    }));

    render(<SettingsPage />);

    expect(await screen.findByText('Business launch status')).toBeInTheDocument();
    expect(screen.getByText('Setup incomplete')).toBeInTheDocument();
    expect(screen.getByTestId('launch-state-setupIncomplete')).toBeInTheDocument();
    expect(screen.getByText('Finish the business setup before the workspace opens to the rest of the team.')).toBeInTheDocument();
    expect(screen.queryByTestId('launch-business-button')).not.toBeInTheDocument();
  });

  it('shows ready to launch and the launch button when business setup is saved', async () => {
    mockUseBusiness.mockReturnValue(buildContext(
      {
        'business.view': true,
        'business.edit': true,
      },
      {
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
          launchedAt: undefined,
        },
      }
    ));

    render(<SettingsPage />);

    expect(await screen.findByText('Ready to launch', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByTestId('launch-state-readyToLaunch')).toBeInTheDocument();
    expect(screen.getByText('Your business setup is saved. Launch the business to open the workspace for your team.')).toBeInTheDocument();
    expect(screen.getByTestId('launch-business-button')).toBeInTheDocument();
  }, 10000);

  it('shows business live when setup and branding are complete', async () => {
    mockUseBusiness.mockReturnValue(buildContext(
      {
        'business.view': true,
      },
      {
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
          launchedAt: '2026-05-03T10:00:00.000Z',
        },
      }
    ));

    render(<SettingsPage />);

    expect(await screen.findByText('Business live')).toBeInTheDocument();
    expect(screen.getByTestId('launch-state-live')).toBeInTheDocument();
    expect(screen.getByText('Your workspace is officially open.')).toBeInTheDocument();
  });

  it('launches the business when the admin clicks Launch Business', async () => {
    const context = buildContext(
      {
        'business.view': true,
        'business.edit': true,
      },
      {
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
          launchedAt: undefined,
        },
      }
    );
    mockUseBusiness.mockReturnValue(context);

    render(<SettingsPage />);

    fireEvent.click(await screen.findByTestId('launch-business-button', {}, { timeout: 10000 }));

    await waitFor(() => {
      expect(context.launchBusinessWorkspace).toHaveBeenCalledTimes(1);
    }, { timeout: 10000 });
  }, 10000);

  it('shows the expanded base role list in Add Employee', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'permissions.manage': true,
    }));

    render(<SettingsPage />);

    fireEvent.click(await screen.findByLabelText('Expand Team accounts'));
    fireEvent.click(await screen.findByText('Add Employee'));

    expect(await screen.findByText('Add Employee Account')).toBeInTheDocument();
    expect(screen.getAllByText('Warehouse Manager').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Store Manager').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Purchase Manager').length).toBeGreaterThan(0);
  });

  it('shows separate store and warehouse creation actions in Locations', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'business.edit': true,
    }));

    render(<SettingsPage />);

    expect(await screen.findByText('Locations')).toBeInTheDocument();
    expect(screen.getByText('Create store')).toBeInTheDocument();
    expect(screen.getByText('Create warehouse')).toBeInTheDocument();
    expect(screen.getByText('Create Store')).toBeInTheDocument();
    expect(screen.getByText('Create Warehouse')).toBeInTheDocument();
  });

  it('shows the temporary password action inside employee account management', async () => {
    mockUseBusiness.mockReturnValue(buildContext({
      'permissions.manage': true,
    }));

    render(<SettingsPage />);

    fireEvent.click(await screen.findByLabelText('Expand Team accounts'));

    expect(await screen.findByText('Add a new employee')).toBeInTheDocument();
    expect(screen.getByText('Create a fresh BisaPilot login and assign the employee a role in one step.')).toBeInTheDocument();
  });

});
