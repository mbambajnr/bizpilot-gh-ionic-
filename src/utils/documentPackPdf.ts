import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { BusinessProfile, Quotation, Sale } from '../data/seedBusiness';
import type { Customer } from '../data/seedBusiness';
import { formatCurrency, formatReceiptDate } from './format';
import { selectDocumentTaxTotals, selectDocumentWithholdingTotals, selectSaleBalanceRemaining, selectSalePaymentStatus } from '../selectors/businessSelectors';

type PdfContext = {
  businessProfile: BusinessProfile;
  currency: string;
  logoDataUrl?: string;
  signatureDataUrl?: string;
};

function toPdfBytes(doc: jsPDF) {
  return new Uint8Array(doc.output('arraybuffer'));
}

function formatPdfCurrency(value: number, currency = 'GHS') {
  const numeric = new Intl.NumberFormat('en-GH', {
    maximumFractionDigits: 0,
  }).format(value);

  if (currency === 'GHS') {
    return `GH¢ ${numeric}`;
  }

  const formatted = formatCurrency(value, currency);
  return formatted.replace(/\s+/g, ' ').trim();
}

function businessInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'BP';
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
}

export function buildDocumentTotalRows(
  document: Pick<Sale | Quotation, 'subtotalAmount' | 'taxAmount' | 'totalAmount' | 'taxSnapshot' | 'withholdingTaxAmount' | 'netReceivableAmount' | 'withholdingTaxSnapshot'>,
  totalLabel: string
) {
  const taxTotals = selectDocumentTaxTotals(document);
  const withholdingTotals = selectDocumentWithholdingTotals(document);
  const rows = [
    {
      label: 'Subtotal',
      value: taxTotals.subtotalAmount,
      highlight: false,
    },
  ];

  if (taxTotals.hasTax && taxTotals.isExempt) {
    rows.push({
      label: taxTotals.exemptionReason ? `Tax exempt - ${taxTotals.exemptionReason}` : 'Tax exempt',
      value: 0,
      highlight: false,
    });
  } else if (taxTotals.hasTax) {
    rows.push({
      label: `Tax (${taxTotals.taxRate}%)`,
      value: taxTotals.taxAmount,
      highlight: false,
    });
  }

  rows.push({
    label: totalLabel,
    value: taxTotals.totalAmount,
    highlight: true,
  });

  if (withholdingTotals.hasWithholding) {
    rows.push({
      label: `${withholdingTotals.label} (${withholdingTotals.rate}%)`,
      value: -withholdingTotals.amount,
      highlight: false,
    });
    rows.push({
      label: 'Net Receivable',
      value: withholdingTotals.netReceivableAmount,
      highlight: true,
    });
  }

  return rows;
}

async function readBlobAsDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function loadLogoDataUrl(logoUrl?: string) {
  if (!logoUrl) {
    return undefined;
  }

  if (logoUrl.startsWith('data:image/')) {
    return logoUrl;
  }

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return undefined;
    }

    const blob = await response.blob();
    return await readBlobAsDataUrl(blob);
  } catch {
    return undefined;
  }
}

function drawBrandHeader(doc: jsPDF, context: PdfContext, title: string, rightTitle: string, rightSubtitle: string) {
  const { businessProfile, logoDataUrl } = context;
  const logoX = 14;
  const logoY = 12;
  const logoSize = 18;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
    } catch {
      // Keep PDF generation resilient if the logo format is unsupported.
    }
  } else {
    doc.setDrawColor(212, 223, 218);
    doc.setFillColor(238, 243, 241);
    doc.rect(logoX, logoY, logoSize, logoSize, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(33, 77, 64);
    doc.text(businessInitials(businessProfile.businessName || 'BizPilot'), logoX + logoSize / 2, logoY + 11.5, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(28, 36, 33);
  doc.text(businessProfile.businessName || 'Business', 38, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(101, 112, 108);
  const contactLines = [
    businessProfile.address,
    [businessProfile.phone, businessProfile.email, businessProfile.website].filter(Boolean).join(' · '),
  ].filter(Boolean);
  contactLines.forEach((line, index) => {
    doc.text(String(line), 38, 23 + index * 4.5);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(28, 36, 33);
  doc.text(title.toUpperCase(), 196, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(101, 112, 108);
  doc.text(rightTitle, 196, 24, { align: 'right' });
  doc.text(rightSubtitle, 196, 29, { align: 'right' });

  doc.setDrawColor(28, 36, 33);
  doc.setLineWidth(0.9);
  const dividerY = Math.max(38, 31 + contactLines.length * 4.5);
  doc.line(14, dividerY, 196, dividerY);

  return {
    dividerY,
  };
}

function drawInfoCard(doc: jsPDF, x: number, y: number, width: number, label: string, lines: string[]) {
  doc.setDrawColor(207, 215, 211);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, width, 28, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(92, 103, 98);
  doc.text(label.toUpperCase(), x + 4, y + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(28, 36, 33);
  if (lines[0]) {
    doc.text(String(lines[0]), x + 4, y + 14);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(78, 89, 85);
  lines.slice(1, 3).forEach((line, index) => {
    doc.text(String(line), x + 4, y + 20 + index * 4.5);
  });
}

function drawSummaryRows(doc: jsPDF, startY: number, rows: Array<[string, string, boolean]>) {
  const boxWidth = 70;
  const boxX = 196 - boxWidth;
  rows.forEach(([label, value, highlight], index) => {
    const y = startY + 8 + index * 10.5;
    if (highlight) {
      doc.setFillColor(237, 242, 239);
      doc.setDrawColor(28, 36, 33);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 231, 228);
    }
    doc.rect(boxX, y, boxWidth, 9, 'FD');
    doc.setFont('helvetica', highlight ? 'bold' : 'normal');
    doc.setFontSize(highlight ? 9 : 8);
    doc.setTextColor(highlight ? 23 : 89, highlight ? 37 : 100, highlight ? 31 : 95);
    doc.text(label, boxX + 4, y + 6);
    doc.text(value, boxX + boxWidth - 4, y + 6, { align: 'right' });
  });
}

function drawDocumentFooter(doc: jsPDF, y: number, primary: string, secondary: string) {
  doc.setDrawColor(223, 229, 226);
  doc.line(14, y, 196, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(54, 67, 62);
  doc.text(primary, 105, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(115, 125, 121);
  doc.text(secondary, 105, y + 12, { align: 'center' });
}

function drawQuotationSignatureRow(doc: jsPDF, context: PdfContext, y: number) {
  doc.setDrawColor(28, 36, 33);
  doc.setLineWidth(0.35);
  doc.line(14, y + 8, 112, y + 8);
  doc.line(136, y + 8, 196, y + 8);

  if (context.signatureDataUrl) {
    try {
      doc.addImage(context.signatureDataUrl, 'PNG', 148, y - 10, 36, 14);
    } catch {
      // Keep the document printable even if the uploaded signature image cannot be embedded.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(92, 103, 98);
  doc.text('PREPARED BY', 14, y);
  doc.text('AUTHORIZED SIGNATURE', 136, y + 14);

  doc.setFontSize(7.5);
  doc.setTextColor(28, 36, 33);
  doc.text(context.businessProfile.businessName || 'Business', 14, y + 14);
}

export function buildInvoicePdf(sale: Sale, customer: Customer | undefined, context: PdfContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { dividerY } = drawBrandHeader(doc, context, 'Tax Invoice', sale.invoiceNumber, formatReceiptDate(sale.createdAt));
  const infoTop = dividerY + 6;
  const customerName = customer?.name ?? sale.customerSnapshot?.name ?? 'Customer';
  const customerReference = customer?.clientId ? `Client ID: ${customer.clientId}` : sale.customerSnapshot?.contactName || sale.customerSnapshot?.location || '';
  const customerContact = customer?.phone ?? customer?.email ?? sale.customerSnapshot?.phone ?? sale.customerSnapshot?.email ?? '';

  drawInfoCard(doc, 14, infoTop, 88, 'Bill To', [
    customerName,
    customerReference,
    customerContact ? `Contact: ${customerContact}` : '',
  ]);
  drawInfoCard(doc, 108, infoTop, 88, 'Payment', [
    selectSalePaymentStatus(sale),
    sale.clientPoNumber ? `Client PO: ${sale.clientPoNumber}` : sale.paymentMethod,
    sale.clientPoNumber ? sale.paymentMethod : sale.paymentReference || 'Reference not recorded',
    customer?.email ? `Email: ${customer.email}` : sale.customerSnapshot?.email ? `Email: ${sale.customerSnapshot.email}` : '',
  ]);

  autoTable(doc, {
    startY: infoTop + 38,
    head: [['Description', 'Quantity', 'Unit Price', 'Total']],
    body: sale.items.map((item) => [
      `${item.productName}\nRef: ${item.inventoryId}`,
      String(item.quantity),
      formatPdfCurrency(item.unitPrice, context.currency),
      formatPdfCurrency(item.total, context.currency),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [36, 52, 46], textColor: 255, halign: 'left', fontSize: 7 },
    styles: { fontSize: 8, cellPadding: 3.5, textColor: [28, 36, 33], lineColor: [226, 231, 228] },
    columnStyles: {
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 34 },
      3: { halign: 'right', cellWidth: 34 },
    },
  });

  const summaryTop = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;
  const balanceDue = selectSaleBalanceRemaining(sale);

  drawSummaryRows(doc, summaryTop, [
    ...buildDocumentTotalRows(sale, 'Invoice Total').map((row) => [
      row.label,
      formatPdfCurrency(row.value, context.currency),
      row.highlight,
    ] as [string, string, boolean]),
    ['Paid To Date', formatPdfCurrency(sale.paidAmount, context.currency), false],
    ['Balance Due', formatPdfCurrency(balanceDue, context.currency), true],
  ]);

  drawDocumentFooter(
    doc,
    272,
    `Thank you for your business at ${context.businessProfile.businessName || 'the business'}.`,
    `Generated by BizPilot Enterprise · Page 1 of 1`
  );

  return toPdfBytes(doc);
}

export function buildQuotationPdf(quotation: Quotation, context: PdfContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { dividerY } = drawBrandHeader(doc, context, 'Quotation', quotation.quotationNumber, formatReceiptDate(quotation.createdAt));
  const infoTop = dividerY + 6;
  const expiryLabel = quotation.validUntil ? formatReceiptDate(quotation.validUntil) : 'Not specified';
  const preparedForDetails = quotation.prospect
    ? [
        quotation.prospect.contactName ? `Contact: ${quotation.prospect.contactName}` : '',
        quotation.prospect.phone ? `Phone: ${quotation.prospect.phone}` : '',
        quotation.prospect.email ? `Email: ${quotation.prospect.email}` : '',
      ].filter(Boolean)
    : [`Client reference: ${quotation.clientId}`];

  drawInfoCard(doc, 14, infoTop, 88, 'Prepared For', [
    quotation.customerName,
    ...preparedForDetails,
  ]);
  drawInfoCard(doc, 108, infoTop, 88, 'Commercial Terms', [
    quotation.status,
    `Expires on: ${expiryLabel}`,
    `Currency: ${context.currency}`,
  ]);

  autoTable(doc, {
    startY: infoTop + 38,
    head: [['Item Description', 'Qty', 'Unit Price', 'Total']],
    body: quotation.items.map((item) => [
      `${item.productName}\nRef: ${item.inventoryId}`,
      String(item.quantity),
      formatPdfCurrency(item.unitPrice, context.currency),
      formatPdfCurrency(item.total, context.currency),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [36, 52, 46], textColor: 255, halign: 'left', fontSize: 7 },
    styles: { fontSize: 8, cellPadding: 3.5, textColor: [28, 36, 33], lineColor: [226, 231, 228] },
    columnStyles: {
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 34 },
      3: { halign: 'right', cellWidth: 34 },
    },
  });

  const summaryTop = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;

  const totalRows = buildDocumentTotalRows(quotation, 'Gross Quotation').map((row) => [
    row.label,
    formatPdfCurrency(row.value, context.currency),
    row.highlight,
  ] as [string, string, boolean]);

  drawSummaryRows(
    doc,
    summaryTop,
    totalRows
  );

  const signatureTop = Math.max(summaryTop + 18 + totalRows.length * 10.5, 210);
  drawQuotationSignatureRow(doc, context, signatureTop);

  drawDocumentFooter(
    doc,
    270,
    `This quotation expires on: ${expiryLabel}`,
    `This quotation is not an invoice until accepted and converted by ${context.businessProfile.businessName || 'the business'}.`
  );

  return toPdfBytes(doc);
}

export function buildWaybillPdf(sale: Sale, customer: Customer | undefined, context: PdfContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const waybillPrefix = context.businessProfile.waybillPrefix ?? 'WAY-';
  const waybillNumber = `${waybillPrefix}${sale.invoiceNumber.split('-').pop()}`;

  const { dividerY } = drawBrandHeader(doc, context, 'Waybill', waybillNumber, formatReceiptDate(sale.createdAt));
  const infoTop = dividerY + 6;
  const consigneeName = customer?.name ?? sale.customerSnapshot?.name ?? 'Customer';
  const consigneePhone = customer?.phone ?? sale.customerSnapshot?.phone;
  const consigneeEmail = customer?.email ?? sale.customerSnapshot?.email;

  drawInfoCard(doc, 14, infoTop, 88, 'Consignor', [
    context.businessProfile.businessName || 'Business',
    context.businessProfile.address || '',
    `Origin: ${context.businessProfile.country || ''}`,
  ]);
  drawInfoCard(doc, 108, infoTop, 88, 'Consignee', [
    consigneeName,
    consigneePhone ? `Phone: ${consigneePhone}` : '',
    consigneeEmail ? `Email: ${consigneeEmail}` : '',
  ]);

  autoTable(doc, {
    startY: infoTop + 34,
    head: [['Description', 'Quantity']],
    body: sale.items.map((item) => [
      `${item.productName}\nRef: ${item.inventoryId}`,
      String(item.quantity),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [36, 52, 46], textColor: 255, halign: 'left', fontSize: 7 },
    styles: { fontSize: 8, cellPadding: 3.5, textColor: [28, 36, 33], lineColor: [226, 231, 228] },
    columnStyles: {
      1: { halign: 'right', cellWidth: 32 },
    },
  });

  const signTop = Math.max((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120, 190);
  const signatureLabels = ['Dispatcher', 'Carrier', 'Recipient'];
  signatureLabels.forEach((label, index) => {
    const x = 14 + index * 61;
    doc.line(x, signTop + 22, x + 48, signTop + 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(102, 112, 133);
    doc.text(label, x + 24, signTop + 27, { align: 'center' });
  });

  drawDocumentFooter(
    doc,
    272,
    `This waybill is the logistics record for goods in transit under invoice ${sale.invoiceNumber}.`,
    `Generated by BizPilot Enterprise · Page 1 of 1`
  );

  return toPdfBytes(doc);
}
