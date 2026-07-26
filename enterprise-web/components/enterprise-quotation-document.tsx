'use client';

import { ArrowLeft, Download, FileText, Printer, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { useBusiness } from '../../src/context/BusinessContext';
import { selectDocumentTaxTotals, selectDocumentWithholdingTotals } from '../../src/selectors/businessSelectors';
import { buildQuotationPdf, loadLogoDataUrl } from '../../src/utils/documentPackPdf';
import { formatCurrency, formatReceiptDate } from '../../src/utils/format';
import { EnterpriseApp } from './enterprise-app';
import { EnterpriseShell } from './enterprise-shell';

export function EnterpriseQuotationDocument({ quotationId }: { quotationId: string }) {
  return <EnterpriseApp><EnterpriseQuotationDocumentView quotationId={quotationId} /></EnterpriseApp>;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function EnterpriseQuotationDocumentView({ quotationId }: { quotationId: string }) {
  const { state, hasPermission } = useBusiness();
  const [generatedAt] = useState(() => new Date());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const quotation = state.quotations.find((entry) => entry.id === quotationId);
  const profile = state.businessProfile;
  const currency = profile.currency;
  const canPrint = hasPermission('quotations.print');
  const canExport = hasPermission('quotations.export_pdf');

  if (!hasPermission('quotations.view')) return <EnterpriseShell active="Quotations"><div className="page-content enterprise-document-missing"><ShieldAlert size={26} /><h1>Quotation access restricted</h1><p>This role is not authorized to view quotation documents.</p><Link className="secondary-button" href="/dashboard"><ArrowLeft size={14} /> Return to dashboard</Link></div></EnterpriseShell>;
  if (!quotation) return <EnterpriseShell active="Quotations"><div className="page-content enterprise-document-missing"><FileText size={26} /><h1>Quotation not found</h1><p>This quotation may have been removed or the link is invalid.</p><Link className="secondary-button" href="/quotations"><ArrowLeft size={14} /> Return to Quotations</Link></div></EnterpriseShell>;

  const tax = selectDocumentTaxTotals(quotation);
  const withholding = selectDocumentWithholdingTotals(quotation);
  const netTotal = withholding.hasWithholding ? withholding.netReceivableAmount : tax.totalAmount;
  const contact = quotation.prospect ? [quotation.prospect.contactName, quotation.prospect.phone, quotation.prospect.email, quotation.prospect.location].filter(Boolean).join(' · ') : quotation.clientId;

  async function savePdf() {
    if (!canExport || busy || !quotation) return;
    setBusy(true);
    setMessage('');
    try {
      const [logoDataUrl, signatureDataUrl] = await Promise.all([
        loadLogoDataUrl(profile.logoUrl),
        loadLogoDataUrl(profile.signatureUrl),
      ]);
      const content = buildQuotationPdf(quotation, { businessProfile: profile, currency, logoDataUrl, signatureDataUrl });
      downloadBlob(new Blob([content], { type: 'application/pdf' }), `${quotation.quotationNumber}.pdf`);
      setMessage(`${quotation.quotationNumber} downloaded with company letterhead.`);
    } catch {
      setMessage('The quotation PDF could not be generated.');
    } finally {
      setBusy(false);
    }
  }

  return <EnterpriseShell active="Quotations"><div className="page-content quotation-document-page">
    <header className="document-page-toolbar no-print"><div><Link className="icon-button" title="Return to Quotations" href="/quotations"><ArrowLeft size={16} /></Link><div><p className="eyebrow">Quotation document</p><h1>{quotation.quotationNumber}</h1><span>{quotation.customerName} · {formatCurrency(netTotal, currency)}</span></div></div><div>{canExport ? <button className="secondary-button" type="button" disabled={busy} onClick={() => void savePdf()}><Download size={14} /> {busy ? 'Preparing PDF...' : 'Save PDF'}</button> : null}{canPrint ? <button className="primary-button" type="button" onClick={() => window.print()}><Printer size={14} /> Print quotation</button> : null}</div></header>
    {message ? <div className="settings-message no-print" role="status">{message}</div> : null}
    <article className="enterprise-paper quotation-paper"><header className="paper-document-header quotation-paper-header"><div className="paper-business"><div className="paper-logo">{profile.logoUrl ? <Image src={profile.logoUrl} width={54} height={54} unoptimized alt={`${profile.businessName} logo`} /> : profile.businessName.slice(0, 2).toUpperCase()}</div><div><strong>{profile.businessName || 'Business name not configured'}</strong><span>{profile.address || 'Business address not configured'}</span><span>{[profile.phone, profile.email, profile.website].filter(Boolean).join(' · ') || 'Business contact not configured'}</span></div></div><div className="paper-document-title"><h2>Quotation</h2><strong>{quotation.quotationNumber}</strong><span>{formatReceiptDate(quotation.createdAt)}</span></div></header>
      <section className="paper-party-grid quotation-party-paper"><div><p>Prepared for</p><h3>{quotation.customerName}</h3><span>{contact || 'Contact not recorded'}</span></div><div><p>Commercial terms</p><strong>{quotation.status}</strong><span>Expires on: {quotation.validUntil ? formatReceiptDate(quotation.validUntil) : 'Not specified'}</span><span>Currency: {currency}</span></div></section>
      <table className="paper-line-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{quotation.items.map((item) => <tr key={`${quotation.id}-${item.productId}`}><td><strong>{item.productName}</strong><span>{item.inventoryId}</span></td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice, currency)}</td><td>{formatCurrency(item.total, currency)}</td></tr>)}</tbody></table>
      <div className="paper-summary-wrap"><dl className="paper-summary"><div><dt>Subtotal</dt><dd>{formatCurrency(tax.subtotalAmount, currency)}</dd></div>{tax.hasTax ? <div><dt>{tax.isExempt ? `Tax exempt${tax.exemptionReason ? ` · ${tax.exemptionReason}` : ''}` : `Tax (${tax.taxRate}%)`}</dt><dd>{formatCurrency(tax.taxAmount, currency)}</dd></div> : null}<div><dt>Gross quotation</dt><dd>{formatCurrency(tax.totalAmount, currency)}</dd></div>{withholding.hasWithholding ? <><div><dt>{withholding.label} ({withholding.rate}%)</dt><dd>-{formatCurrency(withholding.amount, currency)}</dd></div><div className="paper-balance"><dt>Net receivable</dt><dd>{formatCurrency(withholding.netReceivableAmount, currency)}</dd></div></> : <div className="paper-balance"><dt>Estimated total</dt><dd>{formatCurrency(tax.totalAmount, currency)}</dd></div>}</dl></div>
      <section className="quotation-signature-row"><div><span>Prepared by</span><strong>{profile.businessName || 'Business'}</strong></div><div>{profile.signatureUrl ? <Image src={profile.signatureUrl} width={150} height={50} unoptimized alt={`${profile.businessName} authorized signature`} /> : <i />}<span>Authorized signature</span></div></section>
      <footer className="paper-footer"><p>This quotation is not an invoice until accepted and converted by {profile.businessName || 'the business'}.</p><span>Generated by BisaPilot Enterprise · {generatedAt.toLocaleDateString()} {generatedAt.toLocaleTimeString()} · Page 1 of 1</span></footer>
    </article>
  </div></EnterpriseShell>;
}
