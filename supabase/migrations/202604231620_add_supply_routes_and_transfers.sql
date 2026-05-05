create table if not exists public.location_supply_routes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  from_location_id uuid not null references public.business_locations(id) on delete cascade,
  to_location_id uuid not null references public.business_locations(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_supply_routes_distinct_locations_check check (from_location_id <> to_location_id),
  unique (business_id, from_location_id, to_location_id)
);

create index if not exists location_supply_routes_business_id_idx
on public.location_supply_routes(business_id);

create index if not exists location_supply_routes_to_location_id_idx
on public.location_supply_routes(to_location_id, is_active);

create or replace function public.validate_location_supply_route()
returns trigger
language plpgsql
as $$
declare
  source_location public.business_locations%rowtype;
  destination_location public.business_locations%rowtype;
begin
  select * into source_location
  from public.business_locations
  where id = new.from_location_id;

  select * into destination_location
  from public.business_locations
  where id = new.to_location_id;

  if source_location.business_id is distinct from new.business_id
    or destination_location.business_id is distinct from new.business_id then
    raise exception 'Supply route locations must belong to the same business.';
  end if;

  if source_location.type <> 'warehouse' then
    raise exception 'Supply routes must start from a warehouse.';
  end if;

  if destination_location.type <> 'store' then
    raise exception 'Supply routes must deliver to a store.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_location_supply_route_before_write on public.location_supply_routes;
create trigger validate_location_supply_route_before_write
before insert or update on public.location_supply_routes
for each row execute function public.validate_location_supply_route();

alter table public.stock_movements
add column if not exists transfer_id uuid,
add column if not exists from_location_id uuid references public.business_locations(id) on delete set null,
add column if not exists to_location_id uuid references public.business_locations(id) on delete set null;

alter table public.stock_movements
drop constraint if exists stock_movements_movement_type_check;

alter table public.stock_movements
add constraint stock_movements_movement_type_check
check (movement_type in ('opening', 'sale', 'reversal', 'restock', 'transfer'));

create index if not exists stock_movements_transfer_id_idx
on public.stock_movements(transfer_id);

create index if not exists stock_movements_transfer_locations_idx
on public.stock_movements(from_location_id, to_location_id);

drop trigger if exists set_location_supply_routes_updated_at on public.location_supply_routes;
create trigger set_location_supply_routes_updated_at
before update on public.location_supply_routes
for each row execute function public.set_updated_at();

alter table public.location_supply_routes enable row level security;

drop policy if exists "Owners can manage location supply routes" on public.location_supply_routes;
create policy "Owners can manage location supply routes"
on public.location_supply_routes
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));
