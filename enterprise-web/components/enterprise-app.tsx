'use client';

import { ArrowRight, LockKeyhole, LogOut, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import { resolveEnterpriseAccess } from '../../src/authz/enterpriseAccess';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { BusinessProvider, useBusiness } from '../../src/context/BusinessContext';
import { isBusinessWorkspaceLive } from '../../src/utils/businessLogic';

export function EnterpriseApp({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <EnterpriseAuthGate>{children}</EnterpriseAuthGate>
    </AuthProvider>
  );
}

function EnterpriseAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, loading, businessBootstrapStatus } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/auth');
    }
  }, [loading, router, session]);

  if (loading || !session) {
    return <div className="enterprise-loading">Checking your workspace...</div>;
  }

  const hasLocalState = window.localStorage.getItem('bizpilot-gh-state-v1');
  if (businessBootstrapStatus.loading && !hasLocalState) {
    return <div className="enterprise-loading">{businessBootstrapStatus.message}</div>;
  }

  return <BusinessProvider><EnterpriseAccessGate>{children}</EnterpriseAccessGate></BusinessProvider>;
}

function EnterpriseAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, currentUser, hasPermission } = useBusiness();
  const access = resolveEnterpriseAccess({
    pathname,
    workspaceLive: isBusinessWorkspaceLive(state.businessProfile),
    role: currentUser.role,
    hasPermission,
  });

  if (access.status === 'allowed') return children;

  if (access.status === 'setupRequired') {
    return <AccessState
      icon={Settings2}
      eyebrow="Workspace setup"
      title={access.canManageSetup ? 'Complete and launch this workspace' : 'Workspace setup is still in progress'}
      detail={access.canManageSetup ? 'Finish the operating details in Settings, then launch the workspace before entering operational modules.' : 'A system administrator must complete and launch this workspace before your operational tools become available.'}
      href={access.canManageSetup ? '/settings' : undefined}
      action={access.canManageSetup ? 'Open Settings' : undefined}
    />;
  }

  return <AccessState
    icon={LockKeyhole}
    eyebrow="Access control"
    title="This module is not assigned to your role"
    detail="Your account is active, but its current role and permission profile do not authorize this page."
    href={access.defaultRoute === '/auth' ? undefined : access.defaultRoute}
    action={access.defaultRoute === '/auth' ? undefined : 'Open my workspace'}
  />;
}

function AccessState({ icon: Icon, eyebrow, title, detail, href, action }: { icon: typeof LockKeyhole; eyebrow: string; title: string; detail: string; href?: string; action?: string }) {
  const router = useRouter();
  const { signOut } = useAuth();

  // These panels render outside the shell, so this is the only way out for a
  // user who is blocked here — without it they cannot switch accounts.
  async function handleSignOut() {
    await signOut();
    router.replace('/auth');
  }

  return <main className="enterprise-access-page"><section className="enterprise-access-panel"><i><Icon size={23} /></i><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{detail}</p>{href && action ? <Link className="primary-button" href={href}>{action} <ArrowRight size={15} /></Link> : null}<button type="button" className="access-sign-out" onClick={() => void handleSignOut()}><LogOut size={15} /> Sign out</button><small>Contact your BisaPilot administrator if your responsibilities have changed.</small></section></main>;
}
