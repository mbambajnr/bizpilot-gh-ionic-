import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { eye, eyeOff } from 'ionicons/icons';
import { FormEvent, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

type AuthMode = 'sign-in' | 'sign-up';

const AuthPage: React.FC = () => {
  const { isConfigured, signIn, signUp, requestPasswordReset } = useAuth();
  const history = useHistory();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Force Light Mode for Auth Screen
  useEffect(() => {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    document.body.setAttribute('data-theme', 'light');
    
    // Logic for returning to user's preferred theme 
    // happens automatically once inside the BusinessProvider 
    // via the ThemeManager component in App.tsx.
  }, []);

  const isSignUp = mode === 'sign-up';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage('');

    if (!email.trim()) {
      setFormMessage('Owner email is required.');
      return;
    }

    if (!password) {
      setFormMessage('Password is required.');
      return;
    }

    if (isSignUp && !businessName.trim()) {
      setFormMessage('Business name is required for registration.');
      return;
    }

    setIsSubmitting(true);
    const result = isSignUp
      ? await signUp({ email, password, businessName })
      : await signIn(email, password);
    setIsSubmitting(false);

    if (result.ok) {
      history.push('/dashboard');
    } else {
      setFormMessage(result.message ?? '');
    }
  }

  async function handlePasswordReset() {
    setFormMessage('');

    if (!email.trim()) {
      setFormMessage('Please enter your email to request a reset link.');
      return;
    }

    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);
    setFormMessage(result.message ?? '');
  }

  return (
    <IonPage>
      <IonContent fullscreen={true}>
        <main className="auth-shell">
          <section className="auth-brief">
            <h1>BisaPilot</h1>
            <p>
              Your scaling partner. Unified business management for African SMEs. Manage your sales, inventory, and operational transactions with absolute clarity.
            </p>
            <div className="auth-proof-grid">
              <div>
                <strong>Secure access</strong>
                <span>Signed-in owner data isolation.</span>
              </div>
              <div>
                <strong>Local-first</strong>
                <span>Workflows stay online or offline.</span>
              </div>
              <div>
                <strong>Enterprise focus</strong>
                <span>Stock, invoices, and ledgers in sync.</span>
              </div>
            </div>
          </section>

          <section className="auth-panel" aria-label="BisaPilot owner authentication">
            <div className="auth-panel-card">
              <header className="auth-header">
                <img src="/assets/logo.png" alt="BisaPilot" className="auth-logo" />
                <div className="auth-panel-head">
                  <h2>{isSignUp ? 'Establish Owner Account' : 'Sign in to Workspace'}</h2>
                  <IonText>
                    {isSignUp
                      ? 'Create your business profile and owner credentials.'
                      : 'Access your managed SME operations dashboard.'}
                  </IonText>
                </div>
              </header>

              <IonButton fill="clear" color="medium" className="auth-back-home" onClick={() => history.push('/')}>
                Back to BisaPilot overview
              </IonButton>

              <IonSegment
                value={mode}
                onIonChange={(event) => setMode((event.detail.value as AuthMode) ?? 'sign-in')}
              >
                <IonSegmentButton value="sign-in">Sign in</IonSegmentButton>
                <IonSegmentButton value="sign-up">Create account</IonSegmentButton>
              </IonSegment>

              <form className="auth-form" onSubmit={handleSubmit}>
                {isSignUp ? (
                  <IonItem lines="none" className="app-item auth-item">
                    <IonLabel position="stacked">Company Name</IonLabel>
                    <IonInput
                      value={businessName}
                      autocomplete="organization"
                      placeholder="e.g. Accra Logistics Ltd"
                      onIonInput={(event) => setBusinessName(event.detail.value ?? '')}
                    />
                  </IonItem>
                ) : null}

                <IonItem lines="none" className="app-item auth-item">
                  <IonLabel position="stacked">Owner Email Address</IonLabel>
                  <IonInput
                    type="email"
                    value={email}
                    autocomplete="email"
                    inputmode="email"
                    placeholder="manager@business.com"
                    onIonInput={(event) => setEmail(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item auth-item">
                  <IonLabel position="stacked">Secure Password</IonLabel>
                  <IonInput
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    autocomplete={isSignUp ? 'new-password' : 'current-password'}
                    placeholder="Enter owner password"
                    onIonInput={(event) => setPassword(event.detail.value ?? '')}
                  />
                  <IonButton
                    className="auth-password-toggle"
                    fill="clear"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    <IonIcon aria-hidden="true" icon={showPassword ? eyeOff : eye} />
                  </IonButton>
                </IonItem>

                <IonButton className="auth-primary-action" expand="block" type="submit" disabled={!isConfigured || isSubmitting}>
                  {isSubmitting ? <IonSpinner name="crescent" /> : isSignUp ? 'Create owner account' : 'Enter workspace'}
                </IonButton>

                <div className="auth-form-footer">
                  <IonButton
                    className="auth-secondary-action"
                    fill="clear"
                    color="medium"
                    type="button"
                    disabled={!isConfigured || isSubmitting}
                    onClick={handlePasswordReset}
                  >
                    Forgot your password?
                  </IonButton>
                </div>

                {!isConfigured ? (
                  <p className="form-message">
                    Connectivity state: Supabase authentication not configured.
                  </p>
                ) : null}
                {formMessage ? <p className="form-message">{formMessage}</p> : null}
              </form>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AuthPage;
