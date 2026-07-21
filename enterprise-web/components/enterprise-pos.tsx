'use client';

import {
  Banknote,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  LoaderCircle,
  MapPin,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { type CSSProperties, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  loadMagentoStock,
  type MagentoCatalog,
  type MagentoCatalogProduct,
  type MagentoPosOrder,
  type MagentoPosOrderInput,
} from '../../src/lib/magentoClient';
import { useBusiness } from '../../src/context/BusinessContext';
import { resolveCommerceRuntime } from '../../src/integrations/commerce/runtime';
import { buildStandaloneCommerceCatalog, placeStandaloneCommerceOrder } from '../../src/integrations/commerce/standaloneConnector';
import type { CommerceRuntime } from '../../src/integrations/commerce/types';
import { isOnline, onNetworkChange } from '../../src/offline/networkStatus';
import { loadPosCatalogWithOfflineSupport, placePosOrderWithOfflineSupport } from '../../src/offline/offlinePos';
import { flushOfflineSync, getPendingOfflineSync, subscribeOfflineSync } from '../../src/offline/offlineSync';
import { formatCurrency } from '../../src/utils/format';
import { buildTaxSnapshot, calculateTaxTotals } from '../../src/utils/businessLogic';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

type CartLine = { product: MagentoCatalogProduct; quantity: number };
type PaymentMethod = MagentoPosOrderInput['paymentMethod'];
type ReceiptState = {
  order: MagentoPosOrder;
  lines: CartLine[];
  customerName: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  tendered: number;
  completedAt: string;
};

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { value: 'Cash', label: 'Cash', icon: Banknote },
  { value: 'Mobile Money', label: 'MoMo', icon: Smartphone },
  { value: 'Bank Account', label: 'Bank', icon: CreditCard },
];

export function EnterprisePos() {
  return <EnterpriseApp><EnterprisePosRegister /></EnterpriseApp>;
}

function EnterprisePosRegister() {
  const { state, addSale } = useBusiness();
  const activeCustomers = state.customers.filter((customer) => customer.status === 'active');
  const [catalog, setCatalog] = useState<MagentoCatalog | null>(null);
  const [commerceRuntime, setCommerceRuntime] = useState<CommerceRuntime | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [standaloneCustomerId, setStandaloneCustomerId] = useState(activeCustomers[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [tendered, setTendered] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(() => isOnline());
  const [pendingCount, setPendingCount] = useState(() => getPendingOfflineSync().length);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const saleClientRef = useRef<string | null>(null);

  async function loadCatalog() {
    setLoading(true);
    setMessage('');
    try {
      const runtime = await resolveCommerceRuntime();
      setCommerceRuntime(runtime);
      if (runtime.mode === 'standalone') {
        const standaloneCatalog = buildStandaloneCommerceCatalog(state);
        setCatalog(standaloneCatalog);
        setBranchId((current) => standaloneCatalog.branches.some((branch) => branch.id === current)
          ? current
          : standaloneCatalog.branches[0]?.id ?? null);
        return;
      }
      const result = await loadPosCatalogWithOfflineSupport();
      setCatalog(result.catalog);
      setBranchId((current) => result.catalog.branches.some((branch) => branch.id === current)
        ? current
        : result.catalog.branches[0]?.id ?? null);
      if (result.cachedAt) setMessage(`Offline catalog from ${new Date(result.cachedAt).toLocaleString()}. New sales will queue safely.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the commerce register.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribeNetwork = onNetworkChange(setOnline);
    const unsubscribeQueue = subscribeOfflineSync((pending) => setPendingCount(pending.length));
    const initialLoad = window.setTimeout(() => void loadCatalog(), 0);
    return () => { window.clearTimeout(initialLoad); unsubscribeNetwork(); unsubscribeQueue(); };
    // Runtime discovery runs once; standalone catalog updates are handled by the state-driven effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (commerceRuntime?.mode !== 'standalone') return;
    const refresh = window.setTimeout(() => setCatalog(buildStandaloneCommerceCatalog(state)), 0);
    return () => window.clearTimeout(refresh);
  }, [commerceRuntime?.mode, state]);

  useEffect(() => {
    const refreshStock = async () => {
      if (commerceRuntime?.provider !== 'magento' || !isOnline() || document.visibilityState !== 'visible') return;
      try {
        const { stock } = await loadMagentoStock();
        const bySku = new Map<string, Map<string, { quantity: number; is_salable: boolean }>>();
        for (const item of stock.items) {
          if (!bySku.has(item.sku)) bySku.set(item.sku, new Map());
          bySku.get(item.sku)!.set(item.source_code, { quantity: item.quantity, is_salable: item.is_salable });
        }
        setCatalog((current) => current ? {
          ...current,
          generated_at: stock.generated_at,
          products: current.products.map((product) => {
            const sources = bySku.get(product.sku);
            if (!sources) return product;
            const sourceQuantities = [...sources.entries()].map(([source_code, value]) => ({ source_code, ...value }));
            return {
              ...product,
              quantity: sourceQuantities.reduce((sum, value) => sum + value.quantity, 0),
              is_salable: sourceQuantities.some((value) => value.is_salable),
              source_quantities: sourceQuantities,
            };
          }),
        } : current);
      } catch {
        // The register keeps the last confirmed stock snapshot.
      }
    };
    const interval = window.setInterval(refreshStock, 30_000);
    return () => window.clearInterval(interval);
  }, [commerceRuntime?.provider]);

  const selectedBranch = catalog?.branches.find((branch) => branch.id === branchId);
  const stockAtBranch = useCallback((product: MagentoCatalogProduct) => {
    const sourceCode = selectedBranch?.source_code;
    const source = sourceCode ? product.source_quantities?.find((value) => value.source_code === sourceCode) : undefined;
    return source ? (source.is_salable ? source.quantity : 0) : product.quantity;
  }, [selectedBranch?.source_code]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.products ?? [])
      .filter((product) => product.is_salable && stockAtBranch(product) > 0)
      .filter((product) => !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query));
  }, [catalog, search, stockAtBranch]);

  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const standaloneCustomer = activeCustomers.find((customer) => customer.id === standaloneCustomerId);
  const subtotal = commerceRuntime?.mode === 'standalone'
    ? calculateTaxTotals(cartSubtotal, buildTaxSnapshot(state.businessProfile, {
        exempt: standaloneCustomer?.taxExempt,
        exemptionReason: standaloneCustomer?.taxExemptionReason,
      })).totalAmount
    : cartSubtotal;
  const tenderedAmount = Number(tendered) || 0;
  const estimatedChange = paymentMethod === 'Cash' ? Math.max(0, tenderedAmount - subtotal) : 0;

  function changeQuantity(product: MagentoCatalogProduct, delta: number) {
    setCart((current) => {
      const existing = current.find((line) => line.product.sku === product.sku);
      const quantity = Math.min(stockAtBranch(product), Math.max(0, (existing?.quantity ?? 0) + delta));
      if (!quantity) return current.filter((line) => line.product.sku !== product.sku);
      if (existing) return current.map((line) => line.product.sku === product.sku ? { ...line, quantity } : line);
      return [...current, { product, quantity }];
    });
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || !visibleProducts.length) return;
    event.preventDefault();
    changeQuantity(visibleProducts[0], 1);
    setSearch('');
  }

  async function handleSync() {
    setMessage('');
    const result = await flushOfflineSync();
    setPendingCount(result.remaining);
    setMessage(result.remaining ? `${result.remaining} transaction${result.remaining === 1 ? '' : 's'} still waiting to sync.` : 'Register queue synchronized.');
    if (!result.remaining) await loadCatalog();
  }

  async function handleCheckout() {
    if (!branchId || !cart.length || !customerName.trim()) {
      setMessage('Choose a branch, add products, and enter the customer name.');
      return;
    }
    if (paymentMethod === 'Cash' && tenderedAmount < subtotal) {
      setMessage('Cash tendered must cover the current total.');
      return;
    }
    if (!saleClientRef.current) saleClientRef.current = `BISA-${crypto.randomUUID()}`;
    const completedLines = cart;
    setSubmitting(true);
    setMessage('');
    try {
      const orderInput: MagentoPosOrderInput = {
        branchId,
        clientRef: saleClientRef.current,
        customer: { name: customerName.trim(), email: customerEmail.trim(), phone: customerPhone.trim() },
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        items: cart.map((line) => ({ sku: line.product.sku, quantity: line.quantity })),
      };
      if (commerceRuntime?.mode === 'standalone') {
        if (!standaloneCustomerId) throw new Error('Choose a BizPilot customer before completing this sale.');
        const order = placeStandaloneCommerceOrder(state, orderInput, standaloneCustomerId, addSale);
        saleClientRef.current = null;
        setCart([]);
        setPaymentReference('');
        setTendered('');
        setReceipt({ order, lines: completedLines, customerName: customerName.trim(), paymentMethod, paymentReference: paymentReference.trim(), tendered: tenderedAmount, completedAt: new Date().toISOString() });
        return;
      }
      const result = await placePosOrderWithOfflineSupport({
        ...orderInput,
      });
      saleClientRef.current = null;
      setCart([]);
      setPaymentReference('');
      setTendered('');
      if (result.status === 'placed') {
        setReceipt({
          order: result.order,
          lines: completedLines,
          customerName: customerName.trim(),
          paymentMethod,
          paymentReference: paymentReference.trim(),
          tendered: tenderedAmount,
          completedAt: new Date().toISOString(),
        });
        await loadCatalog();
      } else {
        setPendingCount(getPendingOfflineSync().length);
        setMessage('Sale secured on this register and queued for commerce synchronization.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Commerce checkout failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return <EnterpriseShell active="POS">
    <div className="pos-register" data-testid="enterprise-pos">
      <header className="pos-register-bar">
        <div className="pos-register-title"><span>BP</span><div><p>{commerceRuntime?.label ?? 'Commerce register'}</p><h1>Counter sale</h1></div></div>
        <label className="pos-branch-select"><MapPin size={15} /><span><small>Location</small><strong>{selectedBranch?.name ?? 'Select location'}</strong></span><ChevronDown size={14} /><select aria-label="Store location" value={branchId ?? ''} onChange={(event) => setBranchId(Number(event.target.value))}>{(catalog?.branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <div className={online ? 'pos-register-state pos-register-state--online' : 'pos-register-state pos-register-state--offline'}>{online ? <Wifi size={14} /> : <WifiOff size={14} />}<span><strong>{online ? `${commerceRuntime?.label ?? 'Commerce'} live` : 'Offline register'}</strong><small>{pendingCount ? `${pendingCount} waiting to sync` : commerceRuntime?.mode === 'standalone' ? 'BizPilot source of truth' : 'Queue clear'}</small></span>{pendingCount && online ? <button className="icon-button" type="button" aria-label="Synchronize register" title="Synchronize register" onClick={() => void handleSync()}><RefreshCw size={14} /></button> : null}</div>
      </header>

      {loading && !catalog ? <RegisterLoading /> : !catalog ? <RegisterError message={message} onRetry={() => void loadCatalog()} /> : <div className="pos-register-workspace">
        <section className="pos-catalog">
          <div className="pos-search-row"><label className="pos-product-search"><Search size={18} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Scan barcode, enter SKU, or search products" autoFocus /><button type="button" title="Clear search" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><X size={15} /></button></label><div><strong>{visibleProducts.length}</strong><span>available products</span></div></div>
          <div className="pos-product-grid-native">{visibleProducts.map((product, index) => { const inCart = cart.find((line) => line.product.sku === product.sku)?.quantity ?? 0; const branchStock = stockAtBranch(product); return <article className={inCart ? 'pos-product-tile pos-product-tile--selected' : 'pos-product-tile'} style={{ '--tile-index': index } as CSSProperties} key={product.sku}><div className="pos-product-visual"><ProductImage product={product} /><span>{branchStock} in stock</span>{inCart ? <b><Check size={11} /> {inCart}</b> : null}</div><div className="pos-product-info"><small>{product.sku}</small><h2>{product.name}</h2><div><strong>{formatCurrency(product.price, catalog.currency)}</strong>{product.regular_price && product.regular_price > product.price ? <del>{formatCurrency(product.regular_price, catalog.currency)}</del> : null}</div></div><button type="button" aria-label={`Add ${product.name}`} disabled={inCart >= branchStock} onClick={() => changeQuantity(product, 1)}><Plus size={15} /></button></article>;})}</div>
          {!visibleProducts.length ? <div className="pos-no-products"><PackageSearch size={28} /><strong>No matching stock</strong><span>Try another product name or SKU.</span></div> : null}
        </section>

        <aside className="pos-checkout">
          <div className="pos-checkout-head"><div><p>Current sale</p><h2>{itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'New basket'}</h2></div>{cart.length ? <button className="icon-button" type="button" aria-label="Clear basket" title="Clear basket" onClick={() => setCart([])}><Trash2 size={16} /></button> : null}</div>
          <div className="pos-cart-native">{cart.length ? cart.map((line) => <div className="pos-cart-native-line" key={line.product.sku}><div><strong>{line.product.name}</strong><span>{line.product.sku} · {formatCurrency(line.product.price, catalog.currency)}</span></div><div className="pos-quantity-stepper"><button type="button" aria-label={`Remove one ${line.product.name}`} onClick={() => changeQuantity(line.product, -1)}><Minus size={13} /></button><b>{line.quantity}</b><button type="button" aria-label={`Add one ${line.product.name}`} disabled={line.quantity >= stockAtBranch(line.product)} onClick={() => changeQuantity(line.product, 1)}><Plus size={13} /></button></div><strong>{formatCurrency(line.product.price * line.quantity, catalog.currency)}</strong></div>) : <div className="pos-cart-empty"><ShoppingBag size={24} /><strong>Basket ready</strong><span>Selected products will appear here.</span></div>}</div>
          <div className="pos-customer-native"><div className="pos-section-label"><span>Customer</span><small>{commerceRuntime?.mode === 'standalone' ? 'BizPilot account' : 'Optional contact details'}</small></div>{commerceRuntime?.mode === 'standalone' ? <label><span>Customer account</span><select value={standaloneCustomerId} onChange={(event) => { const customerId = event.target.value; const customer = activeCustomers.find((entry) => entry.id === customerId); setStandaloneCustomerId(customerId); setCustomerName(customer?.name ?? 'Walk-in customer'); setCustomerPhone(customer?.phone ?? ''); setCustomerEmail(customer?.email ?? ''); }}>{activeCustomers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.clientId}</option>)}</select></label> : <label><span>Name</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>}<div><label><span>Phone</span><input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Customer phone" /></label><label><span>Email</span><input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Customer email" /></label></div></div>
          <div className="pos-payment-native"><div className="pos-section-label"><span>Payment</span><small>{paymentMethod}</small></div><div className="pos-payment-methods">{paymentMethods.map(({ value, label, icon: Icon }) => <button type="button" className={paymentMethod === value ? 'pos-payment-method pos-payment-method--active' : 'pos-payment-method'} onClick={() => setPaymentMethod(value)} key={value}><Icon size={15} />{label}</button>)}</div>{paymentMethod === 'Cash' ? <div className="pos-cash-row"><label><span>Cash tendered</span><input type="number" min="0" step="0.01" value={tendered} onChange={(event) => setTendered(event.target.value)} placeholder={subtotal.toFixed(2)} /></label><div><span>Change</span><strong>{formatCurrency(estimatedChange, catalog.currency)}</strong></div></div> : <label className="pos-reference"><span>Payment reference</span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Transaction or bank reference" /></label>}</div>
          <div className="pos-checkout-total"><div><span>{commerceRuntime?.mode === 'standalone' ? 'Total' : 'Subtotal'}</span><strong>{formatCurrency(subtotal, catalog.currency)}</strong></div><p>{commerceRuntime?.mode === 'standalone' ? 'Tax calculated from BizPilot business and customer settings.' : 'Final tax is confirmed by the connected commerce platform.'}</p><button type="button" disabled={submitting || !cart.length || !branchId} onClick={() => void handleCheckout()}>{submitting ? <><LoaderCircle className="spin" size={16} /> Processing</> : <><CircleDollarSign size={17} /> Charge {formatCurrency(subtotal, catalog.currency)}</>}</button>{message ? <div className="pos-register-message" role="status">{message}</div> : null}</div>
        </aside>
      </div>}
    </div>
    {receipt ? <ReceiptDialog receipt={receipt} onClose={() => { setReceipt(null); setCustomerName('Walk-in customer'); setCustomerPhone(''); setCustomerEmail(''); searchRef.current?.focus(); }} /> : null}
  </EnterpriseShell>;
}

function RegisterLoading() {
  return <div className="pos-register-loading"><div className="pos-loading-line" /><div className="pos-loading-grid">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div></div>;
}

function ProductImage({ product }: { product: MagentoCatalogProduct }) {
  if (!product.image_url) return <PackageSearch size={25} />;
  // Magento controls these product-media URLs, so Next image host allowlists are not practical here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={product.image_url} alt="" />;
}

function RegisterError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="pos-register-error"><WifiOff size={28} /><strong>Register unavailable</strong><span>{message}</span><button className="secondary-button" type="button" onClick={onRetry}><RefreshCw size={14} /> Retry</button></div>;
}

function ReceiptDialog({ receipt, onClose }: { receipt: ReceiptState; onClose: () => void }) {
  const change = receipt.paymentMethod === 'Cash' ? Math.max(0, receipt.tendered - receipt.order.total) : 0;
  return <div className="pos-receipt-backdrop"><section className="pos-receipt" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><div className="pos-receipt-success"><i><Check size={24} /></i><p>Payment accepted</p><h2 id="receipt-title">{formatCurrency(receipt.order.total, receipt.order.currency)}</h2><span>{receipt.order.orderNumber} · {receipt.order.branch.name}</span></div><div className="pos-receipt-lines">{receipt.lines.map((line) => <div key={line.product.sku}><span>{line.quantity} × {line.product.name}</span><strong>{formatCurrency(line.product.price * line.quantity, receipt.order.currency)}</strong></div>)}</div><dl><div><dt>Customer</dt><dd>{receipt.customerName}</dd></div><div><dt>Payment</dt><dd>{receipt.paymentMethod}</dd></div>{receipt.paymentReference ? <div><dt>Reference</dt><dd>{receipt.paymentReference}</dd></div> : null}{receipt.paymentMethod === 'Cash' ? <><div><dt>Tendered</dt><dd>{formatCurrency(receipt.tendered, receipt.order.currency)}</dd></div><div><dt>Change</dt><dd>{formatCurrency(change, receipt.order.currency)}</dd></div></> : null}<div><dt>Completed</dt><dd>{new Date(receipt.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd></div></dl><div className="pos-receipt-actions"><button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={15} /> Print receipt</button><button className="primary-button" type="button" onClick={onClose}>Next sale <Plus size={15} /></button></div></section></div>;
}
