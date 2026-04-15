import {
  IonBadge,
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { FormEvent, useState } from 'react';

import { useAuth } from '../context/AuthContext';

type AuthMode = 'sign-in' | 'sign-up';
type AuthField = 'businessName' | 'email' | 'password';

const AuthPage: React.FC = () => {
  const { isConfigured, signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<AuthField | null>(null);

  const isSignUp = mode === 'sign-up';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage('');

    if (!email.trim()) {
      setFormMessage('Enter the owner email address.');
      return;
    }

    if (!password) {
      setFormMessage('Enter the owner password.');
      return;
    }

    if (isSignUp && !businessName.trim()) {
      setFormMessage('Enter the business name for this owner account.');
      return;
    }

    setIsSubmitting(true);
    const result = isSignUp
      ? await signUp({ email, password, businessName })
      : await signIn(email, password);
    setIsSubmitting(false);
    setFormMessage(result.ok ? result.message ?? '' : result.message);
  }

  async function handlePasswordReset() {
    setFormMessage('');

    if (!email.trim()) {
      setFormMessage('Enter your email first, then request the reset link.');
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
            <IonBadge color="primary">Owner console</IonBadge>
            <h1>BizPilot Operations</h1>
            <p>
              Secure access for business owners to manage sales, inventory, customer balances, quotations, and
              operational records from one practical workspace.
            </p>
            <div className="auth-proof-grid">
              <div>
                <strong>RLS-backed</strong>
                <span>Business data is scoped to the signed-in owner.</span>
              </div>
              <div>
                <strong>Local-first MVP</strong>
                <span>Existing workflows stay available while backend coverage grows.</span>
              </div>
              <div>
                <strong>Business-ready</strong>
                <span>Designed for traceable invoices, stock movement, and customer ledgers.</span>
              </div>
            </div>
          </section>

          <section className="auth-panel" aria-label="BizPilot owner authentication">
            <div className="auth-panel-head">
              <p className="eyebrow">BizPilot GH</p>
              <h2>{isSignUp ? 'Create owner access' : 'Sign in to workspace'}</h2>
              <IonText>
                {isSignUp
                  ? 'Create the owner account and initial business profile.'
                  : 'Use your owner account to enter the BizPilot workspace.'}
              </IonText>
            </div>

            <IonSegment
              value={mode}
              onIonChange={(event) => setMode((event.detail.value as AuthMode) ?? 'sign-in')}
            >
              <IonSegmentButton value="sign-in">Sign in</IonSegmentButton>
              <IonSegmentButton value="sign-up">Create account</IonSegmentButton>
            </IonSegment>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignUp ? (
                <IonItem lines="none" className="app-item auth-item" aria-labelledby="business-name-label">
                  <IonLabel id="business-name-label" position="stacked">Business name</IonLabel>
                  <IonInput
                    value={businessName}
                    autocomplete="organization"
                    aria-describedby="business-name-help"
                    placeholder={focusedField === 'businessName' ? '' : 'Example: Ama Beauty Supplies'}
                    onIonFocus={() => setFocusedField('businessName')}
                    onIonBlur={() => setFocusedField(null)}
                    onIonInput={(event) => setBusinessName(event.detail.value ?? '')}
                  />
                  {focusedField !== 'businessName' ? (
                    <p id="business-name-help" className="auth-field-help">
                      This creates the first business profile for the owner account.
                    </p>
                  ) : null}
                </IonItem>
              ) : null}

              <IonItem lines="none" className="app-item auth-item" aria-labelledby="owner-email-label">
                <IonLabel id="owner-email-label" position="stacked">Owner email</IonLabel>
                <IonInput
                  type="email"
                  value={email}
                  autocomplete="email"
                  inputmode="email"
                  aria-describedby="owner-email-help"
                  placeholder={focusedField === 'email' ? '' : 'owner@business.com'}
                  onIonFocus={() => setFocusedField('email')}
                  onIonBlur={() => setFocusedField(null)}
                  onIonInput={(event) => setEmail(event.detail.value ?? '')}
                />
                {focusedField !== 'email' ? (
                  <p id="owner-email-help" className="auth-field-help">
                    Use the email connected to the business owner account.
                  </p>
                ) : null}
              </IonItem>

              <IonItem lines="none" className="app-item auth-item" aria-labelledby="owner-password-label">
                <IonLabel id="owner-password-label" position="stacked">Password</IonLabel>
                <IonInput
                  type="password"
                  value={password}
                  autocomplete={isSignUp ? 'new-password' : 'current-password'}
                  aria-describedby="owner-password-help"
                  placeholder={focusedField === 'password' ? '' : 'Enter your password'}
                  onIonFocus={() => setFocusedField('password')}
                  onIonBlur={() => setFocusedField(null)}
                  onIonInput={(event) => setPassword(event.detail.value ?? '')}
                />
                {focusedField !== 'password' ? (
                  <p id="owner-password-help" className="auth-field-help">
                    Keep this private. Password reset is available from this screen.
                  </p>
                ) : null}
              </IonItem>

              <IonButton className="auth-primary-action" expand="block" type="submit" disabled={!isConfigured || isSubmitting}>
                {isSubmitting ? <IonSpinner name="crescent" /> : isSignUp ? 'Create owner account' : 'Sign in'}
              </IonButton>

              <IonButton
                className="auth-secondary-action"
                fill="clear"
                color="medium"
                type="button"
                disabled={!isConfigured || isSubmitting}
                onClick={handlePasswordReset}
              >
                Forgot password?
              </IonButton>

              {!isConfigured ? (
                <p className="form-message">
                  Supabase auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to
                  .env.local.
                </p>
              ) : null}
              {formMessage ? <p className="form-message">{formMessage}</p> : null}
            </form>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AuthPage;
