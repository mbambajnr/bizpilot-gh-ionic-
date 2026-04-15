# BizPilot GH Supabase Schema

This folder contains the initial Supabase database migration for BizPilot GH.

The schema is designed to match the current local-first model without adding heavy ERP complexity.

## What The Schema Covers

- `businesses`: business profile, country, currency, and document prefixes
- `products`: inventory catalog
- `customers`: customer profiles
- `quotations` and `quotation_items`: pre-sale documents
- `invoices`: formal records created from sales
- `stock_movements`: movement history used to derive stock on hand
- `customer_ledger_entries`: statement/receivables history used to derive balances
- `activity_log_entries`: audit-style activity history

## Security Model

Row Level Security is enabled on every table.

The MVP policy is simple:

- each `business` has one `owner_id`
- owners can manage records that belong to their business
- multi-user roles are intentionally not added yet

This keeps the schema ready for Supabase Auth without introducing team/role complexity before the product needs it.

## Apply The Migration

Once a Supabase project exists, apply the migration with the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste the SQL from:

```text
supabase/migrations/202604150001_initial_bizpilot_schema.sql
```

into the Supabase SQL Editor.

## Naming Notes

The database uses user-facing terminology where practical:

- `invoices` instead of saved sale records
- `receipt_number` for payment proof numbering
- `correction_invoice_created` for correction activity
- `customer_ledger_entries` for statement history

The frontend can continue to call the action workflow `Sales` while syncing formal saved records to `invoices`.
