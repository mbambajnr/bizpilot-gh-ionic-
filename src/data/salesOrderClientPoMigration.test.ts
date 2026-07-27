import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dataMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607162100_sales_order_client_po_documents.sql'),
  'utf8',
);

const storageMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607162110_sales_documents_storage.sql'),
  'utf8',
);

const employeeQuotationSync = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161930_employee_quotation_workflow.sql'),
  'utf8',
);

describe('sales order client PO migration', () => {
  it('stores client purchase orders on quotations and carries selected PO data to invoices', () => {
    expect(dataMigration).toContain('client_purchase_orders jsonb not null default');
    expect(dataMigration).toContain('quotations_client_purchase_orders_array_check');
    expect(dataMigration).toContain('client_po_number text');
    expect(dataMigration).toContain('client_po_document jsonb');
  });

  it('creates a private sales document bucket for client PO PDFs', () => {
    expect(storageMigration).toContain("'sales-documents'");
    expect(storageMigration).toContain('array[\'application/pdf\']');
    expect(storageMigration).toContain('file_size_limit');
    expect(storageMigration).toContain('Owners can upload sales documents');
  });

  it('keeps employee quotation sync aware of attached client PO evidence', () => {
    expect(employeeQuotationSync).toContain('client_purchase_orders');
    expect(employeeQuotationSync).toContain("quotation_payload->'clientPurchaseOrders'");
  });
});
