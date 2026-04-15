import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';
import { BusinessState, priorityQuestions, seedState } from '../data/seedBusiness';
import { loadBusinessProfileFromSupabase } from '../data/supabaseBusinessProfile';
import {
  ActionResult,
  addCustomerToState,
  addProductToState,
  addQuotationToState,
  addSaleToState,
  convertQuotationToSalesState,
  ConvertQuotationInput,
  ConvertQuotationResult,
  NewCustomerInput,
  NewProductInput,
  NewQuotationInput,
  NewSaleInput,
  restoreBusinessState,
  reverseSaleInState,
  ReverseSaleInput,
  ReverseSaleResult,
  updateBusinessProfileInState,
  UpdateBusinessProfileInput,
} from '../utils/businessLogic';
import { selectProductQuantityOnHand } from '../selectors/businessSelectors';

const STORAGE_KEY = 'bizpilot-gh-state-v1';

type LowStockAlert = {
  productId: string;
  name: string;
  quantity: number;
  reorderLevel: number;
};

type SaleReceipt = {
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
};

type AddSaleResult =
  | { ok: true; receipt: SaleReceipt; lowStockAlert?: LowStockAlert }
  | { ok: false; message: string };

type ConvertQuotationToSaleResult =
  | { ok: true; receipts: SaleReceipt[]; quotationNumber: string }
  | { ok: false; message: string };

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
  updateBusinessProfile: (input: UpdateBusinessProfileInput) => ActionResult;
  addQuotation: (input: NewQuotationInput) => ActionResult;
  convertQuotationToSale: (input: ConvertQuotationInput) => ConvertQuotationToSaleResult;
  reverseSale: (input: ReverseSaleInput) => ReverseSaleContextResult;
  addSale: (input: NewSaleInput) => AddSaleResult;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

function readInitialState(): BusinessState {
  if (typeof window === 'undefined') {
    return seedState;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return seedState;
  }

  try {
    return restoreBusinessState(JSON.parse(stored) as BusinessState);
  } catch {
    return seedState;
  }
}

export function BusinessProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [state, setState] = useState<BusinessState>(readInitialState);
  const [backendStatus, setBackendStatus] = useState<BusinessBackendStatus>({
    source: 'local',
    loading: true,
    label: 'Checking Supabase',
    detail: 'BizPilot is checking whether a backend business profile is available.',
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendProfile() {
      const result = await loadBusinessProfileFromSupabase(user?.id);

      if (cancelled) {
        return;
      }

      if (result.status === 'loaded') {
        setState((current) => ({
          ...current,
          businessProfile: result.profile,
        }));
        setBackendStatus({
          source: 'supabase',
          loading: false,
          label: 'Supabase profile loaded',
          detail: result.message,
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

  const value = useMemo<BusinessContextValue>(
    () => ({
      state,
      backendStatus,
      priorityQuestions,
      addProduct(input) {
        const result = addProductToState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not save the product right now.' };
        }

        setState(result.data);
        return { ok: true };
      },
      addCustomer(input) {
        const result = addCustomerToState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not save the customer right now.' };
        }

        setState(result.data);
        return { ok: true };
      },
      updateBusinessProfile(input) {
        const result = updateBusinessProfileInState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not update business settings right now.' };
        }

        setState(result.data);
        return { ok: true };
      },
      addQuotation(input) {
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
        const result = convertQuotationToSalesState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not convert the quotation right now.' };
        }

        const { data, receipts, quotationNumber } = result.data as ConvertQuotationResult;
        setState(data);
        return { ok: true, receipts, quotationNumber };
      },
      reverseSale(input) {
        const result = reverseSaleInState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not reverse the invoice right now.' };
        }

        const { data, reversedSale } = result.data as ReverseSaleResult;
        setState(data);
        return { ok: true, reversedSaleId: reversedSale.id };
      },
      addSale(input) {
        const product = state.products.find((item) => item.id === input.productId);
        const customer = state.customers.find((item) => item.id === input.customerId);
        const result = addSaleToState(state, input);
        if (!result.ok) {
          return result;
        }
        if (!result.data) {
          return { ok: false, message: 'Could not record the sale right now.' };
        }
        const savedSale = result.data.sales[0];

        if (!product || !customer || !savedSale) {
          return { ok: false, message: 'Receipt details could not be prepared right now.' };
        }

        const newQuantity = selectProductQuantityOnHand(result.data, product.id);
        const previouslyLow = selectProductQuantityOnHand(state, product.id) <= product.reorderLevel;
        const nowLow = newQuantity <= product.reorderLevel;
        const lowStockAlert = !previouslyLow && nowLow
          ? {
              productId: product.id,
              name: product.name,
              quantity: newQuantity,
              reorderLevel: product.reorderLevel,
            }
          : undefined;

        setState(result.data);

        const receipt: SaleReceipt = {
          receiptId: savedSale.receiptId,
          createdAt: savedSale.createdAt,
          customerName: customer.name,
          clientId: customer.clientId,
          productName: product.name,
          inventoryId: product.inventoryId,
          quantity: savedSale.quantity,
          unitPrice: product.price,
          totalAmount: savedSale.totalAmount,
          amountPaid: savedSale.paidAmount,
          balanceRemaining: Math.max(0, savedSale.totalAmount - savedSale.paidAmount),
          paymentMethod: savedSale.paymentMethod,
        };

        return lowStockAlert ? { ok: true, receipt, lowStockAlert } : { ok: true, receipt };
      },
    }),
    [backendStatus, state]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusiness() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error('useBusiness must be used inside BusinessProvider');
  }

  return context;
}
