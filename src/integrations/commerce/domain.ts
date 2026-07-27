// Provider-neutral commerce domain model.
//
// This is the contract every commerce platform is mapped INTO. Adapters
// translate a provider's native payloads (Magento REST, a custom store's API,
// BisaPilot's own state, …) to and from these shapes, so the POS and inventory
// features never learn which platform a given tenant runs. Field names are
// camelCase and platform-agnostic on purpose — no provider's naming leaks here.

export type CommercePaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Account';

/** Stock for one product at one branch/source ("shelf" quantity). */
export type CommerceSourceQuantity = {
  /** Opaque per-branch source key (e.g. a Magento MSI source or a store id). */
  sourceCode: string;
  quantity: number;
  isSalable: boolean;
};

export type CommerceProduct = {
  /** Stable per-provider id, stringified so every platform fits. */
  id: string;
  /** The SKU the POS charges against; the cross-platform product key. */
  sku: string;
  name: string;
  /** Charge price with any promotions/rules already applied. */
  price: number;
  /** Undiscounted price; differs from price when on promo. */
  regularPrice?: number;
  /** Network-wide quantity across every branch source. */
  quantity: number;
  isSalable: boolean;
  imageUrl?: string;
  /** Per-branch stock; match to a branch by sourceCode. */
  sourceQuantities?: CommerceSourceQuantity[];
};

export type CommerceBranch = {
  /** Stable per-provider id, stringified. */
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  /** The stock source this branch sells from (matches CommerceSourceQuantity.sourceCode). */
  sourceCode?: string;
};

export type CommerceCatalog = {
  generatedAt: string;
  currency: string;
  products: CommerceProduct[];
  branches: CommerceBranch[];
};

export type CommerceOrderInput = {
  /** Which branch fulfils the sale; references CommerceBranch.id. */
  branchId: string;
  /**
   * Idempotency key for this sale attempt. Reuse the SAME value when retrying
   * a failed submission so a provider returns the original order instead of
   * creating a duplicate.
   */
  clientRef: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  paymentMethod: CommercePaymentMethod;
  paymentReference?: string;
  items: Array<{ sku: string; quantity: number }>;
};

export type CommerceOrder = {
  orderId: string;
  orderNumber: string;
  total: number;
  currency: string;
  branch: { id: string; name: string };
  itemCount: number;
  /** True when this was an idempotent replay of an already-recorded sale. */
  duplicate?: boolean;
  clientRef?: string;
};
