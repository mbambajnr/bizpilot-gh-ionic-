alter table public.businesses
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists tax_preset text not null default 'ghana-standard',
  add column if not exists tax_mode text not null default 'exclusive',
  add column if not exists apply_tax_by_default boolean not null default true;

alter table public.businesses
  drop constraint if exists businesses_tax_preset_check,
  add constraint businesses_tax_preset_check check (tax_preset in ('ghana-standard'));

alter table public.businesses
  drop constraint if exists businesses_tax_mode_check,
  add constraint businesses_tax_mode_check check (tax_mode in ('exclusive', 'inclusive'));

alter table public.quotations
  add column if not exists subtotal_amount numeric,
  add column if not exists tax_amount numeric,
  add column if not exists tax_snapshot jsonb;

alter table public.invoices
  add column if not exists subtotal_amount numeric,
  add column if not exists tax_amount numeric,
  add column if not exists tax_snapshot jsonb;
