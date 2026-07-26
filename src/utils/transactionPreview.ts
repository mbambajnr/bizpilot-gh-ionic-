import type { BusinessState } from '../data/seedBusiness';
import { selectProductQuantityOnHand } from '../selectors/businessSelectors';
import {
  buildTaxSnapshot,
  calculateTaxTotals,
  isAccountingPeriodClosed,
  selectCustomerOutstanding,
} from './businessLogic';

/**
 * Transaction impact preview: what a sale WOULD do to stock, receivables, and the customer's credit
 * before it is posted. Pure and read-only — it mirrors the guards and tax math in `addSaleToState`
 * without mutating state, so the composer can show the effect (and any blockers) up front. Keeping the
 * math in one selector means the preview and the actual posting cannot drift apart silently.
 */

export type SaleImpactDraft = {
  customerId?: string;
  /** Name used for a walk-in (unregistered) customer. */
  walkInName?: string;
  items: { productId: string; quantity: number }[];
  locationId?: string;
  paidAmount: number;
  taxExempt?: boolean;
  createdAt?: string;
};

export type SaleImpactItem = {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stockBefore: number;
  stockAfter: number;
  belowReorderAfter: boolean;
  insufficient: boolean;
};

export type SaleImpactCustomer = {
  name: string;
  registered: boolean;
  balanceBefore: number;
  balanceAfter: number;
  creditLimit?: number;
  overLimitAfter: boolean;
};

export type SaleImpact = {
  items: SaleImpactItem[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balanceDue: number;
  hasTax: boolean;
  customer: SaleImpactCustomer | null;
  /** Conditions that would stop `addSaleToState` from posting this sale. */
  blockers: string[];
  /** Advisory effects that do not block posting (e.g. a product dropping to its reorder level). */
  notices: string[];
  canPost: boolean;
};

/** Compute the effect of `draft` on the current `state` without changing anything. */
export function previewSaleImpact(state: BusinessState, draft: SaleImpactDraft): SaleImpact {
  const customer = draft.customerId ? state.customers.find((entry) => entry.id === draft.customerId) : undefined;
  const blockers: string[] = [];
  const notices: string[] = [];

  const createdAt = draft.createdAt || new Date().toISOString();
  if (isAccountingPeriodClosed(state, createdAt)) {
    blockers.push('That date is in a closed accounting period.');
  }
  if (customer?.status === 'terminated') {
    blockers.push(`${customer.name}'s account is terminated — reactivate it before selling on credit.`);
  }

  // Aggregate requested quantity per product (stock decrements aggregate, as in addSaleToState).
  const requestedByProduct = new Map<string, number>();
  for (const item of draft.items) {
    if (item.quantity <= 0) continue;
    requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  const items: SaleImpactItem[] = [];
  let subtotalInput = 0;
  for (const [productId, quantity] of requestedByProduct) {
    const product = state.products.find((entry) => entry.id === productId);
    if (!product) continue;
    const stockBefore = selectProductQuantityOnHand(state, productId, draft.locationId);
    const stockAfter = stockBefore - quantity;
    const lineTotal = product.price * quantity;
    subtotalInput += lineTotal;
    const insufficient = quantity > stockBefore;
    const belowReorderAfter = stockAfter >= 0 && stockAfter <= product.reorderLevel;
    if (insufficient) blockers.push(`Not enough stock for ${product.name} (need ${quantity}, have ${stockBefore}).`);
    else if (stockAfter === 0) notices.push(`${product.name} will be out of stock after this sale.`);
    else if (belowReorderAfter) notices.push(`${product.name} will drop to ${stockAfter}, at or below its reorder level.`);
    items.push({
      productId, productName: product.name, unit: product.unit, quantity,
      unitPrice: product.price, lineTotal, stockBefore, stockAfter, belowReorderAfter, insufficient,
    });
  }

  const taxSnapshot = buildTaxSnapshot(state.businessProfile, {
    exempt: draft.taxExempt ?? customer?.taxExempt ?? false,
    exemptionReason: customer?.taxExemptionReason,
  });
  const taxTotals = calculateTaxTotals(subtotalInput, taxSnapshot);
  const total = taxTotals.totalAmount;
  const paid = Math.max(0, draft.paidAmount);
  const balanceDue = Number(Math.max(0, total - paid).toFixed(2));

  let impactCustomer: SaleImpactCustomer | null = null;
  if (customer) {
    const balanceBefore = selectCustomerOutstanding(state, customer.id);
    const balanceAfter = Number((balanceBefore + balanceDue).toFixed(2));
    const overLimitAfter = customer.creditLimit != null && balanceDue > 0 && balanceAfter > customer.creditLimit;
    impactCustomer = { name: customer.name, registered: true, balanceBefore, balanceAfter, creditLimit: customer.creditLimit, overLimitAfter };
    if (overLimitAfter && !customer.creditHoldOverride) {
      blockers.push(`${customer.name} would be over their credit limit — collect payment or have the accountant release the hold.`);
    }
  } else if (draft.walkInName?.trim()) {
    impactCustomer = { name: draft.walkInName.trim(), registered: false, balanceBefore: 0, balanceAfter: 0, overLimitAfter: false };
    if (balanceDue > 0) notices.push('Walk-in sales cannot carry a balance — collect the full amount.');
  }

  if (paid > total) blockers.push('Amount paid is more than the invoice total.');

  return {
    items,
    subtotal: Number(taxTotals.subtotalAmount.toFixed(2)),
    tax: Number(taxTotals.taxAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
    paid: Number(paid.toFixed(2)),
    balanceDue,
    hasTax: taxTotals.hasTax,
    customer: impactCustomer,
    blockers,
    notices,
    canPost: blockers.length === 0 && items.length > 0,
  };
}
