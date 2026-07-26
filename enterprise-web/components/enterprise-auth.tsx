'use client';

import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import styles from './enterprise-auth.module.css';

type AuthMode = 'sign-in' | 'sign-up';

export function EnterpriseAuth() {
  return <AuthProvider><AuthForm /></AuthProvider>;
}

function AuthForm() {
  const router = useRouter();
  const { isConfigured, loading, session, signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [businessName, setBusinessName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignUp = mode === 'sign-up';

  useEffect(() => {
    if (!loading && session) router.replace('/dashboard');
  }, [loading, router, session]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setMessageKind('error');

    if (!identifier.trim()) return setMessage('Enter your email or employee username.');
    if (!password) return setMessage('Enter your password.');
    if (isSignUp && !businessName.trim()) return setMessage('Enter the registered business name.');
    if (isSignUp && !isConfigured) return setMessage('Cloud authentication must be configured before creating an owner account.');

    setSubmitting(true);
    const result = isSignUp
      ? await signUp({ email: identifier, password, businessName })
      : await signIn(identifier, password);
    setSubmitting(false);

    if (!result.ok) return setMessage(result.message);
    setMessageKind('success');
    setMessage(result.message ?? 'Access confirmed. Opening your workspace...');

    if (isSignUp && /check your email/i.test(result.message ?? '')) {
      setMode('sign-in');
      setPassword('');
      return;
    }

    router.replace('/dashboard');
  }

  async function handlePasswordReset() {
    setMessageKind('error');
    if (!identifier.trim()) return setMessage('Enter your owner email before requesting a reset link.');
    if (!isConfigured) return setMessage('Cloud authentication must be configured before requesting a password reset.');

    setSubmitting(true);
    const result = await requestPasswordReset(identifier);
    setSubmitting(false);
    setMessageKind(result.ok ? 'success' : 'error');
    setMessage(result.message ?? '');
  }

  return (
    <main className={styles.shell}>
      <section className={styles.brandPanel} aria-label="BisaPilot Enterprise">
        <div className={styles.brand}>
          <span className={styles.mark}>BP</span>
          <span><strong>BisaPilot</strong><small>Enterprise</small></span>
        </div>
        <div className={styles.promise}>
          <p className={styles.eyebrow}>One operating workspace</p>
          <h1>Run the business with clarity and control.</h1>
          <p>Sales, inventory, procurement, finance, and commerce activity stay connected across every location and role.</p>
        </div>
        <div className={styles.assurances}>
          <span><ShieldCheck size={18} /><b>Role-based access</b><small>Every user sees the right work.</small></span>
          <span><Building2 size={18} /><b>Multi-location ready</b><small>One view across the enterprise.</small></span>
          <span><CheckCircle2 size={18} /><b>Operational continuity</b><small>Shared workflows across web and mobile.</small></span>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formWrap}>
          <header>
            <span className={styles.secureIcon}><LockKeyhole size={20} /></span>
            <p className={styles.eyebrow}>Secure workspace access</p>
            <h2>{isSignUp ? 'Create the owner account' : 'Welcome back'}</h2>
            <p>{isSignUp ? 'Register the company owner who will govern this workspace.' : 'Sign in as an owner or with employee credentials issued by your administrator.'}</p>
          </header>

          <div className={styles.tabs} role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => changeMode('sign-in')}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignUp} onClick={() => changeMode('sign-up')}>Create account</button>
          </div>

          <form onSubmit={handleSubmit}>
            {isSignUp ? <label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" placeholder="e.g. Jomra Limited" /></label> : null}
            <label>Email or employee username<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="name@company.com or employee.username" /></label>
            <label>Password<span className={styles.passwordField}><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} placeholder="Enter your secure password" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>

            <button className={styles.primary} type="submit" disabled={submitting || loading}>{submitting ? 'Verifying access...' : <>{isSignUp ? 'Create owner account' : 'Enter workspace'} <ArrowRight size={17} /></>}</button>
            {!isSignUp ? <button className={styles.reset} type="button" disabled={submitting} onClick={handlePasswordReset}><KeyRound size={15} /> Reset owner password</button> : null}

            {message ? <p className={messageKind === 'success' ? styles.success : styles.error} role="status" aria-live="polite">{message}</p> : null}
            {!isConfigured ? <p className={styles.connection}><b>Employee access remains available.</b> Connect Supabase to enable owner sign-in, registration, and password recovery.</p> : null}
          </form>
        </div>
        <footer>Protected enterprise workspace <span>•</span> BisaPilot Ghana</footer>
      </section>
    </main>
  );
}
