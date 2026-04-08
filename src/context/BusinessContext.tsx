import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { BusinessState, PaymentMethod, Product, Sale, priorityQuestions, seedState } from '../data/seedBusiness';
import { nextInventoryId } from '../utils/businessIds';
import { createProductImage } from '../utils/productArtwork';

const STORAGE_KEY = 'bizpilot-gh-state-v1';

type NewSaleInput = {
  customerId: string;
  productId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
};

type BusinessContextValue = {
  state: BusinessState;
  priorityQuestions: string[];
  addProduct: (input: Omit<Product, 'id' | 'image'>) => void;
  addSale: (input: NewSaleInput) => { ok: true } | { ok: false; message: string };
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
    const parsed = JSON.parse(stored) as BusinessState;

    return {
      ...parsed,
      products: parsed.products.map((product, index) => ({
        ...product,
        inventoryId: product.inventoryId ?? `INV-${String(index + 1).padStart(3, '0')}`,
      })),
      customers: parsed.customers.map((customer, index) => ({
        ...customer,
        clientId: customer.clientId ?? `CLT-${String(index + 1).padStart(3, '0')}`,
      })),
    };
  } catch {
    return seedState;
  }
}

export function BusinessProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BusinessState>(readInitialState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      state,
      priorityQuestions,
      addProduct(input) {
        setState((current) => ({
          ...current,
          products: [
            {
              ...input,
              id: `p${crypto.randomUUID()}`,
              inventoryId: nextInventoryId(current.products),
              image: createProductImage(input.name),
            },
            ...current.products,
          ],
        }));
      },
      addSale(input) {
        const product = state.products.find((item) => item.id === input.productId);
        const customer = state.customers.find((item) => item.id === input.customerId);

        if (!product || !customer) {
          return { ok: false, message: 'Choose a valid product and customer.' };
        }

        if (input.quantity <= 0) {
          return { ok: false, message: 'Quantity must be at least 1.' };
        }

        if (input.quantity > product.quantity) {
          return { ok: false, message: 'Not enough stock available for that sale.' };
        }

        const totalAmount = product.price * input.quantity;
        if (input.paidAmount < 0 || input.paidAmount > totalAmount) {
          return { ok: false, message: 'Paid amount must be between 0 and the total sale value.' };
        }

        const createdAt = new Date().toISOString();
        const sale: Sale = {
          id: `s${crypto.randomUUID()}`,
          customerId: input.customerId,
          productId: input.productId,
          quantity: input.quantity,
          paymentMethod: input.paymentMethod,
          paidAmount: input.paidAmount,
          totalAmount,
          createdAt,
        };

        setState((current) => ({
          products: current.products.map((item) =>
            item.id === input.productId ? { ...item, quantity: item.quantity - input.quantity } : item
          ),
          customers: current.customers.map((item) =>
            item.id === input.customerId
              ? {
                  ...item,
                  balance: Math.max(0, item.balance + totalAmount - input.paidAmount),
                  lastPayment:
                    input.paidAmount > 0
                      ? `Today, ${input.paymentMethod === 'Cash' ? 'Cash' : 'MoMo'}`
                      : item.lastPayment,
                }
              : item
          ),
          sales: [sale, ...current.sales],
        }));

        return { ok: true };
      },
    }),
    [state]
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
