-- BizPilot GH initial Supabase schema
-- This schema mirrors the current local-first product model while keeping the
-- database simple enough for the MVP: businesses own products, customers,
-- invoices, quotations, stock movements, ledger entries, and activity events.

create extension if not exists "pgcrypto";

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_code text not null unique,
  business_name text not null,
  currency text not null default 'GHS',
  country text not null default 'Ghana',
  receipt_prefix text not null default 'RCP-',
  invoice_prefix text not null default 'INV-',
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inventory_id text not null,
  name text not null,
  unit text not null default 'units',
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2) not null check (cost >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, inventory_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id text not null,
  name text not null,
  channel text not null default 'No action needed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, client_id)
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quotation_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'converted')),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, quotation_number)
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_number text not null,
  receipt_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quotation_id uuid references public.quotations(id) on delete set null,
  quantity integer not null check (quantity > 0),
  payment_method text not null check (payment_method in ('cash', 'mobile_money')),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'completed' check (status in ('completed', 'reversed')),
  reversal_reason text,
  reversed_at timestamptz,
  reversed_by text,
  correction_of_invoice_id uuid references public.invoices(id) on delete set null,
  corrected_by_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number),
  unique (business_id, receipt_number),
  check (paid_amount <= total_amount)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  movement_number text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening', 'sale', 'reversal')),
  quantity_delta integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  invoice_id uuid references public.invoices(id) on delete set null,
  reference_number text,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, movement_number)
);

create table if not exists public.customer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  entry_type text not null check (entry_type in ('opening_balance', 'invoice_charge', 'payment_received', 'reversal')),
  amount_delta numeric(12, 2) not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  reference_number text,
  payment_method text check (payment_method in ('cash', 'mobile_money')),
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (business_id, entry_number)
);

create table if not exists public.activity_log_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  activity_number text not null,
  entity_type text not null check (entity_type in ('invoice', 'quotation', 'product', 'customer', 'business')),
  entity_id uuid not null,
  action_type text not null check (
    action_type in (
      'product_created',
      'customer_created',
      'quotation_created',
      'quotation_converted',
      'invoice_created',
      'receipt_issued',
      'invoice_reversed',
      'correction_invoice_created',
      'business_profile_updated'
    )
  ),
  title text not null,
  detail text not null,
  status text not null default 'info' check (status in ('info', 'success', 'warning')),
  reference_number text,
  related_entity_id uuid,
  related_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, activity_number)
);

create index if not exists businesses_owner_id_idx on public.businesses(owner_id);
create index if not exists products_business_id_idx on public.products(business_id);
create index if not exists customers_business_id_idx on public.customers(business_id);
create index if not exists quotations_business_id_idx on public.quotations(business_id);
create index if not exists quotation_items_quotation_id_idx on public.quotation_items(quotation_id);
create index if not exists invoices_business_id_idx on public.invoices(business_id);
create index if not exists invoices_customer_id_idx on public.invoices(customer_id);
create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);
create index if not exists customer_ledger_entries_customer_id_idx on public.customer_ledger_entries(customer_id);
create index if not exists activity_log_entries_business_id_idx on public.activity_log_entries(business_id);
create index if not exists activity_log_entries_related_invoice_id_idx on public.activity_log_entries(related_invoice_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_quotations_updated_at on public.quotations;
create trigger set_quotations_updated_at
before update on public.quotations
for each row execute function public.set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create or replace function public.user_owns_business(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses
    where businesses.id = target_business_id
      and businesses.owner_id = auth.uid()
  );
$$;

alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.invoices enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customer_ledger_entries enable row level security;
alter table public.activity_log_entries enable row level security;

drop policy if exists "Owners can manage their businesses" on public.businesses;
create policy "Owners can manage their businesses"
on public.businesses
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Owners can manage products" on public.products;
create policy "Owners can manage products"
on public.products
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage customers" on public.customers;
create policy "Owners can manage customers"
on public.customers
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage quotations" on public.quotations;
create policy "Owners can manage quotations"
on public.quotations
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage quotation items" on public.quotation_items;
create policy "Owners can manage quotation items"
on public.quotation_items
for all
using (
  exists (
    select 1
    from public.quotations
    where quotations.id = quotation_items.quotation_id
      and public.user_owns_business(quotations.business_id)
  )
)
with check (
  exists (
    select 1
    from public.quotations
    where quotations.id = quotation_items.quotation_id
      and public.user_owns_business(quotations.business_id)
  )
);

drop policy if exists "Owners can manage invoices" on public.invoices;
create policy "Owners can manage invoices"
on public.invoices
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage stock movements" on public.stock_movements;
create policy "Owners can manage stock movements"
on public.stock_movements
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage customer ledger entries" on public.customer_ledger_entries;
create policy "Owners can manage customer ledger entries"
on public.customer_ledger_entries
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage activity log entries" on public.activity_log_entries;
create policy "Owners can manage activity log entries"
on public.activity_log_entries
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));
