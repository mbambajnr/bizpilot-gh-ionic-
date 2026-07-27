'use client';

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { type FormEvent, useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import type { CreditNote, PaymentChannel, ReturnDisposition, Sale } from '../../src/data/seedBusiness';
import {
  selectCustomerLedgerEntries,
  selectDocumentTaxTotals,
  selectDocumentWithholdingTotals,
  selectLedgerEntryDisplay,
  selectSaleBalanceRemaining,
  selectSalePaymentStatus,
  selectStockMovementDisplay,
} from '../../src/selectors/businessSelectors';
import { formatCurrency, formatReceiptDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

export function EnterpriseInvoice({ saleId }: { saleId: string }) {
  return <EnterpriseApp><EnterpriseInvoiceView saleId={saleId} /></EnterpriseApp>;
}

function EnterpriseInvoiceView({ saleId }: { saleId: string }) {
  const { state, currentUser, hasPermission, reverseSale, createSalesReturn, recordSalePayment, updateSalePaymentReference } = useBusiness();
  const sale = state.sales.find((entry) => entry.id === saleId);
  const customer = state.customers.find((entry) => entry.id === sale?.customerId);
  const [generatedAt] = useState(() => new Date());
  const [paymentReference, setPaymentReference] = useState(sale?.paymentReference ?? '');
  const [message, setMessage] = useState('');
  const [reverseOpen, setReverseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const currency = state.businessProfile.currency;

  if (!hasPermission('invoices.view')) return <EnterpriseShell active="Sales"><div className="page-content enterprise-document-missing"><ShieldAlert size={26} /><h1>Invoice access restricted</h1><p>This role is not authorized to view invoice documents.</p><Link className="secondary-button" href="/dashboard"><ArrowLeft size={14} /> Return to dashboard</Link></div></EnterpriseShell>;
  if (!sale) return <EnterpriseShell active="Sales"><div className="page-content enterprise-document-missing"><FileText size={26} /><h1>Invoice not found</h1><p>This invoice may have been removed or the link is invalid.</p><Link className="secondary-button" href="/sales"><ArrowLeft size={14} /> Return to Sales</Link></div></EnterpriseShell>;

  const invoice = sale;
  const balance = selectSaleBalanceRemaining(sale);
  const tax = selectDocumentTaxTotals(sale);
  const withholding = selectDocumentWithholdingTotals(sale);
  const customerName = customer?.name ?? sale.customerSnapshot?.name ?? 'Customer';
  const customerEmail = customer?.email ?? sale.customerSnapshot?.email ?? '';
  const phone = customer?.whatsapp?.trim() || customer?.phone?.trim() || sale.customerSnapshot?.phone?.trim() || '';
  const stockMovements = state.stockMovements.filter((entry) => entry.relatedSaleId === sale.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const ledgerEntries = customer ? selectCustomerLedgerEntries(state, customer.id).filter((entry) => entry.relatedSaleId === sale.id) : [];
  const activity = state.activityLogEntries.filter((entry) => entry.entityId === sale.id || entry.relatedSaleId === sale.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const invoicePayments = state.payments.filter((entry) => ['invoice', 'sale'].includes(entry.sourceType) && entry.sourceId === sale.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const creditNotes = state.creditNotes.filter((entry) => entry.saleId === sale.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const refunds = state.customerRefunds.filter((entry) => entry.saleId === sale.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const canPrint = hasPermission('invoices.print');
  const canExport = hasPermission('invoices.export_pdf');
  const canEmail = hasPermission('customers.email.send');
  const canRecordPayments = hasPermission('payments.record');
  const canViewLedger = hasPermission('customers.ledger.view');
  const canReverse = hasPermission('sales.reverse');
  const canReturn = hasPermission('sales.reverse');
  const canCorrect = hasPermission('sales.create');

  function emailInvoice() {
    if (!customerEmail) { setMessage('Add a customer email address before sending this invoice.'); return; }
    const subject = `Invoice ${invoice.invoiceNumber} from ${state.businessProfile.businessName}`;
    const body = [`Hello ${customerName},`, '', 'Please find your invoice details below:', `Invoice Number: ${invoice.invoiceNumber}`, `Amount: ${formatCurrency(invoice.totalAmount, currency)}`, `Paid To Date: ${formatCurrency(invoice.paidAmount, currency)}`, `Balance Due: ${formatCurrency(balance, currency)}`, '', `Issued by: ${state.businessProfile.businessName}`].join('\n');
    window.open(`mailto:${encodeURIComponent(customerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
  }

  function whatsappInvoice() {
    if (!phone) { setMessage('Add a customer phone or WhatsApp number before sharing this invoice.'); return; }
    const text = `Hello ${customerName}, thank you for your patronage at ${state.businessProfile.businessName}.\n\nInvoice Number: ${invoice.invoiceNumber}\nAmount: ${formatCurrency(invoice.totalAmount, currency)}\nPaid To Date: ${formatCurrency(invoice.paidAmount, currency)}${balance > 0 ? `\nBalance Due: ${formatCurrency(balance, currency)}` : ''}`;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  async function savePaymentReference() {
    setMessage('');
    const result = await updateSalePaymentReference({ saleId: invoice.id, paymentReference });
    setMessage(result.message ?? (result.ok ? 'Payment reference updated.' : 'Payment reference could not be updated.'));
  }

  async function recordCustomerPayment(input: { amount: number; method: PaymentChannel; reference: string }) {
    setPaymentBusy(true);
    setMessage('');
    const result = await recordSalePayment({ saleId: invoice.id, amount: input.amount, method: input.method, reference: input.reference, recordedBy: currentUser.userId });
    setPaymentBusy(false);
    setMessage(result.message ?? (result.ok ? `Payment recorded against ${invoice.invoiceNumber}.` : 'The customer payment could not be recorded.'));
    if (result.ok) setPaymentOpen(false);
    return result.ok;
  }

  async function postReturn(input: { items: Array<{ productId: string; quantity: number; disposition: ReturnDisposition; locationId?: string }>; reason: string; refundMethod?: PaymentChannel; refundReference?: string }) {
    setReturnBusy(true);
    setMessage('');
    const result = await createSalesReturn({ ...input, saleId: invoice.id, processedBy: currentUser.userId, approvedBy: currentUser.userId });
    setReturnBusy(false);
    setMessage(result.message ?? (result.ok ? 'Return posted.' : 'The return could not be posted.'));
    if (result.ok) setReturnOpen(false);
    return result.ok;
  }

  return <EnterpriseShell active="Sales"><div className="page-content invoice-native-page">
    <header className="document-page-toolbar no-print"><div><Link className="icon-button" title="Return to Sales" href="/sales"><ArrowLeft size={16} /></Link><div><p className="eyebrow">Invoice document</p><h1>{sale.invoiceNumber}</h1><span>{customerName} · {formatCurrency(sale.totalAmount, currency)}</span></div></div><div>{canEmail ? <button className="icon-button" type="button" aria-label="Email invoice" title="Email invoice" onClick={emailInvoice}><Mail size={16} /></button> : null}<button className="icon-button" type="button" aria-label="Share through WhatsApp" title="Share through WhatsApp" disabled={!phone} onClick={whatsappInvoice}><MessageCircle size={16} /></button>{canExport ? <button className="secondary-button" type="button" onClick={() => { setMessage('Choose Save as PDF in the print dialog.'); window.print(); }}><Download size={14} /> Save PDF</button> : null}{canPrint ? <button className="primary-button" type="button" onClick={() => window.print()}><Printer size={14} /> Print invoice</button> : null}</div></header>
    {message ? <div className="settings-message no-print" role="status">{message}</div> : null}
    <div className="invoice-document-layout"><InvoiceDocument sale={sale} customer={customer} profile={state.businessProfile} currency={currency} tax={tax} withholding={withholding} balance={balance} generatedAt={generatedAt} />
      <aside className="invoice-control-rail no-print">
        <section><div className="invoice-control-heading"><Truck size={15} /><div><strong>Fulfilment document</strong><span>Create the goods-in-transit record.</span></div></div><Link className="secondary-button invoice-full-action" href={`/sales/${sale.id}/waybill`}><FileText size={14} /> Open waybill <ArrowRight size={14} /></Link></section>
        {canRecordPayments ? <section><div className="invoice-control-heading"><ReceiptText size={15} /><div><strong>Customer payments</strong><span>{balance > 0 ? `${formatCurrency(balance, currency)} remains outstanding.` : 'This invoice is fully settled.'}</span></div></div>{balance > 0 ? <button className="primary-button invoice-full-action" type="button" onClick={() => setPaymentOpen(true)}><Banknote size={14} /> Record customer payment</button> : null}<div className="invoice-audit-list">{invoicePayments.map((payment) => <div key={payment.id}><i className="invoice-audit-dot invoice-audit-dot--success" /><span><strong>{payment.paymentCode}</strong><small>{formatReceiptDate(payment.createdAt)} · {payment.reference || 'No reference'}</small></span><b>{formatCurrency(payment.amount, currency)}</b></div>)}{!invoicePayments.length ? <p>No follow-up payments have been recorded.</p> : null}</div>{balance === 0 ? <><label className="form-field"><span>Latest evidence reference</span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Receipt, slip, cheque, or transfer" /></label><button className="secondary-button invoice-full-action" type="button" onClick={() => void savePaymentReference()}><Save size={14} /> Update evidence</button></> : null}</section> : null}
        <section><div className="invoice-control-heading"><Boxes size={15} /><div><strong>Inventory impact</strong><span>{stockMovements.length} recorded movements</span></div></div><div className="invoice-audit-list">{stockMovements.map((movement) => { const display = selectStockMovementDisplay(movement); return <div key={movement.id}><i className={`invoice-audit-dot invoice-audit-dot--${display.tone}`} /><span><strong>{display.label}</strong><small>{movement.movementNumber} · End balance {movement.quantityAfter}</small></span><b className={movement.quantityDelta < 0 ? 'invoice-negative' : 'invoice-positive'}>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</b></div>;})}{!stockMovements.length ? <p>No inventory movements recorded.</p> : null}</div></section>
        <section><div className="invoice-control-heading"><PackageCheck size={15} /><div><strong>Account and audit trail</strong><span>Ledger and transaction evidence.</span></div></div><div className="invoice-audit-list">{canViewLedger ? ledgerEntries.map((entry) => { const display = selectLedgerEntryDisplay(entry); return <div key={entry.id}><i className={`invoice-audit-dot invoice-audit-dot--${display.tone}`} /><span><strong>{display.label}</strong><small>{entry.entryNumber} · {entry.note}</small></span><b>{formatCurrency(entry.amountDelta, currency)}</b></div>;}) : <p>Customer ledger details are hidden for this role.</p>}{activity.map((entry) => <div key={entry.id}><i className={`invoice-audit-dot invoice-audit-dot--${entry.status}`} /><span><strong>{entry.title}</strong><small>{formatReceiptDate(entry.createdAt)} · {entry.detail}</small></span></div>)}</div></section>
        {sale.status === 'Completed' && canReturn ? <section className="invoice-return-control"><div className="invoice-control-heading"><PackageOpen size={15} /><div><strong>Returns and credit notes</strong><span>Return selected quantities without voiding the invoice.</span></div></div><button className="secondary-button invoice-full-action" type="button" onClick={() => setReturnOpen(true)}><PackageOpen size={14} /> Create return</button><div className="invoice-audit-list">{creditNotes.map((note) => <div key={note.id}><i className="invoice-audit-dot invoice-audit-dot--warning" /><span><strong>{note.creditNoteNumber}</strong><small>{note.items.reduce((sum, item) => sum + item.quantity, 0)} units · {note.reason}</small></span><b>-{formatCurrency(note.receivableCreditAmount, currency)}</b>{hasPermission('invoices.view') ? <Link className="icon-button" href={`/sales/${sale.id}/credit-note/${note.id}`} title={`Open ${note.creditNoteNumber}`} aria-label={`Open ${note.creditNoteNumber}`}><Printer size={13} /></Link> : null}</div>)}{refunds.map((refund) => <div key={refund.id}><i className="invoice-audit-dot invoice-audit-dot--success" /><span><strong>{refund.refundNumber}</strong><small>{refund.method} · {refund.reference || 'No reference'}</small></span><b>{formatCurrency(refund.amount, currency)}</b></div>)}{!creditNotes.length ? <p>No returns have been posted.</p> : null}</div></section> : null}
        {sale.status === 'Completed' && canReverse ? <section className="invoice-danger-control"><div className="invoice-control-heading"><ShieldAlert size={15} /><div><strong>Reverse and void</strong><span>Restore stock and reverse the customer ledger impact.</span></div></div><button className="secondary-button danger-button invoice-full-action" type="button" onClick={() => setReverseOpen(true)}><RotateCcw size={14} /> Reverse invoice</button></section> : null}
        {sale.status === 'Reversed' && !sale.correctedBySaleId && canCorrect ? <section className="invoice-correction-control"><div className="invoice-control-heading"><CheckCircle2 size={15} /><div><strong>Correction available</strong><span>Create a new invoice prefilled from this voided document.</span></div></div><Link className="primary-button invoice-full-action" href={`/sales?correctionSourceSaleId=${encodeURIComponent(sale.id)}`}>Create corrected copy <ArrowRight size={14} /></Link></section> : null}
        {sale.correctedBySaleId ? <Link className="invoice-related-document" href={`/sales/${sale.correctedBySaleId}`}><CheckCircle2 size={14} /> Open corrected invoice <ArrowRight size={14} /></Link> : null}
      </aside>
    </div>
  </div>{paymentOpen ? <CustomerPaymentDialog sale={sale} customerName={customerName} balance={balance} currency={currency} busy={paymentBusy} onClose={() => setPaymentOpen(false)} onSave={recordCustomerPayment} /> : null}{returnOpen ? <SalesReturnDialog sale={sale} creditNotes={creditNotes} locations={state.locations} currency={currency} busy={returnBusy} onClose={() => setReturnOpen(false)} onSave={postReturn} /> : null}{reverseOpen ? <ReverseInvoiceDialog sale={sale} onClose={() => setReverseOpen(false)} onConfirm={(reason) => { const result = reverseSale({ saleId: sale.id, reason, actor: currentUser.name || currentUser.userId }); setMessage(result.ok ? `${sale.invoiceNumber} reversed and inventory restored.` : result.message); if (result.ok) setReverseOpen(false); }} /> : null}</EnterpriseShell>;
}

function SalesReturnDialog({ sale, creditNotes, locations, currency, busy, onClose, onSave }: { sale: Sale; creditNotes: CreditNote[]; locations: ReturnType<typeof useBusiness>['state']['locations']; currency: string; busy: boolean; onClose: () => void; onSave: (input: { items: Array<{ productId: string; quantity: number; disposition: ReturnDisposition; locationId?: string }>; reason: string; refundMethod?: PaymentChannel; refundReference?: string }) => Promise<boolean> }) {
  const returned = new Map<string, number>();
  creditNotes.forEach((note) => note.items.forEach((item) => returned.set(item.productId, (returned.get(item.productId) ?? 0) + item.quantity)));
  const [lines, setLines] = useState(() => sale.items.map((item) => ({ productId: item.productId, quantity: 0, disposition: 'restock' as ReturnDisposition, locationId: locations.find((location) => location.isDefault)?.id ?? locations[0]?.id ?? '' })));
  const [resolution, setResolution] = useState<'credit' | 'refund'>('refund');
  const [method, setMethod] = useState<PaymentChannel>('cash');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const selectedItems = lines.filter((line) => line.quantity > 0);
  const estimatedCredit = sale.items.reduce((sum, item) => sum + item.unitPrice * (lines.find((line) => line.productId === item.productId)?.quantity ?? 0), 0);
  function updateLine(productId: string, update: Partial<(typeof lines)[number]>) { setLines((current) => current.map((line) => line.productId === productId ? { ...line, ...update } : line)); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedItems.length) return setError('Select at least one quantity to return.');
    if (!reason.trim()) return setError('Add the commercial or quality reason for this return.');
    setError('');
    const ok = await onSave({ items: selectedItems, reason: reason.trim(), refundMethod: resolution === 'refund' ? method : undefined, refundReference: resolution === 'refund' ? reference.trim() : undefined });
    if (!ok) setError('Review the quantities and refund details, then try again.');
  }
  return <div className="composer-backdrop" role="presentation"><form className="return-editor" role="dialog" aria-modal="true" aria-labelledby="sales-return-title" onSubmit={(event) => void submit(event)}><div className="composer-heading"><div><p className="eyebrow">{sale.invoiceNumber}</p><h2 id="sales-return-title">Create return and credit note</h2></div><button className="icon-button" type="button" aria-label="Close return" title="Close return" onClick={onClose}><X size={18} /></button></div><div className="return-editor-body"><div className="return-guidance"><PackageOpen size={17} /><p>The original invoice remains intact. Only saleable items marked <strong>Restock</strong> return to available inventory.</p></div><section className="return-line-editor"><div className="return-line-head"><span>Product</span><span>Returnable</span><span>Quantity</span><span>Disposition</span></div>{sale.items.map((item) => { const available = Math.max(0, item.quantity - (returned.get(item.productId) ?? 0)); const line = lines.find((entry) => entry.productId === item.productId)!; return <div className="return-line" key={item.productId}><div><strong>{item.productName}</strong><span>{item.inventoryId} · {formatCurrency(item.unitPrice, currency)}</span></div><b>{available}</b><input type="number" min="0" max={available} step="1" value={line.quantity} onChange={(event) => updateLine(item.productId, { quantity: Math.max(0, Number(event.target.value)) })} /><select value={line.disposition} disabled={!line.quantity} onChange={(event) => updateLine(item.productId, { disposition: event.target.value as ReturnDisposition })}><option value="restock">Restock</option><option value="quarantine">Quarantine</option><option value="damaged">Damaged</option><option value="writeOff">Write off</option></select>{line.quantity > 0 && line.disposition === 'restock' ? <select className="return-location" value={line.locationId} onChange={(event) => updateLine(item.productId, { locationId: event.target.value })}>{locations.filter((location) => location.isActive).map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select> : null}</div>;})}</section><label className="form-field"><span>Return reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the customer request, defect, or fulfilment issue" /></label><section className="return-resolution"><div><span>Customer resolution</span><div className="payment-segments"><button type="button" className={resolution === 'refund' ? 'payment-segment payment-segment--active' : 'payment-segment'} onClick={() => setResolution('refund')}>Refund eligible amount</button><button type="button" className={resolution === 'credit' ? 'payment-segment payment-segment--active' : 'payment-segment'} onClick={() => setResolution('credit')}>Keep as account credit</button></div></div>{resolution === 'refund' ? <><label className="form-field"><span>Refund method</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentChannel)}><option value="cash">Cash</option><option value="mobileMoney">Mobile Money</option><option value="bank">Bank</option><option value="creditCard">Card</option></select></label><label className="form-field"><span>Refund reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction or cash voucher reference" /></label></> : null}</section><div className="return-estimate"><span>Estimated line value</span><strong>{formatCurrency(estimatedCredit, currency)}</strong><small>Final credit includes the invoice tax and withholding proportions.</small></div>{error ? <p className="accounting-form-error" role="alert">{error}</p> : null}</div><div className="composer-footer"><span>A credit note, customer ledger entry, stock evidence, and audit event will be posted together.</span><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Posting return...' : 'Post return'}</button></div></form></div>;
}

function CustomerPaymentDialog({ sale, customerName, balance, currency, busy, onClose, onSave }: { sale: Sale; customerName: string; balance: number; currency: string; busy: boolean; onClose: () => void; onSave: (input: { amount: number; method: PaymentChannel; reference: string }) => Promise<boolean> }) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentChannel>('bank');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter a payment amount greater than zero.');
    if (numericAmount > balance) return setError('Payment cannot exceed the remaining invoice balance.');
    setError('');
    const ok = await onSave({ amount: numericAmount, method, reference: reference.trim() });
    if (!ok) setError('Review the payment details and try again.');
  }

  return <div className="composer-backdrop" role="presentation"><form className="accounting-editor" role="dialog" aria-modal="true" aria-labelledby="customer-payment-title" onSubmit={(event) => void submit(event)}><div className="composer-heading"><div><p className="eyebrow">{sale.invoiceNumber}</p><h2 id="customer-payment-title">Record customer payment</h2></div><button className="icon-button" type="button" aria-label="Close payment" title="Close payment" onClick={onClose}><X size={18} /></button></div><div className="composer-body"><div className="payment-context"><div><span>Customer</span><strong>{customerName}</strong></div><div><span>Invoice total</span><strong>{formatCurrency(sale.totalAmount, currency)}</strong></div><div><span>Balance due</span><strong>{formatCurrency(balance, currency)}</strong></div></div><label className="form-field"><span>Amount received ({currency})</span><input autoFocus type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="form-field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentChannel)}><option value="bank">Bank</option><option value="cash">Cash</option><option value="mobileMoney">Mobile Money</option><option value="creditCard">Card</option></select></label><label className="form-field"><span>Receipt or transaction reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank slip, MoMo ID, cheque, or receipt" /></label>{error ? <p className="accounting-form-error" role="alert">{error}</p> : null}</div><div className="composer-footer"><span>Partial payments retain the remaining customer balance and a full audit trail.</span><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Recording...' : 'Record payment'}</button></div></form></div>;
}

function InvoiceDocument({ sale, customer, profile, currency, tax, withholding, balance, generatedAt }: { sale: Sale; customer?: ReturnType<typeof useBusiness>['state']['customers'][number]; profile: ReturnType<typeof useBusiness>['state']['businessProfile']; currency: string; tax: ReturnType<typeof selectDocumentTaxTotals>; withholding: ReturnType<typeof selectDocumentWithholdingTotals>; balance: number; generatedAt: Date }) {
  const billToName = customer?.name ?? sale.customerSnapshot?.name ?? 'Customer';
  const billToReference = customer?.clientId ? `Client ID: ${customer.clientId}` : sale.customerSnapshot?.contactName || sale.customerSnapshot?.location || '';
  const billToContact = customer?.phone || customer?.email || sale.customerSnapshot?.phone || sale.customerSnapshot?.email || 'Contact not recorded';
  const paymentStatus = selectSalePaymentStatus(sale);
  return <article className="enterprise-paper invoice-paper"><header className="paper-document-header"><div className="paper-business"><div className="paper-logo">{profile.logoUrl ? <Image src={profile.logoUrl} width={54} height={54} unoptimized alt={`${profile.businessName} logo`} /> : profile.businessName.slice(0, 2).toUpperCase()}</div><div><strong>{profile.businessName}</strong><span>{profile.address || 'Business address not configured'}</span><span>{[profile.phone, profile.email, profile.website].filter(Boolean).join(' · ')}</span></div></div><div className="paper-document-title"><h2>Tax Invoice</h2><strong>{sale.invoiceNumber}</strong><span>{formatReceiptDate(sale.createdAt)}</span></div></header>
    <section className="paper-party-grid"><div><p>Bill to</p><h3>{billToName}</h3>{billToReference ? <span>{billToReference}</span> : null}<span>{billToContact}</span></div><div><p>Payment</p><strong>{paymentStatus}</strong>{sale.clientPoNumber ? <span>Client PO: {sale.clientPoNumber}</span> : null}<span>{sale.paymentMethod}</span><span>{sale.paymentReference || 'Reference not recorded'}</span></div></section>
    <table className="paper-line-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{sale.items.map((item) => <tr key={`${sale.id}-${item.productId}`}><td><strong>{item.productName}</strong><span>{item.inventoryId}</span></td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice, currency)}</td><td>{formatCurrency(item.total, currency)}</td></tr>)}</tbody></table>
    <div className="paper-summary-wrap"><dl className="paper-summary"><div><dt>Subtotal</dt><dd>{formatCurrency(tax.subtotalAmount, currency)}</dd></div>{tax.hasTax ? <div><dt>{tax.isExempt ? `Tax exempt${tax.exemptionReason ? ` · ${tax.exemptionReason}` : ''}` : `Tax (${tax.taxRate}%)`}</dt><dd>{formatCurrency(tax.taxAmount, currency)}</dd></div> : null}<div><dt>Gross total</dt><dd>{formatCurrency(sale.totalAmount, currency)}</dd></div>{withholding.hasWithholding ? <><div><dt>{withholding.label} ({withholding.rate}%)</dt><dd>-{formatCurrency(withholding.amount, currency)}</dd></div><div><dt>Net receivable</dt><dd>{formatCurrency(withholding.netReceivableAmount, currency)}</dd></div></> : null}<div><dt>Paid to date</dt><dd>{formatCurrency(sale.paidAmount, currency)}</dd></div><div className="paper-balance"><dt>Balance due</dt><dd>{formatCurrency(balance, currency)}</dd></div></dl></div>
    <footer className="paper-footer"><p>Thank you for your business at {profile.businessName}.</p><span>Generated by BisaPilot Enterprise · {generatedAt.toLocaleDateString()} {generatedAt.toLocaleTimeString()}</span></footer>
  </article>;
}

function ReverseInvoiceDialog({ sale, onClose, onConfirm }: { sale: Sale; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return <div className="dialog-backdrop"><div className="invoice-reverse-dialog" role="dialog" aria-modal="true"><div className="invoice-reverse-head"><i><RotateCcw size={20} /></i><div><p className="eyebrow">Controlled reversal</p><h2>Void {sale.invoiceNumber}?</h2></div><button className="icon-button" type="button" aria-label="Close reversal" title="Close reversal" onClick={onClose}><X size={17} /></button></div><p>This reverses the customer ledger impact and restores inventory. The original invoice remains preserved in the audit trail.</p><label className="form-field"><span>Reversal reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the error or commercial reason" /></label><div><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="secondary-button danger-button" type="button" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Confirm reversal</button></div></div></div>;
}
