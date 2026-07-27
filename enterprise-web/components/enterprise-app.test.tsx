import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { seedState } from '../../src/data/seedBusiness';
import { EnterpriseApp } from './enterprise-app';

const signOut = vi.fn(async () => ({ ok: true }));
const replace = vi.fn();
const mockUseBusiness = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard',
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('../../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    session: { user: { id: 'u-1' } },
    loading: false,
    businessBootstrapStatus: { loading: false, message: '' },
    signOut,
  }),
}));

vi.mock('../../src/context/BusinessContext', () => ({
  BusinessProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBusiness: () => mockUseBusiness(),
}));

function buildContext(role: 'Admin' | 'SalesManager') {
  return {
    // An un-launched workspace is what puts a user on the setup-required panel.
    state: { ...seedState, businessProfile: { ...seedState.businessProfile, launchedAt: undefined } },
    currentUser: { userId: 'u-1', name: 'Staff', email: 'staff@example.com', role, grantedPermissions: [], revokedPermissions: [] },
    // Only the admin can complete setup; the other role is stranded on the panel.
    hasPermission: (permission: string) => (permission === 'business.edit' ? role === 'Admin' : true),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EnterpriseApp access panels', () => {
  it('offers a way out when a non-admin is blocked by workspace setup', async () => {
    mockUseBusiness.mockReturnValue(buildContext('SalesManager'));
    render(<EnterpriseApp><div>Operational module</div></EnterpriseApp>);

    expect(screen.getByText('Workspace setup is still in progress')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('/auth');
  });

  it('offers sign out to an admin who still has the setup call to action', () => {
    mockUseBusiness.mockReturnValue(buildContext('Admin'));
    render(<EnterpriseApp><div>Operational module</div></EnterpriseApp>);

    expect(screen.getByRole('link', { name: /open settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});
