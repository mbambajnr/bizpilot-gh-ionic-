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
import { roadmapSteps, type TaxComponent } from '../data/seedBusiness';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { calculateTaxComponentTotalRate, getBusinessLaunchState } from '../utils/businessLogic';
import { loadBusinessEmailConfig, saveBusinessEmailConfig } from '../lib/businessEmailConfigClient';
import { getPermissionList } from '../authz/permissions';
import { ROLE_DEFAULT_PERMISSIONS, ROLE_LABELS } from '../authz/defaults';
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
      { permission: 'vendors.view', label: 'View vendors' },
      { permission: 'vendors.manage', label: 'Manage vendors' },
      { permission: 'purchases.view', label: 'View purchases' },
      { permission: 'purchases.create', label: 'Create purchases' },
      { permission: 'purchases.approve', label: 'Approve purchases' },
      { permission: 'purchases.receive', label: 'Receive purchases to warehouse' },
      { permission: 'payables.view', label: 'View payables' },
      { permission: 'payables.manage', label: 'Manage payables' },
      { permission: 'payables.pay', label: 'Record payable payments' },
      { permission: 'transfers.view', label: 'View transfers' },
      { permission: 'transfers.create', label: 'Create transfers' },
      { permission: 'transfers.approve', label: 'Approve transfers' },
      { permission: 'transfers.dispatch', label: 'Dispatch transfers' },
      { permission: 'transfers.receive', label: 'Receive transfers' },
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
  const { state, currentUser, backendStatus, updateBusinessProfile, launchBusinessWorkspace, switchUser, updateUserProfile, addUserAccount, resetEmployeeTemporaryPassword, updateEmployeeAccount, hasPermission, reviewRestockRequest, updateBranding, updateThemePreference, createProductCategory, updateProductCategory, setProductCategoryActive, setInventoryCategoriesEnabled, createBusinessLocation, updateBusinessLocation, createSupplyRoute, setSupplyRouteActive, setCustomerClassificationEnabled, setBusinessTaxSettings } = useBusiness();
  
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
  const [successToastMessage, setSuccessToastMessage] = useState('Business settings updated and synced.');
  const [isLaunchingBusiness, setIsLaunchingBusiness] = useState(false);
  const [launchMessage, setLaunchMessage] = useState('');
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
  const [newEmployeeRole, setNewEmployeeRole] = useState<AppRole>('SalesManager');
  const [newEmployeeRoleLabel, setNewEmployeeRoleLabel] = useState(ROLE_LABELS.SalesManager);
  const [newEmployeePermissions, setNewEmployeePermissions] = useState<AppPermission[]>([...ROLE_DEFAULT_PERMISSIONS.SalesManager]);
  const [newEmployeeMessage, setNewEmployeeMessage] = useState('');
  const [newEmployeeCredentials, setNewEmployeeCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState('');
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeeEmail, setEditEmployeeEmail] = useState('');
  const [editEmployeeRole, setEditEmployeeRole] = useState<AppRole>('SalesManager');
  const [editEmployeeRoleLabel, setEditEmployeeRoleLabel] = useState(ROLE_LABELS.SalesManager);
  const [editEmployeePermissions, setEditEmployeePermissions] = useState<AppPermission[]>([...ROLE_DEFAULT_PERMISSIONS.SalesManager]);
  const [editEmployeeStatus, setEditEmployeeStatus] = useState<'active' | 'deactivated'>('active');
  const [editEmployeeSenderName, setEditEmployeeSenderName] = useState('');
  const [editEmployeeSenderEmail, setEditEmployeeSenderEmail] = useState('');
  const [editEmployeeMessage, setEditEmployeeMessage] = useState('');
  const [editEmployeeUsername, setEditEmployeeUsername] = useState('');
  const [editEmployeeCredentials, setEditEmployeeCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [customerClassificationEnabledDraft, setCustomerClassificationEnabledDraft] = useState(state.businessProfile.customerClassificationEnabled);
  const [customerClassificationMessage, setCustomerClassificationMessage] = useState('');
  const [inventoryCategoriesEnabledDraft, setInventoryCategoriesEnabledDraft] = useState(state.businessProfile.inventoryCategoriesEnabled);
  const [categoryMessage, setCategoryMessage] = useState('');
  const [taxEnabledDraft, setTaxEnabledDraft] = useState(state.businessProfile.taxEnabled);
  const [taxModeDraft, setTaxModeDraft] = useState(state.businessProfile.taxMode);
  const [applyTaxByDefaultDraft, setApplyTaxByDefaultDraft] = useState(state.businessProfile.applyTaxByDefault);
  const [taxComponentDrafts, setTaxComponentDrafts] = useState<TaxComponent[]>(state.businessProfile.taxComponents);
  const [withholdingTaxEnabledDraft, setWithholdingTaxEnabledDraft] = useState(state.businessProfile.withholdingTaxEnabled);
  const [withholdingTaxRateDraft, setWithholdingTaxRateDraft] = useState(String(state.businessProfile.defaultWithholdingTaxRate));
  const [withholdingTaxLabelDraft, setWithholdingTaxLabelDraft] = useState(state.businessProfile.defaultWithholdingTaxLabel);
  const [withholdingTaxBasisDraft, setWithholdingTaxBasisDraft] = useState(state.businessProfile.defaultWithholdingTaxBasis);
  const [taxMessage, setTaxMessage] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [editCategoryParentId, setEditCategoryParentId] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreDefault, setNewStoreDefault] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [editingLocationId, setEditingLocationId] = useState('');
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationType, setEditLocationType] = useState<'store' | 'warehouse'>('store');
  const [editLocationDefault, setEditLocationDefault] = useState(false);
  const [editLocationActive, setEditLocationActive] = useState(true);
  const [routeMessage, setRouteMessage] = useState('');
  const [newRouteFromLocationId, setNewRouteFromLocationId] = useState('');
  const [newRouteToLocationId, setNewRouteToLocationId] = useState('');

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
    setCustomerClassificationEnabledDraft(state.businessProfile.customerClassificationEnabled);
    setInventoryCategoriesEnabledDraft(state.businessProfile.inventoryCategoriesEnabled);
    setTaxEnabledDraft(state.businessProfile.taxEnabled);
    setTaxModeDraft(state.businessProfile.taxMode);
    setApplyTaxByDefaultDraft(state.businessProfile.applyTaxByDefault);
    setTaxComponentDrafts(state.businessProfile.taxComponents);
    setWithholdingTaxEnabledDraft(state.businessProfile.withholdingTaxEnabled);
    setWithholdingTaxRateDraft(String(state.businessProfile.defaultWithholdingTaxRate));
    setWithholdingTaxLabelDraft(state.businessProfile.defaultWithholdingTaxLabel);
    setWithholdingTaxBasisDraft(state.businessProfile.defaultWithholdingTaxBasis);
  }, [state.businessProfile.id, state.businessProfile.inventoryCategoriesEnabled, state.businessProfile.customerClassificationEnabled, state.businessProfile.taxEnabled, state.businessProfile.taxMode, state.businessProfile.applyTaxByDefault, state.businessProfile.taxComponents, state.businessProfile.withholdingTaxEnabled, state.businessProfile.defaultWithholdingTaxRate, state.businessProfile.defaultWithholdingTaxLabel, state.businessProfile.defaultWithholdingTaxBasis]);

  const [brandingMessage, setBrandingMessage] = useState('');
  const [showBrandingToast, setShowBrandingToast] = useState(false);
  const canManageBusinessEmail = hasPermission('business.edit');
  const canManageCustomerClassification = hasPermission('business.edit');
  const canManageInventoryCategories = hasPermission('business.edit');
  const canManageTaxSettings = hasPermission('business.edit');
  const canManageLocations = hasPermission('business.edit');
  const businessLaunchState = getBusinessLaunchState(state.businessProfile);
  const launchStatusMeta =
    businessLaunchState === 'live'
      ? {
          pillClassName: 'success',
          pillLabel: 'Business live',
          title: 'Your workspace is officially open.',
          helper:
            'Assigned users can now enter their role-based dashboards and worklists as soon as they sign in.',
          checklist: [
            { label: 'Business setup details saved', done: true },
            { label: 'Business officially launched', done: true },
            { label: 'Brand identity uploaded', done: Boolean(state.businessProfile.logoUrl?.trim()) },
          ],
        }
      : businessLaunchState === 'readyToLaunch'
        ? {
            pillClassName: 'warning',
            pillLabel: 'Ready to launch',
            title: 'Your business setup is saved. Launch the business to open the workspace for your team.',
            helper:
              'As a new business admin, your next step is simple: save the business setup, then launch the workspace so staff can enter their assigned dashboards.',
            checklist: [
              { label: 'Business setup details saved', done: true },
              { label: 'Business officially launched', done: false },
              { label: 'Brand identity uploaded', done: Boolean(state.businessProfile.logoUrl?.trim()) },
            ],
          }
        : {
            pillClassName: 'danger',
            pillLabel: 'Setup incomplete',
            title: 'Finish the business setup before the workspace opens to the rest of the team.',
            helper:
              'Complete the core company profile first. After you save it, you will be able to launch the business for assigned staff.',
            checklist: [
              { label: 'Business setup details saved', done: false },
              { label: 'Business officially launched', done: false },
              { label: 'Brand identity uploaded', done: Boolean(state.businessProfile.logoUrl?.trim()) },
            ],
          };
  const editableEmployees = state.users.filter((userProfile) => userProfile.userId !== currentUser.userId);
  const sortedProductCategories = [...state.productCategories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const sortedLocations = [...state.locations].sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
  const activeWarehouses = sortedLocations.filter((location) => location.isActive && location.type === 'warehouse');
  const activeStores = sortedLocations.filter((location) => location.isActive && location.type === 'store');
  const sortedSupplyRoutes = [...state.locationSupplyRoutes].sort((left, right) => {
    const leftFrom = sortedLocations.find((location) => location.id === left.fromLocationId)?.name ?? '';
    const rightFrom = sortedLocations.find((location) => location.id === right.fromLocationId)?.name ?? '';
    return leftFrom.localeCompare(rightFrom);
  });
  const derivedTaxRate = calculateTaxComponentTotalRate(taxComponentDrafts);

  const updateTaxComponentDraft = (index: number, updates: Partial<TaxComponent>) => {
    setTaxComponentDrafts((current) => current.map((component, componentIndex) =>
      componentIndex === index ? { ...component, ...updates } : component
    ));
  };

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
      const result = await updateBranding({
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
    setNewEmployeeRole('SalesManager');
    setNewEmployeeRoleLabel(ROLE_LABELS.SalesManager);
    setNewEmployeePermissions([...ROLE_DEFAULT_PERMISSIONS.SalesManager]);
    setNewEmployeeMessage('');
    setNewEmployeeCredentials(null);
    setShowAddEmployeeModal(true);
  };

  const closeAddEmployeeModal = () => {
    setShowAddEmployeeModal(false);
    setNewEmployeeMessage('');
    setNewEmployeeCredentials(null);
  };

  const openEditEmployeeModal = (userProfile: typeof state.users[number]) => {
    setEditingEmployeeId(userProfile.userId);
    setEditEmployeeName(userProfile.name);
    setEditEmployeeEmail(userProfile.email);
    setEditEmployeeRole(userProfile.role);
    setEditEmployeeRoleLabel(userProfile.roleLabel || userProfile.name);
    setEditEmployeePermissions(getPermissionList(userProfile));
    setEditEmployeeStatus(userProfile.accountStatus ?? 'active');
    setEditEmployeeSenderName(userProfile.customerEmailSenderName ?? '');
    setEditEmployeeSenderEmail(userProfile.customerEmailSenderEmail ?? '');
    setEditEmployeeUsername(userProfile.username ?? '');
    setEditEmployeeCredentials(null);
    setEditEmployeeMessage('');
    setShowEditEmployeeModal(true);
  };

  const closeEditEmployeeModal = () => {
    setShowEditEmployeeModal(false);
    setEditingEmployeeId('');
    setEditEmployeeSenderName('');
    setEditEmployeeSenderEmail('');
    setEditEmployeeUsername('');
    setEditEmployeeCredentials(null);
    setEditEmployeeMessage('');
  };

  const handleSave = async () => {
    if (!isPhoneValid) {
      setFormMessage('The business phone number has an invalid length for the selected country.');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateBusinessProfile({
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
      setSuccessToastMessage(result.message ?? 'Business setup saved.');
      setShowSuccessToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLaunchBusiness = async () => {
    setIsLaunchingBusiness(true);

    try {
      const result = await launchBusinessWorkspace();
      if (!result.ok) {
        setLaunchMessage(result.message);
        return;
      }

      setLaunchMessage('');
      setSuccessToastMessage(result.message ?? 'Business launched. Your team can now access their assigned dashboards.');
      setShowSuccessToast(true);
    } finally {
      setIsLaunchingBusiness(false);
    }
  };

  const handleSaveInventoryCategorySetting = async () => {
    const result = await setInventoryCategoriesEnabled({
      enabled: inventoryCategoriesEnabledDraft,
    });

    if (!result.ok) {
      setCategoryMessage(result.message);
      return;
    }

    setCategoryMessage('');
    setSuccessToastMessage(result.message ?? 'Inventory category setting saved.');
    setShowSuccessToast(true);
  };

  const handleSaveCustomerClassificationSetting = async () => {
    const result = await setCustomerClassificationEnabled({
      enabled: customerClassificationEnabledDraft,
    });

    if (!result.ok) {
      setCustomerClassificationMessage(result.message);
      return;
    }

    setCustomerClassificationMessage('');
    setSuccessToastMessage(result.message ?? 'Customer classification setting saved.');
    setShowSuccessToast(true);
  };

  const handleSaveTaxSettings = async () => {
    const result = await setBusinessTaxSettings({
      enabled: taxEnabledDraft,
      preset: 'ghana-standard',
      mode: taxModeDraft,
      applyTaxByDefault: applyTaxByDefaultDraft,
      taxComponents: taxComponentDrafts,
      withholdingTaxEnabled: withholdingTaxEnabledDraft,
      withholdingTaxRate: Number(withholdingTaxRateDraft || 0),
      withholdingTaxLabel: withholdingTaxLabelDraft,
      withholdingTaxBasis: withholdingTaxBasisDraft,
    });

    if (!result.ok) {
      setTaxMessage(result.message);
      return;
    }

    setTaxMessage('');
    setSuccessToastMessage(result.message ?? 'Tax settings saved.');
    setShowSuccessToast(true);
  };

  const handleCreateCategory = async () => {
    const result = await createProductCategory({
      name: newCategoryName,
      description: newCategoryDescription,
      parentCategoryId: newCategoryParentId || undefined,
    });

    if (!result.ok) {
      setCategoryMessage(result.message);
      return;
    }

    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryParentId('');
    setCategoryMessage('');
    setSuccessToastMessage('Product category created.');
    setShowSuccessToast(true);
  };

  const openEditCategory = (category: typeof state.productCategories[number]) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryDescription(category.description ?? '');
    setEditCategoryParentId(category.parentCategoryId ?? '');
    setCategoryMessage('');
  };

  const closeEditCategory = () => {
    setEditingCategoryId('');
    setEditCategoryName('');
    setEditCategoryDescription('');
    setEditCategoryParentId('');
  };

  const handleSaveCategory = async () => {
    const result = await updateProductCategory({
      categoryId: editingCategoryId,
      name: editCategoryName,
      description: editCategoryDescription,
      parentCategoryId: editCategoryParentId || undefined,
    });

    if (!result.ok) {
      setCategoryMessage(result.message);
      return;
    }

    closeEditCategory();
    setCategoryMessage('');
    setSuccessToastMessage('Product category updated.');
    setShowSuccessToast(true);
  };

  const handleToggleCategoryActive = async (categoryId: string, isActive: boolean) => {
    const result = await setProductCategoryActive({ categoryId, isActive });

    if (!result.ok) {
      setCategoryMessage(result.message);
      return;
    }

    if (editingCategoryId === categoryId && !isActive) {
      closeEditCategory();
    }
    setCategoryMessage('');
    setSuccessToastMessage(isActive ? 'Product category reactivated.' : 'Product category archived.');
    setShowSuccessToast(true);
  };

  const handleCreateLocation = async (type: 'store' | 'warehouse') => {
    const result = await createBusinessLocation({
      name: type === 'store' ? newStoreName : newWarehouseName,
      type,
      isDefault: type === 'store' ? newStoreDefault : false,
    });

    if (!result.ok) {
      setLocationMessage(result.message);
      return;
    }

    if (type === 'store') {
      setNewStoreName('');
      setNewStoreDefault(false);
    } else {
      setNewWarehouseName('');
    }
    setLocationMessage('');
    setSuccessToastMessage(result.message ?? `${type === 'store' ? 'Store' : 'Warehouse'} created.`);
    setShowSuccessToast(true);
  };

  const openEditLocation = (location: typeof state.locations[number]) => {
    setEditingLocationId(location.id);
    setEditLocationName(location.name);
    setEditLocationType(location.type);
    setEditLocationDefault(location.isDefault);
    setEditLocationActive(location.isActive);
    setLocationMessage('');
  };

  const closeEditLocation = () => {
    setEditingLocationId('');
    setEditLocationName('');
    setEditLocationType('store');
    setEditLocationDefault(false);
    setEditLocationActive(true);
  };

  const handleSaveLocation = async () => {
    const result = await updateBusinessLocation({
      locationId: editingLocationId,
      name: editLocationName,
      type: editLocationType,
      isDefault: editLocationDefault,
      isActive: editLocationActive,
    });

    if (!result.ok) {
      setLocationMessage(result.message);
      return;
    }

    closeEditLocation();
    setLocationMessage('');
    setSuccessToastMessage(result.message ?? 'Location updated.');
    setShowSuccessToast(true);
  };

  const handleCreateSupplyRoute = async () => {
    const result = await createSupplyRoute({
      fromLocationId: newRouteFromLocationId,
      toLocationId: newRouteToLocationId,
    });

    if (!result.ok) {
      setRouteMessage(result.message);
      return;
    }

    setNewRouteFromLocationId('');
    setNewRouteToLocationId('');
    setRouteMessage('');
    setSuccessToastMessage('Supply route created.');
    setShowSuccessToast(true);
  };

  const handleToggleSupplyRoute = async (routeId: string, isActive: boolean) => {
    const result = await setSupplyRouteActive({ routeId, isActive });

    if (!result.ok) {
      setRouteMessage(result.message);
      return;
    }

    setRouteMessage('');
    setSuccessToastMessage(isActive ? 'Supply route reactivated.' : 'Supply route archived.');
    setShowSuccessToast(true);
  };

  const handleSignOut = async () => {
    const result = await signOut();

    if (!result.ok) {
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
      role: newEmployeeRole,
      roleLabel: newEmployeeRoleLabel,
      grantedPermissions,
      revokedPermissions,
    });

    if (!result.ok) {
      setNewEmployeeMessage(result.message);
      return;
    }

    setNewEmployeeCredentials(result.data ?? null);
    setNewEmployeeMessage('');
    setSuccessToastMessage('Employee account created.');
    setShowSuccessToast(true);
  };

  const handleChangeNewEmployeeRole = (role: AppRole) => {
    setNewEmployeeRole(role);
    setNewEmployeePermissions([...ROLE_DEFAULT_PERMISSIONS[role]]);
    if (!newEmployeeRoleLabel.trim()) {
      setNewEmployeeRoleLabel(ROLE_LABELS[role]);
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
      setEditEmployeeRoleLabel(ROLE_LABELS[role]);
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

  const handleCreateTemporaryPassword = () => {
    const result = resetEmployeeTemporaryPassword(editingEmployeeId);

    if (!result.ok) {
      setEditEmployeeMessage(result.message);
      return;
    }

    if (result.data) {
      setEditEmployeeUsername(result.data.username);
      setEditEmployeeCredentials(result.data);
    }

    setEditEmployeeMessage('');
    setSuccessToastMessage('Temporary password created for employee.');
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
          {hasPermission('business.view') ? (
            <SectionCard
              title="Business launch status"
              subtitle="Track whether this workspace is still being prepared or officially open for the team."
              highlighted={businessLaunchState !== 'live'}
              highlightLabel={
                businessLaunchState === 'live'
                  ? "You're viewing the live business status"
                  : businessLaunchState === 'readyToLaunch'
                    ? "You're one final step away from opening the workspace"
                    : "You're still finishing the business setup"
              }
              dataTestId="business-launch-status"
            >
              <div className="diagnostic-grid">
                <div className="list-row">
                  <div>
                    <strong>{launchStatusMeta.title}</strong>
                    <p>{launchStatusMeta.helper}</p>
                  </div>
                  <span className={`status-pill ${launchStatusMeta.pillClassName}`}>{launchStatusMeta.pillLabel}</span>
                </div>
                <div className="launch-checklist" data-testid={`launch-state-${businessLaunchState}`}>
                  {launchStatusMeta.checklist.map((item) => (
                    <div key={item.label} className="launch-checklist-item">
                      <IonIcon
                        icon={item.done ? checkmarkCircleOutline : closeOutline}
                        color={item.done ? 'success' : businessLaunchState === 'readyToLaunch' ? 'warning' : 'medium'}
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                {hasPermission('business.edit') && businessLaunchState === 'readyToLaunch' ? (
                  <IonButton
                    expand="block"
                    onClick={handleLaunchBusiness}
                    disabled={isLaunchingBusiness}
                    data-testid="launch-business-button"
                  >
                    {isLaunchingBusiness ? 'Launching business...' : 'Launch Business'}
                  </IonButton>
                ) : null}
                {launchMessage ? <p className="form-message">{launchMessage}</p> : null}
                {businessLaunchState === 'live' && state.businessProfile.launchedAt ? (
                  <p className="form-message">Business launched on {new Date(state.businessProfile.launchedAt).toLocaleString()}.</p>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

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
                             {userProfile.username ? <p className="code-label">Username: {userProfile.username}</p> : null}
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
            subtitle="Authentication credentials are managed by the configured identity provider, not by local workspace state."
          >
            <div className="list-block">
              <div className="list-row">
                <div>
                  <strong>Owner authentication</strong>
                  <p>Use the sign-in screen or password reset flow to manage your owner credentials securely through Supabase Auth.</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {canManageCustomerClassification && (
            <SectionCard
              title="Customer classification"
              subtitle="Turn B2B/B2C classification on only if your business needs that customer distinction."
            >
              <div className="form-grid">
                <div className="stats-row">
                  <div className="app-card stat-pill">
                    <p className="muted-label">Active vendors</p>
                    <h2>{state.vendors.filter((vendor) => vendor.status === 'active').length}</h2>
                  </div>
                  <div className="app-card stat-pill">
                    <p className="muted-label">Inactive vendors</p>
                    <h2>{state.vendors.filter((vendor) => vendor.status === 'inactive').length}</h2>
                  </div>
                </div>
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Enable B2B/B2C classification</strong>
                      <p>Classification stays optional. Customers and documents can remain unclassified when needed.</p>
                    </div>
                    <IonToggle
                      checked={customerClassificationEnabledDraft}
                      onIonChange={(event) => setCustomerClassificationEnabledDraft(event.detail.checked)}
                    />
                  </div>
                </div>

                <IonButton expand="block" fill="outline" onClick={handleSaveCustomerClassificationSetting}>
                  Save Customer Classification Setting
                </IonButton>
                {customerClassificationMessage ? <p className="form-message">{customerClassificationMessage}</p> : null}
              </div>
            </SectionCard>
          )}

          {canManageTaxSettings && (
            <SectionCard
              title="Ghana tax"
              subtitle="Enable tax only when this business needs VAT/NHIL/GETFund treatment on new documents."
            >
              <div className="form-grid">
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Enable Ghana Standard tax</strong>
                      <p>Uses VAT 12.5%, NHIL 2.5%, and GETFund 2.5% for a combined 17.5% snapshot on new documents.</p>
                    </div>
                    <IonToggle
                      checked={taxEnabledDraft}
                      onIonChange={(event) => setTaxEnabledDraft(event.detail.checked)}
                    />
                  </div>
                </div>

                {taxEnabledDraft ? (
                  <>
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Tax mode</IonLabel>
                      <IonSelect
                        value={taxModeDraft}
                        interface="popover"
                        onIonChange={(event) => setTaxModeDraft(event.detail.value)}
                      >
                        <IonSelectOption value="exclusive">Exclusive - add tax on top</IonSelectOption>
                        <IonSelectOption value="inclusive">Inclusive - prices already include tax</IonSelectOption>
                      </IonSelect>
                    </IonItem>

                    <div className="list-block">
                      <div className="list-row">
                        <div>
                          <strong>Ghana Standard components</strong>
                          <p>Edit the active default rates for future documents. Existing quotations and invoices keep their saved snapshots.</p>
                        </div>
                        <IonBadge color="primary">{derivedTaxRate}% total</IonBadge>
                      </div>
                      {taxComponentDrafts.map((component, index) => (
                        <div className="list-row" key={component.key}>
                          <div style={{ flex: 1 }}>
                            <IonItem lines="none" className="app-item">
                              <IonLabel position="stacked">Component label</IonLabel>
                              <IonInput
                                value={component.label}
                                onIonInput={(event) => updateTaxComponentDraft(index, { label: event.detail.value ?? '' })}
                              />
                            </IonItem>
                          </div>
                          <div style={{ width: '130px' }}>
                            <IonItem lines="none" className="app-item">
                              <IonLabel position="stacked">Rate (%)</IonLabel>
                              <IonInput
                                type="number"
                                min={0}
                                max={100}
                                inputmode="decimal"
                                value={String(component.rate)}
                                onIonInput={(event) => updateTaxComponentDraft(index, { rate: Number(event.detail.value || 0) })}
                              />
                            </IonItem>
                          </div>
                          <IonToggle
                            aria-label={`Enable ${component.label || component.key}`}
                            checked={component.enabled !== false}
                            onIonChange={(event) => updateTaxComponentDraft(index, { enabled: event.detail.checked })}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="list-block">
                      <div className="list-row">
                        <div>
                          <strong>Apply tax by default</strong>
                          <p>New quotations and invoices capture the current tax settings automatically.</p>
                        </div>
                        <IonToggle
                          checked={applyTaxByDefaultDraft}
                          onIonChange={(event) => setApplyTaxByDefaultDraft(event.detail.checked)}
                        />
                      </div>
                    </div>

                    <div className="list-block">
                      <div className="list-row">
                        <div>
                          <strong>Enable withholding tax defaults</strong>
                          <p>Shows withholding as a deduction from the gross invoice amount, separate from VAT/NHIL/GETFund.</p>
                        </div>
                        <IonToggle
                          checked={withholdingTaxEnabledDraft}
                          onIonChange={(event) => setWithholdingTaxEnabledDraft(event.detail.checked)}
                        />
                      </div>
                    </div>

                    {withholdingTaxEnabledDraft ? (
                      <>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Default withholding label</IonLabel>
                          <IonInput
                            value={withholdingTaxLabelDraft}
                            placeholder="Withholding Tax"
                            onIonInput={(event) => setWithholdingTaxLabelDraft(event.detail.value ?? '')}
                          />
                        </IonItem>
                        <div className="dual-stat">
                          <IonItem lines="none" className="app-item">
                            <IonLabel position="stacked">Default withholding rate (%)</IonLabel>
                            <IonInput
                              type="number"
                              min={0}
                              max={100}
                              inputmode="decimal"
                              value={withholdingTaxRateDraft}
                              onIonInput={(event) => setWithholdingTaxRateDraft(event.detail.value ?? '0')}
                            />
                          </IonItem>
                          <IonItem lines="none" className="app-item">
                            <IonLabel position="stacked">Withholding basis</IonLabel>
                            <IonSelect
                              value={withholdingTaxBasisDraft}
                              interface="popover"
                              onIonChange={(event) => setWithholdingTaxBasisDraft(event.detail.value)}
                            >
                              <IonSelectOption value="taxInclusiveTotal">Gross total after tax</IonSelectOption>
                              <IonSelectOption value="subtotal">Subtotal</IonSelectOption>
                              <IonSelectOption value="taxExclusiveSubtotal">Tax-exclusive subtotal</IonSelectOption>
                            </IonSelect>
                          </IonItem>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}

                <IonButton expand="block" fill="outline" onClick={handleSaveTaxSettings}>
                  Save Tax Settings
                </IonButton>
                {taxMessage ? <p className="form-message">{taxMessage}</p> : null}
              </div>
            </SectionCard>
          )}

          {canManageLocations && (
            <SectionCard
              title="Locations"
              subtitle="Set up stores, warehouses, and simple warehouse-to-store supply routes."
            >
              <div className="form-grid">
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Current locations</strong>
                      <p>Every business keeps one default location so single-location workflows stay simple.</p>
                    </div>
                    <IonBadge color="primary">{sortedLocations.length}</IonBadge>
                  </div>
                  {sortedLocations.map((location) => (
                    <div className="list-row" key={location.id}>
                      <div>
                        <strong>{location.name}</strong>
                        <p>{location.type === 'warehouse' ? 'Warehouse' : 'Store'}</p>
                      </div>
                      <div className="right-meta">
                        {location.isDefault ? <IonBadge color="success">Default</IonBadge> : null}
                        {!location.isActive ? <IonBadge color="medium">Inactive</IonBadge> : null}
                        <IonButton fill="clear" size="small" onClick={() => openEditLocation(location)}>
                          <IonIcon slot="icon-only" icon={createOutline} />
                        </IonButton>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Create store</strong>
                      <p>Set up a selling location separately from warehouses so admin work stays clear.</p>
                    </div>
                  </div>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Store name</IonLabel>
                    <IonInput
                      value={newStoreName}
                      placeholder="e.g. Main Store"
                      onIonInput={(event) => setNewStoreName(event.detail.value ?? '')}
                    />
                  </IonItem>
                  <div className="list-row">
                    <div>
                      <strong>Make this the main store</strong>
                      <p>The main store stays editable and can remain the default point for simple workflows.</p>
                    </div>
                    <IonToggle checked={newStoreDefault} onIonChange={(event) => setNewStoreDefault(event.detail.checked)} />
                  </div>
                  <IonButton expand="block" onClick={() => handleCreateLocation('store')}>
                    Create Store
                  </IonButton>
                </div>

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Create warehouse</strong>
                      <p>Create warehouse locations separately so transfer and receipt workflows stay easy to understand.</p>
                    </div>
                  </div>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Warehouse name</IonLabel>
                    <IonInput
                      value={newWarehouseName}
                      placeholder="e.g. North Warehouse"
                      onIonInput={(event) => setNewWarehouseName(event.detail.value ?? '')}
                    />
                  </IonItem>
                  <IonButton expand="block" fill="outline" onClick={() => handleCreateLocation('warehouse')}>
                    Create Warehouse
                  </IonButton>
                </div>

                {editingLocationId ? (
                  <div className="list-block">
                    <div className="list-row">
                      <div>
                        <strong>Edit location</strong>
                        <p>Keep one active default location for stable inventory behavior.</p>
                      </div>
                    </div>
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Location name</IonLabel>
                      <IonInput value={editLocationName} onIonInput={(event) => setEditLocationName(event.detail.value ?? '')} />
                    </IonItem>
                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Type</IonLabel>
                      <IonSelect value={editLocationType} interface="popover" onIonChange={(event) => setEditLocationType(event.detail.value)}>
                        <IonSelectOption value="store">Store</IonSelectOption>
                        <IonSelectOption value="warehouse">Warehouse</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                    <div className="list-row">
                      <div>
                        <strong>Default location</strong>
                        <p>Only one location can be default at a time.</p>
                      </div>
                      <IonToggle checked={editLocationDefault} onIonChange={(event) => setEditLocationDefault(event.detail.checked)} />
                    </div>
                    <div className="list-row">
                      <div>
                        <strong>Active location</strong>
                        <p>Inactive locations stay preserved but are hidden from normal stock entry.</p>
                      </div>
                      <IonToggle checked={editLocationActive} onIonChange={(event) => setEditLocationActive(event.detail.checked)} />
                    </div>
                    <div className="dual-stat">
                      <IonButton expand="block" onClick={handleSaveLocation}>
                        Save Location
                      </IonButton>
                      <IonButton expand="block" fill="outline" color="medium" onClick={closeEditLocation}>
                        Cancel
                      </IonButton>
                    </div>
                  </div>
                ) : null}

                {locationMessage ? <p className="form-message">{locationMessage}</p> : null}

                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Warehouse to store supply routes</strong>
                      <p>Routes keep transfer choices simple and prevent accidental store-to-store movement.</p>
                    </div>
                    <IonBadge color="primary">{sortedSupplyRoutes.filter((route) => route.isActive).length}</IonBadge>
                  </div>

                  {sortedSupplyRoutes.length === 0 ? (
                    <div className="list-row">
                      <div>
                        <strong>No supply routes yet</strong>
                        <p>Create a warehouse and a store, then connect them here.</p>
                      </div>
                    </div>
                  ) : (
                    sortedSupplyRoutes.map((route) => {
                      const from = sortedLocations.find((location) => location.id === route.fromLocationId);
                      const to = sortedLocations.find((location) => location.id === route.toLocationId);

                      return (
                        <div className="list-row" key={route.id}>
                          <div>
                            <strong>{from?.name ?? 'Unknown warehouse'} → {to?.name ?? 'Unknown store'}</strong>
                            <p>Warehouse supply route</p>
                          </div>
                          <div className="right-meta">
                            <IonBadge color={route.isActive ? 'success' : 'medium'}>
                              {route.isActive ? 'Active' : 'Archived'}
                            </IonBadge>
                            <IonButton
                              fill="clear"
                              size="small"
                              onClick={() => handleToggleSupplyRoute(route.id, !route.isActive)}
                            >
                              {route.isActive ? 'Archive' : 'Reactivate'}
                            </IonButton>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="dual-stat">
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Source warehouse</IonLabel>
                    <IonSelect
                      value={newRouteFromLocationId}
                      interface="popover"
                      placeholder="Choose warehouse"
                      onIonChange={(event) => setNewRouteFromLocationId(event.detail.value)}
                    >
                      {activeWarehouses.map((location) => (
                        <IonSelectOption key={location.id} value={location.id}>{location.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none" className="app-item">
                    <IonLabel position="stacked">Destination store</IonLabel>
                    <IonSelect
                      value={newRouteToLocationId}
                      interface="popover"
                      placeholder="Choose store"
                      onIonChange={(event) => setNewRouteToLocationId(event.detail.value)}
                    >
                      {activeStores.map((location) => (
                        <IonSelectOption key={location.id} value={location.id}>{location.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                </div>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={handleCreateSupplyRoute}
                  disabled={activeWarehouses.length === 0 || activeStores.length === 0}
                >
                  Create Supply Route
                </IonButton>
                {routeMessage ? <p className="form-message">{routeMessage}</p> : null}
              </div>
            </SectionCard>
          )}

          {canManageInventoryCategories && (
            <SectionCard
              title="Inventory categories"
              subtitle="Turn optional product categorization on only if your business needs extra inventory structure."
            >
              <div className="form-grid">
                <div className="list-block">
                  <div className="list-row">
                    <div>
                      <strong>Enable inventory categories</strong>
                      <p>
                        Categories stay optional. Products can remain uncategorized even when this is enabled.
                      </p>
                    </div>
                    <IonToggle
                      checked={inventoryCategoriesEnabledDraft}
                      onIonChange={(event) => setInventoryCategoriesEnabledDraft(event.detail.checked)}
                    />
                  </div>
                </div>

                <IonButton expand="block" fill="outline" onClick={handleSaveInventoryCategorySetting}>
                  Save Inventory Category Setting
                </IonButton>

                {inventoryCategoriesEnabledDraft && (
                  <>
                    <div className="list-block">
                      <div className="list-row">
                        <div>
                          <strong>Create category</strong>
                          <p>Use a simple business-scoped category name. Duplicate names are blocked.</p>
                        </div>
                      </div>
                    </div>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Category name</IonLabel>
                      <IonInput
                        value={newCategoryName}
                        placeholder="e.g. Household"
                        onIonInput={(event) => setNewCategoryName(event.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Description (optional)</IonLabel>
                      <IonInput
                        value={newCategoryDescription}
                        placeholder="e.g. Fast-moving home supplies"
                        onIonInput={(event) => setNewCategoryDescription(event.detail.value ?? '')}
                      />
                    </IonItem>

                    <IonItem lines="none" className="app-item">
                      <IonLabel position="stacked">Parent category (optional)</IonLabel>
                      <IonSelect
                        value={newCategoryParentId}
                        placeholder="None"
                        interface="popover"
                        onIonChange={(event) => setNewCategoryParentId(event.detail.value ?? '')}
                      >
                        <IonSelectOption value="">None</IonSelectOption>
                        {sortedProductCategories.map((category) => (
                          <IonSelectOption key={category.id} value={category.id}>
                            {category.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>

                    <IonButton expand="block" onClick={handleCreateCategory}>
                      Create Product Category
                    </IonButton>

                    <div className="list-block">
                      <div className="list-row">
                        <div>
                          <strong>Saved categories</strong>
                          <p>Archive categories you want to retire. Existing product links remain intact.</p>
                        </div>
                        <IonBadge color="primary">{sortedProductCategories.length}</IonBadge>
                      </div>

                      {sortedProductCategories.length === 0 ? (
                        <p className="diagnostic-detail">No categories have been created yet.</p>
                      ) : (
                        sortedProductCategories.map((category) => (
                          <div className="list-row" key={category.id}>
                            <div style={{ flex: 1 }}>
                              <strong>{category.name}</strong>
                              <p>{category.description || 'No description provided.'}</p>
                              {category.parentCategoryId ? (
                                <p className="muted-label">
                                  Parent: {state.productCategories.find((item) => item.id === category.parentCategoryId)?.name ?? 'Unknown category'}
                                </p>
                              ) : null}
                              <p className="code-label">{category.slug}</p>
                            </div>
                            <div className="right-meta">
                              <IonBadge color={category.isActive ? 'success' : 'medium'}>
                                {category.isActive ? 'Active' : 'Archived'}
                              </IonBadge>
                              <IonButton fill="clear" size="small" onClick={() => openEditCategory(category)}>
                                <IonIcon slot="icon-only" icon={createOutline} />
                              </IonButton>
                              {category.isActive ? (
                                <IonButton fill="clear" size="small" color="medium" onClick={() => handleToggleCategoryActive(category.id, false)}>
                                  <IonIcon slot="icon-only" icon={powerOutline} />
                                </IonButton>
                              ) : (
                                <IonButton fill="clear" size="small" color="success" onClick={() => handleToggleCategoryActive(category.id, true)}>
                                  <IonIcon slot="icon-only" icon={refreshOutline} />
                                </IonButton>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {editingCategoryId ? (
                      <div className="list-block">
                        <div className="list-row">
                          <div>
                            <strong>Edit category</strong>
                            <p>Rename or clarify the selected category without changing any existing product links.</p>
                          </div>
                        </div>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Category name</IonLabel>
                          <IonInput
                            value={editCategoryName}
                            onIonInput={(event) => setEditCategoryName(event.detail.value ?? '')}
                          />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Description (optional)</IonLabel>
                          <IonInput
                            value={editCategoryDescription}
                            onIonInput={(event) => setEditCategoryDescription(event.detail.value ?? '')}
                          />
                        </IonItem>
                        <IonItem lines="none" className="app-item">
                          <IonLabel position="stacked">Parent category (optional)</IonLabel>
                          <IonSelect
                            value={editCategoryParentId}
                            placeholder="None"
                            interface="popover"
                            onIonChange={(event) => setEditCategoryParentId(event.detail.value ?? '')}
                          >
                            <IonSelectOption value="">None</IonSelectOption>
                            {sortedProductCategories
                              .filter((category) => category.id !== editingCategoryId)
                              .map((category) => (
                                <IonSelectOption key={category.id} value={category.id}>
                                  {category.name}
                                </IonSelectOption>
                              ))}
                          </IonSelect>
                        </IonItem>
                        <div className="dual-stat">
                          <IonButton expand="block" onClick={handleSaveCategory}>
                            Save Category
                          </IonButton>
                          <IonButton expand="block" fill="outline" color="medium" onClick={closeEditCategory}>
                            Cancel
                          </IonButton>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {categoryMessage ? <p className="form-message">{categoryMessage}</p> : null}
              </div>
            </SectionCard>
          )}

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
                <IonButton 
                  expand="block" 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="save-settings-btn"
                >
                  {isSaving ? (
                    <>
                      <IonSpinner name="crescent" style={{ marginRight: '8px' }} />
                      Saving business setup...
                    </>
                  ) : (
                    'Save Business Setup'
                  )}
                </IonButton>
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
            <SectionCard title="Brand identity" subtitle="Manage your company's visual identifiers for official invoices, quotations, and waybills. Add a logo for stronger branded documents.">
              <div className="form-grid">
                <div className="branding-upload-grid">
                  <div className="branding-item branding-asset-card">
                    <div className="branding-asset-head">
                      <div>
                        <div className="branding-label-row">
                          <IonLabel>Company logo</IonLabel>
                          <IonBadge color="medium">Recommended</IonBadge>
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
                          <p>PNG, JPG, or WebP. This helps your invoices, quotations, and waybills look more official.</p>
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
                      <p className="form-message" style={{ marginTop: '10px' }}>You can still launch the business without a logo, but branded documents will look better once you add one.</p>
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

                {!state.businessProfile.logoUrl ? (
                  <p className="muted-label" style={{ marginTop: '12px' }}>
                    You can save business details without a logo. Add one here when you want branded PDFs and customer-facing documents.
                  </p>
                ) : null}
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
                  <IonLabel position="stacked">Base role</IonLabel>
                  <IonSelect value={newEmployeeRole} onIonChange={(event) => handleChangeNewEmployeeRole(event.detail.value as AppRole)}>
                    <IonSelectOption value="SalesManager">Sales Manager</IonSelectOption>
                    <IonSelectOption value="WarehouseManager">Warehouse Manager</IonSelectOption>
                    <IonSelectOption value="StoreManager">Store Manager</IonSelectOption>
                    <IonSelectOption value="PurchaseManager">Purchase Manager</IonSelectOption>
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

                {newEmployeeCredentials ? (
                  <div className="list-block">
                    <div className="list-row">
                      <div>
                        <strong>Employee sign-in credentials</strong>
                        <p>Share these with the employee so they can sign in with their authorized role.</p>
                        <p className="code-label">Username: {newEmployeeCredentials.username}</p>
                        <p className="code-label">Temporary password: {newEmployeeCredentials.temporaryPassword}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {newEmployeeCredentials ? (
                  <IonButton expand="block" fill="outline" onClick={closeAddEmployeeModal}>
                    Done
                  </IonButton>
                ) : (
                  <IonButton expand="block" onClick={handleAddEmployee}>
                    Create Employee Account
                  </IonButton>
                )}
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
                  <IonLabel position="stacked">Base role</IonLabel>
                  <IonSelect value={editEmployeeRole} onIonChange={(event) => handleChangeEditEmployeeRole(event.detail.value as AppRole)}>
                    <IonSelectOption value="SalesManager">Sales Manager</IonSelectOption>
                    <IonSelectOption value="WarehouseManager">Warehouse Manager</IonSelectOption>
                    <IonSelectOption value="StoreManager">Store Manager</IonSelectOption>
                    <IonSelectOption value="PurchaseManager">Purchase Manager</IonSelectOption>
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
                      <strong>Employee sign-in access</strong>
                      <p>Create a fresh temporary password when this employee is newly assigned, returning, or locked out.</p>
                      {editEmployeeUsername ? <p className="code-label">Username: {editEmployeeUsername}</p> : null}
                    </div>
                    <IonButton
                      fill="outline"
                      size="small"
                      onClick={handleCreateTemporaryPassword}
                      disabled={!editingEmployeeId || editEmployeeStatus !== 'active'}
                    >
                      Create Temporary Password
                    </IonButton>
                  </div>
                  {editEmployeeCredentials ? (
                    <div className="list-row" style={{ borderTop: '1px solid var(--border-color)' }}>
                      <div>
                        <strong>Temporary credentials</strong>
                        <p>Share these with the employee and ask them to sign in right away.</p>
                        <p className="code-label">Username: {editEmployeeCredentials.username}</p>
                        <p className="code-label">Temporary password: {editEmployeeCredentials.temporaryPassword}</p>
                      </div>
                    </div>
                  ) : null}
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
        message={successToastMessage}
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
