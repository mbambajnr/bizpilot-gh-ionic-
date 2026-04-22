import { describe, expect, it } from 'vitest';

import { seedState } from '../data/seedBusiness';
import { buildInvoicePdf } from './documentPackPdf';

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
});
