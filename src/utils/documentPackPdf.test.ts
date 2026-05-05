import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import { buildDocumentTotalRows, buildInvoicePdf, buildQuotationPdf } from './documentPackPdf';

describe('documentPackPdf', () => {
  it('renders invoice pdf bytes with ascii-safe Ghana currency labels', () => {
    const sale = seedState.sales[0];
    const customer = seedState.customers.find((item) => item.id === sale.customerId);
    const pdfBytes = buildInvoicePdf(sale, customer, {
      businessProfile: seedState.businessProfile,
      currency: seedState.businessProfile.currency,
    });

    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it('builds untaxed invoice export total rows with no tax row', () => {
    expect(buildDocumentTotalRows(seedState.sales[0], 'Invoice Total')).toEqual([
      { label: 'Subtotal', value: seedState.sales[0].totalAmount, highlight: false },
      { label: 'Invoice Total', value: seedState.sales[0].totalAmount, highlight: true },
    ]);
  });

  it('builds taxed invoice export total rows from document snapshot fields', () => {
    const sale = {
      ...seedState.sales[0],
      subtotalAmount: 100,
      taxAmount: 17.5,
      totalAmount: 117.5,
      taxSnapshot: {
        enabled: true as const,
        preset: 'ghana-standard' as const,
        mode: 'exclusive' as const,
        totalRate: 17.5,
      },
    };

    expect(buildDocumentTotalRows(sale, 'Invoice Total')).toEqual([
      { label: 'Subtotal', value: 100, highlight: false },
      { label: 'Tax (17.5%)', value: 17.5, highlight: false },
      { label: 'Invoice Total', value: 117.5, highlight: true },
    ]);
  });

  it('builds exempt invoice export total rows without a misleading tax charge', () => {
    const sale = {
      ...seedState.sales[0],
      subtotalAmount: 100,
      taxAmount: 0,
      totalAmount: 100,
      taxSnapshot: {
        enabled: true as const,
        preset: 'ghana-standard' as const,
        mode: 'exclusive' as const,
        totalRate: 17.5,
        exempt: true,
        exemptionReason: 'Certificate A',
      },
    };

    expect(buildDocumentTotalRows(sale, 'Invoice Total')).toEqual([
      { label: 'Subtotal', value: 100, highlight: false },
      { label: 'Tax exempt - Certificate A', value: 0, highlight: false },
      { label: 'Invoice Total', value: 100, highlight: true },
    ]);
  });

  it('builds withholding invoice export total rows with net receivable', () => {
    const sale = {
      ...seedState.sales[0],
      subtotalAmount: 100,
      taxAmount: 17.5,
      totalAmount: 117.5,
      withholdingTaxAmount: 3.53,
      netReceivableAmount: 113.97,
      taxSnapshot: {
        enabled: true as const,
        preset: 'ghana-standard' as const,
        mode: 'exclusive' as const,
        totalRate: 17.5,
      },
      withholdingTaxSnapshot: {
        enabled: true as const,
        label: 'WHT',
        rate: 3,
        basis: 'taxInclusiveTotal' as const,
        amount: 3.53,
      },
    };

    expect(buildDocumentTotalRows(sale, 'Invoice Total')).toEqual([
      { label: 'Subtotal', value: 100, highlight: false },
      { label: 'Tax (17.5%)', value: 17.5, highlight: false },
      { label: 'Invoice Total', value: 117.5, highlight: true },
      { label: 'WHT (3%)', value: -3.53, highlight: false },
      { label: 'Net Receivable', value: 113.97, highlight: true },
    ]);
  });

  it('builds untaxed quotation export total rows with legacy fallback subtotal', () => {
    const quotation = {
      id: 'q-legacy',
      quotationNumber: 'QTN-LEGACY',
      customerId: 'c1',
      customerName: 'Legacy Customer',
      clientId: 'CLT-LEGACY',
      createdAt: new Date().toISOString(),
      items: [],
      totalAmount: 80,
      status: 'Draft' as const,
    };

    expect(buildDocumentTotalRows(quotation, 'Estimated Total')).toEqual([
      { label: 'Subtotal', value: 80, highlight: false },
      { label: 'Estimated Total', value: 80, highlight: true },
    ]);
  });

  it('builds taxed quotation export total rows from document snapshot fields', () => {
    const quotation = {
      id: 'q-taxed',
      quotationNumber: 'QTN-TAXED',
      customerId: 'c1',
      customerName: 'Taxed Customer',
      clientId: 'CLT-TAXED',
      createdAt: new Date().toISOString(),
      items: [],
      subtotalAmount: 200,
      taxAmount: 35,
      totalAmount: 235,
      status: 'Draft' as const,
      taxSnapshot: {
        enabled: true as const,
        preset: 'ghana-standard' as const,
        mode: 'exclusive' as const,
        totalRate: 17.5,
      },
    };

    expect(buildDocumentTotalRows(quotation, 'Estimated Total')).toEqual([
      { label: 'Subtotal', value: 200, highlight: false },
      { label: 'Tax (17.5%)', value: 35, highlight: false },
      { label: 'Estimated Total', value: 235, highlight: true },
    ]);

    expect(buildQuotationPdf(quotation, {
      businessProfile: seedState.businessProfile,
      currency: seedState.businessProfile.currency,
    }).byteLength).toBeGreaterThan(1000);
  });

  it('builds exempt and withholding quotation export rows from snapshots', () => {
    const quotation = {
      id: 'q-exempt-wht',
      quotationNumber: 'QTN-WHT',
      customerId: 'c1',
      customerName: 'Exempt Customer',
      clientId: 'CLT-WHT',
      createdAt: new Date().toISOString(),
      items: [],
      subtotalAmount: 200,
      taxAmount: 0,
      withholdingTaxAmount: 4,
      netReceivableAmount: 196,
      totalAmount: 200,
      status: 'Draft' as const,
      taxSnapshot: {
        enabled: true as const,
        preset: 'ghana-standard' as const,
        mode: 'exclusive' as const,
        totalRate: 17.5,
        exempt: true,
      },
      withholdingTaxSnapshot: {
        enabled: true as const,
        label: 'WHT',
        rate: 2,
        basis: 'subtotal' as const,
        amount: 4,
      },
    };

    expect(buildDocumentTotalRows(quotation, 'Estimated Total')).toEqual([
      { label: 'Subtotal', value: 200, highlight: false },
      { label: 'Tax exempt', value: 0, highlight: false },
      { label: 'Estimated Total', value: 200, highlight: true },
      { label: 'WHT (2%)', value: -4, highlight: false },
      { label: 'Net Receivable', value: 196, highlight: true },
    ]);
  });
});
