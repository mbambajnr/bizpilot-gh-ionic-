import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './AuthContext';
import { BusinessState, priorityQuestions, seedState } from '../data/seedBusiness';
import { loadBusinessProfileFromSupabase } from '../data/supabaseBusinessProfile';
import { loadFullBusinessDataFromSupabase } from '../data/supabaseDataLoader';
import {
  ActionResult,
  addCustomerToState,
  addProductToState,
  addQuotationToState,
  addSaleToState,
  ConvertedSaleReceipt,
  convertQuotationToSalesState,
  ConvertQuotationInput,
  ConvertQuotationResult,
  NewCustomerInput,
  UpdateCustomerStatusInput,
  UpdateCustomerInput,
  NewProductInput,
  NewQuotationInput,
  NewSaleInput,
  addRestockRequestToState,
  reviewRestockRequestInState,
  updateBrandingInState,
  NewRestockRequestInput,
  ReviewRestockRequestInput,
  restoreBusinessState,
  reverseSaleInState,
  ReverseSaleInput,
  ReverseSaleResult,
  updateCustomerInState,
  updateCustomerStatusInState,
  updateBusinessProfileInState,
  UpdateBusinessProfileInput,
  addExpenseToState,
  NewExpenseInput,
  createProductCategoryInState,
  CreateProductCategoryInput,
  updateProductCategoryInState,
  UpdateProductCategoryInput,
  setProductCategoryActiveInState,
  SetProductCategoryActiveInput,
  setInventoryCategoriesEnabledInState,
  SetInventoryCategoriesEnabledInput,
  setCustomerClassificationEnabledInState,
  SetCustomerClassificationEnabledInput,
  setBusinessTaxSettingsInState,
  SetBusinessTaxSettingsInput,
  launchBusinessWorkspaceInState,
  createBusinessLocationInState,
  CreateBusinessLocationInput,
  updateBusinessLocationInState,
  UpdateBusinessLocationInput,
  createSupplyRouteInState,
  CreateSupplyRouteInput,
  setSupplyRouteActiveInState,
  SetSupplyRouteActiveInput,
  createStockTransferInState,
  approveStockTransferInState,
  dispatchStockTransferInState,
  receiveStockTransferInState,
  cancelStockTransferInState,
  createVendorInState,
  updateVendorInState,
  setVendorStatusInState,
  createPurchaseDraftInState,
  submitPurchaseInState,
  approvePurchaseInState,
  cancelPurchaseInState,
  receivePurchaseInWarehouseInState,
  createPayableFromPurchaseInState,
  approvePayableInState,
  recordPayablePaymentInState,
  CreateStockTransferInput,
  StockTransferActionInput,
  transferStockInState,
  TransferStockInput,
  CreateVendorInput,
  UpdateVendorInput,
  SetVendorStatusInput,
  CreatePurchaseDraftInput,
  PurchaseActionInput,
  ReceivePurchaseInput,
  CreatePayableInput,
  ApprovePayableInput,
  RecordPayablePaymentInput,
  LaunchBusinessWorkspaceInput,
} from '../utils/businessLogic';
import { getLastSupabaseSyncErrorMessage, syncProduct, syncCustomer, syncSale, syncExpense, syncBusinessProfile, syncProductCategory, syncQuotation, syncBusinessLocation, syncSupplyRoute, syncStockMovement, syncEmployeeCredential } from '../data/supabaseSync';
import { selectProductQuantityOnHand, selectSaleBalanceRemaining } from '../selectors/businessSelectors';
import { AppPermission, AppRole, UserAccessProfile } from '../authz/types';
import { hasPermission } from '../authz/permissions';

const STORAGE_KEY = 'bizpilot-gh-state-v1';
const EMPLOYEE_CREDENTIALS_STORAGE_KEY = 'bizpilot-employee-credentials-v1';

function getCloudSaveMessage(fallback: string) {
  return getLastSupabaseSyncErrorMessage() ?? fallback;
}

type LowStockAlert = {
  productId: string;
  name: string;
  quantity: number;
  reorderLevel: number;
};

type SaleReceipt = {
  id: string;
  receiptId: string;
  createdAt: string;
  customerName: string;
  clientId: string;
  productName: string;
  inventoryId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  paymentMethod: string;
  paymentReference?: string;
};

type AddSaleResult =
  | { ok: true; receipt: SaleReceipt; lowStockAlert?: LowStockAlert }
  | { ok: false; message: string };

type ConvertQuotationToSaleResult =
  | { ok: true; receipts: SaleReceipt[]; quotationNumber: string }
  | { ok: false; message: string };

function mapConvertedReceipt(receipt: ConvertedSaleReceipt): SaleReceipt {
  return {
    id: receipt.id,
    receiptId: receipt.receiptId,
    createdAt: receipt.createdAt,
    customerName: receipt.customerName,
    clientId: receipt.clientId,
    productName: receipt.productName,
    inventoryId: receipt.inventoryId,
    quantity: receipt.quantity,
    unitPrice: receipt.unitPrice,
    totalAmount: receipt.totalAmount,
    amountPaid: receipt.amountPaid,
    balanceRemaining: receipt.balanceRemaining,
    paymentMethod: receipt.paymentMethod,
    paymentReference: receipt.paymentReference,
  };
}

type ReverseSaleContextResult =
  | { ok: true; reversedSaleId: string }
  | { ok: false; message: string };

type BusinessBackendStatus = {
  source: 'local' | 'supabase';
  loading: boolean;
  label: string;
  detail: string;
};

type BusinessContextValue = {
  state: BusinessState;
  backendStatus: BusinessBackendStatus;
  priorityQuestions: string[];
  addProduct: (input: NewProductInput) => ActionResult;
  addCustomer: (input: NewCustomerInput) => ActionResult;
  updateCustomer: (input: UpdateCustomerInput) => ActionResult;
  updateCustomerStatus: (input: UpdateCustomerStatusInput) => ActionResult;
  updateBusinessProfile: (input: UpdateBusinessProfileInput) => Promise<ActionResult>;
  launchBusinessWorkspace: (input?: LaunchBusinessWorkspaceInput) => Promise<ActionResult>;
  addQuotation: (input: NewQuotationInput) => ActionResult;
  convertQuotationToSale: (input: ConvertQuotationInput) => ConvertQuotationToSaleResult;
  reverseSale: (input: ReverseSaleInput) => ReverseSaleContextResult;
  addSale: (input: NewSaleInput) => AddSaleResult;
  currentUser: UserAccessProfile;
  switchUser: (userId: string) => void;
  updateUserPermissions: (userId: string, granted: AppPermission[], revoked: AppPermission[]) => ActionResult;
  updateUserProfile: (userId: string, profile: Partial<Pick<UserAccessProfile, 'email' | 'name' | 'customerEmailSenderName' | 'customerEmailSenderEmail'>>) => ActionResult;
  addUserAccount: (input: { name: string; email: string; role: AppRole; roleLabel?: string; grantedPermissions?: AppPermission[]; revokedPermissions?: AppPermission[] }) => ActionResult<{ username: string; temporaryPassword: string }>;
  resetEmployeeTemporaryPassword: (userId: string) => ActionResult<{ username: string; temporaryPassword: string }>;
  updateEmployeeAccount: (input: {
    userId: string;
    name: string;
    email: string;
    role: AppRole;
    roleLabel?: string;
    grantedPermissions: AppPermission[];
    revokedPermissions: AppPermission[];
    accountStatus: 'active' | 'deactivated';
  }) => ActionResult;
  addRestockRequest: (input: NewRestockRequestInput) => ActionResult;
  reviewRestockRequest: (input: ReviewRestockRequestInput) => ActionResult;
  updateBranding: (input: { logoUrl?: string; signatureUrl?: string }) => Promise<ActionResult>;
  hasPermission: (permission: AppPermission) => boolean;
  addExpense: (input: NewExpenseInput) => ActionResult;
  updateThemePreference: (theme: 'system' | 'light' | 'dark') => void;
  createProductCategory: (input: CreateProductCategoryInput) => Promise<ActionResult>;
  updateProductCategory: (input: UpdateProductCategoryInput) => Promise<ActionResult>;
  setProductCategoryActive: (input: SetProductCategoryActiveInput) => Promise<ActionResult>;
  setInventoryCategoriesEnabled: (input: SetInventoryCategoriesEnabledInput) => Promise<ActionResult>;
  createBusinessLocation: (input: CreateBusinessLocationInput) => Promise<ActionResult>;
  updateBusinessLocation: (input: UpdateBusinessLocationInput) => Promise<ActionResult>;
  createSupplyRoute: (input: CreateSupplyRouteInput) => Promise<ActionResult>;
  setSupplyRouteActive: (input: SetSupplyRouteActiveInput) => Promise<ActionResult>;
  createStockTransfer: (input: CreateStockTransferInput) => Promise<ActionResult>;
  approveStockTransfer: (input: StockTransferActionInput) => Promise<ActionResult>;
  dispatchStockTransfer: (input: StockTransferActionInput) => Promise<ActionResult>;
  receiveStockTransfer: (input: StockTransferActionInput) => Promise<ActionResult>;
  cancelStockTransfer: (input: StockTransferActionInput) => Promise<ActionResult>;
  transferStock: (input: TransferStockInput) => Promise<ActionResult>;
  createVendor: (input: CreateVendorInput) => Promise<ActionResult>;
  updateVendor: (input: UpdateVendorInput) => Promise<ActionResult>;
  setVendorStatus: (input: SetVendorStatusInput) => Promise<ActionResult>;
  createPurchaseDraft: (input: CreatePurchaseDraftInput) => Promise<ActionResult>;
  submitPurchase: (input: PurchaseActionInput) => Promise<ActionResult>;
  approvePurchase: (input: PurchaseActionInput) => Promise<ActionResult>;
  cancelPurchase: (input: PurchaseActionInput) => Promise<ActionResult>;
  receivePurchaseInWarehouse: (input: ReceivePurchaseInput) => Promise<ActionResult>;
  createPayableFromPurchase: (input: CreatePayableInput) => Promise<ActionResult>;
  approvePayable: (input: ApprovePayableInput) => Promise<ActionResult>;
  recordPayablePayment: (input: RecordPayablePaymentInput) => Promise<ActionResult>;
  setCustomerClassificationEnabled: (input: SetCustomerClassificationEnabledInput) => Promise<ActionResult>;
  setBusinessTaxSettings: (input: SetBusinessTaxSettingsInput) => Promise<ActionResult>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

function useBusiness() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error('useBusiness must be used inside BusinessProvider');
  }

  return context;
}

function readInitialState(): BusinessState {
  if (typeof window === 'undefined') {
    return seedState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return restoreBusinessState(JSON.parse(stored) as BusinessState);
    } catch {
      // Fall through to default logic
    }
  }

  return seedState;
}

function buildLocalSaveWarning(fallback: string) {
  return `${getCloudSaveMessage(fallback)} Changes were saved locally.`;
}

function buildEmployeeUsername(email: string) {
  return email.trim().toLowerCase();
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = 'BP-';

  for (let index = 0; index < 10; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return password;
}

function shouldSyncEmployeeCredential(user: UserAccessProfile) {
  return Boolean(user.username || user.temporaryPassword || user.credentialsGeneratedAt);
}

function getEmployeeCredentialSyncKey(user: UserAccessProfile) {
  return [
    user.userId,
    user.email,
    user.username ?? '',
    user.temporaryPassword ?? '',
    user.credentialsGeneratedAt ?? '',
    user.accountStatus ?? 'active',
    user.deactivatedAt ?? '',
    user.role,
    user.roleLabel ?? '',
    (user.grantedPermissions ?? []).join(','),
    (user.revokedPermissions ?? []).join(','),
  ].join('|');
}

function createBlankBusinessState(owner?: { id?: string; email?: string; name?: string }, themePreference: BusinessState['themePreference'] = seedState.themePreference): BusinessState {
  const ownerId = owner?.id;

  return {
    ...seedState,
    businessProfile: {
      ...seedState.businessProfile,
      businessName: '',
      phone: '',
      email: owner?.email ?? '',
      address: '',
      website: '',
      launchedAt: undefined,
    },
    products: [],
    customers: [],
    vendors: [],
    purchases: [],
    accountsPayable: [],
    stockTransfers: [],
    payments: [],
    sales: [],
    quotations: [],
    expenses: [],
    stockMovements: [],
    customerLedgerEntries: [],
    activityLogEntries: [],
    notifications: [],
    restockRequests: [],
    users: ownerId
      ? [
          {
            userId: ownerId,
            name: owner?.name || owner?.email?.split('@')[0] || 'Business Owner',
            email: owner?.email ?? '',
            accountStatus: 'active',
            role: 'Admin',
            grantedPermissions: [],
            revokedPermissions: [],
          },
        ]
      : seedState.users,
    currentUserId: ownerId ?? seedState.currentUserId,
    themePreference,
  };
}

export function BusinessProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [state, setState] = useState<BusinessState>(readInitialState);
  const stateRef = useRef(state);
  const employeeCredentialSyncKeysRef = useRef(new Set<string>());
  const [backendStatus, setBackendStatus] = useState<BusinessBackendStatus>({
    source: 'local',
    loading: true,
    label: 'Checking Supabase',
    detail: 'BisaPilot is checking whether a backend business profile is available.',
  });

  // Immediate persistence to localStorage to prevent data loss during quick navigations
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const employeeUsers = state.users.filter((user) => user.temporaryPassword);
    window.localStorage.setItem(
      EMPLOYEE_CREDENTIALS_STORAGE_KEY,
      JSON.stringify({ users: employeeUsers })
    );
  }, [state.users]);

  useEffect(() => {
    const isLocalEmployeeSession = user?.user_metadata?.auth_mode === 'employee-local';
    if (backendStatus.source !== 'supabase' || backendStatus.loading || isLocalEmployeeSession) {
      return;
    }

    state.users
      .filter(shouldSyncEmployeeCredential)
      .forEach((employee) => {
        const syncKey = getEmployeeCredentialSyncKey(employee);
        if (employeeCredentialSyncKeysRef.current.has(syncKey)) {
          return;
        }

        employeeCredentialSyncKeysRef.current.add(syncKey);
        void syncEmployeeCredential(state.businessProfile.id, employee);
      });
  }, [backendStatus.loading, backendStatus.source, state.businessProfile.id, state.users, user?.user_metadata?.auth_mode]);

  useEffect(() => {
    const isLocalEmployeeSession = user?.user_metadata?.auth_mode === 'employee-local';
    if (!user?.id || isLocalEmployeeSession) {
      return;
    }

    setState((current) => {
      if (current.currentUserId === user.id && current.users.some((item) => item.userId === user.id)) {
        return current;
      }

      return createBlankBusinessState(
        {
          id: user.id,
          email: user.email,
          name:
            typeof user.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name
              : undefined,
        },
        current.themePreference
      );
    });
  }, [user?.id, user?.email, user?.user_metadata?.auth_mode, user?.user_metadata?.full_name]);

  useEffect(() => {
    const isLocalEmployeeSession = user?.user_metadata?.auth_mode === 'employee-local';
    if (isLocalEmployeeSession) {
      setBackendStatus({
        source: 'local',
        loading: false,
        label: 'Employee workspace ready',
        detail: 'Signed in with employee credentials for this workspace.',
      });
      return;
    }

    let cancelled = false;

    async function loadBackendProfile() {
      const result = await loadBusinessProfileFromSupabase(user?.id);

      if (cancelled) {
        return;
      }

      if (result.status === 'loaded') {
        const fullCloudData = await loadFullBusinessDataFromSupabase(result.profile.id);
        if (cancelled) return;

        setState((current) => {
          // 1. IDENTITY HANDSHAKE: Ensure owner is registered with Admin role
          const authenticatedId = user?.id || 'unknown';
          const alreadyExists = current.users.some(u => u.userId === authenticatedId);
          
          let updatedUsers = current.users;
          if (!alreadyExists && authenticatedId !== 'unknown') {
            updatedUsers = [...current.users, {
              userId: authenticatedId,
              name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Business Owner',
              email: user?.email || '',
              accountStatus: 'active',
              role: 'Admin' as const,
              grantedPermissions: [],
              revokedPermissions: [],
            }];
          }

          // 2. DATA MERGE: Non-destructive merge of cloud data over local state
          const mergedProfile = {
            ...result.profile,
            businessName: current.businessProfile.businessName || result.profile.businessName,
            phone: current.businessProfile.phone || result.profile.phone,
            email: current.businessProfile.email || result.profile.email,
            address: current.businessProfile.address || result.profile.address,
            website: current.businessProfile.website || result.profile.website,
            logoUrl: current.businessProfile.logoUrl || result.profile.logoUrl,
            signatureUrl: current.businessProfile.signatureUrl || result.profile.signatureUrl,
          };

          const cloudUsersById = new Map((fullCloudData.users ?? []).map((cloudUser) => [cloudUser.userId, cloudUser]));
          updatedUsers.forEach((localUser) => cloudUsersById.set(localUser.userId, localUser));

          return {
            ...current,
            users: Array.from(cloudUsersById.values()),
            currentUserId: authenticatedId,
            businessProfile: mergedProfile,
            locations: fullCloudData.locations ?? current.locations,
            locationSupplyRoutes: fullCloudData.locationSupplyRoutes ?? current.locationSupplyRoutes,
            products: fullCloudData.products ?? current.products,
            productCategories: fullCloudData.productCategories ?? current.productCategories,
            customers: fullCloudData.customers ?? current.customers,
            sales: fullCloudData.sales ?? current.sales,
            stockMovements: fullCloudData.stockMovements ?? current.stockMovements,
            expenses: fullCloudData.expenses ?? current.expenses,
          };
        });

        setBackendStatus({
          source: 'supabase',
          loading: false,
          label: 'Cloud workspace ready',
          detail: 'Your data has been synchronized and the demo workspace has been hidden.',
        });
        return;
      }

      setBackendStatus({
        source: 'local',
        loading: false,
        label: result.status === 'error' ? 'Using local profile' : 'Local profile active',
        detail: result.message,
      });
    }

    void loadBackendProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, user?.user_metadata?.auth_mode, user?.user_metadata?.full_name]);
  
  const currentUser = useMemo(() => {
    if (user?.id) {
      return (
        state.users.find((u) => u.userId === user.id && (u.accountStatus ?? 'active') !== 'deactivated') ||
        state.users.find((u) => (u.accountStatus ?? 'active') !== 'deactivated') ||
        state.users[0]
      );
    }

    return (
      state.users.find((u) => u.userId === state.currentUserId && (u.accountStatus ?? 'active') !== 'deactivated') ||
      state.users.find((u) => (u.accountStatus ?? 'active') !== 'deactivated') ||
      state.users[0]
    );
  }, [state.currentUserId, state.users, user?.id]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      state,
      backendStatus,
      priorityQuestions,
      addProduct(input) {
        if (!hasPermission(currentUser, 'inventory.create')) {
          return { ok: false, message: 'You are not authorized to add new products.' };
        }
        const currentState = stateRef.current;
        const result = addProductToState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not save the product right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        
        // Background Sync: Fire and forget to maintain UI speed
        const newProduct = result.data.products[0];
        if (newProduct) {
          void syncProduct(currentState.businessProfile.id, newProduct);
        }
        result.data.stockMovements
          .filter((movement) => !currentState.stockMovements.some((existing) => existing.id === movement.id))
          .forEach((movement) => {
            void syncStockMovement(currentState.businessProfile.id, movement);
          });

        return { ok: true };
      },
      addCustomer(input) {
        if (!hasPermission(currentUser, 'customers.create')) {
          return { ok: false, message: 'You are not authorized to add customers.' };
        }
        const result = addCustomerToState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not save the customer right now.' };
        }

        setState(result.data);

        // Background Sync
        const newCustomer = result.data.customers[0];
        if (newCustomer) {
          void syncCustomer(state.businessProfile.id, newCustomer);
        }

        return { ok: true };
      },
      updateCustomer(input) {
        if (!hasPermission(currentUser, 'customers.edit')) {
          return { ok: false, message: 'You are not authorized to edit customers.' };
        }
        const result = updateCustomerInState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the customer right now.' };
        }

        setState(result.data);

        const updatedCustomer = result.data.customers.find((customer) => customer.id === input.customerId);
        if (updatedCustomer) {
          void syncCustomer(state.businessProfile.id, updatedCustomer);
        }

        return { ok: true };
      },
      updateCustomerStatus(input) {
        if (!hasPermission(currentUser, 'customers.edit')) {
          return { ok: false, message: 'You are not authorized to manage customer accounts.' };
        }
        const result = updateCustomerStatusInState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the customer account status right now.' };
        }

        setState(result.data);

        const updatedCustomer = result.data.customers.find((customer) => customer.id === input.customerId);
        if (updatedCustomer) {
          void syncCustomer(state.businessProfile.id, updatedCustomer);
        }

        return { ok: true };
      },
      async updateBusinessProfile(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to update business settings.' };
        }
        const currentState = stateRef.current;
        const result = updateBusinessProfileInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update business settings right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessProfile(result.data.businessProfile);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Business settings could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async launchBusinessWorkspace(input = {}) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to launch this business.' };
        }

        const currentState = stateRef.current;
        const result = launchBusinessWorkspaceInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not launch the business right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessProfile(result.data.businessProfile);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Business launch could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      addQuotation(input) {
        if (!hasPermission(currentUser, 'quotations.create')) {
          return { ok: false, message: 'You are not authorized to create quotations.' };
        }
        const result = addQuotationToState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not save the quotation right now.' };
        }

        setState(result.data);

        const savedQuotation = result.data.quotations[0];
        if (savedQuotation) {
          void syncQuotation(state.businessProfile.id, savedQuotation);
        }

        return { ok: true };
      },
      convertQuotationToSale(input) {
        if (!hasPermission(currentUser, 'quotations.convert')) {
          return { ok: false, message: 'You are not authorized to convert quotations to sales.' };
        }
        const result = convertQuotationToSalesState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not convert the quotation right now.' };
        }

        const { data, receipts, quotationNumber } = result.data as ConvertQuotationResult;
        setState(data);

        const convertedQuotation = data.quotations.find((quotation) => quotation.id === input.quotationId);
        if (convertedQuotation) {
          void syncQuotation(state.businessProfile.id, convertedQuotation);
        }
        receipts.forEach((receipt) => {
          const convertedSale = data.sales.find((sale) => sale.id === receipt.id);
          if (convertedSale) {
            void syncSale(state.businessProfile.id, convertedSale);
          }
        });
        data.stockMovements
          .filter((movement) => !state.stockMovements.some((existing) => existing.id === movement.id))
          .forEach((movement) => {
            void syncStockMovement(state.businessProfile.id, movement);
          });

        return { ok: true, receipts: receipts.map(mapConvertedReceipt), quotationNumber };
      },
      reverseSale(input) {
        if (!hasPermission(currentUser, 'sales.reverse')) {
          return { ok: false, message: 'You are not authorized to reverse invoices.' };
        }
        const result = reverseSaleInState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not reverse the invoice right now.' };
        }

        const { data, reversedSale } = result.data as ReverseSaleResult;
        setState(data);

        // Background Sync: Sync the updated (reversed) sale
        void syncSale(state.businessProfile.id, reversedSale);
        result.data.data.stockMovements
          .filter((movement) => !state.stockMovements.some((existing) => existing.id === movement.id))
          .forEach((movement) => {
            void syncStockMovement(state.businessProfile.id, movement);
          });

        return { ok: true, reversedSaleId: reversedSale.id };
      },
      addSale(input) {
        if (!hasPermission(currentUser, 'sales.create')) {
          return { ok: false, message: 'You are not authorized to record sales.' };
        }
        
        const customer = state.customers.find((item) => item.id === input.customerId);
        if (!customer) {
           return { ok: false, message: 'Customer not found.' };
        }

        const result = addSaleToState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Receipt details could not be prepared right now.' };
        }

        const savedSale = result.data.sales[0];
        if (!savedSale) {
          return { ok: false, message: 'Receipt details could not be prepared right now.' };
        }

        const receipt: SaleReceipt = {
          id: savedSale.id,
          receiptId: savedSale.receiptId,
          createdAt: savedSale.createdAt,
          customerName: state.customers.find((c) => c.id === input.customerId)?.name || 'Customer',
          clientId: state.customers.find((c) => c.id === input.customerId)?.clientId || 'N/A',
          productName: savedSale.items.length > 1 
            ? `${savedSale.items.length} items (${savedSale.items[0].productName}...)`
            : savedSale.items[0]?.productName || 'Legacy Item',
          inventoryId: savedSale.items.length > 1 ? 'Multiple items' : savedSale.items[0]?.inventoryId || 'N/A',
          quantity: savedSale.quantity,
          unitPrice: savedSale.items.length > 1 ? 0 : savedSale.items[0]?.unitPrice || 0,
          totalAmount: savedSale.totalAmount,
          amountPaid: savedSale.paidAmount,
          balanceRemaining: selectSaleBalanceRemaining(savedSale),
          paymentMethod: savedSale.paymentMethod,
        };

        // Check for ANY item that went low stock
        let lowStockAlert: LowStockAlert | undefined;
        for (const item of savedSale.items || []) {
            const product = state.products.find(p => p.id === item.productId);
            if (!product) continue;

            const newQuantity = selectProductQuantityOnHand(result.data, product.id);
            const previouslyLow = selectProductQuantityOnHand(state, product.id) <= product.reorderLevel;
            const nowLow = newQuantity <= product.reorderLevel;

            if (!previouslyLow && nowLow) {
                lowStockAlert = {
                    productId: product.id,
                    name: product.name,
                    quantity: newQuantity,
                    reorderLevel: product.reorderLevel,
                };
                break; // Alert on the first one found
            }
        }

        setState(result.data);

        // Background Sync
        if (savedSale) {
          void syncSale(state.businessProfile.id, savedSale);
        }
        result.data.stockMovements
          .filter((movement) => !state.stockMovements.some((existing) => existing.id === movement.id))
          .forEach((movement) => {
            void syncStockMovement(state.businessProfile.id, movement);
          });

        return lowStockAlert ? { ok: true, receipt, lowStockAlert } : { ok: true, receipt };
      },
      currentUser,
      switchUser(userId) {
        if (user?.id) {
          return;
        }

        const targetUser = state.users.find((user) => user.userId === userId);
        if (!targetUser || (targetUser.accountStatus ?? 'active') === 'deactivated') {
          return;
        }
        setState(current => ({
          ...current,
          currentUserId: userId,
        }));
      },
      updateUserPermissions(userId, granted, revoked) {
        if (!hasPermission(currentUser, 'permissions.manage')) {
          return { ok: false, message: 'Only admins can manage permissions.' };
        }

        const targetUser = state.users.find((user) => user.userId === userId);
        if (!targetUser) {
          return { ok: false, message: 'Employee account not found.' };
        }

        const updatedUser = {
          ...targetUser,
          grantedPermissions: granted,
          revokedPermissions: revoked,
        };

        setState(current => ({
          ...current,
          users: current.users.map(u => u.userId === userId ? updatedUser : u)
        }));

        if (shouldSyncEmployeeCredential(updatedUser)) {
          void syncEmployeeCredential(state.businessProfile.id, updatedUser);
        }
        
        return { ok: true };
      },
      updateUserProfile(userId, profile) {
        const isSelf = currentUser.userId === userId;
        const isAdmin = hasPermission(currentUser, 'permissions.manage');

        if (!isSelf && !isAdmin) {
          return { ok: false, message: 'You are not authorized to update this profile.' };
        }

        // Non-admins can only update their own password or name, not email (identity)
        if (isSelf && !isAdmin && profile.email && profile.email !== currentUser.email) {
          return { ok: false, message: 'Only admins can change user email addresses.' };
        }

        if (!isAdmin && (profile.customerEmailSenderEmail || profile.customerEmailSenderName)) {
          return { ok: false, message: 'Only admins can assign customer email sender identities.' };
        }

        const targetUser = state.users.find((user) => user.userId === userId);
        const updatedUser = targetUser
          ? {
              ...targetUser,
              ...profile,
              username: profile.email ? buildEmployeeUsername(profile.email) : targetUser.username,
            }
          : undefined;

        setState(current => ({
          ...current,
          users: current.users.map(u => u.userId === userId ? {
            ...u,
            ...profile,
            username: profile.email ? buildEmployeeUsername(profile.email) : u.username,
          } : u)
        }));

        if (updatedUser && shouldSyncEmployeeCredential(updatedUser)) {
          void syncEmployeeCredential(state.businessProfile.id, updatedUser);
        }

        return { ok: true };
      },
      addUserAccount(input) {
        if (!hasPermission(currentUser, 'permissions.manage')) {
          return { ok: false, message: 'Only admins can add employee accounts.' };
        }

        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        if (!name) {
          return { ok: false, message: 'Employee name is required.' };
        }

        if (!email) {
          return { ok: false, message: 'Employee email is required.' };
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { ok: false, message: 'Employee email is invalid.' };
        }

        if (state.users.some((user) => user.email.trim().toLowerCase() === email)) {
          return { ok: false, message: 'Another user already uses that email address.' };
        }

        const nextUserId = `u-${input.role.toLowerCase()}-${Date.now().toString(36)}`;
        const username = buildEmployeeUsername(email);
        const temporaryPassword = generateTemporaryPassword();
        const credentialsGeneratedAt = new Date().toISOString();
        const createdUser: UserAccessProfile = {
          userId: nextUserId,
          name,
          email,
          username,
          temporaryPassword,
          credentialsGeneratedAt,
          accountStatus: 'active',
          roleLabel: input.roleLabel?.trim() || undefined,
          role: input.role,
          grantedPermissions: input.grantedPermissions ?? [],
          revokedPermissions: input.revokedPermissions ?? [],
        };

        setState((current) => ({
          ...current,
          users: [
            ...current.users,
            createdUser,
          ],
        }));

        void syncEmployeeCredential(state.businessProfile.id, createdUser);

        return { ok: true, data: { username, temporaryPassword } };
      },
      resetEmployeeTemporaryPassword(userId) {
        if (!hasPermission(currentUser, 'permissions.manage')) {
          return { ok: false, message: 'Only admins can create temporary passwords for employees.' };
        }

        const targetUser = state.users.find((user) => user.userId === userId);
        if (!targetUser) {
          return { ok: false, message: 'Employee account not found.' };
        }

        if ((targetUser.accountStatus ?? 'active') !== 'active') {
          return { ok: false, message: 'Reactivate this employee account before creating a temporary password.' };
        }

        const username = buildEmployeeUsername(targetUser.email);
        const temporaryPassword = generateTemporaryPassword();
        const credentialsGeneratedAt = new Date().toISOString();
        const updatedUser: UserAccessProfile = {
          ...targetUser,
          username,
          temporaryPassword,
          credentialsGeneratedAt,
        };

        setState((current) => ({
          ...current,
          users: current.users.map((user) =>
            user.userId === userId
              ? updatedUser
              : user
          ),
        }));

        void syncEmployeeCredential(state.businessProfile.id, updatedUser);

        return { ok: true, data: { username, temporaryPassword } };
      },
      updateEmployeeAccount(input) {
        if (!hasPermission(currentUser, 'permissions.manage')) {
          return { ok: false, message: 'Only admins can manage employee accounts.' };
        }

        const targetUser = state.users.find((user) => user.userId === input.userId);
        if (!targetUser) {
          return { ok: false, message: 'Employee account not found.' };
        }

        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        const roleLabel = input.roleLabel?.trim() || undefined;

        if (!name) {
          return { ok: false, message: 'Employee name is required.' };
        }

        if (!email) {
          return { ok: false, message: 'Employee email is required.' };
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { ok: false, message: 'Employee email is invalid.' };
        }

        if (state.users.some((user) => user.userId !== input.userId && user.email.trim().toLowerCase() === email)) {
          return { ok: false, message: 'Another user already uses that email address.' };
        }

        if (input.accountStatus === 'deactivated' && input.userId === currentUser.userId) {
          return { ok: false, message: 'You cannot deactivate your own admin account.' };
        }

        const activeAdminsAfterChange = state.users.filter((user) => {
          if (user.userId === input.userId) {
            return input.role === 'Admin' && input.accountStatus === 'active';
          }

          return user.role === 'Admin' && (user.accountStatus ?? 'active') === 'active';
        }).length;

        if (activeAdminsAfterChange === 0) {
          return { ok: false, message: 'At least one active admin account must remain in the workspace.' };
        }

        const updatedUser: UserAccessProfile = {
          ...targetUser,
          name,
          email,
          role: input.role,
          username: buildEmployeeUsername(email),
          roleLabel,
          grantedPermissions: input.grantedPermissions,
          revokedPermissions: input.revokedPermissions,
          accountStatus: input.accountStatus,
          deactivatedAt:
            input.accountStatus === 'deactivated'
              ? targetUser.deactivatedAt ?? new Date().toISOString()
              : undefined,
        };

        setState((current) => {
          const nextUsers = current.users.map((user) => {
            if (user.userId !== input.userId) {
              return user;
            }

            return updatedUser;
          });

          const fallbackActiveUserId =
            nextUsers.find((user) => (user.accountStatus ?? 'active') === 'active')?.userId ??
            current.currentUserId;

          return {
            ...current,
            users: nextUsers,
            currentUserId:
              current.currentUserId === input.userId && input.accountStatus === 'deactivated'
                ? fallbackActiveUserId
                : current.currentUserId,
          };
        });

        void syncEmployeeCredential(state.businessProfile.id, updatedUser);

        return { ok: true };
      },
      addRestockRequest(input) {
        if (!hasPermission(currentUser, 'restockRequests.create')) {
          return { ok: false, message: 'You are not authorized to create restock requests.' };
        }
        const result = addRestockRequestToState(state, input);
        if (!result.ok) return result;
        if (!result.data) return { ok: false, message: 'Action failed to update state.' };
        setState(result.data);
        return { ok: true };
      },
      reviewRestockRequest(input) {
        if (!hasPermission(currentUser, 'restockRequests.manage')) {
          return { ok: false, message: 'You are not authorized to manage restock requests.' };
        }
        const result = reviewRestockRequestInState(state, input);
        if (!result.ok) return result;
        if (!result.data) return { ok: false, message: 'Review failed to update state.' };
        setState(result.data);
        return { ok: true };
      },
      async updateBranding(input) {
        if (!hasPermission(currentUser, 'branding.manage')) {
          return { ok: false, message: 'You are not authorized to manage branding.' };
        }
        const currentState = stateRef.current;
        const result = updateBrandingInState(currentState, input);
        if (!result.ok) return result;
        if (!result.data) return { ok: false, message: 'Update failed to update state.' };

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessProfile(result.data.businessProfile);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Branding could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      hasPermission(permission) {
        return hasPermission(currentUser, permission);
      },
      addExpense(input) {
        if (!hasPermission(currentUser, 'accounting.access') || !hasPermission(currentUser, 'expenses.create')) {
          return { ok: false, message: 'You are not authorized to record expenses.' };
        }
        const result = addExpenseToState(state, input);
        if (!result.ok) return result;
        if (!result.data) return { ok: false, message: 'Failed to update state with expense.' };
        setState(result.data);

        // Background Sync
        const newExpense = result.data.expenses[0];
        if (newExpense) {
          void syncExpense(state.businessProfile.id, newExpense);
        }

        return { ok: true };
      },
      updateThemePreference(theme) {
        setState((prev) => ({ ...prev, themePreference: theme }));
      },
      async createProductCategory(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage product categories.' };
        }

        const currentState = stateRef.current;
        const result = createProductCategoryInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the category right now.' };
        }

        const createdCategory = result.data.productCategories[result.data.productCategories.length - 1];
        if (!createdCategory) {
          return { ok: false, message: 'Could not create the category right now.' };
        }

        const syncOk = await syncProductCategory(currentState.businessProfile.id, createdCategory);
        if (!syncOk) {
          return { ok: false, message: getCloudSaveMessage('Category could not be saved to the cloud right now.') };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async updateProductCategory(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage product categories.' };
        }

        const currentState = stateRef.current;
        const result = updateProductCategoryInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the category right now.' };
        }

        const updatedCategory = result.data.productCategories.find((category) => category.id === input.categoryId);
        if (!updatedCategory) {
          return { ok: false, message: 'Could not update the category right now.' };
        }

        const syncOk = await syncProductCategory(currentState.businessProfile.id, updatedCategory);
        if (!syncOk) {
          return { ok: false, message: getCloudSaveMessage('Category changes could not be saved to the cloud right now.') };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async setProductCategoryActive(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage product categories.' };
        }

        const currentState = stateRef.current;
        const result = setProductCategoryActiveInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the category status right now.' };
        }

        const updatedCategory = result.data.productCategories.find((category) => category.id === input.categoryId);
        if (!updatedCategory) {
          return { ok: false, message: 'Could not update the category status right now.' };
        }

        const syncOk = await syncProductCategory(currentState.businessProfile.id, updatedCategory);
        if (!syncOk) {
          return { ok: false, message: getCloudSaveMessage('Category status could not be saved to the cloud right now.') };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async setInventoryCategoriesEnabled(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage product categories.' };
        }

        const currentState = stateRef.current;
        const result = setInventoryCategoriesEnabledInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the inventory category setting right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessProfile(result.data.businessProfile);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Inventory category setting could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async createBusinessLocation(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage locations.' };
        }

        const currentState = stateRef.current;
        const result = createBusinessLocationInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the location right now.' };
        }

        const createdLocation = result.data.locations.find((location) =>
          !currentState.locations.some((existing) => existing.id === location.id)
        );
        if (!createdLocation) {
          return { ok: false, message: 'Could not create the location right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessLocation(currentState.businessProfile.id, createdLocation);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Location could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async updateBusinessLocation(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage locations.' };
        }

        const currentState = stateRef.current;
        const result = updateBusinessLocationInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the location right now.' };
        }

        const changedLocations = result.data.locations.filter((location) => {
          const existing = currentState.locations.find((item) => item.id === location.id);
          return !existing ||
            existing.name !== location.name ||
            existing.type !== location.type ||
            existing.isDefault !== location.isDefault ||
            existing.isActive !== location.isActive;
        });
        stateRef.current = result.data;
        setState(result.data);
        const syncResults = await Promise.all(changedLocations.map((location) =>
          syncBusinessLocation(currentState.businessProfile.id, location)
        ));
        if (syncResults.some((ok) => !ok)) {
          return { ok: true, message: buildLocalSaveWarning('Location changes could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async createSupplyRoute(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage supply routes.' };
        }

        const currentState = stateRef.current;
        const result = createSupplyRouteInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the supply route right now.' };
        }

        const createdRoute = result.data.locationSupplyRoutes.find((route) =>
          !currentState.locationSupplyRoutes.some((existing) => existing.id === route.id)
        );
        if (!createdRoute) {
          return { ok: false, message: 'Could not create the supply route right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncSupplyRoute(currentState.businessProfile.id, createdRoute);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Supply route could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async setSupplyRouteActive(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage supply routes.' };
        }

        const currentState = stateRef.current;
        const result = setSupplyRouteActiveInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the supply route right now.' };
        }

        const changedRoute = result.data.locationSupplyRoutes.find((route) => route.id === input.routeId);
        if (!changedRoute) {
          return { ok: false, message: 'Could not update the supply route right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncSupplyRoute(currentState.businessProfile.id, changedRoute);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Supply route change could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async createVendor(input) {
        if (!hasPermission(currentUser, 'vendors.manage')) {
          return { ok: false, message: 'You are not authorized to manage vendors.' };
        }

        const currentState = stateRef.current;
        const result = createVendorInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the vendor right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async updateVendor(input) {
        if (!hasPermission(currentUser, 'vendors.manage')) {
          return { ok: false, message: 'You are not authorized to manage vendors.' };
        }

        const currentState = stateRef.current;
        const result = updateVendorInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the vendor right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async setVendorStatus(input) {
        if (!hasPermission(currentUser, 'vendors.manage')) {
          return { ok: false, message: 'You are not authorized to manage vendors.' };
        }

        const currentState = stateRef.current;
        const result = setVendorStatusInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update vendor status right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async createPurchaseDraft(input) {
        if (!hasPermission(currentUser, 'purchases.create')) {
          return { ok: false, message: 'You are not authorized to create purchases.' };
        }

        const currentState = stateRef.current;
        const result = createPurchaseDraftInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the purchase draft right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async submitPurchase(input) {
        if (!hasPermission(currentUser, 'purchases.create')) {
          return { ok: false, message: 'You are not authorized to submit purchases.' };
        }

        const currentState = stateRef.current;
        const result = submitPurchaseInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not submit the purchase right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async approvePurchase(input) {
        if (currentUser.role !== 'Admin' || !hasPermission(currentUser, 'purchases.approve')) {
          return { ok: false, message: 'You are not authorized to approve purchases.' };
        }

        const currentState = stateRef.current;
        const result = approvePurchaseInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not approve the purchase right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async cancelPurchase(input) {
        if (currentUser.role !== 'Admin' || !hasPermission(currentUser, 'purchases.approve')) {
          return { ok: false, message: 'You are not authorized to decline purchases.' };
        }

        const currentState = stateRef.current;
        const result = cancelPurchaseInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not cancel the purchase right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async receivePurchaseInWarehouse(input) {
        if (!hasPermission(currentUser, 'purchases.receive')) {
          return { ok: false, message: 'You are not authorized to receive purchases into warehouse.' };
        }

        const currentState = stateRef.current;
        const result = receivePurchaseInWarehouseInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not receive the purchase right now.' };
        }

        const newMovements = result.data.stockMovements.filter((movement) =>
          !currentState.stockMovements.some((existing) => existing.id === movement.id)
        );
        const syncResults = await Promise.all(newMovements.map((movement) =>
          syncStockMovement(currentState.businessProfile.id, movement)
        ));
        if (syncResults.some((ok) => !ok)) {
          return { ok: false, message: getCloudSaveMessage('Purchase receipt could not be saved to the cloud right now.') };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async createPayableFromPurchase(input) {
        if (!hasPermission(currentUser, 'payables.manage')) {
          return { ok: false, message: 'You are not authorized to create payables.' };
        }

        const currentState = stateRef.current;
        const result = createPayableFromPurchaseInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the payable right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async approvePayable(input) {
        if (!hasPermission(currentUser, 'payables.manage') && !hasPermission(currentUser, 'payables.approve')) {
          return { ok: false, message: 'You are not authorized to approve payables.' };
        }

        const currentState = stateRef.current;
        const result = approvePayableInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not approve the payable right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async recordPayablePayment(input) {
        if (!hasPermission(currentUser, 'payables.pay')) {
          return { ok: false, message: 'You are not authorized to record payable payments.' };
        }

        const currentState = stateRef.current;
        const result = recordPayablePaymentInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not record the payable payment right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async transferStock(input) {
        if (!hasPermission(currentUser, 'transfers.create')) {
          return { ok: false, message: 'You are not authorized to transfer stock.' };
        }

        const currentState = stateRef.current;
        const result = transferStockInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not transfer stock right now.' };
        }

        const newMovements = result.data.stockMovements.filter((movement) =>
          !currentState.stockMovements.some((existing) => existing.id === movement.id)
        );
        const syncResults = await Promise.all(newMovements.map((movement) =>
          syncStockMovement(currentState.businessProfile.id, movement)
        ));
        if (syncResults.some((ok) => !ok)) {
          return { ok: false, message: getCloudSaveMessage('Transfer could not be saved to the cloud right now.') };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async createStockTransfer(input) {
        if (!hasPermission(currentUser, 'transfers.create')) {
          return { ok: false, message: 'You are not authorized to create stock transfers.' };
        }

        const currentState = stateRef.current;
        const result = createStockTransferInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not create the stock transfer right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async approveStockTransfer(input) {
        if (!hasPermission(currentUser, 'transfers.approve')) {
          return { ok: false, message: 'You are not authorized to approve stock transfers.' };
        }

        const currentState = stateRef.current;
        const result = approveStockTransferInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not approve the stock transfer right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async dispatchStockTransfer(input) {
        if (!hasPermission(currentUser, 'transfers.dispatch')) {
          return { ok: false, message: 'You are not authorized to dispatch stock transfers.' };
        }

        const currentState = stateRef.current;
        const result = dispatchStockTransferInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not dispatch the stock transfer right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async receiveStockTransfer(input) {
        if (!hasPermission(currentUser, 'transfers.receive')) {
          return { ok: false, message: 'You are not authorized to receive stock transfers.' };
        }

        const currentState = stateRef.current;
        const result = receiveStockTransferInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not receive the stock transfer right now.' };
        }

        const newMovements = result.data.stockMovements.filter((movement) =>
          !currentState.stockMovements.some((existing) => existing.id === movement.id)
        );
        const syncResults = await Promise.all(newMovements.map((movement) =>
          syncStockMovement(currentState.businessProfile.id, movement)
        ));
        if (syncResults.some((ok) => !ok)) {
          return { ok: false, message: getCloudSaveMessage('Transfer receipt could not be saved to the cloud right now.') };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async cancelStockTransfer(input) {
        if (!hasPermission(currentUser, 'transfers.approve')) {
          return { ok: false, message: 'You are not authorized to cancel stock transfers.' };
        }

        const currentState = stateRef.current;
        const result = cancelStockTransferInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not cancel the stock transfer right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        return { ok: true };
      },
      async setCustomerClassificationEnabled(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage customer classification.' };
        }

        const currentState = stateRef.current;
        const result = setCustomerClassificationEnabledInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update the customer classification setting right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessProfile(result.data.businessProfile);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Customer classification setting could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
      async setBusinessTaxSettings(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to manage tax settings.' };
        }

        const currentState = stateRef.current;
        const result = setBusinessTaxSettingsInState(currentState, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update tax settings right now.' };
        }

        stateRef.current = result.data;
        setState(result.data);
        const syncOk = await syncBusinessProfile(result.data.businessProfile);
        if (!syncOk) {
          return { ok: true, message: buildLocalSaveWarning('Tax settings could not be saved to the cloud right now.') };
        }

        return { ok: true };
      },
    }),
    [backendStatus, state, currentUser, user?.id]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export { useBusiness };
