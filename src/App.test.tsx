import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { vi } from 'vitest';
import App from './App';

let mockedSession: {
  user: { id: string; email: string; user_metadata?: Record<string, unknown> };
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
} | null = null;

// Mock Supabase to avoid resolution or environment issues during tests
// This ensures the test does not depend on real Supabase config/env
vi.mock('./lib/supabase', () => {
  const mockSupa = {
    auth: {
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      })),
      getSession: vi.fn(() => Promise.resolve({ 
        data: { session: mockedSession }, 
        error: null 
      })),
    },
  };
  return {
    supabase: mockSupa,
    hasSupabaseConfig: true,
    getSupabaseClient: vi.fn(() => mockSupa),
  };
});

vi.mock('./data/supabaseBusinessProfile', () => ({
  loadBusinessProfileFromSupabase: vi.fn(() =>
    Promise.resolve({
      status: 'skipped',
      message: 'Test mode skipped business profile load.',
    })
  ),
  ensureBusinessProfileForOwner: vi.fn(() =>
    Promise.resolve({
      status: 'skipped',
      message: 'Test mode skipped business profile bootstrap.',
    })
  ),
}));

vi.mock('./data/supabaseDataLoader', () => ({
  loadFullBusinessDataFromSupabase: vi.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
  mockedSession = null;
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  mockedSession = null;
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('renders public shell when no authenticated session exists', async () => {
  mockedSession = null;
  render(<App />);
  expect(await screen.findByRole('heading', {
    name: 'Everything your business runs on, in one place.',
  }, { timeout: 10000 })).toBeInTheDocument();
}, 10000);

test('ignores legacy local auth session data in localStorage', async () => {
  mockedSession = null;
  window.localStorage.setItem('bizpilot-local-session', JSON.stringify({
    user: { id: 'u-admin', email: 'admin@bisapilot.gh' },
    access_token: 'legacy-token',
  }));

  render(<App />);

  expect(await screen.findByRole('heading', {
    name: 'Everything your business runs on, in one place.',
  }, { timeout: 15000 })).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
}, 15000);

test('localStorage manipulation cannot authenticate or enter the app shell', async () => {
  mockedSession = null;
  window.localStorage.setItem('bizpilot-local-session', JSON.stringify({
    user: { id: 'u-admin', email: 'admin@bisapilot.gh' },
    access_token: 'forged-token',
  }));
  window.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify({
    users: [
      {
        userId: 'u-admin',
        name: 'Admin User',
        email: 'admin@bisapilot.gh',
        role: 'Admin',
        grantedPermissions: [],
        revokedPermissions: [],
      },
    ],
    currentUserId: 'u-admin',
  }));

  render(<App />);

  expect(await screen.findByRole('heading', {
    name: 'Everything your business runs on, in one place.',
  }, { timeout: 15000 })).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
}, 15000);

test('localStorage manipulation cannot replace the authenticated owner identity', async () => {
  mockedSession = {
    user: {
      id: 'real-owner-id',
      email: 'owner@realbusiness.com',
      user_metadata: { business_name: 'Real Business' },
    },
    access_token: 'real-access-token',
    refresh_token: 'real-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
  };

  window.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify({
    businessProfile: {
      id: 'biz-001',
      businessName: 'Tampered Workspace',
      businessType: 'General Retail',
      currency: 'GHS',
      country: 'Ghana',
      receiptPrefix: 'RCP-',
      invoicePrefix: 'INV-',
      phone: '',
      email: 'admin@bisapilot.gh',
      address: '',
      website: '',
      waybillPrefix: 'WAY-',
    },
    products: [],
    customers: [],
    sales: [],
    quotations: [],
    stockMovements: [],
    customerLedgerEntries: [],
    activityLogEntries: [],
    users: [
      {
        userId: 'u-admin',
        name: 'Forged Admin',
        email: 'admin@bisapilot.gh',
        role: 'Admin',
        grantedPermissions: [],
        revokedPermissions: [],
      },
    ],
    currentUserId: 'u-admin',
    restockRequests: [],
    expenses: [],
    themePreference: 'system',
  }));

  window.history.pushState({}, '', '/settings');
  render(<App />);

  await waitFor(
    () => {
      expect(screen.getByText('owner@realbusiness.com')).toBeInTheDocument();
      expect(screen.queryByText('admin@bisapilot.gh')).not.toBeInTheDocument();
    },
    { timeout: 30000 }
  );
}, 30000);

test('keeps the workspace closed until the admin launches the business', async () => {
  mockedSession = {
    user: {
      id: 'owner-setup-id',
      email: 'owner@setup.com',
      user_metadata: { business_name: 'Setup Business' },
    },
    access_token: 'setup-access-token',
    refresh_token: 'setup-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
  };

  window.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify({
    businessProfile: {
      id: '11111111-1111-4111-8111-111111111111',
      businessName: 'Setup Business',
      businessType: 'General Retail',
      currency: 'GHS',
      country: 'Ghana',
      receiptPrefix: 'RCP-',
      invoicePrefix: 'INV-',
      phone: '0240000000',
      email: 'owner@setup.com',
      address: 'Accra',
      website: '',
      waybillPrefix: 'WAY-',
      logoUrl: '',
      launchedAt: undefined,
    },
    products: [],
    customers: [],
    sales: [],
    quotations: [],
    stockMovements: [],
    customerLedgerEntries: [],
    activityLogEntries: [],
    users: [
      {
        userId: 'owner-setup-id',
        name: 'Setup Owner',
        email: 'owner@setup.com',
        role: 'Admin',
        grantedPermissions: [],
        revokedPermissions: [],
      },
    ],
    currentUserId: 'owner-setup-id',
    restockRequests: [],
    expenses: [],
    themePreference: 'system',
  }));

  window.history.pushState({}, '', '/dashboard');
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Launch Business Workspace' })).toBeInTheDocument();
  expect(screen.getByText('Your business setup is saved. Go to Settings and click Launch Business to officially open the workspace for your team.')).toBeInTheDocument();
  expect(screen.getByText('Once setup is complete, each assigned role will only see the interfaces and dashboards they are authorized to use.')).toBeInTheDocument();
  expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
});

test('opens role interfaces after setup is complete and launched', async () => {
  mockedSession = {
    user: {
      id: 'owner-open-id',
      email: 'owner@open.com',
      user_metadata: { business_name: 'Open Business' },
    },
    access_token: 'open-access-token',
    refresh_token: 'open-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
  };

  window.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify({
    businessProfile: {
      id: '22222222-2222-4222-8222-222222222222',
      businessName: 'Open Business',
      businessType: 'General Retail',
      currency: 'GHS',
      country: 'Ghana',
      receiptPrefix: 'RCP-',
      invoicePrefix: 'INV-',
      phone: '0240000001',
      email: 'owner@open.com',
      address: 'Kumasi',
      website: '',
      waybillPrefix: 'WAY-',
      logoUrl: 'data:image/png;base64,logo',
      launchedAt: '2026-05-03T10:00:00.000Z',
    },
    products: [],
    customers: [],
    sales: [],
    quotations: [],
    stockMovements: [],
    customerLedgerEntries: [],
    activityLogEntries: [],
    users: [
      {
        userId: 'owner-open-id',
        name: 'Open Owner',
        email: 'owner@open.com',
        role: 'Admin',
        grantedPermissions: [],
        revokedPermissions: [],
      },
    ],
    currentUserId: 'owner-open-id',
    restockRequests: [],
    expenses: [],
    themePreference: 'system',
  }));

  window.history.pushState({}, '', '/dashboard');
  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId('tab-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('tab-sales')).toBeInTheDocument();
  });
  expect(screen.queryByRole('heading', { name: 'Complete Business Setup' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
});
