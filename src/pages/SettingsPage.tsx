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
  IonToggle,
  IonChip,
} from '@ionic/react';
import { useEffect, useState } from 'react';

import SectionCard from '../components/SectionCard';
import { roadmapSteps } from '../data/seedBusiness';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { AppPermission } from '../authz/types';

const SettingsPage: React.FC = () => {
  const { user, businessBootstrapStatus, signOut } = useAuth();
  const { state, currentUser, backendStatus, updateBusinessProfile, switchUser, updateUserPermissions, updateUserProfile, hasPermission } = useBusiness();
  
  const [businessName, setBusinessName] = useState(state.businessProfile.businessName);
  const [businessType, setBusinessType] = useState(state.businessProfile.businessType);
  const [currency, setCurrency] = useState(state.businessProfile.currency);
  const [country, setCountry] = useState(state.businessProfile.country);
  const [receiptPrefix, setReceiptPrefix] = useState(state.businessProfile.receiptPrefix);
  const [invoicePrefix, setInvoicePrefix] = useState(state.businessProfile.invoicePrefix);
  const [phone, setPhone] = useState(state.businessProfile.phone);
  const [email, setEmail] = useState(state.businessProfile.email);
  const [formMessage, setFormMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // User credential state
  const salesManager = state.users.find((u) => u.role === 'SalesManager');
  const accountant = state.users.find((u) => u.role === 'Accountant');

  const [salesEmail, setSalesEmail] = useState(salesManager?.email ?? '');
  const [salesPassword, setSalesPassword] = useState(salesManager?.password ?? '');
  const [accountantEmail, setAccountantEmail] = useState(accountant?.email ?? '');
  const [accountantPassword, setAccountantPassword] = useState(accountant?.password ?? '');
  const [myPassword, setMyPassword] = useState(currentUser.password ?? '');

  useEffect(() => {
    setBusinessName(state.businessProfile.businessName);
    setBusinessType(state.businessProfile.businessType);
    setCurrency(state.businessProfile.currency);
    setCountry(state.businessProfile.country);
    setReceiptPrefix(state.businessProfile.receiptPrefix);
    setInvoicePrefix(state.businessProfile.invoicePrefix);
    setPhone(state.businessProfile.phone);
    setEmail(state.businessProfile.email);
    
    setSalesEmail(salesManager?.email ?? '');
    setSalesPassword(salesManager?.password ?? '');
    setAccountantEmail(accountant?.email ?? '');
    setAccountantPassword(accountant?.password ?? '');
    setMyPassword(currentUser.password ?? '');
  }, [state.businessProfile, salesManager, accountant, currentUser]);

  const handleSave = () => {
    const result = updateBusinessProfile({
      businessName,
      businessType,
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

  const handleSignOut = async () => {
    const result = await signOut();

    if (!result.ok) {
      setFormMessage(result.message);
    }
  };

  const handleSaveSalesCredentials = () => {
    if (!salesManager) return;
    const result = updateUserProfile(salesManager.userId, { 
      email: salesEmail, 
      password: salesPassword 
    });
    if (result.ok) {
      setShowSuccessToast(true);
    } else {
      setFormMessage(result.message);
    }
  };

  const handleSaveAccountantCredentials = () => {
    if (!accountant) return;
    const result = updateUserProfile(accountant.userId, { 
      email: accountantEmail, 
      password: accountantPassword 
    });
    if (result.ok) {
      setShowSuccessToast(true);
    } else {
      setFormMessage(result.message);
    }
  };

  const handleUpdateMyPassword = () => {
    const result = updateUserProfile(currentUser.userId, { 
      password: myPassword 
    });
    if (result.ok) {
      setShowSuccessToast(true);
    } else {
      setFormMessage(result.message);
    }
  };

  const toggleInventoryForSales = (checked: boolean) => {
    if (!salesManager) return;
    const inventoryPerms: AppPermission[] = ['inventory.create', 'inventory.edit', 'inventory.adjust', 'inventory.restock'];
    const currentGranted = salesManager.grantedPermissions;
    const nextGranted = checked
      ? [...new Set([...currentGranted, ...inventoryPerms])]
      : currentGranted.filter((p) => !inventoryPerms.includes(p));

    updateUserPermissions(salesManager.userId, nextGranted, salesManager.revokedPermissions);
  };

  const toggleAccountingForAccountant = (checked: boolean) => {
    if (!accountant) return;
    const accountingPerms: AppPermission[] = ['accounting.access', 'expenses.view', 'expenses.create', 'expenses.edit', 'reports.financial.view'];
    const currentGranted = accountant.grantedPermissions;
    const nextGranted = checked
      ? [...new Set([...currentGranted, ...accountingPerms])]
      : currentGranted.filter((p) => !accountingPerms.includes(p));

    updateUserPermissions(accountant.userId, nextGranted, accountant.revokedPermissions);
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
            title="Owner access"
            subtitle="The signed-in owner controls this BizPilot workspace."
          >
            <div className="list-block">
              <div className="list-row">
                <div>
                  <strong>{user?.email ?? 'Owner account'}</strong>
                  <p>{businessBootstrapStatus.message}</p>
                </div>
                <IonButton fill="outline" color="medium" onClick={handleSignOut}>
                  Sign out
                </IonButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard
             title="Demo access"
             subtitle="Switch between identities to test Role-Based Access Control and permission gating."
           >
             <div className="tab-group" style={{ padding: '4px' }}>
                {state.users.map((u) => (
                  <IonChip
                    key={u.userId}
                    color={state.currentUserId === u.userId ? 'primary' : 'medium'}
                    onClick={() => switchUser(u.userId)}
                  >
                    <IonLabel>{u.name} ({u.role})</IonLabel>
                  </IonChip>
                ))}
             </div>
           </SectionCard>

           {hasPermission('permissions.manage') && (
             <SectionCard
               title="User credentials & permissions (Admin only)"
               subtitle="Manage access identifiers and explicit grants for your team."
             >
               <div className="list-block">
                 <div className="form-grid" style={{ marginBottom: '24px' }}>
                   <IonText color="primary"><strong>Sales Manager credentials</strong></IonText>
                   <div className="dual-stat">
                     <IonItem lines="none" className="app-item">
                       <IonLabel position="stacked">Email</IonLabel>
                       <IonInput 
                         type="email" 
                         value={salesEmail} 
                         onIonInput={(e) => setSalesEmail(e.detail.value ?? '')} 
                       />
                     </IonItem>
                     <IonItem lines="none" className="app-item">
                       <IonLabel position="stacked">Password</IonLabel>
                       <IonInput 
                         type="password" 
                         value={salesPassword} 
                         onIonInput={(e) => setSalesPassword(e.detail.value ?? '')} 
                       />
                     </IonItem>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: '0.9em' }}>Authorize Inventory Access</p>
                      <IonToggle
                        checked={salesManager?.grantedPermissions.includes('inventory.create')}
                        onIonChange={(e) => toggleInventoryForSales(e.detail.checked)}
                      />
                   </div>
                   <IonButton fill="outline" size="small" onClick={handleSaveSalesCredentials}>
                     Update Sales Profile
                   </IonButton>
                 </div>

                 <div className="form-grid">
                   <IonText color="primary"><strong>Accountant credentials</strong></IonText>
                   <div className="dual-stat">
                     <IonItem lines="none" className="app-item">
                       <IonLabel position="stacked">Email</IonLabel>
                       <IonInput 
                         type="email" 
                         value={accountantEmail} 
                         onIonInput={(e) => setAccountantEmail(e.detail.value ?? '')} 
                       />
                     </IonItem>
                     <IonItem lines="none" className="app-item">
                       <IonLabel position="stacked">Password</IonLabel>
                       <IonInput 
                         type="password" 
                         value={accountantPassword} 
                         onIonInput={(e) => setAccountantPassword(e.detail.value ?? '')} 
                       />
                     </IonItem>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontSize: '0.9em' }}>Authorize Accounting Access</p>
                      <IonToggle
                        checked={accountant?.grantedPermissions.includes('accounting.access')}
                        onIonChange={(e) => toggleAccountingForAccountant(e.detail.checked)}
                      />
                   </div>
                   <IonButton fill="outline" size="small" onClick={handleSaveAccountantCredentials}>
                     Update Accountant Profile
                   </IonButton>
                 </div>
               </div>
             </SectionCard>
           )}

          <SectionCard
            title="Security"
            subtitle="Secure your identity by keeping your password updated."
          >
            <div className="form-grid">
              <IonItem lines="none" className="app-item">
                <IonLabel position="stacked">My password</IonLabel>
                <IonInput 
                  type="password" 
                  value={myPassword} 
                  onIonInput={(e) => setMyPassword(e.detail.value ?? '')} 
                />
              </IonItem>
              <IonButton expand="block" fill="outline" onClick={handleUpdateMyPassword}>
                Change my password
              </IonButton>
            </div>
          </SectionCard>

          <SectionCard
            title="Business setup"
            subtitle="These local settings shape invoice and receipt numbering, contact details, and currency display across the current MVP."
          >
            <div className="form-grid">
              <div className="dual-stat">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Business name</IonLabel>
                  <IonInput value={businessName} onIonInput={(event) => setBusinessName(event.detail.value ?? '')} />
                </IonItem>
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Business type</IonLabel>
                  <IonInput value={businessType} onIonInput={(event) => setBusinessType(event.detail.value ?? '')} />
                </IonItem>
              </div>

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
