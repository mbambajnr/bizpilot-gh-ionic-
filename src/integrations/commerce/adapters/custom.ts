import type { CommerceCapabilities } from '../types';
import type { CommerceBranch, CommerceCatalog, CommerceOrder, CommerceOrderInput, CommerceProduct } from '../domain';
import type { CommerceAdapter, CommerceTransport } from '../adapter';

// The generic adapter for a client on a platform we have no first-class support
// for. Instead of code per platform, the tenant supplies a field map describing
// where each neutral field lives in their API's JSON, and this adapter reads it.

/** Where a neutral collection and its fields live in a raw payload (dot paths). */
export type CustomFieldMap = {
  /** Dot path to the array of records (e.g. "data.products"). Empty = payload is the array. */
  list: string;
  /** neutralFieldName -> dot path within each record. */
  fields: Record<string, string>;
};

export type CustomProviderSettings = {
  /** Server-proxy path that returns the client's catalog JSON. */
  catalogPath: string;
  /** Server-proxy path that accepts an order and returns the client's order JSON. */
  orderPath: string;
  /** Fixed currency, or read it from the payload via currencyPath. */
  currency?: string;
  currencyPath?: string;
  products: CustomFieldMap;
  branches: CustomFieldMap;
  /** Optional overrides for reading the order-confirmation response. */
  order?: { fields?: Record<string, string> };
  capabilities?: Partial<CommerceCapabilities>;
};

const defaultCapabilities: CommerceCapabilities = {
  catalog: true,
  inventory: true,
  orders: true,
  customers: false,
  multiLocation: false,
};

export function getByPath(source: unknown, path: string): unknown {
  if (!path) return source;
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in (value as Record<string, unknown>)) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(str(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  const text = str(value).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function readField(record: unknown, fields: Record<string, string>, name: string): unknown {
  const path = fields[name];
  return path === undefined ? undefined : getByPath(record, path);
}

export function mapCustomCatalog(raw: unknown, settings: CustomProviderSettings): CommerceCatalog {
  const currency = settings.currency ?? (str(getByPath(raw, settings.currencyPath ?? 'currency')) || 'GHS');
  const products: CommerceProduct[] = asArray(getByPath(raw, settings.products.list)).map((record) => {
    const f = settings.products.fields;
    const quantity = num(readField(record, f, 'quantity'));
    return {
      id: str(readField(record, f, 'id') ?? readField(record, f, 'sku')),
      sku: str(readField(record, f, 'sku')),
      name: str(readField(record, f, 'name')),
      price: num(readField(record, f, 'price')),
      regularPrice: f.regularPrice ? num(readField(record, f, 'regularPrice')) : undefined,
      quantity,
      isSalable: f.isSalable ? bool(readField(record, f, 'isSalable')) : quantity > 0,
      imageUrl: f.imageUrl ? str(readField(record, f, 'imageUrl')) : undefined,
    };
  });
  const branches: CommerceBranch[] = asArray(getByPath(raw, settings.branches.list)).map((record, index) => {
    const f = settings.branches.fields;
    const id = str(readField(record, f, 'id') ?? index + 1);
    return {
      id,
      name: str(readField(record, f, 'name')),
      address: f.address ? str(readField(record, f, 'address')) : undefined,
      phone: f.phone ? str(readField(record, f, 'phone')) : undefined,
      isActive: f.isActive ? bool(readField(record, f, 'isActive')) : true,
      sourceCode: f.sourceCode ? str(readField(record, f, 'sourceCode')) : id,
    };
  });
  return { generatedAt: new Date().toISOString(), currency, products, branches };
}

export function mapCustomOrder(raw: unknown, input: CommerceOrderInput, settings: CustomProviderSettings): CommerceOrder {
  const f = { orderId: 'orderId', orderNumber: 'orderNumber', total: 'total', currency: 'currency', branchId: 'branch.id', branchName: 'branch.name', itemCount: 'itemCount', duplicate: 'duplicate', clientRef: 'clientRef', ...settings.order?.fields };
  const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    orderId: str(getByPath(raw, f.orderId)),
    orderNumber: str(getByPath(raw, f.orderNumber)) || str(getByPath(raw, f.orderId)),
    total: num(getByPath(raw, f.total)),
    currency: str(getByPath(raw, f.currency)) || settings.currency || 'GHS',
    branch: { id: str(getByPath(raw, f.branchId)) || input.branchId, name: str(getByPath(raw, f.branchName)) },
    itemCount: f.itemCount && getByPath(raw, f.itemCount) !== undefined ? num(getByPath(raw, f.itemCount)) : itemCount,
    duplicate: bool(getByPath(raw, f.duplicate)),
    clientRef: str(getByPath(raw, f.clientRef)) || input.clientRef,
  };
}

export function createCustomAdapter(settings: CustomProviderSettings, transport: CommerceTransport, label = 'Custom Commerce'): CommerceAdapter {
  return {
    id: 'custom',
    label,
    capabilities: { ...defaultCapabilities, ...settings.capabilities },
    async loadCatalog() {
      const raw = await transport.get(settings.catalogPath);
      return mapCustomCatalog(raw, settings);
    },
    async placeOrder(input: CommerceOrderInput) {
      const raw = await transport.post(settings.orderPath, input);
      return mapCustomOrder(raw, input, settings);
    },
  };
}
