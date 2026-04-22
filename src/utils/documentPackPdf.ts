import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import type { BusinessProfile, Quotation, Sale } from '../data/seedBusiness';
import type { Customer } from '../data/seedBusiness';
import { formatCurrency, formatReceiptDate } from './format';

type PdfContext = {
  businessProfile: BusinessProfile;
  currency: string;
  logoDataUrl?: string;
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

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, 12, 22, 22);
    } catch {
      // Keep PDF generation resilient if the logo format is unsupported.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(102, 112, 133);
  doc.text(title.toUpperCase(), 40, 18);

  doc.setFontSize(20);
  doc.setTextColor(16, 24, 40);
  doc.text(businessProfile.businessName || 'Business', 40, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  const contactLines = [
    businessProfile.address,
    businessProfile.phone,
    businessProfile.website ? `Website: ${businessProfile.website}` : '',
  ].filter(Boolean);
  contactLines.forEach((line, index) => {
    doc.text(String(line), 40, 33 + index * 5);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(16, 24, 40);
  doc.text(rightTitle, 196, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(102, 112, 133);
  doc.text(rightSubtitle, 196, 27, { align: 'right' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  const dividerY = 39 + contactLines.length * 5;
  doc.line(14, dividerY, 196, dividerY);

  return {
    dividerY,
  };
}

function drawInfoCard(doc: jsPDF, x: number, y: number, width: number, label: string, lines: string[]) {
  doc.setDrawColor(208, 213, 221);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, 26, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  doc.text(label.toUpperCase(), x + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 24, 40);
  if (lines[0]) {
    doc.text(lines[0], x + 4, y + 13);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(102, 112, 133);
  lines.slice(1, 3).forEach((line, index) => {
    doc.text(line, x + 4, y + 18 + index * 4.5);
  });
}

export function buildInvoicePdf(sale: Sale, customer: Customer | undefined, context: PdfContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { dividerY } = drawBrandHeader(doc, context, 'Tax Invoice', sale.invoiceNumber, formatReceiptDate(sale.createdAt));
  const infoTop = dividerY + 6;

  drawInfoCard(doc, 14, infoTop, 88, 'From', [
    context.businessProfile.businessName || 'Business',
    context.businessProfile.address || '',
  ]);
  drawInfoCard(doc, 108, infoTop, 88, 'Bill To', [
    customer?.name || 'Customer',
    customer?.phone ? `Phone: ${customer.phone}` : '',
    customer?.email ? `Email: ${customer.email}` : '',
  ]);

  autoTable(doc, {
    startY: infoTop + 34,
    head: [['Item Description', 'Qty', 'Price', 'Total']],
    body: sale.items.map((item) => [
      `${item.productName}\nRef: ${item.inventoryId}`,
      String(item.quantity),
      formatPdfCurrency(item.unitPrice, context.currency),
      formatPdfCurrency(item.total, context.currency),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [16, 24, 40] },
    columnStyles: {
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 34 },
      3: { halign: 'right', cellWidth: 34 },
    },
  });

  const summaryTop = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;
  const rightEdge = 196;
  const boxWidth = 70;
  const boxX = rightEdge - boxWidth;
  const balanceDue = Math.max(0, sale.totalAmount - sale.paidAmount);

  [
    ['Invoice Total', formatPdfCurrency(sale.totalAmount, context.currency), false],
    ['Paid To Date', formatPdfCurrency(sale.paidAmount, context.currency), false],
    ['Balance Due', formatPdfCurrency(balanceDue, context.currency), true],
  ].forEach(([label, value, highlight], index) => {
    const y = summaryTop + 8 + index * 12;
    doc.setFillColor(highlight ? 238 : 255, highlight ? 244 : 255, highlight ? 255 : 255);
    doc.setDrawColor(208, 213, 221);
    doc.roundedRect(boxX, y, boxWidth, 10, 2, 2, 'FD');
    doc.setFont('helvetica', highlight ? 'bold' : 'normal');
    doc.setFontSize(highlight ? 11 : 10);
    doc.setTextColor(highlight ? 24 : 102, highlight ? 73 : 112, highlight ? 169 : 133);
    doc.text(String(label), boxX + 4, y + 6.5);
    doc.text(String(value), boxX + boxWidth - 4, y + 6.5, { align: 'right' });
  });

  return toPdfBytes(doc);
}

export function buildQuotationPdf(quotation: Quotation, context: PdfContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { dividerY } = drawBrandHeader(doc, context, 'Quotation', quotation.quotationNumber, formatReceiptDate(quotation.createdAt));
  const infoTop = dividerY + 6;

  drawInfoCard(doc, 14, infoTop, 182, 'Prepared For', [
    quotation.customerName,
    `Client ID: ${quotation.clientId}`,
  ]);

  autoTable(doc, {
    startY: infoTop + 34,
    head: [['Item Description', 'Qty', 'Total']],
    body: quotation.items.map((item) => [
      `${item.productName}\nRef: ${item.inventoryId}`,
      String(item.quantity),
      formatPdfCurrency(item.total, context.currency),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [16, 24, 40] },
    columnStyles: {
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 34 },
    },
  });

  const summaryTop = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;
  doc.setFillColor(238, 244, 255);
  doc.setDrawColor(208, 213, 221);
  doc.roundedRect(126, summaryTop + 10, 70, 12, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(24, 73, 169);
  doc.text('Estimated Total', 130, summaryTop + 17.5);
  doc.text(formatPdfCurrency(quotation.totalAmount, context.currency), 192, summaryTop + 17.5, { align: 'right' });

  return toPdfBytes(doc);
}

export function buildWaybillPdf(sale: Sale, customer: Customer | undefined, context: PdfContext) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const waybillPrefix = context.businessProfile.waybillPrefix ?? 'WAY-';
  const waybillNumber = `${waybillPrefix}${sale.invoiceNumber.split('-').pop()}`;

  const { dividerY } = drawBrandHeader(doc, context, 'Waybill', waybillNumber, formatReceiptDate(sale.createdAt));
  const infoTop = dividerY + 6;

  drawInfoCard(doc, 14, infoTop, 88, 'Consignor', [
    context.businessProfile.businessName || 'Business',
    context.businessProfile.address || '',
    `Origin: ${context.businessProfile.country || ''}`,
  ]);
  drawInfoCard(doc, 108, infoTop, 88, 'Consignee', [
    customer?.name || 'Customer',
    customer?.phone ? `Phone: ${customer.phone}` : '',
    customer?.email ? `Email: ${customer.email}` : '',
  ]);

  autoTable(doc, {
    startY: infoTop + 34,
    head: [['Description', 'Quantity']],
    body: sale.items.map((item) => [
      `${item.productName}\nRef: ${item.inventoryId}`,
      String(item.quantity),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: 'left' },
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [16, 24, 40] },
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

  return toPdfBytes(doc);
}
