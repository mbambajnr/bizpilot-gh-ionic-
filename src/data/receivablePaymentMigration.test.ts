import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161000_atomic_receivable_payments.sql'),
  'utf8',
);

describe('receivable payment command migration', () => {
  it('keeps payment posting atomic, serialized, and idempotent', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('for update');
    expect(migration).toContain("where id = requested_payment_id");
    expect(migration).toContain("'idempotent', true");
    expect(migration).toContain('insert into public.payments');
    expect(migration).toContain('insert into public.customer_ledger_entries');
    expect(migration).toContain('insert into public.business_audit_events');
    expect(migration).toContain('insert into public.app_notifications');
  });

  it('validates authorization and required evidence inside the command', () => {
    expect(migration).toContain("owner_id = auth.uid()");
    expect(migration).toContain("'payments.record'");
    expect(migration).toContain('requested_ledger_entry_number is null');
    expect(migration).toContain('requested_activity_number is null');
    expect(migration).toContain('requested_notification_id is null');
  });
});
