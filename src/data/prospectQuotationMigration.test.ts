import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202607161430_prospect_quotations.sql'),
  'utf8'
);

describe('prospect quotation migration', () => {
  it('allows a customer-less quotation only with an identifiable prospect snapshot', () => {
    expect(migration).toContain('alter column customer_id drop not null');
    expect(migration).toContain("customer_type in ('registered', 'walkIn', 'prospect')");
    expect(migration).toContain("prospect_details ->> 'name'");
    expect(migration).toContain("prospect_details ->> 'phone'");
    expect(migration).toContain("prospect_details ->> 'email'");
    expect(migration).toContain('prospect_converted_at timestamptz');
  });
});
