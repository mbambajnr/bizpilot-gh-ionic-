'use client';

import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { ClientPurchaseOrderDocument, PaymentMethod, Quotation } from '../../src/data/seedBusiness';
import {
  selectDocumentTaxTotals,
  selectDocumentWithholdingTotals,
  selectQuotationStatusDisplay,
} from '../../src/selectors/businessSelectors';
import { buildTaxSnapshot, buildWithholdingTaxSnapshot, calculateTaxTotals } from '../../src/utils/businessLogic';
import { formatCurrency, formatRelativeDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';
import { deleteClientPurchaseOrder, fetchDocumentStorageConfigured, getClientPurchaseOrderUrl, uploadClientPurchaseOrder } from '../lib/sales-documents';

type PipelineView = 'active' | 'converted' | 'expired' | 'all';
type DraftLine = { id: number; productId: string; quantity: number; productSearch: string; pickerOpen: boolean };

function normalizedStatus(quotation: Quotation) {
  return quotation.status.toLowerCase();
}

function isExpired(quotation: Quotation, now: number) {
  const status = normalizedStatus(quotation);
  return Boolean(quotation.validUntil && Date.parse(quotation.validUntil) < now && ['draft', 'open', 'approved'].includes(status));
}

function isActive(quotation: Quotation, now: number) {
  return !isExpired(quotation, now) && ['draft', 'open', 'approved'].includes(normalizedStatus(quotation));
}

export function EnterpriseQuotations({ initialQuotationId = '' }: { initialQuotationId?: string }) {
  return <EnterpriseApp><EnterpriseQuotationsView initialQuotationId={initialQuotationId} /></EnterpriseApp>;
}

function EnterpriseQuotationsView({ initialQuotationId }: { initialQuotationId: string }) {
  const { state, currentUser, hasPermission, addQuotation, registerQuotationProspect, convertQuotationToSale, addQuotationClientPo, removeQuotationClientPo } = useBusiness();
  const [pageOpenedAt] = useState(() => new Date().getTime());
  const [view, setView] = useState<PipelineView>('active');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialQuotationId || state.quotations[0]?.id || '');
  const [composerOpen, setComposerOpen] = useState(false);
  const [conversionTarget, setConversionTarget] = useState<Quotation | null>(null);
  const [registrationTarget, setRegistrationTarget] = useState<Quotation | null>(null);
  const [message, setMessage] = useState('');
  const currency = state.businessProfile.currency;
  const canCreate = hasPermission('quotations.create');
  const canConvert = hasPermission('quotations.convert');
  const canRegisterCustomers = hasPermission('customers.create');
  const canPrint = hasPermission('quotations.print');
  const canExport = hasPermission('quotations.export_pdf');
  const active = state.quotations.filter((quotation) => isActive(quotation, pageOpenedAt));
  const converted = state.quotations.filter((quotation) => normalizedStatus(quotation) === 'converted');
  const expired = state.quotations.filter((quotation) => isExpired(quotation, pageOpenedAt));
  const pipelineValue = active.reduce((sum, quotation) => sum + (quotation.netReceivableAmount ?? quotation.totalAmount), 0);
  const expiringSoon = active.filter((quotation) => quotation.validUntil && Date.parse(quotation.validUntil) - pageOpenedAt <= 3 * 24 * 60 * 60 * 1000).length;
  const scoped = view === 'active' ? active : view === 'converted' ? converted : view === 'expired' ? expired : state.quotations;
  const filtered = [...scoped].filter((quotation) => `${quotation.quotationNumber} ${quotation.customerName} ${quotation.clientId} ${quotation.items.map((item) => item.productName).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const selected = filtered.find((quotation) => quotation.id === selectedId) ?? state.quotations.find((quotation) => quotation.id === initialQuotationId) ?? filtered[0];

  function convert(quotation: Quotation, paymentMethod: PaymentMethod, amountPaid: number, clientPoDocumentId?: string) {
    const result = convertQuotationToSale({ quotationId: quotation.id, paymentMethod, amountPaid, clientPoDocumentId });
    if (!result.ok) { setMessage(result.message); return false; }
    setMessage(`${result.quotationNumber} converted into an invoice.`);
    setConversionTarget(null);
    setView('converted');
    return true;
  }

  async function attachClientPo(quotation: Quotation, file: File, poNumber: string) {
    try {
      const upload = await uploadClientPurchaseOrder(file, { quotationId: quotation.id, businessId: state.businessProfile.id, poNumber, user: currentUser });
      const result = await addQuotationClientPo({
        quotationId: quotation.id,
        poNumber: upload.document.poNumber,
        name: upload.document.name,
        storagePath: upload.document.storagePath,
        mimeType: upload.document.mimeType,
        size: upload.document.size,
        uploadedBy: upload.document.uploadedBy,
      });
      setMessage(result.message ?? (result.ok ? 'Client PO attached to the quotation.' : 'The client PO could not be attached.'));
      return result.ok;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The client PO upload could not be completed.');
      return false;
    }
  }

  async function openClientPo(quotation: Quotation, document: ClientPurchaseOrderDocument) {
    try {
      if (document.url) {
        window.open(document.url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!document.storagePath) {
        setMessage('This client PO does not have an available document link.');
        return;
      }
      const { url } = await getClientPurchaseOrderUrl({ quotationId: quotation.id, businessId: state.businessProfile.id, storagePath: document.storagePath, user: currentUser });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The client PO could not be opened.');
    }
  }

  async function removeClientPo(quotation: Quotation, document: ClientPurchaseOrderDocument) {
    try {
      if (document.storagePath) {
        await deleteClientPurchaseOrder({ quotationId: quotation.id, businessId: state.businessProfile.id, storagePath: document.storagePath, user: currentUser });
      }
      const result = await removeQuotationClientPo({ quotationId: quotation.id, documentId: document.id, removedBy: currentUser.userId });
      if (!result.ok) {
        setMessage(result.message);
        return false;
      }
      setMessage(result.message ?? 'Client PO removed from the quotation.');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The client PO could not be removed.');
      return false;
    }
  }

  return <EnterpriseShell active="Quotations"><div className="page-content quotations-native-page">
    <section className="page-heading quotations-heading"><div><p className="eyebrow">Pre-sales control</p><h1>Quotation pipeline</h1><p>Prepare customer offers, control validity, and convert accepted terms without re-entering invoice data.</p></div>{canCreate ? <button className="primary-button" type="button" onClick={() => setComposerOpen(true)}><Plus size={16} /> New quotation</button> : null}</section>
    <section className="quotation-metrics" aria-label="Quotation pipeline summary">
      <QuotationMetric icon={FileCheck2} label="Active quotations" value={String(active.length)} note={`${formatCurrency(pipelineValue, currency)} pipeline value`} />
      <QuotationMetric icon={CalendarClock} label="Expiring soon" value={String(expiringSoon)} note="Within the next 3 days" tone={expiringSoon ? 'warn' : 'good'} />
      <QuotationMetric icon={ReceiptText} label="Converted" value={String(converted.length)} note="Invoices created from quotes" tone="good" />
      <QuotationMetric icon={CircleDollarSign} label="Converted value" value={formatCurrency(converted.reduce((sum, quotation) => sum + quotation.totalAmount, 0), currency)} note="Historical quoted value" />
    </section>
    <nav className="quotation-tabs" aria-label="Quotation pipeline views">{([['active', `Active (${active.length})`], ['converted', `Converted (${converted.length})`], ['expired', `Expired (${expired.length})`], ['all', `All (${state.quotations.length})`]] as const).map(([value, label]) => <button type="button" className={view === value ? 'quotation-tab quotation-tab--active' : 'quotation-tab'} onClick={() => setView(value)} key={value}>{label}</button>)}</nav>
    {message ? <div className="settings-message" role="status">{message}</div> : null}
    <section className="quotation-workspace"><div className="quotation-list-panel"><div className="quotation-toolbar"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quotation, customer, or item" /></label><span>{filtered.length} documents</span></div><div className="quotation-table-wrap"><table className="quotation-table"><thead><tr><th>Quotation</th><th>Customer</th><th>Validity</th><th>Value</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((quotation) => { const display = selectQuotationStatusDisplay(quotation); return <tr className={selected?.id === quotation.id ? 'quotation-row quotation-row--selected' : 'quotation-row'} onClick={() => setSelectedId(quotation.id)} key={quotation.id}><td><strong>{quotation.quotationNumber}</strong><span>{quotation.items.length} lines · {formatRelativeDate(quotation.createdAt)}</span></td><td><strong>{quotation.customerName}</strong><span>{quotation.clientId}</span></td><td>{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'Not set'}</td><td><strong>{formatCurrency(quotation.netReceivableAmount ?? quotation.totalAmount, currency)}</strong></td><td><span className={`quotation-status quotation-status--${display.tone}`}>{display.label}</span></td><td><ChevronRight size={15} /></td></tr>;})}</tbody></table>{!filtered.length ? <QuotationEmpty canCreate={canCreate && view === 'active'} onCreate={() => setComposerOpen(true)} /> : null}</div></div>
      <QuotationInspector quotation={selected} state={state} currency={currency} now={pageOpenedAt} canConvert={canConvert} canRegisterCustomers={canRegisterCustomers} canManageClientPo={canCreate || canConvert} canPrint={canPrint} canExport={canExport} onConvert={setConversionTarget} onRegister={setRegistrationTarget} onUploadClientPo={attachClientPo} onOpenClientPo={openClientPo} onRemoveClientPo={removeClientPo} />
    </section>
  </div>{composerOpen ? <QuotationComposer state={state} currency={currency} onClose={() => setComposerOpen(false)} onCreate={(input) => { const result = addQuotation(input); setMessage(result.ok ? 'Quotation created and added to the active pipeline.' : result.message); if (result.ok) { setComposerOpen(false); setView('active'); } return result.ok; }} /> : null}{registrationTarget ? <ProspectRegistrationDialog quotation={registrationTarget} state={state} onClose={() => setRegistrationTarget(null)} onRegister={(existingCustomerId, customerType) => { const result = registerQuotationProspect({ quotationId: registrationTarget.id, existingCustomerId, customerType }); setMessage(result.ok ? `${registrationTarget.customerName} registered as ${result.clientId}. Future documents can use the customer account.` : result.message); if (result.ok) setRegistrationTarget(null); return result.ok; }} /> : null}{conversionTarget ? <ConversionDialog quotation={conversionTarget} currency={currency} onClose={() => setConversionTarget(null)} onConvert={convert} /> : null}</EnterpriseShell>;
}

function QuotationMetric({ icon: Icon, label, value, note, tone = 'neutral' }: { icon: typeof FileText; label: string; value: string; note: string; tone?: 'neutral' | 'good' | 'warn' }) { return <article><div><Icon size={14} /><span>{label}</span></div><strong>{value}</strong><small className={`quotation-metric-note quotation-metric-note--${tone}`}>{note}</small></article>; }

function QuotationInspector({ quotation, state, currency, now, canConvert, canRegisterCustomers, canManageClientPo, canPrint, canExport, onConvert, onRegister, onUploadClientPo, onOpenClientPo, onRemoveClientPo }: { quotation?: Quotation; state: ReturnType<typeof useBusiness>['state']; currency: string; now: number; canConvert: boolean; canRegisterCustomers: boolean; canManageClientPo: boolean; canPrint: boolean; canExport: boolean; onConvert: (quotation: Quotation) => void; onRegister: (quotation: Quotation) => void; onUploadClientPo: (quotation: Quotation, file: File, poNumber: string) => Promise<boolean>; onOpenClientPo: (quotation: Quotation, document: ClientPurchaseOrderDocument) => Promise<void>; onRemoveClientPo: (quotation: Quotation, document: ClientPurchaseOrderDocument) => Promise<boolean> }) {
  if (!quotation) return <aside className="quotation-inspector quotation-inspector--empty"><FileText size={25} /><strong>Select a quotation</strong><span>Customer terms, validity, line items, and conversion controls will appear here.</span></aside>;
  const customer = state.customers.find((entry) => entry.id === quotation.customerId);
  const tax = selectDocumentTaxTotals(quotation);
  const withholding = selectDocumentWithholdingTotals(quotation);
  const status = selectQuotationStatusDisplay(quotation);
  const convertible = isActive(quotation, now);
  return <aside className="quotation-inspector"><div className="quotation-inspector-head"><div><p className="eyebrow">Customer quotation</p><h2>{quotation.quotationNumber}</h2><span>{quotation.customerName} · {quotation.clientId}</span></div><span className={`quotation-status quotation-status--${status.tone}`}>{status.label}</span></div>
    <div className="quotation-validity"><div><Clock3 size={14} /><span><small>Created</small><strong>{new Date(quotation.createdAt).toLocaleDateString()}</strong></span></div><div><CalendarClock size={14} /><span><small>Valid until</small><strong>{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'Not specified'}</strong></span></div></div>
    <div className={quotation.customerType === 'prospect' ? 'quotation-customer-context quotation-customer-context--prospect' : 'quotation-customer-context'}><Users size={14} /><span><strong>{customer?.name ?? quotation.customerName}</strong><small>{customer?.email || customer?.phone || quotation.prospect?.email || quotation.prospect?.phone || 'No customer contact recorded'}{quotation.customerType === 'prospect' ? ' · Prospect' : quotation.customerTypeSnapshot ? ` · ${quotation.customerTypeSnapshot}` : ''}</small></span></div>
    <div className="quotation-line-preview"><div className="quotation-section-heading"><strong>Commercial lines</strong><span>{quotation.items.length} items</span></div>{quotation.items.map((item) => <div key={`${quotation.id}-${item.productId}`}><span><strong>{item.productName}</strong><small>{item.inventoryId} · {item.quantity} × {formatCurrency(item.unitPrice, currency)}</small></span><b>{formatCurrency(item.total, currency)}</b></div>)}</div>
    <dl className="quotation-totals"><div><dt>Subtotal</dt><dd>{formatCurrency(tax.subtotalAmount, currency)}</dd></div>{tax.hasTax ? <div><dt>{tax.isExempt ? 'Tax exempt' : `Tax (${tax.taxRate}%)`}</dt><dd>{formatCurrency(tax.taxAmount, currency)}</dd></div> : null}<div><dt>Gross total</dt><dd>{formatCurrency(quotation.totalAmount, currency)}</dd></div>{withholding.hasWithholding ? <><div><dt>{withholding.label}</dt><dd>-{formatCurrency(withholding.amount, currency)}</dd></div><div className="quotation-net-total"><dt>Net receivable</dt><dd>{formatCurrency(withholding.netReceivableAmount, currency)}</dd></div></> : null}</dl>
    {tax.isExempt ? <div className="quotation-control-note"><ShieldCheck size={14} /><span><strong>Tax exemption applied</strong><small>{tax.exemptionReason || 'Customer exemption snapshot'}</small></span></div> : null}
    {quotation.customerType === 'prospect' ? <div className="quotation-prospect-note"><UserPlus size={15} /><span><strong>Prospect quotation</strong><small>You can invoice now using the prospect snapshot, then register or link the customer later.</small></span></div> : null}
    <ClientPurchaseOrderPanel quotation={quotation} canManage={canManageClientPo && normalizedStatus(quotation) !== 'converted'} onUpload={onUploadClientPo} onOpen={onOpenClientPo} onRemove={onRemoveClientPo} />
    <div className="quotation-inspector-actions">{canPrint ? <button className="icon-button" type="button" aria-label="Print quotation" title="Print quotation" onClick={() => window.print()}><Printer size={15} /></button> : null}{canExport ? <button className="icon-button" type="button" aria-label="Export quotation as PDF" title="Export quotation as PDF" onClick={() => window.print()}><FileText size={15} /></button> : null}<Link className="secondary-button" href={`/quotations/${quotation.id}`}><ReceiptText size={14} /> Open document</Link>{quotation.customerType === 'prospect' && canRegisterCustomers ? <button className="secondary-button" type="button" onClick={() => onRegister(quotation)}><UserPlus size={14} /> Register customer</button> : null}{canConvert && convertible ? <button className="primary-button" type="button" onClick={() => onConvert(quotation)}>Convert to invoice <ArrowRight size={14} /></button> : null}</div>
    {!convertible && normalizedStatus(quotation) !== 'converted' ? <div className="quotation-blocked-note">{status.helper}</div> : null}{quotation.convertedInvoiceId ? <Link className="quotation-converted-link" href={`/sales/${quotation.convertedInvoiceId}`}><Check size={14} /> Open converted invoice <ChevronRight size={14} /></Link> : null}
  </aside>;
}

function ClientPurchaseOrderPanel({ quotation, canManage, onUpload, onOpen, onRemove }: { quotation: Quotation; canManage: boolean; onUpload: (quotation: Quotation, file: File, poNumber: string) => Promise<boolean>; onOpen: (quotation: Quotation, document: ClientPurchaseOrderDocument) => Promise<void>; onRemove: (quotation: Quotation, document: ClientPurchaseOrderDocument) => Promise<boolean> }) {
  const [poNumber, setPoNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageConfigured, setStorageConfigured] = useState<boolean | null>(null);
  const documents = quotation.clientPurchaseOrders ?? [];

  useEffect(() => {
    let cancelled = false;
    void fetchDocumentStorageConfigured().then((configured) => { if (!cancelled) setStorageConfigured(configured); });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!poNumber.trim()) {
      setError('Enter the client PO number.');
      return;
    }
    if (!file) {
      setError('Choose the approved PO PDF.');
      return;
    }
    setBusy(true);
    setError('');
    const ok = await onUpload(quotation, file, poNumber.trim());
    setBusy(false);
    if (ok) {
      setPoNumber('');
      setFile(null);
    } else {
      setError('The client PO could not be attached.');
    }
  }

  return <section className="quotation-po-panel"><div className="quotation-section-heading"><strong>Client purchase order</strong><span>{documents.length ? `${documents.length} attached` : 'Approval evidence'}</span></div>
    <div className="quotation-po-list">{documents.map((document) => <div className="quotation-po-item" key={document.id}><FileCheck2 size={15} /><span><strong>{document.poNumber}</strong><small>{document.name} · {new Date(document.uploadedAt).toLocaleDateString()}</small></span><button className="icon-button" type="button" aria-label="Open client PO" title="Open client PO" onClick={() => void onOpen(quotation, document)}><ExternalLink size={14} /></button>{canManage ? <button className="icon-button" type="button" aria-label="Remove client PO" title="Remove client PO" onClick={() => void onRemove(quotation, document)}><Trash2 size={14} /></button> : null}</div>)}{!documents.length ? <p>No approved client PO has been attached yet.</p> : null}</div>
    {canManage && storageConfigured === false ? <div className="quotation-po-unavailable"><ShieldAlert size={15} /><span><strong>Document storage isn&apos;t set up</strong><small>An administrator needs to set <code>SUPABASE_SERVICE_ROLE_KEY</code> and create a private <code>sales-documents</code> bucket before client POs can be attached.</small></span></div> : null}
    {canManage && storageConfigured !== false ? <form className="quotation-po-upload" onSubmit={(event) => void submit(event)}><label className="form-field"><span>Client PO number</span><input value={poNumber} onChange={(event) => setPoNumber(event.target.value)} placeholder="e.g. PO-2026-1048" disabled={storageConfigured === null} /></label><label className="quotation-file-drop"><Upload size={15} /><span>{file?.name ?? 'Choose PO PDF'}</span><input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={storageConfigured === null} /></label>{error ? <small className="quotation-po-error">{error}</small> : null}<button className="secondary-button" type="submit" disabled={busy || storageConfigured === null}>{busy ? 'Uploading...' : storageConfigured === null ? 'Checking storage…' : 'Attach PO'}</button></form> : null}
  </section>;
}

function QuotationComposer({ state, currency, onClose, onCreate }: { state: ReturnType<typeof useBusiness>['state']; currency: string; onClose: () => void; onCreate: (input: Parameters<ReturnType<typeof useBusiness>['addQuotation']>[0]) => boolean }) {
  const customers = state.customers.filter((customer) => customer.status !== 'terminated');
  function createLine(id: number, product = state.products[0]): DraftLine {
    return { id, productId: product?.id ?? '', quantity: 1, productSearch: product ? `${product.name} ${product.inventoryId}` : '', pickerOpen: false };
  }
  const [partyMode, setPartyMode] = useState<'registered' | 'prospect'>(customers.length ? 'registered' : 'prospect');
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [prospectName, setProspectName] = useState('');
  const [prospectContact, setProspectContact] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectLocation, setProspectLocation] = useState('');
  const [prospectNotes, setProspectNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [createLine(1)]);
  const [nextLineId, setNextLineId] = useState(2);
  const [validUntil, setValidUntil] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);
  const [taxReason, setTaxReason] = useState('');
  const [withholdingEnabled, setWithholdingEnabled] = useState(state.businessProfile.withholdingTaxEnabled);
  const [error, setError] = useState('');
  const customer = partyMode === 'registered' ? customers.find((entry) => entry.id === customerId) : undefined;
  const subtotal = lines.reduce((sum, line) => sum + (state.products.find((product) => product.id === line.productId)?.price ?? 0) * line.quantity, 0);
  const effectiveExempt = taxExempt || Boolean(customer?.taxExempt);
  const tax = calculateTaxTotals(subtotal, buildTaxSnapshot(state.businessProfile, { exempt: effectiveExempt, exemptionReason: taxReason.trim() || customer?.taxExemptionReason }));
  const withholding = buildWithholdingTaxSnapshot(state.businessProfile, tax, withholdingEnabled);
  const net = tax.totalAmount - (withholding?.amount ?? 0);
  function updateLine(id: number, update: Partial<DraftLine>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...update } : line)); }
  function submit(event: FormEvent) { event.preventDefault(); if (partyMode === 'registered' && !customerId) { setError('Choose an active customer.'); return; } if (partyMode === 'prospect' && !prospectName.trim()) { setError('Enter the prospect business or client name.'); return; } if (partyMode === 'prospect' && !prospectPhone.trim() && !prospectEmail.trim()) { setError('Add a phone number or email address for the prospect.'); return; } if (!lines.length || lines.some((line) => !line.productId || line.quantity < 1)) { setError('Every quotation line needs a product and quantity.'); return; } if (effectiveExempt && !taxReason.trim() && !customer?.taxExemptionReason) { setError('Record the tax exemption reason.'); return; } let expiry = validUntil; if (!expiry) { const defaultExpiry = new Date(); defaultExpiry.setDate(defaultExpiry.getDate() + 7); expiry = defaultExpiry.toISOString().slice(0, 10); } onCreate({ customerId: partyMode === 'registered' ? customerId : undefined, prospect: partyMode === 'prospect' ? { name: prospectName, contactName: prospectContact, phone: prospectPhone, email: prospectEmail, location: prospectLocation, notes: prospectNotes } : undefined, items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })), status: 'Draft', validUntil: expiry, taxExempt: state.businessProfile.taxEnabled ? effectiveExempt : undefined, taxExemptionReason: effectiveExempt ? taxReason.trim() || customer?.taxExemptionReason : undefined, applyWithholdingTax: state.businessProfile.taxEnabled ? withholdingEnabled : undefined }); }
  return <div className="composer-backdrop"><form className="quotation-composer" onSubmit={submit}><div className="composer-heading"><div><p className="eyebrow">New customer offer</p><h2>Create quotation</h2></div><button className="icon-button" type="button" aria-label="Close quotation" title="Close quotation" onClick={onClose}><X size={18} /></button></div><div className="quotation-composer-body">
    <section className="quotation-party-section"><div className="quotation-party-mode" role="tablist" aria-label="Quotation client type"><button type="button" className={partyMode === 'registered' ? 'is-active' : ''} onClick={() => setPartyMode('registered')} disabled={!customers.length}>Registered customer</button><button type="button" className={partyMode === 'prospect' ? 'is-active' : ''} onClick={() => setPartyMode('prospect')}>New prospect</button></div><div className="quotation-party-grid">{partyMode === 'registered' ? <label className="form-field"><span>Customer</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.clientId}</option>)}</select></label> : <><label className="form-field"><span>Business or client name</span><input value={prospectName} onChange={(event) => setProspectName(event.target.value)} placeholder="e.g. Northstar Hotels" /></label><label className="form-field"><span>Contact person <small>Optional</small></span><input value={prospectContact} onChange={(event) => setProspectContact(event.target.value)} /></label><label className="form-field"><span>Phone</span><input value={prospectPhone} onChange={(event) => setProspectPhone(event.target.value)} inputMode="tel" /></label><label className="form-field"><span>Email</span><input value={prospectEmail} onChange={(event) => setProspectEmail(event.target.value)} type="email" /></label><label className="form-field"><span>Location <small>Optional</small></span><input value={prospectLocation} onChange={(event) => setProspectLocation(event.target.value)} /></label></>}<label className="form-field"><span>Valid until <small>Defaults to 7 days</small></span><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>{partyMode === 'registered' && customer ? <div className="quotation-party-context"><strong>{customer.name}</strong><span>{customer.email || customer.phone || 'No contact details'} · {customer.customerType ?? 'Unclassified'}</span></div> : null}{partyMode === 'prospect' ? <label className="form-field quotation-prospect-notes"><span>Request notes <small>Optional</small></span><textarea value={prospectNotes} onChange={(event) => setProspectNotes(event.target.value)} placeholder="Tender reference, delivery expectation, or request context" /></label> : null}</div></section>
    <section className="quotation-line-editor"><div className="quotation-line-head"><span>Product</span><span>Unit price</span><span>Quantity</span><span>Total</span><span /></div>{lines.map((line) => {
      const product = state.products.find((entry) => entry.id === line.productId);
      const queryText = line.productSearch.trim().toLowerCase();
      const results = state.products.filter((entry) => !queryText || `${entry.name} ${entry.inventoryId} ${entry.unit}`.toLowerCase().includes(queryText)).slice(0, 8);
      return <div className="quotation-line-edit" key={line.id}><div className="quotation-product-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) updateLine(line.id, { pickerOpen: false }); }}><label><Search size={13} /><span><input value={line.productSearch} onFocus={() => updateLine(line.id, { pickerOpen: true })} onChange={(event) => updateLine(line.id, { productId: '', productSearch: event.target.value, pickerOpen: true })} placeholder="Search product name or code" /><small>{product?.inventoryId ?? 'Select a product'}</small></span></label>{line.pickerOpen ? <div className="quotation-product-results">{results.length ? results.map((entry) => <button type="button" key={entry.id} onMouseDown={(event) => event.preventDefault()} onClick={() => updateLine(line.id, { productId: entry.id, productSearch: `${entry.name} ${entry.inventoryId}`, pickerOpen: false })}><span><strong>{entry.name}</strong><small>{entry.inventoryId} · {entry.unit}</small></span><b>{formatCurrency(entry.price, currency)}</b></button>) : <div className="quotation-product-empty">No matching product</div>}</div> : null}</div><strong>{formatCurrency(product?.price ?? 0, currency)}</strong><input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Math.max(1, Number(event.target.value)) })} /><strong>{formatCurrency((product?.price ?? 0) * line.quantity, currency)}</strong><button className="icon-button" type="button" aria-label="Remove line" title="Remove line" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={14} /></button></div>;
    })}<button className="text-button quotation-add-line" type="button" onClick={() => { setLines((current) => [...current, createLine(nextLineId)]); setNextLineId((value) => value + 1); }}><Plus size={14} /> Add item</button></section>
    {state.businessProfile.taxEnabled ? <section className="quotation-tax-panel"><label><input type="checkbox" checked={taxExempt} onChange={(event) => setTaxExempt(event.target.checked)} disabled={Boolean(customer?.taxExempt)} /><span><strong>Tax exempt</strong><small>{customer?.taxExempt ? 'Inherited from customer account' : 'Apply exemption to this quotation'}</small></span></label>{effectiveExempt && !customer?.taxExemptionReason ? <label className="form-field"><span>Exemption reason</span><input value={taxReason} onChange={(event) => setTaxReason(event.target.value)} /></label> : null}{state.businessProfile.withholdingTaxEnabled ? <label><input type="checkbox" checked={withholdingEnabled} onChange={(event) => setWithholdingEnabled(event.target.checked)} /><span><strong>Apply withholding tax</strong><small>{state.businessProfile.defaultWithholdingTaxLabel}</small></span></label> : null}</section> : null}
    <section className="quotation-preview-total"><div><span>Subtotal</span><strong>{formatCurrency(tax.subtotalAmount, currency)}</strong></div>{tax.taxAmount ? <div><span>Tax</span><strong>{formatCurrency(tax.taxAmount, currency)}</strong></div> : null}<div><span>Gross quotation</span><strong>{formatCurrency(tax.totalAmount, currency)}</strong></div>{withholding ? <div><span>{withholding.label}</span><strong>-{formatCurrency(withholding.amount, currency)}</strong></div> : null}<div className="quotation-preview-net"><span>Net receivable</span><strong>{formatCurrency(net, currency)}</strong></div></section>
    {error ? <div className="settings-message" role="alert">{error}</div> : null}
  </div><div className="composer-footer"><span>{partyMode === 'prospect' ? 'Prospect details are snapshotted and can be invoiced before customer registration.' : 'Prices and tax treatment are snapshotted when the quotation is created.'}</span><button className="primary-button" type="submit" disabled={!state.products.length}>Create quotation <ArrowRight size={15} /></button></div></form></div>;
}

function ProspectRegistrationDialog({ quotation, state, onClose, onRegister }: { quotation: Quotation; state: ReturnType<typeof useBusiness>['state']; onClose: () => void; onRegister: (existingCustomerId?: string, customerType?: 'B2B' | 'B2C') => boolean }) {
  const customers = state.customers.filter((customer) => customer.status !== 'terminated');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [existingCustomerId, setExistingCustomerId] = useState(customers[0]?.id ?? '');
  const [customerType, setCustomerType] = useState<'B2B' | 'B2C'>(quotation.prospect?.name ? 'B2B' : 'B2C');
  const [error, setError] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (mode === 'existing' && !existingCustomerId) { setError('Choose an active customer.'); return; } if (!onRegister(mode === 'existing' ? existingCustomerId : undefined, state.businessProfile.customerClassificationEnabled ? customerType : undefined)) setError('The prospect could not be registered.'); }
  return <div className="dialog-backdrop"><form className="quotation-registration-dialog" onSubmit={submit}><div className="quotation-conversion-head"><i><UserPlus size={20} /></i><div><p className="eyebrow">Customer onboarding</p><h2>Register quotation prospect</h2><span>{quotation.customerName} · {quotation.quotationNumber}</span></div><button className="icon-button" type="button" aria-label="Close registration" title="Close registration" onClick={onClose}><X size={17} /></button></div><div className="quotation-conversion-body"><div className="quotation-party-mode"><button type="button" className={mode === 'new' ? 'is-active' : ''} onClick={() => setMode('new')}>Create customer</button><button type="button" className={mode === 'existing' ? 'is-active' : ''} onClick={() => setMode('existing')} disabled={!customers.length}>Link existing</button></div>{mode === 'new' ? <div className="prospect-registration-summary"><strong>{quotation.prospect?.name}</strong><span>{quotation.prospect?.contactName || 'No contact person specified'}</span><span>{[quotation.prospect?.phone, quotation.prospect?.email].filter(Boolean).join(' · ')}</span>{quotation.prospect?.location ? <span>{quotation.prospect.location}</span> : null}</div> : <label className="form-field"><span>Existing customer</span><select value={existingCustomerId} onChange={(event) => setExistingCustomerId(event.target.value)}>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.clientId}</option>)}</select></label>}{mode === 'new' && state.businessProfile.customerClassificationEnabled ? <label className="form-field"><span>Customer type</span><select value={customerType} onChange={(event) => setCustomerType(event.target.value as 'B2B' | 'B2C')}><option value="B2B">Business (B2B)</option><option value="B2C">Consumer (B2C)</option></select></label> : null}<div className="quotation-prospect-note"><ShieldCheck size={15} /><span><strong>Controlled conversion</strong><small>The original prospect snapshot remains on the quotation for audit history.</small></span></div>{error ? <div className="settings-message" role="alert">{error}</div> : null}</div><div className="quotation-conversion-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><UserPlus size={14} /> {mode === 'new' ? 'Create and link customer' : 'Link customer'}</button></div></form></div>;
}

function ConversionDialog({ quotation, currency, onClose, onConvert }: { quotation: Quotation; currency: string; onClose: () => void; onConvert: (quotation: Quotation, method: PaymentMethod, amountPaid: number, clientPoDocumentId?: string) => boolean }) {
  const [paymentState, setPaymentState] = useState<'paid' | 'partial' | 'unpaid'>('unpaid');
  const [method, setMethod] = useState<PaymentMethod>('Bank Account');
  const [amount, setAmount] = useState(0);
  const [clientPoDocumentId, setClientPoDocumentId] = useState(quotation.clientPurchaseOrders?.[0]?.id ?? '');
  const [error, setError] = useState('');
  const invoiceTotal = quotation.netReceivableAmount ?? quotation.totalAmount;
  const paid = paymentState === 'paid' ? invoiceTotal : paymentState === 'unpaid' ? 0 : amount;
  function submit(event: FormEvent) { event.preventDefault(); if (paid < 0 || paid > invoiceTotal) { setError('Payment must be between zero and the invoice total.'); return; } if (!onConvert(quotation, method, paid, clientPoDocumentId || undefined)) setError('The quotation could not be converted.'); }
  return <div className="dialog-backdrop"><form className="quotation-conversion-dialog" onSubmit={submit}><div className="quotation-conversion-head"><i><ShoppingCart size={20} /></i><div><p className="eyebrow">Convert quotation</p><h2>{quotation.quotationNumber}</h2><span>{quotation.customerName} · {formatCurrency(invoiceTotal, currency)}</span></div><button className="icon-button" type="button" aria-label="Close conversion" title="Close conversion" onClick={onClose}><X size={17} /></button></div><div className="quotation-conversion-body">{quotation.customerType === 'prospect' ? <div className="quotation-prospect-note"><ShieldCheck size={15} /><span><strong>Prospect invoice</strong><small>The invoice will use this prospect snapshot. You can register or link the customer later.</small></span></div> : null}{quotation.clientPurchaseOrders?.length ? <label className="form-field"><span>Client PO evidence</span><select value={clientPoDocumentId} onChange={(event) => setClientPoDocumentId(event.target.value)}>{quotation.clientPurchaseOrders.map((document) => <option value={document.id} key={document.id}>{document.poNumber} · {document.name}</option>)}</select></label> : <div className="quotation-prospect-note"><FileCheck2 size={15} /><span><strong>No client PO attached</strong><small>You can still create the invoice, but attach PO evidence when the client sends it.</small></span></div>}<label><span>Invoice payment state</span><div className="payment-segments">{(['unpaid', 'partial', 'paid'] as const).map((value) => <button type="button" className={paymentState === value ? 'payment-segment payment-segment--active' : 'payment-segment'} onClick={() => setPaymentState(value)} key={value}>{value}</button>)}</div></label><label className="form-field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option>Bank Account</option><option>Mobile Money</option><option>Cash</option></select></label>{paymentState === 'partial' ? <label className="form-field"><span>Amount received</span><input type="number" min="0" max={invoiceTotal} step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label> : null}<div className="quotation-conversion-summary"><span>Invoice balance after conversion</span><strong>{formatCurrency(Math.max(0, invoiceTotal - paid), currency)}</strong></div>{error ? <div className="settings-message" role="alert">{error}</div> : null}</div><div className="quotation-conversion-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Create invoice <ArrowRight size={14} /></button></div></form></div>;
}

function QuotationEmpty({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) { return <div className="quotation-empty"><Send size={23} /><strong>No quotations in this view</strong><span>New customer offers and their conversion status will appear here.</span>{canCreate ? <button className="secondary-button" type="button" onClick={onCreate}><Plus size={14} /> New quotation</button> : null}</div>; }
