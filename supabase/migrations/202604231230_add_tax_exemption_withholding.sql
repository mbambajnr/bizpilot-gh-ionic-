alter table public.businesses
  add column if not exists withholding_tax_enabled boolean not null default false,
  add column if not exists default_withholding_tax_rate numeric not null default 0,
  add column if not exists default_withholding_tax_label text not null default 'Withholding Tax',
  add column if not exists default_withholding_tax_basis text not null default 'taxInclusiveTotal';

alter table public.businesses
  drop constraint if exists businesses_default_withholding_tax_basis_check,
  add constraint businesses_default_withholding_tax_basis_check
    check (default_withholding_tax_basis in ('subtotal', 'taxInclusiveTotal', 'taxExclusiveSubtotal'));

alter table public.businesses
  drop constraint if exists businesses_default_withholding_tax_rate_check,
  add constraint businesses_default_withholding_tax_rate_check
    check (default_withholding_tax_rate >= 0 and default_withholding_tax_rate <= 100);

alter table public.customers
  add column if not exists tax_exempt boolean not null default false,
  add column if not exists tax_exemption_reason text;

alter table public.quotations
  add column if not exists withholding_tax_amount numeric,
  add column if not exists net_receivable_amount numeric,
  add column if not exists withholding_tax_snapshot jsonb;

alter table public.invoices
  add column if not exists withholding_tax_amount numeric,
  add column if not exists net_receivable_amount numeric,
  add column if not exists withholding_tax_snapshot jsonb;
