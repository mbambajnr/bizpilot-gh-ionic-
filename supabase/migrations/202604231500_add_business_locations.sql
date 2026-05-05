create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null default 'store',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_locations_type_check check (type in ('store', 'warehouse')),
  constraint business_locations_name_not_blank check (length(trim(name)) > 0)
);

create unique index if not exists business_locations_one_default_idx
on public.business_locations(business_id)
where is_default;

create index if not exists business_locations_business_id_idx
on public.business_locations(business_id);

create index if not exists business_locations_business_id_type_idx
on public.business_locations(business_id, type, is_active);

insert into public.business_locations (business_id, name, type, is_default, is_active)
select businesses.id, 'Main Store', 'store', true, true
from public.businesses
where not exists (
  select 1
  from public.business_locations
  where business_locations.business_id = businesses.id
);

alter table public.stock_movements
add column if not exists location_id uuid references public.business_locations(id) on delete set null;

alter table public.stock_movements
drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
add constraint stock_movements_movement_type_check
check (movement_type in ('opening', 'sale', 'reversal', 'restock'));

update public.stock_movements
set location_id = defaults.id
from public.business_locations defaults
where stock_movements.business_id = defaults.business_id
  and defaults.is_default = true
  and stock_movements.location_id is null;

create index if not exists stock_movements_product_location_idx
on public.stock_movements(product_id, location_id);

drop trigger if exists set_business_locations_updated_at on public.business_locations;
create trigger set_business_locations_updated_at
before update on public.business_locations
for each row execute function public.set_updated_at();

alter table public.business_locations enable row level security;

drop policy if exists "Owners can manage business locations" on public.business_locations;
create policy "Owners can manage business locations"
on public.business_locations
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));
