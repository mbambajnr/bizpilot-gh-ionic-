import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonText,
  IonToast,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';

import SectionCard from '../components/SectionCard';
import { roadmapSteps } from '../data/seedBusiness';
import { useBusiness } from '../context/BusinessContext';

const SettingsPage: React.FC = () => {
  const { state, backendStatus, updateBusinessProfile } = useBusiness();
  const [businessName, setBusinessName] = useState(state.businessProfile.businessName);
  const [currency, setCurrency] = useState(state.businessProfile.currency);
  const [country, setCountry] = useState(state.businessProfile.country);
  const [receiptPrefix, setReceiptPrefix] = useState(state.businessProfile.receiptPrefix);
  const [invoicePrefix, setInvoicePrefix] = useState(state.businessProfile.invoicePrefix);
  const [phone, setPhone] = useState(state.businessProfile.phone);
  const [email, setEmail] = useState(state.businessProfile.email);
  const [formMessage, setFormMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    setBusinessName(state.businessProfile.businessName);
    setCurrency(state.businessProfile.currency);
    setCountry(state.businessProfile.country);
    setReceiptPrefix(state.businessProfile.receiptPrefix);
    setInvoicePrefix(state.businessProfile.invoicePrefix);
    setPhone(state.businessProfile.phone);
    setEmail(state.businessProfile.email);
  }, [state.businessProfile]);

  const handleSave = () => {
    const result = updateBusinessProfile({
      businessName,
      currency,
      country,
      receiptPrefix,
      invoicePrefix,
      phone,
      email,
    });

    if (!result.ok) {
      setFormMessage(result.message);
      return;
    }

    setFormMessage('');
    setShowSuccessToast(true);
  };

  return (
    <IonPage>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={true}>
        <div className="page-shell">
          <SectionCard
            title="Data source"
            subtitle="Phase 1 keeps transactions local while safely checking Supabase for business profile setup."
          >
            <div className="sync-line">
              <IonBadge color={backendStatus.source === 'supabase' ? 'success' : 'medium'}>
                {backendStatus.loading ? 'Checking' : backendStatus.source === 'supabase' ? 'Supabase' : 'Local-first'}
              </IonBadge>
              <IonText>
                <strong>{backendStatus.label}</strong>
                <span> · {backendStatus.detail}</span>
              </IonText>
            </div>
          </SectionCard>

          <SectionCard
            title="Business setup"
            subtitle="These local settings shape invoice and receipt numbering, contact details, and currency display across the current MVP."
          >
            <div className="form-grid">
              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">Business name</IonLabel>
                <IonInput value={businessName} onIonInput={(event) => setBusinessName(event.detail.value ?? '')} />
              </IonItem>

              <div className="dual-stat">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Country</IonLabel>
                  <IonInput value={country} onIonInput={(event) => setCountry(event.detail.value ?? '')} />
                </IonItem>
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Currency</IonLabel>
                  <IonInput value={currency} onIonInput={(event) => setCurrency(event.detail.value ?? '')} />
                </IonItem>
              </div>

              <div className="dual-stat">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Receipt prefix</IonLabel>
                  <IonInput value={receiptPrefix} onIonInput={(event) => setReceiptPrefix(event.detail.value ?? '')} />
                </IonItem>
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Invoice prefix</IonLabel>
                  <IonInput value={invoicePrefix} onIonInput={(event) => setInvoicePrefix(event.detail.value ?? '')} />
                </IonItem>
              </div>

              <div className="dual-stat">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Phone</IonLabel>
                  <IonInput value={phone} onIonInput={(event) => setPhone(event.detail.value ?? '')} />
                </IonItem>
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput value={email} onIonInput={(event) => setEmail(event.detail.value ?? '')} />
                </IonItem>
              </div>

              <IonButton expand="block" onClick={handleSave}>
                Save settings
              </IonButton>
              {formMessage ? <p className="form-message">{formMessage}</p> : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Product roadmap"
            subtitle="This stays as a quick local reminder of the current BizPilot implementation milestones."
          >
            <div className="list-block">
              {roadmapSteps.map((step) => (
                <div className="roadmap-row" key={step.id}>
                  <span className={`status-dot ${step.done ? 'done' : 'pending'}`} />
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </IonContent>
      <IonToast
        isOpen={showSuccessToast}
        message="Business settings saved locally."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowSuccessToast(false)}
      />
    </IonPage>
  );
};

export default SettingsPage;
