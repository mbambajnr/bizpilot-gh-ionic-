-- BizPilot ERP foundation schema alignment
-- Brings Supabase up to the current local-first ERP data model.

alter table public.business_locations
  add column if not exists location_code text,
  add column if not exists address text,
  add column if not exists manager_name text,
  add column if not exists linked_warehouse_id uuid references public.business_locations(id) on delete set null;

create unique index if not exists business_locations_business_id_location_code_idx
on public.business_locations(business_id, location_code)
where location_code is not null;

alter table public.stock_movements
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists vendor_id text,
  add column if not exists vendor_code text,
  add column if not exists from_warehouse_id uuid references public.business_locations(id) on delete set null,
  add column if not exists to_store_id uuid references public.business_locations(id) on delete set null,
  add column if not exists performed_by text;

alter table public.stock_movements
  drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
  add constraint stock_movements_movement_type_check
  check (movement_type in ('opening', 'sale', 'reversal', 'restock', 'transfer', 'purchase', 'adjustment'));

alter table public.stock_movements
  drop constraint if exists stock_movements_source_type_check;

alter table public.stock_movements
  add constraint stock_movements_source_type_check
  check (source_type is null or source_type in ('purchase', 'transfer', 'sale', 'adjustment'));

create index if not exists stock_movements_source_type_source_id_idx
on public.stock_movements(source_type, source_id);

create index if not exists stock_movements_vendor_code_idx
on public.stock_movements(vendor_code);

alter table public.quotations
  add column if not exists valid_until timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists converted_invoice_id text,
  add column if not exists customer_type text;

alter table public.quotations
  drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in ('draft', 'open', 'approved', 'converted', 'rejected', 'expired', 'cancelled'));

alter table public.quotations
  drop constraint if exists quotations_customer_type_check;

alter table public.quotations
  add constraint quotations_customer_type_check
  check (customer_type is null or customer_type in ('registered', 'walkIn'));

alter table public.invoices
  drop constraint if exists invoices_payment_method_check;

alter table public.invoices
  add constraint invoices_payment_method_check
  check (payment_method in ('cash', 'mobile_money', 'bank_account'));

create table if not exists public.vendors (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendor_code text not null,
  name text not null,
  contact_email text,
  location text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_status_check check (status in ('active', 'inactive')),
  constraint vendors_name_not_blank check (length(trim(name)) > 0),
  unique (business_id, vendor_code)
);

create index if not exists vendors_business_id_idx
on public.vendors(business_id);

drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at
before update on public.vendors
for each row execute function public.set_updated_at();

alter table public.vendors enable row level security;

drop policy if exists "Owners can manage vendors" on public.vendors;
create policy "Owners can manage vendors"
on public.vendors
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

create table if not exists public.purchases (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_code text not null,
  vendor_id text not null,
  vendor_code text not null,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'draft',
  created_by text not null,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  received_warehouse_id uuid references public.business_locations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchases_status_check check (status in ('draft', 'submitted', 'adminReviewed', 'approved', 'receivedToWarehouse', 'cancelled')),
  unique (business_id, purchase_code)
);

create index if not exists purchases_business_id_idx
on public.purchases(business_id);

create index if not exists purchases_vendor_id_idx
on public.purchases(vendor_id);

drop trigger if exists set_purchases_updated_at on public.purchases;
create trigger set_purchases_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;

drop policy if exists "Owners can manage purchases" on public.purchases;
create policy "Owners can manage purchases"
on public.purchases
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id text not null references public.purchases(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  total_cost numeric(12, 2) not null check (total_cost >= 0),
  vendor_code text not null,
  created_at timestamptz not null default now()
);

create index if not exists purchase_items_purchase_id_idx
on public.purchase_items(purchase_id);

alter table public.purchase_items enable row level security;

drop policy if exists "Owners can manage purchase items" on public.purchase_items;
create policy "Owners can manage purchase items"
on public.purchase_items
for all
using (
  exists (
    select 1
    from public.purchases
    where purchases.id = purchase_items.purchase_id
      and public.user_owns_business(purchases.business_id)
  )
)
with check (
  exists (
    select 1
    from public.purchases
    where purchases.id = purchase_items.purchase_id
      and public.user_owns_business(purchases.business_id)
  )
);

create table if not exists public.accounts_payable (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  payable_code text not null,
  vendor_id text not null,
  vendor_code text not null,
  purchase_id text not null,
  amount_due numeric(12, 2) not null default 0 check (amount_due >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  due_date timestamptz,
  status text not null default 'pendingReview',
  payment_method text,
  payment_reference text,
  created_by text,
  approved_by text,
  paid_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint accounts_payable_status_check check (status in ('pendingReview', 'approved', 'partiallyPaid', 'paid', 'overdue', 'cancelled')),
  constraint accounts_payable_payment_method_check check (payment_method is null or payment_method in ('cash', 'bank', 'mobileMoney', 'creditCard')),
  unique (business_id, payable_code)
);

create index if not exists accounts_payable_business_id_idx
on public.accounts_payable(business_id);

create index if not exists accounts_payable_purchase_id_idx
on public.accounts_payable(purchase_id);

drop trigger if exists set_accounts_payable_updated_at on public.accounts_payable;
create trigger set_accounts_payable_updated_at
before update on public.accounts_payable
for each row execute function public.set_updated_at();

alter table public.accounts_payable enable row level security;

drop policy if exists "Owners can manage accounts payable" on public.accounts_payable;
create policy "Owners can manage accounts payable"
on public.accounts_payable
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

create table if not exists public.stock_transfers (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  transfer_code text not null,
  from_warehouse_id uuid not null references public.business_locations(id) on delete cascade,
  to_store_id uuid not null references public.business_locations(id) on delete cascade,
  status text not null default 'pending',
  initiated_by text not null,
  approved_by text,
  dispatched_by text,
  received_by text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  dispatched_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  constraint stock_transfers_status_check check (status in ('pending', 'approved', 'dispatched', 'received', 'cancelled')),
  unique (business_id, transfer_code)
);

create index if not exists stock_transfers_business_id_idx
on public.stock_transfers(business_id);

create index if not exists stock_transfers_from_to_idx
on public.stock_transfers(from_warehouse_id, to_store_id);

alter table public.stock_transfers enable row level security;

drop policy if exists "Owners can manage stock transfers" on public.stock_transfers;
create policy "Owners can manage stock transfers"
on public.stock_transfers
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id text not null references public.stock_transfers(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists stock_transfer_items_transfer_id_idx
on public.stock_transfer_items(transfer_id);

alter table public.stock_transfer_items enable row level security;

drop policy if exists "Owners can manage stock transfer items" on public.stock_transfer_items;
create policy "Owners can manage stock transfer items"
on public.stock_transfer_items
for all
using (
  exists (
    select 1
    from public.stock_transfers
    where stock_transfers.id = stock_transfer_items.transfer_id
      and public.user_owns_business(stock_transfers.business_id)
  )
)
with check (
  exists (
    select 1
    from public.stock_transfers
    where stock_transfers.id = stock_transfer_items.transfer_id
      and public.user_owns_business(stock_transfers.business_id)
  )
);

create table if not exists public.payments (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  payment_code text not null,
  source_type text not null,
  source_id text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  method text not null,
  reference text,
  recorded_by text not null,
  created_at timestamptz not null default now(),
  constraint payments_source_type_check check (source_type in ('sale', 'invoice', 'payable', 'expense')),
  constraint payments_method_check check (method in ('cash', 'bank', 'mobileMoney', 'creditCard')),
  unique (business_id, payment_code)
);

create index if not exists payments_business_id_idx
on public.payments(business_id);

create index if not exists payments_source_idx
on public.payments(source_type, source_id);

alter table public.payments enable row level security;

drop policy if exists "Owners can manage payments" on public.payments;
create policy "Owners can manage payments"
on public.payments
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));
