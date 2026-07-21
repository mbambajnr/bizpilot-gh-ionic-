alter table public.invoices
  add column if not exists customer_snapshot jsonb;

alter table public.invoices
  alter column customer_id drop not null;

alter table public.invoices
  drop constraint if exists invoices_customer_or_snapshot_check;

alter table public.invoices
  add constraint invoices_customer_or_snapshot_check
  check (
    customer_id is not null
    or (
      customer_snapshot is not null
      and nullif(btrim(customer_snapshot ->> 'name'), '') is not null
      and nullif(btrim(customer_snapshot ->> 'source'), '') in ('registered', 'prospect')
    )
  );

create index if not exists invoices_business_customer_snapshot_idx
on public.invoices using gin (customer_snapshot);

comment on column public.invoices.customer_snapshot is
  'Customer details captured on invoices created without a registered customer, especially prospect-originated quotations.';
