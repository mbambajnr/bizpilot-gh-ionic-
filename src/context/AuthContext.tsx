import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ensureBusinessProfileForOwner } from '../data/supabaseBusinessProfile';
import { getSupabaseClient, hasSupabaseConfig } from '../lib/supabase';

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
    if (!hasSupabaseConfig) {
      setLoading(false);
      setBusinessBootstrapStatus({
        loading: false,
        ready: false,
        message: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      });
      return;
    }

    const auth = getAuthClient();
    let mounted = true;

    auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (!error) {
        setSession(data.session);
      }

      setLoading(false);
    });

    const { data: listener } = auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);

      if (!nextSession) {
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
      const result = await ensureBusinessProfileForOwner({
        ownerId: activeOwnerId,
        email: ownerEmail,
        businessName,
      });

      if (cancelled) {
        return;
      }

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
        if (!hasSupabaseConfig) {
          return { ok: false, message: 'Supabase is not configured for authentication yet.' };
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
        if (!hasSupabaseConfig) {
          return { ok: false, message: 'Supabase is not configured for authentication yet.' };
        }

        const { error } = await getAuthClient().signOut();

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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
