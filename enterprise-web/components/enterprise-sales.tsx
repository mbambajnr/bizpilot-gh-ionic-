'use client';

import { ActivitySquare, AlertTriangle, ArrowRight, Check, ChevronRight, FileText, Info, Plus, ReceiptText, RotateCcw, Search, ShoppingCart, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { PaymentMethod, Sale } from '../../src/data/seedBusiness';
import { buildTaxSnapshot, buildWithholdingTaxSnapshot, calculateTaxTotals, type NewSaleLineItemInput } from '../../src/utils/businessLogic';
import { previewSaleImpact } from '../../src/utils/transactionPreview';
import { selectProductQuantityOnHand, selectSaleBalanceRemaining } from '../../src/selectors/businessSelectors';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

type SalesTab = 'invoices' | 'receivables' | 'quotations';

export function EnterpriseSales({ initialSaleId = '', initialCustomerId = '', correctionSourceSaleId = '', initiallyOpenComposer = false }: { initialSaleId?: string; initialCustomerId?: string; correctionSourceSaleId?: string; initiallyOpenComposer?: boolean }) {
  return <EnterpriseApp><EnterpriseSalesView initialSaleId={initialSaleId} initialCustomerId={initialCustomerId} correctionSourceSaleId={correctionSourceSaleId} initiallyOpenComposer={initiallyOpenComposer} /></EnterpriseApp>;
}

function EnterpriseSalesView({ initialSaleId, initialCustomerId, correctionSourceSaleId, initiallyOpenComposer }: { initialSaleId: string; initialCustomerId: string; correctionSourceSaleId: string; initiallyOpenComposer: boolean }) {
  const { state, currentUser, hasPermission, addSale, convertQuotationToSale, reverseSale } = useBusiness();
  const [tab, setTab] = useState<SalesTab>('invoices');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialSaleId || state.sales[0]?.id || '');
  const [composerOpen, setComposerOpen] = useState(initiallyOpenComposer);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const currency = state.businessProfile.currency;
  const canCreate = hasPermission('sales.create');
  const canReverse = hasPermission('sales.reverse');
  const canConvert = hasPermission('quotations.convert');
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const completed = state.sales.filter((sale) => sale.status === 'Completed');
  const salesToday = completed.filter((sale) => sale.createdAt.slice(0, 10) === today);
  const monthSales = completed.filter((sale) => sale.createdAt.slice(0, 7) === month);
  const receivables = completed.reduce((sum, sale) => sum + selectSaleBalanceRemaining(sale), 0);
  const openQuotes = state.quotations.filter((quote) => ['Draft', 'draft', 'open', 'approved'].includes(quote.status));
  const scopedSales = tab === 'receivables' ? state.sales.filter((sale) => sale.status === 'Completed' && selectSaleBalanceRemaining(sale) > 0) : state.sales;
  const filtered = scopedSales.filter((sale) => {
    const customer = state.customers.find((entry) => entry.id === sale.customerId);
    return `${sale.invoiceNumber} ${sale.receiptId} ${customer?.name ?? sale.customerSnapshot?.name ?? ''} ${sale.items.map((item) => item.productName).join(' ')}`.toLowerCase().includes(query.toLowerCase());
  });
  const selected = state.sales.find((sale) => sale.id === selectedId) ?? filtered[0];

  async function run(action: () => Promise<{ ok: boolean; message?: string }> | { ok: boolean; message?: string }, success: string) {
    setBusy(true); setMessage('');
    const result = await action();
    setMessage(result.message ?? (result.ok ? success : 'The action could not be completed.'));
    setBusy(false);
  }

  return <EnterpriseShell active="Sales"><div className="page-content sales-page">
    <section className="page-heading sales-heading"><div><p className="eyebrow">Commercial operations</p><h1>Sales workspace</h1><p>Invoice customers, collect payments, and control fulfilment from one worklist.</p></div>{canCreate ? <button className="primary-button" type="button" onClick={() => setComposerOpen(true)}><Plus size={16} /> New sale</button> : null}</section>
    <section className="sales-metrics" aria-label="Sales performance"><SalesMetric label="Sales today" value={formatCurrency(salesToday.reduce((sum, sale) => sum + sale.totalAmount, 0), currency)} helper={`${salesToday.length} invoices`} /><SalesMetric label="Month invoiced" value={formatCurrency(monthSales.reduce((sum, sale) => sum + sale.totalAmount, 0), currency)} helper={`${monthSales.length} invoices`} /><SalesMetric label="Collected" value={formatCurrency(monthSales.reduce((sum, sale) => sum + sale.paidAmount, 0), currency)} helper="This month" /><SalesMetric label="Receivables" value={formatCurrency(receivables, currency)} helper={`${completed.filter((sale) => selectSaleBalanceRemaining(sale) > 0).length} invoices open`} tone={receivables ? 'warn' : 'good'} /></section>
    <nav className="procurement-tabs" aria-label="Sales views">{([['invoices', 'Invoices'], ['receivables', `Receivables${receivables ? ` (${completed.filter((sale) => selectSaleBalanceRemaining(sale) > 0).length})` : ''}`], ['quotations', `Quotations${openQuotes.length ? ` (${openQuotes.length})` : ''}`]] as const).map(([value, label]) => <button type="button" className={tab === value ? 'procurement-tab procurement-tab--active' : 'procurement-tab'} onClick={() => setTab(value)} key={value}>{label}</button>)}</nav>
    {message ? <div className="settings-message" role="status">{message}</div> : null}
    {tab === 'quotations' ? <QuotationQueue quotations={openQuotes} currency={currency} canConvert={canConvert} busy={busy} onConvert={(id) => void run(() => convertQuotationToSale({ quotationId: id, paymentMethod: 'Bank Account', amountPaid: 0 }), 'Quotation converted to an unpaid invoice.')} /> : <section className="sales-workspace"><div className="sales-list-panel"><label className="purchase-search sales-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, customer, receipt, or item" /></label><div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Payment</th><th /></tr></thead><tbody>{filtered.map((sale) => { const customer = state.customers.find((entry) => entry.id === sale.customerId); const balance = selectSaleBalanceRemaining(sale); return <tr className={selected?.id === sale.id ? 'sales-row sales-row--selected' : 'sales-row'} onClick={() => setSelectedId(sale.id)} key={sale.id}><td><strong>{sale.invoiceNumber}</strong><span>{sale.receiptId} · {formatRelativeDate(sale.createdAt)}</span></td><td>{customer?.name ?? sale.customerSnapshot?.name ?? 'Walk-in customer'}</td><td><strong>{formatCurrency(sale.totalAmount, currency)}</strong></td><td><span className={`purchase-status purchase-status--${sale.status === 'Reversed' ? 'risk' : balance > 0 ? 'warn' : 'good'}`}>{sale.status === 'Reversed' ? 'Reversed' : balance > 0 ? `${formatCurrency(balance, currency)} due` : 'Paid'}</span></td><td><ChevronRight size={15} /></td></tr>;})}</tbody></table>{!filtered.length ? <div className="procurement-empty"><ReceiptText size={22} /><strong>No invoices in this view</strong><span>Recorded sales and customer balances will appear here.</span></div> : null}</div></div><InvoiceDetail sale={selected} state={state} currency={currency} canReverse={canReverse} busy={busy} onReverse={(sale, reason) => void run(() => reverseSale({ saleId: sale.id, reason, actor: currentUser.userId }), `${sale.invoiceNumber} reversed.`)} /></section>}
  </div>{composerOpen ? <SaleComposer state={state} currency={currency} initialCustomerId={initialCustomerId} correctionSourceSaleId={correctionSourceSaleId} onClose={() => setComposerOpen(false)} onCreate={addSale} onCreated={(saleId, text) => { setSelectedId(saleId); setMessage(text); setComposerOpen(false); setTab('invoices'); }} /> : null}</EnterpriseShell>;
}

function SalesMetric({ label, value, helper, tone = 'good' }: { label: string; value: string; helper: string; tone?: 'good' | 'warn' }) { return <article><span>{label}</span><strong>{value}</strong><small className={tone === 'warn' ? 'sales-metric-warn' : ''}>{helper}</small></article>; }

function InvoiceDetail({ sale, state, currency, canReverse, busy, onReverse }: { sale?: Sale; state: ReturnType<typeof useBusiness>['state']; currency: string; canReverse: boolean; busy: boolean; onReverse: (sale: Sale, reason: string) => void }) {
  const [reason, setReason] = useState('');
  if (!sale) return <aside className="sale-detail sale-detail--empty"><FileText size={24} /><strong>Select an invoice</strong><span>Customer, payment, fulfilment, and audit details will appear here.</span></aside>;
  const customer = state.customers.find((entry) => entry.id === sale.customerId);
  const balance = selectSaleBalanceRemaining(sale);
  const activity = state.activityLogEntries.filter((entry) => entry.entityId === sale.id || entry.relatedSaleId === sale.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <aside className="sale-detail"><div className="sale-detail-heading"><div><p className="eyebrow">Invoice</p><h2>{sale.invoiceNumber}</h2><span>{customer?.name ?? sale.customerSnapshot?.name ?? 'Walk-in customer'} · {sale.receiptId}</span></div><span className={`purchase-status purchase-status--${sale.status === 'Reversed' ? 'risk' : balance ? 'warn' : 'good'}`}>{sale.status === 'Reversed' ? 'Reversed' : balance ? 'Payment due' : 'Paid'}</span></div><div className="sale-detail-stats"><div><span>Invoice total</span><strong>{formatCurrency(sale.totalAmount, currency)}</strong></div><div><span>Paid</span><strong>{formatCurrency(sale.paidAmount, currency)}</strong></div><div><span>Balance</span><strong>{formatCurrency(balance, currency)}</strong></div></div><div className="sale-line-list">{sale.items.map((item) => <div key={item.productId}><div><strong>{item.productName}</strong><span>{item.inventoryId} · {item.quantity} × {formatCurrency(item.unitPrice, currency)}</span></div><b>{formatCurrency(item.total, currency)}</b></div>)}</div><dl className="purchase-meta"><div><dt>Payment method</dt><dd>{sale.paymentMethod}</dd></div><div><dt>Payment reference</dt><dd>{sale.paymentReference || 'Not recorded'}</dd></div><div><dt>Created</dt><dd>{new Date(sale.createdAt).toLocaleString()}</dd></div>{sale.quotationId ? <div><dt>Quotation</dt><dd>{state.quotations.find((entry) => entry.id === sale.quotationId)?.quotationNumber ?? sale.quotationId}</dd></div> : null}</dl><section className="sale-audit"><div className="purchase-section-heading"><div><FileText size={16} /><strong>Audit history</strong></div><span>{activity.length}</span></div><div className="purchase-audit-list">{activity.map((entry) => <div key={entry.id}><i className={`audit-dot audit-dot--${entry.status}`} /><span><strong>{entry.title}</strong><small>{entry.detail} · {new Date(entry.createdAt).toLocaleString()}</small></span></div>)}</div></section>{sale.status === 'Completed' && canReverse ? <div className="sale-reversal"><label><span>Reversal reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit trail" /></label><button className="secondary-button danger-button" type="button" disabled={busy || !reason.trim()} onClick={() => onReverse(sale, reason)}><RotateCcw size={14} /> Reverse invoice</button></div> : null}</aside>;
}

function SaleComposer({ state, currency, initialCustomerId = '', correctionSourceSaleId = '', onClose, onCreate, onCreated }: { state: ReturnType<typeof useBusiness>['state']; currency: string; initialCustomerId?: string; correctionSourceSaleId?: string; onClose: () => void; onCreate: ReturnType<typeof useBusiness>['addSale']; onCreated: (saleId: string, message: string) => void }) {
  const activeCustomers = state.customers.filter((customer) => customer.status === 'active');
  const correctionSource = state.sales.find((sale) => sale.id === correctionSourceSaleId && sale.status === 'Reversed' && !sale.correctedBySaleId);
  const preferredCustomerId = correctionSource?.customerId || initialCustomerId;
  const correctionReceivable = correctionSource ? correctionSource.netReceivableAmount ?? correctionSource.totalAmount : 0;
  const correctionPaymentState = !correctionSource || correctionSource.paidAmount <= 0 ? 'unpaid' : correctionSource.paidAmount >= correctionReceivable ? 'paid' : 'partial';
  const correctionWalkIn = Boolean(correctionSource && !correctionSource.customerId && correctionSource.customerSnapshot);
  const [customerMode, setCustomerMode] = useState<'registered' | 'walkIn'>(correctionWalkIn || !activeCustomers.length ? 'walkIn' : 'registered');
  const [customerId, setCustomerId] = useState(activeCustomers.some((customer) => customer.id === preferredCustomerId) ? preferredCustomerId : activeCustomers[0]?.id ?? '');
  const [walkInName, setWalkInName] = useState(correctionWalkIn ? correctionSource?.customerSnapshot?.name ?? '' : '');
  const [walkInPhone, setWalkInPhone] = useState(correctionWalkIn ? correctionSource?.customerSnapshot?.phone ?? '' : '');
  const [walkInEmail, setWalkInEmail] = useState(correctionWalkIn ? correctionSource?.customerSnapshot?.email ?? '' : '');
  const [lines, setLines] = useState<NewSaleLineItemInput[]>(correctionSource?.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) ?? [{ productId: state.products[0]?.id ?? '', quantity: 1 }]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(correctionSource?.paymentMethod ?? 'Cash');
  const [paymentState, setPaymentState] = useState<'paid' | 'partial' | 'unpaid'>(correctionPaymentState);
  const [paidAmount, setPaidAmount] = useState(correctionSource?.paidAmount ?? 0);
  const [paymentReference, setPaymentReference] = useState(correctionSource?.paymentReference ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const customer = activeCustomers.find((entry) => entry.id === customerId);
  const subtotal = lines.reduce((sum, line) => sum + (state.products.find((product) => product.id === line.productId)?.price ?? 0) * line.quantity, 0);
  const tax = calculateTaxTotals(subtotal, buildTaxSnapshot(state.businessProfile, { exempt: customer?.taxExempt, exemptionReason: customer?.taxExemptionReason }));
  const withholding = buildWithholdingTaxSnapshot(state.businessProfile, tax, false);
  const total = Number((tax.totalAmount - (withholding?.amount ?? 0)).toFixed(2));
  const effectivePaid = paymentState === 'paid' ? total : paymentState === 'unpaid' ? 0 : paidAmount;
  function updateLine(index: number, update: Partial<NewSaleLineItemInput>) { setLines((current) => current.map((line, position) => position === index ? { ...line, ...update } : line)); }
  const isWalkIn = customerMode === 'walkIn';
  const impact = previewSaleImpact(state, {
    customerId: isWalkIn ? undefined : customerId,
    walkInName: isWalkIn ? walkInName : undefined,
    items: lines,
    paidAmount: effectivePaid,
    taxExempt: customer?.taxExempt,
  });
  function submit(event: FormEvent) { event.preventDefault(); if (isWalkIn && !walkInName.trim()) { setError('Enter the walk-in customer name.'); return; } setBusy(true); setError(''); const customerFields = isWalkIn ? { customerSnapshot: { name: walkInName.trim(), phone: walkInPhone.trim() || undefined, email: walkInEmail.trim() || undefined, source: 'prospect' as const } } : { customerId }; const result = onCreate({ ...customerFields, items: lines, paymentMethod, paidAmount: effectivePaid, paymentReference: paymentReference.trim() || undefined, correctionOfSaleId: correctionSource?.id, createdAt: new Date().toISOString(), taxExempt: customer?.taxExempt, taxExemptionReason: customer?.taxExemptionReason }); setBusy(false); if (!result.ok) { setError(result.message); return; } if (result.receipt) onCreated(result.receipt.id, `${result.receipt.receiptId} created for ${formatCurrency(result.receipt.totalAmount, currency)}.`); }
  return <div className="composer-backdrop"><form className="sale-composer" onSubmit={submit}><div className="composer-heading"><div><p className="eyebrow">{correctionSource ? `Correction of ${correctionSource.invoiceNumber}` : 'New sale'}</p><h2>{correctionSource ? 'Create corrected invoice' : 'Create customer invoice'}</h2></div><button className="icon-button" type="button" aria-label="Close sale" title="Close sale" onClick={onClose}><X size={18} /></button></div><div className="sale-composer-body">{correctionSource ? <div className="settings-message">Review every line and payment field before creating the corrected copy. The voided source remains in the audit trail.</div> : null}<section className="sale-customer-panel"><div><p className="eyebrow">Customer</p><div className="payment-segments">{([['registered', 'Registered'], ['walkIn', 'Walk-in']] as const).map(([value, label]) => <button type="button" className={customerMode === value ? 'payment-segment payment-segment--active' : 'payment-segment'} onClick={() => { setCustomerMode(value); setError(''); }} key={value}>{label}</button>)}</div></div>{isWalkIn ? <div className="sale-walkin-fields"><label className="form-field"><span>Customer name</span><input value={walkInName} onChange={(event) => setWalkInName(event.target.value)} placeholder="Walk-in customer name" autoFocus /></label><label className="form-field"><span>Phone (optional)</span><input type="tel" value={walkInPhone} onChange={(event) => setWalkInPhone(event.target.value)} placeholder="Contact number" /></label><label className="form-field"><span>Email (optional)</span><input type="email" value={walkInEmail} onChange={(event) => setWalkInEmail(event.target.value)} placeholder="name@example.com" /></label></div> : activeCustomers.length ? <><label className="form-field"><span>Registered customer</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{activeCustomers.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.clientId}</option>)}</select></label>{customer ? <div className="customer-context"><strong>{customer.name}</strong><span>{customer.phone || customer.email || 'No contact details'} · {customer.channel}</span>{customer.taxExempt ? <small>Tax exempt: {customer.taxExemptionReason || 'Customer exemption'}</small> : null}</div> : null}</> : <div className="customer-context">No registered customers yet. Add one under Customers, or switch to Walk-in to record this sale.</div>}</section><section className="sale-line-editor"><div className="sale-line-head"><span>Item</span><span>Available</span><span>Unit price</span><span>Qty</span><span>Total</span><span /></div>{lines.map((line, index) => { const product = state.products.find((entry) => entry.id === line.productId); const available = product ? selectProductQuantityOnHand(state, product.id) : 0; return <div className="sale-line-edit" key={`${index}-${line.productId}`}><ProductPicker products={state.products} value={line.productId} currency={currency} onChange={(productId) => updateLine(index, { productId })} /><span className={line.quantity > available ? 'stock-risk' : ''}>{available}</span><strong>{formatCurrency(product?.price ?? 0, currency)}</strong><input type="number" min="1" max={available} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value)) })} /><strong>{formatCurrency((product?.price ?? 0) * line.quantity, currency)}</strong><button className="icon-button" type="button" aria-label="Remove item" title="Remove item" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}><X size={14} /></button></div>;})}<button className="text-button sale-add-line" type="button" onClick={() => setLines((current) => [...current, { productId: state.products[0]?.id ?? '', quantity: 1 }])}><Plus size={14} /> Add item</button></section><section className="sale-payment-panel"><div><p className="eyebrow">Payment</p><div className="payment-segments">{(['paid', 'partial', 'unpaid'] as const).map((value) => <button type="button" className={paymentState === value ? 'payment-segment payment-segment--active' : 'payment-segment'} onClick={() => setPaymentState(value)} key={value}>{value}</button>)}</div></div><label className="form-field"><span>Method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option>Cash</option><option>Mobile Money</option><option>Bank Account</option></select></label>{paymentState === 'partial' ? <label className="form-field"><span>Amount paid</span><input type="number" min="0" max={total} step="0.01" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} /></label> : null}<label className="form-field"><span>Reference</span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="MoMo, bank, cheque, or deposit reference" /></label></section><section className="sale-total-panel"><div><span>Subtotal</span><strong>{formatCurrency(tax.subtotalAmount, currency)}</strong></div>{tax.taxAmount ? <div><span>Tax</span><strong>{formatCurrency(tax.taxAmount, currency)}</strong></div> : null}<div className="sale-grand-total"><span>Invoice total</span><strong>{formatCurrency(total, currency)}</strong></div><div><span>Payment now</span><strong>{formatCurrency(effectivePaid, currency)}</strong></div><div><span>Balance due</span><strong>{formatCurrency(Math.max(0, total - effectivePaid), currency)}</strong></div></section>{impact.items.length ? <SaleImpactPreview impact={impact} currency={currency} /> : null}{error ? <div className="settings-message">{error}</div> : null}</div><div className="composer-footer"><span>Stock and customer ledger update when this invoice is created.</span><button className="primary-button" type="submit" disabled={busy || (isWalkIn ? !walkInName.trim() : !customerId) || !lines.length || lines.some((line) => !line.productId)}>{busy ? 'Creating...' : correctionSource ? 'Create corrected invoice' : 'Create invoice'} <ArrowRight size={15} /></button></div></form></div>;
}

function SaleImpactPreview({ impact, currency }: { impact: ReturnType<typeof previewSaleImpact>; currency: string }) {
  return <section className="sale-impact-panel">
    <div className="sale-impact-head"><ActivitySquare size={15} /><div><strong>Impact preview</strong><span>What this invoice will do when posted.</span></div></div>
    <div className="sale-impact-stock">{impact.items.map((item) => <div className="sale-impact-row" key={item.productId}><span>{item.productName}</span><b className={item.insufficient ? 'stock-risk' : ''}>{item.stockBefore} → <strong className={item.insufficient || item.belowReorderAfter ? 'stock-risk' : ''}>{item.stockAfter}</strong> {item.unit}</b></div>)}</div>
    {impact.customer?.registered && impact.balanceDue > 0 ? <div className="sale-impact-row sale-impact-ledger"><span>{impact.customer.name} balance</span><b>{formatCurrency(impact.customer.balanceBefore, currency)} → <strong className={impact.customer.overLimitAfter ? 'stock-risk' : ''}>{formatCurrency(impact.customer.balanceAfter, currency)}</strong>{impact.customer.creditLimit != null ? <small> / {formatCurrency(impact.customer.creditLimit, currency)} limit</small> : null}</b></div> : null}
    {impact.blockers.map((message, index) => <p className="sale-impact-blocker" key={`b-${index}`}><AlertTriangle size={13} /> {message}</p>)}
    {impact.notices.map((message, index) => <p className="sale-impact-notice" key={`n-${index}`}><Info size={13} /> {message}</p>)}
  </section>;
}

function ProductPicker({ products, value, currency, onChange }: { products: ReturnType<typeof useBusiness>['state']['products']; value: string; currency: string; onChange: (productId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = products.find((product) => product.id === value);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => `${product.name} ${product.inventoryId}`.toLowerCase().includes(needle));
  }, [products, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function choose(productId: string) {
    onChange(productId);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setHighlight((current) => Math.min(current + 1, matches.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((current) => Math.max(current - 1, 0)); }
    else if (event.key === 'Enter') { if (open && matches[highlight]) { event.preventDefault(); choose(matches[highlight].id); } }
    else if (event.key === 'Escape') { setOpen(false); }
  }

  return <div className="product-picker" ref={rootRef}>
    <input type="text" className="product-picker-input" value={open ? query : selected ? `${selected.name} · ${selected.inventoryId}` : ''} placeholder="Search item by name or code" onFocus={() => { setOpen(true); setHighlight(0); }} onChange={(event) => { setQuery(event.target.value); setOpen(true); setHighlight(0); }} onKeyDown={onKeyDown} role="combobox" aria-expanded={open} aria-controls="product-picker-list" />
    {open ? <ul className="product-picker-menu" id="product-picker-list" role="listbox">{matches.length ? matches.map((product, position) => <li key={product.id} role="option" aria-selected={product.id === value} className={position === highlight ? 'product-picker-option product-picker-option--active' : 'product-picker-option'} onMouseEnter={() => setHighlight(position)} onMouseDown={(event) => { event.preventDefault(); choose(product.id); }}><span>{product.name}</span><small>{product.inventoryId} · {formatCurrency(product.price, currency)}</small></li>) : <li className="product-picker-empty">No items match “{query}”.</li>}</ul> : null}
  </div>;
}

function QuotationQueue({ quotations, currency, canConvert, busy, onConvert }: { quotations: ReturnType<typeof useBusiness>['state']['quotations']; currency: string; canConvert: boolean; busy: boolean; onConvert: (id: string) => void }) { return <section className="quotation-queue"><div className="reorder-heading"><div><p className="eyebrow">Pre-sale pipeline</p><h2>Open quotations</h2><p>Convert approved customer intent into controlled invoices without re-entering line items.</p></div><span className="status-pill">{quotations.length} open</span></div><div className="quotation-list">{quotations.map((quote) => <article key={quote.id}><div><strong>{quote.quotationNumber}</strong><span>{quote.customerName} · {formatRelativeDate(quote.createdAt)}</span></div><div><span>{quote.items.length} lines</span><strong>{formatCurrency(quote.totalAmount, currency)}</strong></div><span className="purchase-status purchase-status--warn">{quote.status}</span>{canConvert ? <button className="secondary-button" type="button" disabled={busy} onClick={() => onConvert(quote.id)}>Convert unpaid <Check size={14} /></button> : null}</article>)}</div>{!quotations.length ? <div className="procurement-empty"><ShoppingCart size={22} /><strong>No open quotations</strong><span>Draft and approved quotations will appear here for conversion.</span></div> : null}</section>; }
