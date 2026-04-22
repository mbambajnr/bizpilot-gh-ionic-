import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonText,
  IonToast,
  IonTitle,
  IonToolbar,
  IonToggle,
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/react';
import { checkmarkCircleOutline, closeOutline, createOutline, imageOutline, pencilOutline, powerOutline, refreshOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { resizeImage } from '../utils/imageUtils';

import SectionCard from '../components/SectionCard';
import PhoneInputField from '../components/PhoneInputField';
import { roadmapSteps } from '../data/seedBusiness';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { loadBusinessEmailConfig, saveBusinessEmailConfig } from '../lib/businessEmailConfigClient';
import { getPermissionList } from '../authz/permissions';
import { ROLE_DEFAULT_PERMISSIONS } from '../authz/defaults';
import { hasSupabaseConfig } from '../lib/supabase';
import { AppPermission, AppRole } from '../authz/types';
import { RestockRequestStatus } from '../data/seedBusiness';

const permissionGroups: Array<{ title: string; items: Array<{ permission: AppPermission; label: string }> }> = [
  {
    title: 'Core business',
    items: [
      { permission: 'business.view', label: 'View business details' },
      { permission: 'business.edit', label: 'Edit business setup' },
      { permission: 'users.manage', label: 'Manage users' },
      { permission: 'permissions.manage', label: 'Manage permissions' },
    ],
  },
  {
    title: 'Sales & customers',
    items: [
      { permission: 'sales.view', label: 'View sales' },
      { permission: 'sales.create', label: 'Create sales' },
      { permission: 'sales.reverse', label: 'Reverse sales' },
      { permission: 'customers.view', label: 'View customers' },
      { permission: 'customers.create', label: 'Create customers' },
      { permission: 'customers.edit', label: 'Edit customers' },
      { permission: 'customers.email.send', label: 'Send customer emails' },
      { permission: 'customers.ledger.view', label: 'View customer ledger' },
    ],
  },
  {
    title: 'Inventory & quotations',
    items: [
      { permission: 'inventory.view', label: 'View inventory' },
      { permission: 'inventory.create', label: 'Create inventory items' },
      { permission: 'inventory.edit', label: 'Edit inventory items' },
      { permission: 'inventory.adjust', label: 'Adjust inventory' },
      { permission: 'inventory.restock', label: 'Restock inventory' },
      { permission: 'quotations.view', label: 'View quotations' },
      { permission: 'quotations.create', label: 'Create quotations' },
      { permission: 'quotations.convert', label: 'Convert quotations to sales' },
    ],
  },
  {
    title: 'Documents & reports',
    items: [
      { permission: 'invoices.view', label: 'View invoices' },
      { permission: 'invoices.print', label: 'Print invoices' },
      { permission: 'invoices.export_pdf', label: 'Export invoices to PDF' },
      { permission: 'quotations.print', label: 'Print quotations' },
      { permission: 'quotations.export_pdf', label: 'Export quotations to PDF' },
      { permission: 'reports.dashboard.view', label: 'View dashboard reports' },
      { permission: 'reports.sales.view', label: 'View sales reports' },
      { permission: 'reports.inventory.view', label: 'View inventory reports' },
      { permission: 'reports.financial.view', label: 'View financial reports' },
    ],
  },
  {
    title: 'Accounting & operations',
    items: [
      { permission: 'accounting.access', label: 'Access accounting' },
      { permission: 'expenses.view', label: 'View expenses' },
      { permission: 'expenses.create', label: 'Create expenses' },
      { permission: 'expenses.edit', label: 'Edit expenses' },
      { permission: 'restockRequests.view', label: 'View restock requests' },
      { permission: 'restockRequests.create', label: 'Create restock requests' },
      { permission: 'restockRequests.manage', label: 'Manage restock requests' },
      { permission: 'branding.view', label: 'View branding' },
      { permission: 'branding.manage', label: 'Manage branding' },
    ],
  },
];

const SettingsPage: React.FC = () => {
  const { user, businessBootstrapStatus, signOut } = useAuth();
  const { state, currentUser, backendStatus, updateBusinessProfile, switchUser, updateUserPermissions, updateUserProfile, addUserAccount, updateEmployeeAccount, hasPermission, reviewRestockRequest, updateBranding, updateThemePreference } = useBusiness();
  
  const [businessName, setBusinessName] = useState(state.businessProfile.businessName);
  const [businessType, setBusinessType] = useState(state.businessProfile.businessType);
  const [currency, setCurrency] = useState(state.businessProfile.currency);
  const [country, setCountry] = useState(state.businessProfile.country);
  const [receiptPrefix, setReceiptPrefix] = useState(state.businessProfile.receiptPrefix);
  const [invoicePrefix, setInvoicePrefix] = useState(state.businessProfile.invoicePrefix);
  const [phone, setPhone] = useState(state.businessProfile.phone);
  const [email, setEmail] = useState(state.businessProfile.email);
  const [address, setAddress] = useState(state.businessProfile.address);
  const [website, setWebsite] = useState(state.businessProfile.website ?? '');
  const [waybillPrefix, setWaybillPrefix] = useState(state.businessProfile.waybillPrefix);
  const [formMessage, setFormMessage] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [businessEmailConfigMessage, setBusinessEmailConfigMessage] = useState('');
  const [showBusinessEmailToast, setShowBusinessEmailToast] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [isBusinessEmailConfigLoading, setIsBusinessEmailConfigLoading] = useState(false);
  const [isBusinessEmailConfigSaving, setIsBusinessEmailConfigSaving] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [hasSavedSmtpPassword, setHasSavedSmtpPassword] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
  const [newEmployeePassword, setNewEmployeePassword] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState<AppRole>('SalesManager');
  const [newEmployeeRoleLabel, setNewEmployeeRoleLabel] = useState('Sales Manager');
  const [newEmployeePermissions, setNewEmployeePermissions] = useState<AppPermission[]>([...ROLE_DEFAULT_PERMISSIONS.SalesManager]);
  const [newEmployeeMessage, setNewEmployeeMessage] = useState('');
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState('');
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeeEmail, setEditEmployeeEmail] = useState('');
  const [editEmployeePassword, setEditEmployeePassword] = useState('');
  const [editEmployeeRole, setEditEmployeeRole] = useState<AppRole>('SalesManager');
  const [editEmployeeRoleLabel, setEditEmployeeRoleLabel] = useState('Sales Manager');
  const [editEmployeePermissions, setEditEmployeePermissions] = useState<AppPermission[]>([...ROLE_DEFAULT_PERMISSIONS.SalesManager]);
  const [editEmployeeStatus, setEditEmployeeStatus] = useState<'active' | 'deactivated'>('active');
  const [editEmployeeSenderName, setEditEmployeeSenderName] = useState('');
  const [editEmployeeSenderEmail, setEditEmployeeSenderEmail] = useState('');
  const [editEmployeeMessage, setEditEmployeeMessage] = useState('');
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
    setAddress(state.businessProfile.address);
    setWebsite(state.businessProfile.website ?? '');
    setWaybillPrefix(state.businessProfile.waybillPrefix);
  }, [state.businessProfile.id]);

  useEffect(() => {
    setMyPassword(currentUser.password ?? '');
  }, [currentUser.userId, currentUser.password]);

  const [brandingMessage, setBrandingMessage] = useState('');
  const [showBrandingToast, setShowBrandingToast] = useState(false);
  const canManageBusinessEmail = hasPermission('business.edit');
  const editableEmployees = state.users.filter((userProfile) => userProfile.userId !== currentUser.userId);

  useEffect(() => {
    const businessId = state.businessProfile.id?.trim();

    if (!businessId || !canManageBusinessEmail) {
      return;
    }

    let cancelled = false;
    setIsBusinessEmailConfigLoading(true);

    loadBusinessEmailConfig(businessId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        const config = result.config;
        setSmtpHost(config?.smtpHost || 'smtp.gmail.com');
        setSmtpPort(config?.smtpPort ? String(config.smtpPort) : '587');
        setSmtpUser(config?.smtpUser || state.businessProfile.email || '');
        setFromEmail(config?.fromEmail || state.businessProfile.email || '');
        setFromName(config?.fromName || state.businessProfile.businessName || '');
        setHasSavedSmtpPassword(Boolean(config?.hasPassword));
        setSmtpPass('');
        setBusinessEmailConfigMessage('');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSmtpHost('smtp.gmail.com');
        setSmtpPort('587');
        setSmtpUser(state.businessProfile.email || '');
        setFromEmail(state.businessProfile.email || '');
        setFromName(state.businessProfile.businessName || '');
        setHasSavedSmtpPassword(false);
        setSmtpPass('');
        setBusinessEmailConfigMessage(error instanceof Error ? error.message : 'Business email system could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsBusinessEmailConfigLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManageBusinessEmail, state.businessProfile.businessName, state.businessProfile.email, state.businessProfile.id]);

  const handleBrandingUpload = async (type: 'logo' | 'signature', file: File) => {
    try {
      setBrandingMessage(`Processing ${type}...`);
      const resized = await resizeImage(file, 400, 400); // Practical size for docs
      const result = updateBranding({
        [type === 'logo' ? 'logoUrl' : 'signatureUrl']: resized
      });
      if (result.ok) {
        setShowBrandingToast(true);
        setBrandingMessage('');
      } else {
        setBrandingMessage(result.message);
      }
    } catch {
      setBrandingMessage('Upload failed. Try a different file.');
    }
  };

  const handleReviewRequest = (requestId: string, status: RestockRequestStatus, note: string) => {
    const result = reviewRestockRequest({
      requestId,
      status,
      reviewedByUserId: currentUser.userId,
      reviewedByName: currentUser.name,
      reviewNote: note,
    });
    if (result.ok) {
      setShowSuccessToast(true);
    } else {
      setFormMessage(result.message);
    }
  };

  const handleSaveBusinessEmailConfig = async () => {
    const businessId = state.businessProfile.id?.trim();

    if (!businessId) {
      setBusinessEmailConfigMessage('Business ID is missing. Save your business profile first and try again.');
      return;
    }

    const parsedPort = Number(smtpPort);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      setBusinessEmailConfigMessage('SMTP port must be a valid number.');
      return;
    }

    setIsBusinessEmailConfigSaving(true);
    setBusinessEmailConfigMessage('');

    try {
      const result = await saveBusinessEmailConfig({
        businessId,
        smtpHost: smtpHost.trim(),
        smtpPort: parsedPort,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim() || undefined,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
      });

      setSmtpHost(result.config.smtpHost);
      setSmtpPort(String(result.config.smtpPort));
      setSmtpUser(result.config.smtpUser);
      setFromEmail(result.config.fromEmail);
      setFromName(result.config.fromName);
      setHasSavedSmtpPassword(result.config.hasPassword);
      setSmtpPass('');
      setShowBusinessEmailToast(true);
    } catch (error) {
      setBusinessEmailConfigMessage(error instanceof Error ? error.message : 'Business email system could not be saved.');
    } finally {
      setIsBusinessEmailConfigSaving(false);
    }
  };

  const openAddEmployeeModal = () => {
    setNewEmployeeName('');
    setNewEmployeeEmail('');
    setNewEmployeePassword('');
    setNewEmployeeRole('SalesManager');
    setNewEmployeeRoleLabel('Sales Manager');
    setNewEmployeePermissions([...ROLE_DEFAULT_PERMISSIONS.SalesManager]);
    setNewEmployeeMessage('');
    setShowAddEmployeeModal(true);
  };

  const closeAddEmployeeModal = () => {
    setShowAddEmployeeModal(false);
    setNewEmployeeMessage('');
  };

  const openEditEmployeeModal = (userProfile: typeof state.users[number]) => {
    setEditingEmployeeId(userProfile.userId);
    setEditEmployeeName(userProfile.name);
    setEditEmployeeEmail(userProfile.email);
    setEditEmployeePassword('');
    setEditEmployeeRole(userProfile.role);
    setEditEmployeeRoleLabel(userProfile.roleLabel || userProfile.name);
    setEditEmployeePermissions(getPermissionList(userProfile));
    setEditEmployeeStatus(userProfile.accountStatus ?? 'active');
    setEditEmployeeSenderName(userProfile.customerEmailSenderName ?? '');
    setEditEmployeeSenderEmail(userProfile.customerEmailSenderEmail ?? '');
    setEditEmployeeMessage('');
    setShowEditEmployeeModal(true);
  };

  const closeEditEmployeeModal = () => {
    setShowEditEmployeeModal(false);
    setEditingEmployeeId('');
    setEditEmployeePassword('');
    setEditEmployeeSenderName('');
    setEditEmployeeSenderEmail('');
    setEditEmployeeMessage('');
  };

  const handleSave = async () => {
    if (!isPhoneValid) {
      setFormMessage('The business phone number has an invalid length for the selected country.');
      return;
    }

    if (!state.businessProfile.logoUrl) {
      setFormMessage('Upload your company logo before completing business setup. The logo is required for branded PDFs.');
      return;
    }

    setIsSaving(true);
    console.log('[DEBUG-SUBMIT] Saving Business Info:', { businessName, phone });
    // Short delay to allow the 'Saving...' state to render and provide visual feedback
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
      const result = updateBusinessProfile({
        businessName,
        businessType,
        currency,
        country,
        receiptPrefix,
        invoicePrefix,
        phone,
        email,
        address,
        website: website.trim() || undefined,
        waybillPrefix,
      });

      if (!result.ok) {
        setFormMessage(result.message);
        return;
      }

      setFormMessage('');
      setShowSuccessToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    const result = await signOut();

    if (!result.ok) {
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

  const handleAddEmployee = () => {
    const defaultPermissions = new Set(ROLE_DEFAULT_PERMISSIONS[newEmployeeRole]);
    const selectedPermissions = new Set(newEmployeePermissions);
    const grantedPermissions = Array.from(selectedPermissions).filter((permission) => !defaultPermissions.has(permission));
    const revokedPermissions = Array.from(defaultPermissions).filter((permission) => !selectedPermissions.has(permission));

    const result = addUserAccount({
      name: newEmployeeName,
      email: newEmployeeEmail,
      password: newEmployeePassword,
      role: newEmployeeRole,
      roleLabel: newEmployeeRoleLabel,
      grantedPermissions,
      revokedPermissions,
    });

    if (!result.ok) {
      setNewEmployeeMessage(result.message);
      return;
    }

    setShowSuccessToast(true);
    closeAddEmployeeModal();
  };

  const handleChangeNewEmployeeRole = (role: AppRole) => {
    setNewEmployeeRole(role);
    setNewEmployeePermissions([...ROLE_DEFAULT_PERMISSIONS[role]]);
    if (!newEmployeeRoleLabel.trim()) {
      setNewEmployeeRoleLabel(
        role === 'SalesManager' ? 'Sales Manager' : role === 'Accountant' ? 'Accountant' : 'Admin'
      );
    }
  };

  const toggleNewEmployeePermission = (permission: AppPermission, checked: boolean) => {
    setNewEmployeePermissions((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return Array.from(next);
    });
  };

  const handleChangeEditEmployeeRole = (role: AppRole) => {
    setEditEmployeeRole(role);
    setEditEmployeePermissions([...ROLE_DEFAULT_PERMISSIONS[role]]);
    if (!editEmployeeRoleLabel.trim()) {
      setEditEmployeeRoleLabel(role === 'SalesManager' ? 'Sales Manager' : role === 'Accountant' ? 'Accountant' : 'Admin');
    }
  };

  const toggleEditEmployeePermission = (permission: AppPermission, checked: boolean) => {
    setEditEmployeePermissions((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return Array.from(next);
    });
  };

  const handleSaveEmployeeChanges = () => {
    const defaultPermissions = new Set(ROLE_DEFAULT_PERMISSIONS[editEmployeeRole]);
    const selectedPermissions = new Set(editEmployeePermissions);
    const grantedPermissions = Array.from(selectedPermissions).filter((permission) => !defaultPermissions.has(permission));
    const revokedPermissions = Array.from(defaultPermissions).filter((permission) => !selectedPermissions.has(permission));

    const result = updateEmployeeAccount({
      userId: editingEmployeeId,
      name: editEmployeeName,
      email: editEmployeeEmail,
      password: editEmployeePassword || undefined,
      role: editEmployeeRole,
      roleLabel: editEmployeeRoleLabel,
      grantedPermissions,
      revokedPermissions,
      accountStatus: editEmployeeStatus,
    });

    if (!result.ok) {
      setEditEmployeeMessage(result.message);
      return;
    }

    const senderResult = updateUserProfile(editingEmployeeId, {
      customerEmailSenderName: editEmployeeSenderName.trim(),
      customerEmailSenderEmail: editEmployeeSenderEmail.trim(),
    });

    if (!senderResult.ok) {
      setEditEmployeeMessage(senderResult.message);
      return;
    }

    setShowSuccessToast(true);
    closeEditEmployeeModal();
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
            title="Cloud integrity"
            subtitle="Verify your workspace is correctly synchronized with the Supabase backend."
          >
            <div className="diagnostic-grid">
              <div className="sync-line">
                <IonBadge color={backendStatus.source === 'supabase' ? 'success' : 'medium'}>
                  {backendStatus.loading ? 'Syncing...' : backendStatus.source === 'supabase' ? 'Active' : 'Offline Mode'}
                </IonBadge>
                <div className="diagnostic-info">
                  <strong>{backendStatus.label}</strong>
                  <p className="diagnostic-detail">{backendStatus.detail}</p>
                </div>
              </div>
              
              <div className="integrity-check-list">
                <div className="integrity-item">
                  <span className={`status-pill ${hasSupabaseConfig ? 'success' : 'danger'}`}>
                    {hasSupabaseConfig ? 'Keys Loaded' : 'Missing Keys'}
                  </span>
                  <span className="integrity-label">Environment Config</span>
                </div>
                <div className="integrity-item">
                  <span className={`status-pill ${user ? 'success' : 'warning'}`}>
                    {user ? 'Authenticated' : 'Local Only'}
                  </span>
                  <span className="integrity-label">Owner Identity</span>
                </div>
              </div>
              
              <IonButton 
                fill="solid" 
                size="small" 
                onClick={() => window.location.reload()}
                className="diagnostic-reload"
              >
                Re-verify Connection
              </IonButton>
            </div>
          </SectionCard>

          <SectionCard
            title="Owner access"
            subtitle="The signed-in owner controls this BisaPilot workspace."
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
            title="Business owner identity"
            subtitle="Switch between roles to test permissions or repair your admin access."
          >
            <div className="list-block">
               <div className="tab-group" style={{ padding: '8px 4px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                {state.users.map((u) => (
                  <IonChip
                    key={u.userId}
                    color={state.currentUserId === u.userId ? 'primary' : 'medium'}
                    onClick={() => switchUser(u.userId)}
                    disabled={(u.accountStatus ?? 'active') === 'deactivated'}
                  >
                    <IonLabel>
                      {u.name} ({u.roleLabel || u.role}){(u.accountStatus ?? 'active') === 'deactivated' ? ' • Deactivated' : ''}
                    </IonLabel>
                  </IonChip>
                ))}
              </div>

               <div className="list-row" style={{ border: 'none' }}>
                <div>
                  <strong>Stuck in restricted mode?</strong>
                  <p>If you cannot see Sales or Accounting, tap below to force Admin access.</p>
                </div>
                <IonButton fill="solid" color="danger" size="small" onClick={() => {
                  switchUser('u-admin');
                }}>
                  Repair admin access
                </IonButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Appearance"
            subtitle="Choose how BisaPilot looks for you. Light mode can improve readability in bright environments."
          >
            <div className="form-grid" style={{ paddingTop: '8px' }}>
              <IonSegment
                value={state.themePreference}
                onIonChange={(e) => updateThemePreference(e.detail.value as 'system' | 'light' | 'dark')}
                className="app-segment"
              >
                <IonSegmentButton value="system">
                  <IonLabel>System</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="light">
                  <IonLabel>Light</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="dark">
                  <IonLabel>Dark</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>
          </SectionCard>

           {hasPermission('permissions.manage') && (
             <SectionCard
               title="Team accounts (Admin only)"
               subtitle="Create, edit, and control employee access from one coherent team-management flow."
               collapsible={true}
               defaultExpanded={false}
             >
               <div className="list-block">
                 <div className="list-row">
                   <div>
                     <strong>Add a new employee</strong>
                     <p>Create a fresh BisaPilot login and assign the employee a role in one step.</p>
                   </div>
                   <IonButton fill="solid" size="small" onClick={openAddEmployeeModal}>
                     Add Employee
                   </IonButton>
                 </div>

                 <div className="form-grid" style={{ marginBottom: 0 }}>
                   <IonText color="primary"><strong>Team accounts</strong></IonText>
                   <p className="diagnostic-detail" style={{ marginTop: 0 }}>
                     Use one team-management flow to create staff, update roles, fine-tune permissions, and deactivate or reactivate accounts without juggling separate role-specific forms.
                   </p>
                   {editableEmployees.length === 0 ? (
                     <p className="diagnostic-detail">No extra employee accounts have been created yet.</p>
                   ) : (
                     <div className="list-block">
                       {editableEmployees.map((userProfile) => (
                         <div className="list-row" key={userProfile.userId}>
                           <div>
                             <strong>{userProfile.name}</strong>
                             <p>{userProfile.email}</p>
                             <p className="code-label">{userProfile.roleLabel || userProfile.role}</p>
                           </div>
                           <div className="right-meta">
                             <IonBadge color={(userProfile.accountStatus ?? 'active') === 'deactivated' ? 'medium' : 'success'}>
                               {(userProfile.accountStatus ?? 'active') === 'deactivated' ? 'Deactivated' : 'Active'}
                             </IonBadge>
                             <IonButton fill="clear" size="small" onClick={() => openEditEmployeeModal(userProfile)}>
                               <IonIcon slot="icon-only" icon={createOutline} />
                             </IonButton>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
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

           {canManageBusinessEmail && (
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
                    <IonSelect 
                      value={country} 
                      interface="alert"
                      interfaceOptions={{ header: 'Select Country' }}
                      onIonChange={(event) => {
                        const newCountry = event.detail.value;
                        setCountry(newCountry);
                        
                        // Auto-select currency and phone code
                        const config: Record<string, { currency: string, prefix: string }> = {
                          'Ghana': { currency: 'GHS', prefix: '+233' },
                          'Nigeria': { currency: 'NGN', prefix: '+234' },
                          'Kenya': { currency: 'KES', prefix: '+254' },
                          'South Africa': { currency: 'ZAR', prefix: '+27' },
                          'USA': { currency: 'USD', prefix: '+1' },
                          'UK': { currency: 'GBP', prefix: '+44' },
                          'China': { currency: 'CNY', prefix: '+86' },
                          'UAE': { currency: 'AED', prefix: '+971' },
                          'France': { currency: 'EUR', prefix: '+33' },
                          'Germany': { currency: 'EUR', prefix: '+49' },
                          'India': { currency: 'INR', prefix: '+91' },
                          'Uganda': { currency: 'UGX', prefix: '+256' },
                          'Tanzania': { currency: 'TZS', prefix: '+255' },
                          'Senegal': { currency: 'XOF', prefix: '+221' },
                          'Ivory Coast': { currency: 'XOF', prefix: '+225' },
                          'Cameroon': { currency: 'XAF', prefix: '+237' }
                        };

                        if (config[newCountry]) {
                          setCurrency(config[newCountry].currency);
                          // Only update prefix if current phone is empty or just a prefix
                          if (!phone || phone.startsWith('+')) {
                            setPhone(config[newCountry].prefix);
                          }
                        }
                      }}
                    >
                      <IonSelectOption value="Ghana">Ghana</IonSelectOption>
                      <IonSelectOption value="Nigeria">Nigeria</IonSelectOption>
                      <IonSelectOption value="Kenya">Kenya</IonSelectOption>
                      <IonSelectOption value="South Africa">South Africa</IonSelectOption>
                      <IonSelectOption value="USA">USA</IonSelectOption>
                      <IonSelectOption value="UK">UK</IonSelectOption>
                      <IonSelectOption value="UAE">UAE</IonSelectOption>
                      <IonSelectOption value="China">China</IonSelectOption>
                      <IonSelectOption value="France">France</IonSelectOption>
                      <IonSelectOption value="Germany">Germany</IonSelectOption>
                      <IonSelectOption value="India">India</IonSelectOption>
                      <IonSelectOption value="Uganda">Uganda</IonSelectOption>
                      <IonSelectOption value="Tanzania">Tanzania</IonSelectOption>
                      <IonSelectOption value="Senegal">Senegal</IonSelectOption>
                      <IonSelectOption value="Ivory Coast">Ivory Coast</IonSelectOption>
                      <IonSelectOption value="Cameroon">Cameroon</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Currency</IonLabel>
                    <IonSelect
                      value={currency}
                      interface="alert"
                      interfaceOptions={{ header: 'Select Currency' }}
                      onIonChange={(event) => setCurrency(event.detail.value)}
                    >
                      <IonSelectOption value="GHS">GHS (Ghana Cedi)</IonSelectOption>
                      <IonSelectOption value="NGN">NGN (Nigerian Naira)</IonSelectOption>
                      <IonSelectOption value="KES">KES (Kenyan Shilling)</IonSelectOption>
                      <IonSelectOption value="USD">USD (US Dollar)</IonSelectOption>
                      <IonSelectOption value="EUR">EUR (Euro)</IonSelectOption>
                      <IonSelectOption value="GBP">GBP (British Pound)</IonSelectOption>
                      <IonSelectOption value="ZAR">ZAR (South African Rand)</IonSelectOption>
                      <IonSelectOption value="INR">INR (Indian Rupee)</IonSelectOption>
                      <IonSelectOption value="CNY">CNY (Chinese Yuan)</IonSelectOption>
                      <IonSelectOption value="AED">AED (UAE Dirham)</IonSelectOption>
                      <IonSelectOption value="UGX">UGX (Ugandan Shilling)</IonSelectOption>
                      <IonSelectOption value="TZS">TZS (Tanzanian Shilling)</IonSelectOption>
                      <IonSelectOption value="XOF">XOF (West African CFA)</IonSelectOption>
                      <IonSelectOption value="XAF">XAF (Central African CFA)</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                </div>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Company Address</IonLabel>
                  <IonInput
                    value={address}
                    placeholder="e.g. 123 Independence Ave, Accra"
                    onIonInput={(e) => setAddress(e.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Business Website (optional)</IonLabel>
                  <IonInput
                    value={website}
                    placeholder="e.g. www.bisapilotgh.app"
                    onIonInput={(e) => setWebsite(e.detail.value ?? '')}
                  />
                </IonItem>

                <div className="dual-stat">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Receipt prefix</IonLabel>
                    <IonInput
                      value={receiptPrefix}
                      onIonInput={(event) => setReceiptPrefix(event.detail.value ?? '')}
                    />
                  </IonItem>

                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Invoice prefix</IonLabel>
                    <IonInput
                      value={invoicePrefix}
                      onIonInput={(event) => setInvoicePrefix(event.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Waybill prefix</IonLabel>
                  <IonInput
                    value={waybillPrefix}
                    onIonInput={(event) => setWaybillPrefix(event.detail.value ?? '')}
                  />
                </IonItem>

                <div className="dual-stat">
                  <PhoneInputField
                    label="Phone"
                    value={phone}
                    placeholder="e.g. 0XXXXXXXXX"
                    onPhoneChange={setPhone}
                    onValidityChange={setIsPhoneValid}
                  />
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Email</IonLabel>
                    <IonInput value={email} onIonInput={(event) => setEmail(event.detail.value ?? '')} />
                  </IonItem>
                </div>

                {formMessage ? <p className="form-message">{formMessage}</p> : null}
              </div>
            </SectionCard>
          )}

          {canManageBusinessEmail && (
            <SectionCard
              title="Business mailing system"
              subtitle="This sender identity belongs to the business. All authorized users send customer emails through this configured mailbox."
            >
              <div className="form-grid">
                <div className="dual-stat">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">SMTP host</IonLabel>
                    <IonInput
                      value={smtpHost}
                      placeholder="e.g. smtp.gmail.com"
                      onIonInput={(event) => setSmtpHost(event.detail.value ?? '')}
                    />
                  </IonItem>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">SMTP port</IonLabel>
                    <IonInput
                      type="number"
                      value={smtpPort}
                      placeholder="587"
                      onIonInput={(event) => setSmtpPort(event.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">SMTP username</IonLabel>
                  <IonInput
                    value={smtpUser}
                    placeholder="e.g. gina@gmail.com"
                    onIonInput={(event) => setSmtpUser(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">
                    SMTP password / app password {hasSavedSmtpPassword ? '(leave blank to keep current password)' : ''}
                  </IonLabel>
                  <IonInput
                    type="password"
                    value={smtpPass}
                    placeholder={hasSavedSmtpPassword ? 'Leave blank to keep the saved password' : 'Enter your SMTP password or Gmail app password'}
                    onIonInput={(event) => setSmtpPass(event.detail.value ?? '')}
                  />
                </IonItem>

                <div className="dual-stat">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">From email</IonLabel>
                    <IonInput
                      type="email"
                      value={fromEmail}
                      placeholder="e.g. gina@gmail.com"
                      onIonInput={(event) => setFromEmail(event.detail.value ?? '')}
                    />
                  </IonItem>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">From name</IonLabel>
                    <IonInput
                      value={fromName}
                      placeholder="e.g. Gina Ventures"
                      onIonInput={(event) => setFromName(event.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>How this works</strong>
                      <p>
                        Owners and admins configure the business mailbox once here. Sales and customer-facing users then send
                        branded emails through that business identity without leaving BisaPilot.
                      </p>
                      <p>For Gmail, use `smtp.gmail.com`, port `587`, and a Google App Password instead of your normal Gmail password.</p>
                    </div>
                    <IonBadge color={hasSavedSmtpPassword ? 'success' : 'medium'}>
                      {isBusinessEmailConfigLoading ? 'Loading...' : hasSavedSmtpPassword ? 'Password saved' : 'Not configured'}
                    </IonBadge>
                  </div>
                </div>

                {businessEmailConfigMessage ? <p className="form-message">{businessEmailConfigMessage}</p> : null}

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleSaveBusinessEmailConfig}
                  disabled={isBusinessEmailConfigLoading || isBusinessEmailConfigSaving}
                >
                  {isBusinessEmailConfigSaving ? 'Saving business mail system...' : 'Save Business Mail System'}
                </IonButton>
              </div>
            </SectionCard>
          )}

          {hasPermission('branding.manage') && (
            <SectionCard title="Brand identity" subtitle="Manage your company's visual identifiers for official invoices, quotations, and waybills. Company logo is required before setup can be completed.">
              <div className="form-grid">
                <div className="branding-upload-grid">
                  <div className="branding-item branding-asset-card">
                    <div className="branding-asset-head">
                      <div>
                        <div className="branding-label-row">
                          <IonLabel>Company logo</IonLabel>
                          <IonBadge color="danger">Required</IonBadge>
                        </div>
                        <p className="branding-helper-copy">Used on invoices, quotations, and waybills. Best with a square or landscape logo on a transparent background.</p>
                      </div>
                    </div>
                    <div className="asset-preview">
                      {state.businessProfile.logoUrl ? (
                        <img src={state.businessProfile.logoUrl} alt="Logo" />
                      ) : (
                        <div className="asset-preview-empty">
                          <div className="asset-preview-icon">
                            <IonIcon icon={imageOutline} />
                          </div>
                          <strong>Upload your company logo</strong>
                          <p>PNG, JPG, or WebP. This asset is required before business setup can be completed.</p>
                        </div>
                      )}
                    </div>
                    <input type="file" hidden id="logo-input" accept="image/*" onChange={(e) => e.target.files?.[0] && handleBrandingUpload('logo', e.target.files[0])} />
                    <div className="branding-asset-actions">
                      <IonButton fill="outline" size="small" onClick={() => document.getElementById('logo-input')?.click()}>
                        {state.businessProfile.logoUrl ? 'Replace Logo' : 'Upload Logo'}
                      </IonButton>
                      <span className="branding-file-hint">Recommended for branded PDFs and customer-facing documents.</span>
                    </div>
                    {!state.businessProfile.logoUrl ? (
                      <p className="form-message" style={{ marginTop: '10px' }}>A company logo is required before you can complete business setup.</p>
                    ) : null}
                  </div>
                  <div className="branding-item branding-asset-card">
                    <div className="branding-asset-head">
                      <div>
                        <div className="branding-label-row">
                          <IonLabel>Owner signature</IonLabel>
                          <IonBadge color="medium">Optional</IonBadge>
                        </div>
                        <p className="branding-helper-copy">Appears on quotations and other formal documents when you want a more personalized approval mark.</p>
                      </div>
                    </div>
                    <div className="asset-preview signature">
                      {state.businessProfile.signatureUrl ? (
                        <img src={state.businessProfile.signatureUrl} alt="Signature" />
                      ) : (
                        <div className="asset-preview-empty signature-empty">
                          <div className="asset-preview-icon">
                            <IonIcon icon={pencilOutline} />
                          </div>
                          <strong>Add an owner signature</strong>
                          <p>Optional for a more official document finish. A clean dark signature on a light background works best.</p>
                        </div>
                      )}
                    </div>
                    <input type="file" hidden id="sig-input" accept="image/*" onChange={(e) => e.target.files?.[0] && handleBrandingUpload('signature', e.target.files[0])} />
                    <div className="branding-asset-actions">
                      <IonButton fill="outline" size="small" onClick={() => document.getElementById('sig-input')?.click()}>
                        {state.businessProfile.signatureUrl ? 'Replace Signature' : 'Upload Signature'}
                      </IonButton>
                      <span className="branding-file-hint">Helpful for quotations and approvals, but not required to keep using BisaPilot.</span>
                    </div>
                  </div>
                </div>
                {brandingMessage && <p className="form-message">{brandingMessage}</p>}

                <div style={{ marginTop: '24px' }}>
                  <IonButton 
                    expand="block" 
                    onClick={handleSave}
                    disabled={isSaving || !state.businessProfile.logoUrl}
                    className="save-settings-btn"
                  >
                    {isSaving ? (
                      <>
                        <IonSpinner name="crescent" style={{ marginRight: '8px' }} />
                        Saving Setup...
                      </>
                    ) : (
                      'Complete Business Setup'
                    )}
                  </IonButton>
                  {formMessage ? <p className="form-message" style={{ marginTop: '12px', textAlign: 'center' }}>{formMessage}</p> : null}
                </div>
              </div>
            </SectionCard>
          )}

          {hasPermission('restockRequests.manage') && state.restockRequests.length > 0 && (
            <SectionCard title="Restock requests queue" subtitle="Review and fulfill inventory replenishment requests from your Sales Managers.">
              <div className="list-block">
                {state.restockRequests.map(req => (
                  <div className="list-row" key={req.id}>
                    <div>
                      <strong>{req.productName} ({req.requestedQuantity})</strong>
                      <p>By {req.requestedByName} • {req.urgency} urgency</p>
                      <p>QOH: {req.currentQuantity} • Note: {req.note || 'None'}</p>
                      <p>Status: <span className={req.status === 'Pending' ? 'warning-text' : 'primary-text'}>{req.status}</span></p>
                    </div>
                    {req.status === 'Pending' && (
                      <div className="action-stack">
                        <IonButton size="small" color="success" onClick={() => handleReviewRequest(req.id, 'Approved', 'Stocking soon')}>Approve</IonButton>
                        <IonButton size="small" color="danger" onClick={() => handleReviewRequest(req.id, 'Rejected', 'Not needed now')}>Reject</IonButton>
                      </div>
                    )}
                    {req.status === 'Approved' && (
                      <IonButton size="small" color="primary" onClick={() => handleReviewRequest(req.id, 'Fulfilled', 'Stock added')}>Mark Fulfilled</IonButton>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Product roadmap"
            subtitle="This stays as a quick local reminder of the current BisaPilot implementation milestones."
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
      <IonModal isOpen={showAddEmployeeModal} onDidDismiss={closeAddEmployeeModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Add Employee Account</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeAddEmployeeModal} aria-label="Close add employee form">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <SectionCard
              title="New employee"
              subtitle="Create a new BisaPilot login for your staff member and assign their role immediately."
            >
              <div className="form-grid">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Full name</IonLabel>
                  <IonInput
                    value={newEmployeeName}
                    placeholder="e.g. Akua Mensah"
                    onIonInput={(event) => setNewEmployeeName(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput
                    type="email"
                    value={newEmployeeEmail}
                    placeholder="e.g. akua@yourbusiness.com"
                    onIonInput={(event) => setNewEmployeeEmail(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Temporary password</IonLabel>
                  <IonInput
                    type="password"
                    value={newEmployeePassword}
                    placeholder="Set an initial password"
                    onIonInput={(event) => setNewEmployeePassword(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Base role</IonLabel>
                  <IonSelect value={newEmployeeRole} onIonChange={(event) => handleChangeNewEmployeeRole(event.detail.value as AppRole)}>
                    <IonSelectOption value="SalesManager">Sales Manager</IonSelectOption>
                    <IonSelectOption value="Accountant">Accountant</IonSelectOption>
                    <IonSelectOption value="Admin">Admin</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Role title</IonLabel>
                  <IonInput
                    value={newEmployeeRoleLabel}
                    placeholder="e.g. Store Supervisor"
                    onIonInput={(event) => setNewEmployeeRoleLabel(event.detail.value ?? '')}
                  />
                </IonItem>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Customer email sending</strong>
                      <p>
                        If this employee will send customer emails, first save the shared business mailbox in
                        Business mailing system below, then enable `Send customer emails` in the permission list.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Choose what this role can access</strong>
                      <p>Turn permissions on or off to control exactly what this employee is allowed to see and use in BisaPilot.</p>
                    </div>
                    <IonBadge color="primary">{newEmployeePermissions.length} enabled</IonBadge>
                  </div>
                </div>

                <div className="form-grid">
                  {permissionGroups.map((group) => (
                    <div key={group.title} className="list-block" style={{ gap: '10px', marginTop: 0 }}>
                      <IonText color="primary">
                        <strong>{group.title}</strong>
                      </IonText>
                      {group.items.map((item) => (
                        <div
                          key={item.permission}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                        >
                          <p style={{ margin: 0, fontSize: '0.92em' }}>{item.label}</p>
                          <IonToggle
                            checked={newEmployeePermissions.includes(item.permission)}
                            onIonChange={(event) => toggleNewEmployeePermission(item.permission, event.detail.checked)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {newEmployeeMessage ? <p className="form-message">{newEmployeeMessage}</p> : null}

                <IonButton expand="block" onClick={handleAddEmployee}>
                  Create Employee Account
                </IonButton>
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>
      <IonModal isOpen={showEditEmployeeModal} onDidDismiss={closeEditEmployeeModal}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Edit Employee Account</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={closeEditEmployeeModal} aria-label="Close edit employee form">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="page-shell">
            <SectionCard
              title="Employee account"
              subtitle="Update role, custom title, permissions, and account status while keeping the current RBAC model intact."
            >
              <div className="form-grid">
                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Full name</IonLabel>
                  <IonInput
                    value={editEmployeeName}
                    placeholder="e.g. Akua Mensah"
                    onIonInput={(event) => setEditEmployeeName(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput
                    type="email"
                    value={editEmployeeEmail}
                    placeholder="e.g. akua@yourbusiness.com"
                    onIonInput={(event) => setEditEmployeeEmail(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">New password (optional)</IonLabel>
                  <IonInput
                    type="password"
                    value={editEmployeePassword}
                    placeholder="Leave blank to keep current password"
                    onIonInput={(event) => setEditEmployeePassword(event.detail.value ?? '')}
                  />
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Base role</IonLabel>
                  <IonSelect value={editEmployeeRole} onIonChange={(event) => handleChangeEditEmployeeRole(event.detail.value as AppRole)}>
                    <IonSelectOption value="SalesManager">Sales Manager</IonSelectOption>
                    <IonSelectOption value="Accountant">Accountant</IonSelectOption>
                    <IonSelectOption value="Admin">Admin</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem lines="none" className="app-item">
                  <IonLabel position="stacked">Role title</IonLabel>
                  <IonInput
                    value={editEmployeeRoleLabel}
                    placeholder="e.g. Store Supervisor"
                    onIonInput={(event) => setEditEmployeeRoleLabel(event.detail.value ?? '')}
                  />
                </IonItem>

                <div className="dual-stat">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Assigned sender name (optional)</IonLabel>
                    <IonInput
                      value={editEmployeeSenderName}
                      placeholder="e.g. Sales Desk"
                      onIonInput={(event) => setEditEmployeeSenderName(event.detail.value ?? '')}
                    />
                  </IonItem>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Assigned sender email (optional)</IonLabel>
                    <IonInput
                      type="email"
                      value={editEmployeeSenderEmail}
                      placeholder="e.g. sales@yourbusiness.com"
                      onIonInput={(event) => setEditEmployeeSenderEmail(event.detail.value ?? '')}
                    />
                  </IonItem>
                </div>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Account status</strong>
                      <p>{editEmployeeStatus === 'deactivated' ? 'This employee is currently blocked from signing in and being switched into.' : 'This employee can sign in and use their assigned role.'}</p>
                    </div>
                    <IonBadge color={editEmployeeStatus === 'deactivated' ? 'medium' : 'success'}>
                      {editEmployeeStatus === 'deactivated' ? 'Deactivated' : 'Active'}
                    </IonBadge>
                  </div>
                </div>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Choose what this role can access</strong>
                      <p>These toggles still resolve back into the employee's base role plus explicit grants and revocations.</p>
                    </div>
                    <IonBadge color="primary">{editEmployeePermissions.length} enabled</IonBadge>
                  </div>
                </div>

                <div className="form-grid">
                  {permissionGroups.map((group) => (
                    <div key={group.title} className="list-block" style={{ gap: '10px', marginTop: 0 }}>
                      <IonText color="primary">
                        <strong>{group.title}</strong>
                      </IonText>
                      {group.items.map((item) => (
                        <div
                          key={item.permission}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                        >
                          <p style={{ margin: 0, fontSize: '0.92em' }}>{item.label}</p>
                          <IonToggle
                            checked={editEmployeePermissions.includes(item.permission)}
                            onIonChange={(event) => toggleEditEmployeePermission(item.permission, event.detail.checked)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="button-group">
                  <IonButton expand="block" onClick={handleSaveEmployeeChanges}>
                    Save Employee Changes
                  </IonButton>
                  {editEmployeeStatus === 'active' ? (
                    <IonButton expand="block" fill="outline" color="danger" onClick={() => setEditEmployeeStatus('deactivated')}>
                      <IonIcon slot="start" icon={powerOutline} />
                      Deactivate Account
                    </IonButton>
                  ) : (
                    <IonButton expand="block" fill="outline" color="success" onClick={() => setEditEmployeeStatus('active')}>
                      <IonIcon slot="start" icon={refreshOutline} />
                      Reactivate Account
                    </IonButton>
                  )}
                </div>

                {editEmployeeMessage ? <p className="form-message">{editEmployeeMessage}</p> : null}
              </div>
            </SectionCard>
          </div>
        </IonContent>
      </IonModal>
      <IonToast
        isOpen={showSuccessToast}
        message="Business settings updated and synced."
        duration={2500}
        color="success"
        position="bottom"
        icon={checkmarkCircleOutline}
        onDidDismiss={() => setShowSuccessToast(false)}
      />
      <IonToast
        isOpen={showBrandingToast}
        message="Brand identity updated successfully."
        duration={1800}
        color="success"
        position="top"
        onDidDismiss={() => setShowBrandingToast(false)}
      />
      <IonToast
        isOpen={showBusinessEmailToast}
        message="Business mailing system saved successfully."
        duration={2200}
        color="success"
        position="top"
        onDidDismiss={() => setShowBusinessEmailToast(false)}
      />
    </IonPage>
  );
};

export default SettingsPage;
