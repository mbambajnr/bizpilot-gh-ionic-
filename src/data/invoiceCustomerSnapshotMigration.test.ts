import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607162030_invoice_customer_snapshots.sql'),
  'utf8'
);

describe('invoice customer snapshot migration', () => {
  it('allows invoices to be backed by either a registered customer or an invoice customer snapshot', () => {
    expect(migration).toContain('customer_snapshot jsonb');
    expect(migration).toContain('alter column customer_id drop not null');
    expect(migration).toContain('invoices_customer_or_snapshot_check');
    expect(migration).toContain("customer_snapshot ->> 'name'");
    expect(migration).toContain("customer_snapshot ->> 'source'");
  });
});
