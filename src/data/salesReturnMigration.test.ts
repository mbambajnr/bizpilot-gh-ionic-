import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161130_sales_returns_credit_notes.sql'),
  'utf8',
);

describe('sales return command migration', () => {
  it('creates immutable return documents and owner-scoped policies', () => {
    expect(migration).toContain('create table if not exists public.credit_notes');
    expect(migration).toContain('create table if not exists public.credit_note_items');
    expect(migration).toContain('create table if not exists public.customer_refunds');
    expect(migration).toContain('public.user_owns_business');
  });

  it('keeps returns authorized, serialized, validated, and idempotent', () => {
    expect(migration).toContain("'sales.reverse'");
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('for update');
    expect(migration).toContain('Return quantity exceeds the remaining sold quantity');
    expect(migration).toContain('Credit amount does not match the returned invoice value');
    expect(migration).toContain("'idempotent', true");
  });

  it('writes inventory, ledger, audit, and notification evidence in the command', () => {
    expect(migration).toContain('insert into public.stock_movements');
    expect(migration).toContain('insert into public.customer_ledger_entries');
    expect(migration).toContain('insert into public.business_audit_events');
    expect(migration).toContain('insert into public.app_notifications');
  });
});
