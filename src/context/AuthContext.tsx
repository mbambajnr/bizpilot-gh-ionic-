import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ensureBusinessProfileForOwner } from '../data/supabaseBusinessProfile';
import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';
import type { UserAccessProfile } from '../authz/types';

type AuthActionResult = { ok: true; message?: string } | { ok: false; message: string };

type BusinessBootstrapStatus = {
  loading: boolean;
  ready: boolean;
  message: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  businessBootstrapStatus: BusinessBootstrapStatus;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (input: { email: string; password: string; businessName: string }) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

function getAuthClient() {
  return getSupabaseClient().auth;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessBootstrapStatus, setBusinessBootstrapStatus] = useState<BusinessBootstrapStatus>({
    loading: false,
    ready: false,
    message: 'Waiting for owner sign-in.',
  });
  const bootstrappedOwnerRef = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!hasSupabaseConfig && !(window as any).Cypress) {
      setLoading(false);
      setBusinessBootstrapStatus({
        loading: false,
        ready: false,
        message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      });
      return;
    }

    // Bypass auth and bootstrap during Cypress E2E tests for determinism
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Cypress) {
      setSession({
        user: { 
          id: 'test-user', 
          email: 'test@example.com', 
          user_metadata: { business_name: 'BizPilot GH Demo Shop' } 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        expires_in: 3600,
        token_type: 'bearer',
      });
      setLoading(false);
      setBusinessBootstrapStatus({
        loading: false,
        ready: true,
        message: 'Test mode active (Cypress)',
      });
      return;
    }

    const auth = getAuthClient();
    let mounted = true;

    // Check for local session first
    const localSession = window.localStorage.getItem('bizpilot-local-session');
    if (localSession) {
      try {
        setSession(JSON.parse(localSession));
        setLoading(false);
      } catch {
        window.localStorage.removeItem('bizpilot-local-session');
      }
    } else {
      auth.getSession().then(({ data, error }) => {
        if (!mounted) {
          return;
        }

        if (!error && data.session) {
          setSession(data.session);
        }

        setLoading(false);
      });
    }

    const { data: listener } = auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);

      if (!nextSession && !window.localStorage.getItem('bizpilot-local-session')) {
        bootstrappedOwnerRef.current = null;
        setBusinessBootstrapStatus({
          loading: false,
          ready: false,
          message: 'Waiting for owner sign-in.',
        });
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const ownerId = session?.user.id;

    if (!ownerId || bootstrappedOwnerRef.current === ownerId) {
      return;
    }

    // Skip cloud bootstrap for local/demo accounts
    if (ownerId.startsWith('u-')) {
      bootstrappedOwnerRef.current = ownerId;
      setBusinessBootstrapStatus({
        loading: false,
        ready: true,
        message: 'Using local demo profile.',
      });
      return;
    }

    let cancelled = false;
    const activeOwnerId = ownerId;
    const ownerEmail = session.user.email;
    const businessName =
      typeof session.user.user_metadata.business_name === 'string'
        ? session.user.user_metadata.business_name
        : undefined;
    bootstrappedOwnerRef.current = ownerId;
    setBusinessBootstrapStatus({
      loading: true,
      ready: false,
      message: 'Preparing business profile for this owner.',
    });

    async function bootstrapBusiness() {
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setBusinessBootstrapStatus({
            loading: false,
            ready: false,
            message: 'Cloud sync timed out. Proceeding with local data.',
          });
        }
      }, 5500);

      const result = await ensureBusinessProfileForOwner({
        ownerId: activeOwnerId,
        email: ownerEmail,
        businessName,
      });

      if (cancelled) {
        clearTimeout(timeoutId);
        return;
      }

      clearTimeout(timeoutId);
      setBusinessBootstrapStatus({
        loading: false,
        ready: result.status === 'ready',
        message: result.message,
      });
    }

    void bootstrapBusiness();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isConfigured: hasSupabaseConfig,
      businessBootstrapStatus,
      async signIn(email, password) {
        // Attempt LOCAL authentication check first (for RBAC users)
        const storedState = window.localStorage.getItem('bizpilot-gh-state-v1');
        if (storedState) {
          try {
            const state = JSON.parse(storedState);
            const matchedUser = state.users.find((u: UserAccessProfile) => 
              u.email.toLowerCase() === email.trim().toLowerCase() && 
              u.password === password
            );

            if (matchedUser) {
              // Simulating a Supabase session for the local user
              const localSession = {
                user: {
                  id: matchedUser.userId,
                  email: matchedUser.email,
                  user_metadata: { name: matchedUser.name, role: matchedUser.role },
                },
                access_token: 'local-token',
                expires_in: 3600,
                token_type: 'bearer',
              };

              // Update storage to target this user ID for BusinessProvider
              state.currentUserId = matchedUser.userId;
              window.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify(state));
              window.localStorage.setItem('bizpilot-local-session', JSON.stringify(localSession));
              
              setSession(localSession as unknown as Session);
              return { ok: true, message: `Signed in as ${matchedUser.name}.` };
            }
          } catch (e) {
            console.error('Local auth check failed', e);
          }
        }

        if (!hasSupabaseConfig) {
          return { ok: false, message: 'Supabase is not configured. Local user not found.' };
        }

        const { error } = await getAuthClient().signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return { ok: false, message: error.message };
        }

        return { ok: true, message: 'Signed in successfully.' };
      },
      async signUp(input) {
        if (!hasSupabaseConfig) {
          return { ok: false, message: 'Supabase is not configured for authentication yet.' };
        }

        const { data, error } = await getAuthClient().signUp({
          email: input.email.trim(),
          password: input.password,
          options: {
            data: {
              business_name: input.businessName.trim(),
            },
          },
        });

        if (error) {
          return { ok: false, message: error.message };
        }

        if (!data.session) {
          return {
            ok: true,
            message: 'Account created. Check your email to confirm the owner account before signing in.',
          };
        }

        return { ok: true, message: 'Owner account created.' };
      },
      async requestPasswordReset(email) {
        if (!hasSupabaseConfig) {
          return { ok: false, message: 'Supabase is not configured for password reset yet.' };
        }

        const { error } = await getAuthClient().resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });

        if (error) {
          return { ok: false, message: error.message };
        }

        return { ok: true, message: 'Password reset instructions were sent if that email exists.' };
      },
      async signOut() {
        window.localStorage.removeItem('bizpilot-local-session');
        
        // Optionally reset to Admin in stored state when logging out
        const storedState = window.localStorage.getItem('bizpilot-gh-state-v1');
        if (storedState) {
          try {
            const state = JSON.parse(storedState);
            state.currentUserId = 'u-admin';
            window.localStorage.setItem('bizpilot-gh-state-v1', JSON.stringify(state));
          } catch (e) {
            console.error('Signout state reset failed', e);
          }
        }

        if (!hasSupabaseConfig) {
          setSession(null);
          return { ok: true, message: 'Logged out from local session.' };
        }

        const { error } = await getAuthClient().signOut();
        setSession(null);

        if (error) {
          return { ok: false, message: error.message };
        }

        return { ok: true, message: 'Signed out.' };
      },
    }),
    [businessBootstrapStatus, loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { useAuth };
