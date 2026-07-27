'use client';

import { ArrowLeft, FileText, Printer, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import { formatCurrency, formatReceiptDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

export function EnterpriseCreditNote({ saleId, creditNoteId }: { saleId: string; creditNoteId: string }) {
  return <EnterpriseApp><EnterpriseCreditNoteView saleId={saleId} creditNoteId={creditNoteId} /></EnterpriseApp>;
}

function EnterpriseCreditNoteView({ saleId, creditNoteId }: { saleId: string; creditNoteId: string }) {
  const { state, hasPermission } = useBusiness();
  const [generatedAt] = useState(() => new Date());
  const note = state.creditNotes.find((entry) => entry.id === creditNoteId && entry.saleId === saleId);
  const customer = state.customers.find((entry) => entry.id === note?.customerId);
  const profile = state.businessProfile;
  const currency = profile.currency;

  if (!hasPermission('invoices.view')) {
    return <EnterpriseShell active="Sales"><div className="page-content enterprise-document-missing"><ShieldAlert size={26} /><h1>Credit note access restricted</h1><p>This role is not authorized to view credit documents.</p><Link className="secondary-button" href="/dashboard"><ArrowLeft size={14} /> Return to dashboard</Link></div></EnterpriseShell>;
  }
  if (!note) {
    return <EnterpriseShell active="Sales"><div className="page-content enterprise-document-missing"><FileText size={26} /><h1>Credit note not found</h1><p>The credit note record required for this document is unavailable.</p><Link className="secondary-button" href={`/sales/${saleId}`}><ArrowLeft size={14} /> Return to invoice</Link></div></EnterpriseShell>;
  }

  return <EnterpriseShell active="Sales"><div className="page-content waybill-native-page">
    <header className="document-page-toolbar no-print"><div><Link className="icon-button" title="Return to invoice" href={`/sales/${saleId}`}><ArrowLeft size={16} /></Link><div><p className="eyebrow">Credit document</p><h1>{note.creditNoteNumber}</h1><span>Invoice {note.invoiceNumber} · {customer?.name ?? 'Customer'}</span></div></div>{hasPermission('invoices.print') ? <button className="primary-button" type="button" onClick={() => window.print()}><Printer size={14} /> Print credit note</button> : null}</header>
    <article className="enterprise-paper credit-note-paper">
      <header className="paper-document-header"><div className="paper-business"><div className="paper-logo">{profile.logoUrl ? <Image src={profile.logoUrl} width={54} height={54} unoptimized alt={`${profile.businessName} logo`} /> : profile.businessName.slice(0, 2).toUpperCase()}</div><div><strong>{profile.businessName}</strong><span>Credit note</span></div></div><div className="paper-document-title"><h2>Credit Note</h2><strong>{note.creditNoteNumber}</strong><span>Issued: {formatReceiptDate(note.createdAt)}</span></div></header>
      <section className="waybill-party-grid"><div><p>Issued by</p><h3>{profile.businessName}</h3><span>{profile.address || 'Address not configured'}</span><span>{profile.phone || 'Phone not configured'}</span></div><div><p>Credited to</p><h3>{customer?.name ?? 'Customer'}</h3><span>Client ID: {customer?.clientId ?? '—'}</span><span>{customer?.phone || customer?.email || 'No contact recorded'}</span></div></section>
      <table className="credit-note-line-table"><thead><tr><th>No.</th><th>Returned item</th><th>Qty</th><th>Unit price</th><th>Credit</th></tr></thead><tbody>{note.items.map((item, index) => <tr key={`${note.id}-${item.productId}`}><td>{index + 1}</td><td><strong>{item.productName}</strong><span>{item.inventoryId}</span></td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice, currency)}</td><td>{formatCurrency(item.creditAmount, currency)}</td></tr>)}</tbody></table>
      <section className="credit-note-summary"><div className="credit-note-reason"><p>Reason for credit</p><span>{note.reason || 'No reason recorded'}</span></div><dl className="credit-note-totals"><div><dt>Subtotal credited</dt><dd>{formatCurrency(note.subtotalAmount, currency)}</dd></div><div><dt>Tax credited</dt><dd>{formatCurrency(note.taxAmount, currency)}</dd></div><div className="credit-note-total"><dt>Total credit</dt><dd>{formatCurrency(note.totalAmount, currency)}</dd></div><div><dt>Applied to receivable</dt><dd>{formatCurrency(note.receivableCreditAmount, currency)}</dd></div></dl></section>
      <section className="waybill-reference-strip"><span><strong>Reference invoice</strong>{note.invoiceNumber}</span><span><strong>Issued by</strong>{note.issuedBy}</span><span><strong>Approved by</strong>{note.approvedBy}</span></section>
      <footer className="paper-footer"><p>This credit note reduces the customer&apos;s outstanding balance against invoice {note.invoiceNumber}. It is not a cash refund unless a separate refund is issued.</p><span>Generated by BisaPilot Enterprise · {generatedAt.toLocaleDateString()} {generatedAt.toLocaleTimeString()} · Page 1 of 1</span></footer>
    </article>
  </div></EnterpriseShell>;
}
