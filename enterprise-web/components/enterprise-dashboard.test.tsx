import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../../src/data/seedBusiness';
import { EnterpriseDashboard } from './enterprise-dashboard';

const mockUseBusiness = vi.fn();

vi.mock('../../src/context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('./enterprise-app', () => ({ EnterpriseApp: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./enterprise-shell', () => ({ EnterpriseShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./magento-status', () => ({ MagentoStatus: () => <div data-testid="commerce-widget">Magento widget</div> }));

function mockHealth(configured: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ ok: true, integration: { configured, baseUrl: '', storeCode: 'default' } }),
  })) as unknown as typeof fetch);
}

function buildContext() {
  return {
    // GeneralManager => role model has showCommerce: true, so only the connection gate decides.
    state: seedState,
    currentUser: { userId: 'u-gm', name: 'Gm', email: 'gm@e.com', role: 'GeneralManager', roleLabel: 'General Manager', grantedPermissions: [], revokedPermissions: [] },
    backendStatus: { source: 'local', loading: false, label: 'Ready', detail: 'Ready' },
    hasPermission: () => true,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('EnterpriseDashboard commerce widget gating', () => {
  it('hides the commerce widget when no commerce platform is connected', async () => {
    mockUseBusiness.mockReturnValue(buildContext());
    mockHealth(false);

    render(<EnterpriseDashboard />);

    // The role brief is the fallback panel; it should be shown instead.
    await waitFor(() => expect(screen.getByText('Role brief')).toBeInTheDocument());
    expect(screen.queryByTestId('commerce-widget')).not.toBeInTheDocument();
  });

  it('shows the commerce widget once a commerce platform is connected', async () => {
    mockUseBusiness.mockReturnValue(buildContext());
    mockHealth(true);

    render(<EnterpriseDashboard />);

    await waitFor(() => expect(screen.getByTestId('commerce-widget')).toBeInTheDocument());
    expect(screen.queryByText('Role brief')).not.toBeInTheDocument();
  });

  it('hides the commerce widget when the health check fails', async () => {
    mockUseBusiness.mockReturnValue(buildContext());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch);

    render(<EnterpriseDashboard />);

    await waitFor(() => expect(screen.getByText('Role brief')).toBeInTheDocument());
    expect(screen.queryByTestId('commerce-widget')).not.toBeInTheDocument();
  });
});
