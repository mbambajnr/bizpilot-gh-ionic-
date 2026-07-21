import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../../src/data/seedBusiness';
import { EnterpriseSettings } from './enterprise-settings';

const mockUseBusiness = vi.fn();

vi.mock('../../src/context/BusinessContext', () => ({
  useBusiness: () => mockUseBusiness(),
}));

vi.mock('./enterprise-app', () => ({ EnterpriseApp: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./enterprise-shell', () => ({ EnterpriseShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./enterprise-team-settings', () => ({ EnterpriseTeamSettings: () => null, EmployeeSecuritySettings: () => null }));
vi.mock('./enterprise-operations-settings', () => ({ EnterpriseOperationsSettings: () => null }));
vi.mock('./magento-status', () => ({ MagentoStatus: () => null }));

const updateBusinessProfile = vi.fn(async () => ({ ok: true }));

function buildContext(businessName: string) {
  return {
    state: { ...seedState, businessProfile: { ...seedState.businessProfile, businessName } },
    backendStatus: { source: 'local', loading: false, label: 'Ready', detail: 'Ready' },
    hasPermission: () => true,
    updateBusinessProfile,
    launchBusinessWorkspace: vi.fn(async () => ({ ok: true })),
  };
}

function openBusinessTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Business details' }));
}

function businessNameInput() {
  return screen.getByLabelText('Business name') as HTMLInputElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EnterpriseSettings business details', () => {
  it('shows the cloud profile once it hydrates after mount', () => {
    mockUseBusiness.mockReturnValue(buildContext('Seed Placeholder'));
    const view = render(<EnterpriseSettings />);
    openBusinessTab();

    mockUseBusiness.mockReturnValue(buildContext('Real Cloud Business'));
    view.rerender(<EnterpriseSettings />);

    expect(businessNameInput().value).toBe('Real Cloud Business');
  });

  it('does not discard admin edits when the profile hydrates mid-edit', () => {
    mockUseBusiness.mockReturnValue(buildContext('Seed Placeholder'));
    const view = render(<EnterpriseSettings />);
    openBusinessTab();
    fireEvent.change(businessNameInput(), { target: { value: 'Admin Typed Name' } });

    mockUseBusiness.mockReturnValue(buildContext('Real Cloud Business'));
    view.rerender(<EnterpriseSettings />);

    expect(businessNameInput().value).toBe('Admin Typed Name');
  });

  it('saves the edited values the admin submitted', async () => {
    mockUseBusiness.mockReturnValue(buildContext('Real Cloud Business'));
    render(<EnterpriseSettings />);
    openBusinessTab();
    fireEvent.change(businessNameInput(), { target: { value: 'Renamed Business' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save business details' }));

    expect(updateBusinessProfile).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: 'Renamed Business' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Business profile saved.');
  });
});
