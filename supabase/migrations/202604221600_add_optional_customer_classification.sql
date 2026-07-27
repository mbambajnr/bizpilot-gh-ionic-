alter table public.businesses
add column if not exists customer_classification_enabled boolean not null default false;

alter table public.customers
add column if not exists customer_type text
check (customer_type in ('B2C', 'B2B'));

alter table public.quotations
add column if not exists customer_type_snapshot text
check (customer_type_snapshot in ('B2C', 'B2B'));

alter table public.invoices
add column if not exists customer_type_snapshot text
check (customer_type_snapshot in ('B2C', 'B2B'));

create index if not exists customers_business_id_customer_type_idx
on public.customers(business_id, customer_type);

create index if not exists quotations_business_id_customer_type_snapshot_idx
on public.quotations(business_id, customer_type_snapshot);

create index if not exists invoices_business_id_customer_type_snapshot_idx
on public.invoices(business_id, customer_type_snapshot);
