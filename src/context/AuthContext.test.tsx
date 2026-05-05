import React, { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

const signInWithPassword = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock('../lib/supabase', () => ({
  hasSupabaseConfig: true,
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword,
      getSession,
      onAuthStateChange,
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
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
});
