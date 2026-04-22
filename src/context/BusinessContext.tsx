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
} from '../utils/businessLogic';
import { syncProduct, syncCustomer, syncSale, syncExpense, syncBusinessProfile } from '../data/supabaseSync';
import { selectProductQuantityOnHand, selectSaleBalanceRemaining } from '../selectors/businessSelectors';
import { AppPermission, AppRole, UserAccessProfile } from '../authz/types';
import { hasPermission } from '../authz/permissions';

const STORAGE_KEY = 'bizpilot-gh-state-v1';

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
  updateBusinessProfile: (input: UpdateBusinessProfileInput) => ActionResult;
  addQuotation: (input: NewQuotationInput) => ActionResult;
  convertQuotationToSale: (input: ConvertQuotationInput) => ConvertQuotationToSaleResult;
  reverseSale: (input: ReverseSaleInput) => ReverseSaleContextResult;
  addSale: (input: NewSaleInput) => AddSaleResult;
  currentUser: UserAccessProfile;
  switchUser: (userId: string) => void;
  updateUserPermissions: (userId: string, granted: AppPermission[], revoked: AppPermission[]) => ActionResult;
  updateUserProfile: (userId: string, profile: Partial<Pick<UserAccessProfile, 'email' | 'password' | 'name' | 'customerEmailSenderName' | 'customerEmailSenderEmail'>>) => ActionResult;
  addUserAccount: (input: { name: string; email: string; password: string; role: AppRole; roleLabel?: string; grantedPermissions?: AppPermission[]; revokedPermissions?: AppPermission[] }) => ActionResult;
  updateEmployeeAccount: (input: {
    userId: string;
    name: string;
    email: string;
    password?: string;
    role: AppRole;
    roleLabel?: string;
    grantedPermissions: AppPermission[];
    revokedPermissions: AppPermission[];
    accountStatus: 'active' | 'deactivated';
  }) => ActionResult;
  addRestockRequest: (input: NewRestockRequestInput) => ActionResult;
  reviewRestockRequest: (input: ReviewRestockRequestInput) => ActionResult;
  updateBranding: (input: { logoUrl?: string; signatureUrl?: string }) => ActionResult;
  hasPermission: (permission: AppPermission) => boolean;
  addExpense: (input: NewExpenseInput) => ActionResult;
  updateThemePreference: (theme: 'system' | 'light' | 'dark') => void;
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

  // If no stored state, check if we're authenticated. 
  // If we have a session, we should stay 'clean' and wait for cloud load.
  const hasSession = !!window.localStorage.getItem('bizpilot-local-session');
  if (hasSession) {
    return {
      ...seedState,
      businessProfile: { ...seedState.businessProfile, businessName: '', phone: '' },
      products: [],
      customers: [],
      sales: [],
      expenses: [],
      stockMovements: [],
      customerLedgerEntries: [],
      activityLogEntries: [],
      restockRequests: [],
    };
  }

  return seedState;
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
    },
    products: [],
    customers: [],
    sales: [],
    quotations: [],
    expenses: [],
    stockMovements: [],
    customerLedgerEntries: [],
    activityLogEntries: [],
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
    if (!user?.id || user.id.startsWith('u-')) {
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
  }, [user?.id, user?.email, user?.user_metadata?.full_name]);

  useEffect(() => {
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

          return {
            ...current,
            users: updatedUsers,
            currentUserId: authenticatedId,
            businessProfile: mergedProfile,
            products: fullCloudData.products?.length ? fullCloudData.products : current.products,
            customers: fullCloudData.customers?.length ? fullCloudData.customers : current.customers,
            sales: fullCloudData.sales?.length ? fullCloudData.sales : current.sales,
            expenses: fullCloudData.expenses?.length ? fullCloudData.expenses : current.expenses,
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
  }, [user?.id]);
  
  const currentUser = useMemo(() => {
    return (
      state.users.find((u) => u.userId === state.currentUserId && (u.accountStatus ?? 'active') !== 'deactivated') ||
      state.users.find((u) => (u.accountStatus ?? 'active') !== 'deactivated') ||
      state.users[0]
    );
  }, [state.currentUserId, state.users]);

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
      updateBusinessProfile(input) {
        if (!hasPermission(currentUser, 'business.edit')) {
          return { ok: false, message: 'You are not authorized to update business settings.' };
        }
        console.log('[DEBUG-CONTEXT-ACTION] updateBusinessProfile called with:', input.businessName);
        const result = updateBusinessProfileInState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update business settings right now.' };
        }

        console.log('[DEBUG-CONTEXT-ACTION] State result OK. Updating state...');
        setState(result.data);
        void syncBusinessProfile(result.data.businessProfile);
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

        return lowStockAlert ? { ok: true, receipt, lowStockAlert } : { ok: true, receipt };
      },
      currentUser,
      switchUser(userId) {
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
        
        setState(current => ({
          ...current,
          users: current.users.map(u => u.userId === userId ? {
            ...u,
            grantedPermissions: granted,
            revokedPermissions: revoked,
          } : u)
        }));
        
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

        setState(current => ({
          ...current,
          users: current.users.map(u => u.userId === userId ? {
            ...u,
            ...profile,
          } : u)
        }));

        return { ok: true };
      },
      addUserAccount(input) {
        if (!hasPermission(currentUser, 'permissions.manage')) {
          return { ok: false, message: 'Only admins can add employee accounts.' };
        }

        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        const password = input.password.trim();

        if (!name) {
          return { ok: false, message: 'Employee name is required.' };
        }

        if (!email) {
          return { ok: false, message: 'Employee email is required.' };
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return { ok: false, message: 'Employee email is invalid.' };
        }

        if (!password) {
          return { ok: false, message: 'Employee password is required.' };
        }

        if (state.users.some((user) => user.email.trim().toLowerCase() === email)) {
          return { ok: false, message: 'Another user already uses that email address.' };
        }

        const nextUserId = `u-${input.role.toLowerCase()}-${Date.now().toString(36)}`;

        setState((current) => ({
          ...current,
          users: [
            ...current.users,
            {
              userId: nextUserId,
              name,
              email,
              password,
              accountStatus: 'active',
              roleLabel: input.roleLabel?.trim() || undefined,
              role: input.role,
              grantedPermissions: input.grantedPermissions ?? [],
              revokedPermissions: input.revokedPermissions ?? [],
            },
          ],
        }));

        return { ok: true };
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

        setState((current) => {
          const nextUsers = current.users.map((user) => {
            if (user.userId !== input.userId) {
              return user;
            }

            const nextPassword = input.password?.trim();

            return {
              ...user,
              name,
              email,
              password: nextPassword ? nextPassword : user.password,
              role: input.role,
              roleLabel,
              grantedPermissions: input.grantedPermissions,
              revokedPermissions: input.revokedPermissions,
              accountStatus: input.accountStatus,
              deactivatedAt:
                input.accountStatus === 'deactivated'
                  ? user.deactivatedAt ?? new Date().toISOString()
                  : undefined,
            };
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
      updateBranding(input) {
        if (!hasPermission(currentUser, 'branding.manage')) {
          return { ok: false, message: 'You are not authorized to manage branding.' };
        }
        const result = updateBrandingInState(state, input);
        if (!result.ok) return result;
        if (!result.data) return { ok: false, message: 'Update failed to update state.' };
        setState(result.data);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
        }
        void syncBusinessProfile(result.data.businessProfile);
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
    }),
    [backendStatus, state, currentUser]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export { useBusiness };
