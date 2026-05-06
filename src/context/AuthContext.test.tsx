import React, { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

const signInWithPassword = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn();
const rpc = vi.fn();

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: true,
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword,
      getSession,
      onAuthStateChange,
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    rpc,
  }),
}));

vi.mock('../data/supabaseBusinessProfile', () => ({
  ensureBusinessProfileForOwner: vi.fn(() =>
    Promise.resolve({
      status: 'skipped',
      message: 'Skipped in test.',
    })
  ),
}));

function SignInHarness({
  identifier,
  password,
  onDone,
}: {
  identifier: string;
  password: string;
  onDone: (result: { ok: boolean; message?: string; authMode?: string }) => void;
}) {
  const { signIn, session } = useAuth();
  const didAttempt = useRef(false);

  useEffect(() => {
    if (didAttempt.current) {
      return;
    }
    didAttempt.current = true;
    void signIn(identifier, password).then((result) => {
      onDone({
        ok: result.ok,
        message: result.message,
        authMode: session?.user.user_metadata?.auth_mode as string | undefined,
      });
    });
  }, [identifier, onDone, password, session, signIn]);

  useEffect(() => {
    if (session) {
      onDone({
        ok: true,
        authMode: session.user.user_metadata?.auth_mode as string | undefined,
      });
    }
  }, [onDone, session]);

  return null;
}

describe('AuthContext employee sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    rpc.mockResolvedValue({ data: [], error: null });
    onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('uses local employee credentials before calling Supabase owner auth', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    window.localStorage.setItem(
      'bizpilot-gh-state-v1',
      JSON.stringify({
        users: [
          {
            userId: 'u-store-1',
            name: 'Store Lead',
            email: 'storelead@example.com',
            username: 'storelead@example.com',
            temporaryPassword: 'BP-TestPass1',
            accountStatus: 'active',
            role: 'StoreManager',
            grantedPermissions: [],
            revokedPermissions: [],
          },
        ],
      })
    );

    const onDone = vi.fn();

    render(
      <AuthProvider>
        <SignInHarness identifier="storelead@example.com" password="BP-TestPass1" onDone={onDone} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          authMode: 'employee-local',
        })
      );
    });

    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('uses cached employee credentials when the cloud workspace state no longer contains the employee', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    window.localStorage.setItem(
      'bizpilot-gh-state-v1',
      JSON.stringify({
        users: [],
      })
    );
    window.localStorage.setItem(
      'bizpilot-employee-credentials-v1',
      JSON.stringify({
        users: [
          {
            userId: 'u-store-2',
            name: 'Store Staff',
            email: 'info@silentstarltd.com',
            username: 'info@silentstarltd.com',
            temporaryPassword: 'BP-TestPass2',
            accountStatus: 'active',
            role: 'StoreManager',
            grantedPermissions: [],
            revokedPermissions: [],
          },
        ],
      })
    );

    const onDone = vi.fn();

    render(
      <AuthProvider>
        <SignInHarness identifier="info@silentstarltd.com" password="BP-TestPass2" onDone={onDone} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          authMode: 'employee-local',
        })
      );
    });

    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('falls through to Supabase owner auth when a cached employee email has a different password', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'owner-1',
          email: 'jaysino14@gmail.com',
        },
        session: null,
      },
      error: null,
    });

    window.localStorage.setItem(
      'bizpilot-employee-credentials-v1',
      JSON.stringify({
        users: [
          {
            userId: 'u-old-employee',
            name: 'Old Employee',
            email: 'jaysino14@gmail.com',
            username: 'jaysino14@gmail.com',
            temporaryPassword: 'BP-OldEmployeePass',
            accountStatus: 'active',
            role: 'PurchaseManager',
            grantedPermissions: [],
            revokedPermissions: [],
          },
        ],
      })
    );

    const onDone = vi.fn();

    render(
      <AuthProvider>
        <SignInHarness identifier="jaysino14@gmail.com" password="admin-password" onDone={onDone} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
        })
      );
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'jaysino14@gmail.com',
      password: 'admin-password',
    });
  });

  it('uses Supabase employee credentials when the local cache is empty', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    rpc.mockResolvedValue({
      data: [
        {
          id: 'u-purchase-1',
          business_id: '4a9d35da-0000-4000-9000-000000000000',
          name: 'Purchase Officer',
          email: 'jaysino14@gmail.com',
          username: 'jaysino14@gmail.com',
          temporary_password: 'BP-CloudPass1',
          credentials_generated_at: '2026-05-06T10:30:00.000Z',
          account_status: 'active',
          deactivated_at: null,
          role: 'PurchaseManager',
          role_label: null,
          granted_permissions: [],
          revoked_permissions: [],
          customer_email_sender_name: null,
          customer_email_sender_email: null,
        },
      ],
      error: null,
    });

    const onDone = vi.fn();

    render(
      <AuthProvider>
        <SignInHarness identifier="jaysino14@gmail.com" password="BP-CloudPass1" onDone={onDone} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          authMode: 'employee-local',
        })
      );
    });

    expect(rpc).toHaveBeenCalledWith('authenticate_employee_credential', {
      credential_identifier: 'jaysino14@gmail.com',
      credential_password: 'BP-CloudPass1',
    });
    expect(signInWithPassword).not.toHaveBeenCalled();

    const cachedCredentials = JSON.parse(window.localStorage.getItem('bizpilot-employee-credentials-v1') ?? '{}');
    expect(cachedCredentials.users?.[0]).toEqual(
      expect.objectContaining({
        userId: 'u-purchase-1',
        email: 'jaysino14@gmail.com',
        username: 'jaysino14@gmail.com',
      })
    );
  });
});
