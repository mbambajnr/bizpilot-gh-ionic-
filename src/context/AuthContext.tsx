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

type TestWindow = Window & {
  Cypress?: unknown;
  __BIZAPILOT_TEST_SESSION__?: Session | null;
};

const LOCAL_SESSION_KEY = 'bizpilot-local-session';
const LOCAL_STATE_KEY = 'bizpilot-gh-state-v1';
const LOCAL_EMPLOYEE_CREDENTIALS_KEY = 'bizpilot-employee-credentials-v1';

type LocalEmployeeSession = {
  kind: 'employee-local';
  userId: string;
  businessId?: string;
  email: string;
  username?: string;
  issuedAt: string;
};

type CloudEmployeeCredentialRow = {
  id: string;
  business_id: string;
  name: string;
  email: string;
  username: string;
  temporary_password: string | null;
  credentials_generated_at: string | null;
  account_status: UserAccessProfile['accountStatus'];
  deactivated_at: string | null;
  role: UserAccessProfile['role'];
  role_label: string | null;
  granted_permissions: UserAccessProfile['grantedPermissions'] | null;
  revoked_permissions: UserAccessProfile['revokedPermissions'] | null;
  customer_email_sender_name: string | null;
  customer_email_sender_email: string | null;
};

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

function buildLocalEmployeeSession(user: Pick<UserAccessProfile, 'userId' | 'businessId' | 'email' | 'username'>): Session {
  return {
    access_token: `local-${user.userId}`,
    refresh_token: '',
    expires_in: 60 * 60 * 24,
    token_type: 'bearer',
    user: {
      id: user.userId,
      email: user.email,
      user_metadata: {
        auth_mode: 'employee-local',
        business_id: user.businessId,
        username: user.username,
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User,
  } as Session;
}

function readStoredUsers(): UserAccessProfile[] {
  const usersById = new Map<string, UserAccessProfile>();
  const raw = window.localStorage.getItem(LOCAL_STATE_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { users?: UserAccessProfile[] };
      (parsed.users ?? []).forEach((user) => usersById.set(user.userId, user));
    } catch {
      // Ignore invalid local state and fall back to the credential cache.
    }
  }

  const rawCredentials = window.localStorage.getItem(LOCAL_EMPLOYEE_CREDENTIALS_KEY);

  if (rawCredentials) {
    try {
      const parsed = JSON.parse(rawCredentials) as { users?: UserAccessProfile[] };
      (parsed.users ?? []).forEach((user) => usersById.set(user.userId, user));
    } catch {
      // Ignore invalid credential cache.
    }
  }

  return Array.from(usersById.values());
}

function cacheEmployeeCredential(user: UserAccessProfile) {
  const credentialsById = new Map<string, UserAccessProfile>();
  const rawCredentials = window.localStorage.getItem(LOCAL_EMPLOYEE_CREDENTIALS_KEY);

  if (rawCredentials) {
    try {
      const parsed = JSON.parse(rawCredentials) as { users?: UserAccessProfile[] };
      (parsed.users ?? []).forEach((storedUser) => credentialsById.set(storedUser.userId, storedUser));
    } catch {
      // Replace invalid credential cache with a clean copy below.
    }
  }

  credentialsById.set(user.userId, user);
  window.localStorage.setItem(LOCAL_EMPLOYEE_CREDENTIALS_KEY, JSON.stringify({ users: Array.from(credentialsById.values()) }));

  try {
    const rawState = window.localStorage.getItem(LOCAL_STATE_KEY);
    const parsedState = rawState ? JSON.parse(rawState) as { businessProfile?: { id?: string }; users?: UserAccessProfile[]; currentUserId?: string } : {};
    const stateUsersById = new Map<string, UserAccessProfile>();
    (parsedState.users ?? []).forEach((storedUser) => stateUsersById.set(storedUser.userId, storedUser));
    stateUsersById.set(user.userId, user);

    window.localStorage.setItem(
      LOCAL_STATE_KEY,
      JSON.stringify({
        ...parsedState,
        businessProfile: user.businessId
          ? {
              ...(parsedState.businessProfile ?? {}),
              id: user.businessId,
            }
          : parsedState.businessProfile,
        users: Array.from(stateUsersById.values()),
        currentUserId: user.userId,
      })
    );
  } catch {
    window.localStorage.setItem(
      LOCAL_STATE_KEY,
      JSON.stringify({
        businessProfile: user.businessId ? { id: user.businessId } : undefined,
        users: [user],
        currentUserId: user.userId,
      })
    );
  }
}

function readValidLocalEmployeeSession(): Session | null {
  const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalEmployeeSession>;
    if (parsed.kind !== 'employee-local' || !parsed.userId || !parsed.email) {
      return null;
    }

    const matchingUser = readStoredUsers().find((user) =>
      user.userId === parsed.userId &&
      user.email === parsed.email &&
      (user.accountStatus ?? 'active') === 'active'
    );

    if (!matchingUser) {
      return null;
    }

    return buildLocalEmployeeSession(matchingUser);
  } catch {
    return null;
  }
}

function saveLocalEmployeeSession(user: Pick<UserAccessProfile, 'userId' | 'businessId' | 'email' | 'username'>) {
  const localSession: LocalEmployeeSession = {
    kind: 'employee-local',
    userId: user.userId,
    businessId: user.businessId,
    email: user.email,
    username: user.username,
    issuedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localSession));
}

function findLocalEmployee(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return readStoredUsers().find((user) =>
    (user.email.trim().toLowerCase() === normalizedIdentifier ||
      (user.username ?? '').trim().toLowerCase() === normalizedIdentifier) &&
    (user.accountStatus ?? 'active') === 'active'
  );
}

function signInWithLocalEmployee(identifier: string, password: string): AuthActionResult & { session?: Session } {
  const normalizedPassword = password.trim();
  const matchingUser = findLocalEmployee(identifier);

  if (!matchingUser || !matchingUser.temporaryPassword || matchingUser.temporaryPassword !== normalizedPassword) {
    return { ok: false, message: 'Incorrect username, email, or password.' };
  }

  saveLocalEmployeeSession(matchingUser);
  return {
    ok: true,
    message: 'Signed in successfully.',
    session: buildLocalEmployeeSession(matchingUser),
  };
}

function mapCloudEmployeeCredential(row: CloudEmployeeCredentialRow): UserAccessProfile {
  return {
    userId: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email,
    username: row.username,
    temporaryPassword: row.temporary_password ?? undefined,
    credentialsGeneratedAt: row.credentials_generated_at ?? undefined,
    accountStatus: row.account_status ?? 'active',
    deactivatedAt: row.deactivated_at ?? undefined,
    role: row.role,
    roleLabel: row.role_label ?? undefined,
    grantedPermissions: row.granted_permissions ?? [],
    revokedPermissions: row.revoked_permissions ?? [],
    customerEmailSenderName: row.customer_email_sender_name ?? undefined,
    customerEmailSenderEmail: row.customer_email_sender_email ?? undefined,
  };
}

async function signInWithCloudEmployee(identifier: string, password: string): Promise<AuthActionResult & { session?: Session }> {
  if (!hasSupabaseConfig) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  try {
    const { data, error } = await getSupabaseClient().rpc('authenticate_employee_credential', {
      credential_identifier: identifier.trim(),
      credential_password: password.trim(),
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    const [row] = (data ?? []) as CloudEmployeeCredentialRow[];
    if (!row) {
      return { ok: false, message: 'Incorrect username, email, or password.' };
    }

    const employee = mapCloudEmployeeCredential(row);
    cacheEmployeeCredential(employee);
    saveLocalEmployeeSession(employee);

    return {
      ok: true,
      message: 'Signed in successfully.',
      session: buildLocalEmployeeSession(employee),
    };
  } catch {
    return { ok: false, message: 'Could not check employee credentials right now.' };
  }
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
    const testWindow = window as TestWindow;
    const injectedTestSession = testWindow.__BIZAPILOT_TEST_SESSION__ ?? null;

    if (injectedTestSession) {
      setSession(injectedTestSession);
      setLoading(false);
      setBusinessBootstrapStatus({
        loading: false,
        ready: true,
        message: 'Test session active.',
      });
      return;
    }

    const localEmployeeSession = readValidLocalEmployeeSession();
    if (localEmployeeSession) {
      setSession(localEmployeeSession);
      setLoading(false);
      setBusinessBootstrapStatus({
        loading: false,
        ready: true,
        message: 'Employee workspace ready.',
      });
      return;
    }

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

      if (!error && data.session) {
        setSession(data.session);
      }

      setLoading(false);
    });

    // Safety timeout: Never stay stuck on "Checking session" for more than 2s
    setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 2000);

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
    const isLocalEmployeeSession = session?.user.user_metadata?.auth_mode === 'employee-local';

    if (!ownerId || isLocalEmployeeSession || bootstrappedOwnerRef.current === ownerId) {
      if (isLocalEmployeeSession) {
        setBusinessBootstrapStatus({
          loading: false,
          ready: true,
          message: 'Employee workspace ready.',
        });
      }
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
      message: 'Syncing your business profile...',
    });

    async function bootstrapBusiness() {
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setBusinessBootstrapStatus({
            loading: false,
            ready: false,
            message: 'Starting with local data...',
          });
        }
      }, 2000);

      try {
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
      } catch (err: unknown) {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setBusinessBootstrapStatus({
            loading: false,
            ready: false,
            message: 'We encountered a connection issue while preparing your cloud profile. Your local data is safe and ready to use.',
          });
          console.error('[Bootstrap] Failed to prepare business profile:', err);
        }
      }
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
        const localFallback = () => {
          const result = signInWithLocalEmployee(email, password);
          if (result.ok && result.session) {
            setSession(result.session);
          }
          return result;
        };

        const localEmployeeResult = localFallback();
        if (localEmployeeResult.ok) {
          return localEmployeeResult;
        }

        if (!hasSupabaseConfig) {
          return localEmployeeResult;
        }

        const cloudEmployeeResult = await signInWithCloudEmployee(email, password);
        if (cloudEmployeeResult.ok && cloudEmployeeResult.session) {
          setSession(cloudEmployeeResult.session);
          return cloudEmployeeResult;
        }

        const { error } = await getAuthClient().signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const localResult = localFallback();
          if (localResult.ok) {
            return localResult;
          }
          if (/invalid login credentials/i.test(error.message)) {
            return {
              ok: false,
              message:
                'Invalid login credentials. If this is an employee temporary password, sign in with the username or employee email exactly as created by the admin.',
            };
          }
          return { ok: false, message: error.message };
        }

        window.localStorage.removeItem(LOCAL_SESSION_KEY);
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
        const testWindow = window as TestWindow;
        testWindow.__BIZAPILOT_TEST_SESSION__ = null;
        window.localStorage.removeItem(LOCAL_SESSION_KEY);
        setSession(null);
        bootstrappedOwnerRef.current = null;
        setBusinessBootstrapStatus({
          loading: false,
          ready: false,
          message: 'Waiting for owner sign-in.',
        });

        if (!hasSupabaseConfig) {
          return { ok: true, message: 'Signed out.' };
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

export { useAuth };
