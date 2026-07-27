alter table public.businesses
add column if not exists inventory_categories_enabled boolean not null default false;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

alter table public.products
add column if not exists category_id uuid references public.product_categories(id) on delete set null;

alter table public.product_categories
drop constraint if exists product_categories_id_business_id_key;

alter table public.product_categories
add constraint product_categories_id_business_id_key unique (id, business_id);

alter table public.product_categories
add column if not exists parent_category_id uuid references public.product_categories(id) on delete set null;

create index if not exists product_categories_business_id_parent_category_id_idx
on public.product_categories(business_id, parent_category_id);

create index if not exists product_categories_business_id_idx
on public.product_categories(business_id);

create index if not exists product_categories_business_id_is_active_sort_idx
on public.product_categories(business_id, is_active, sort_order, name);

create index if not exists products_business_id_category_id_idx
on public.products(business_id, category_id);

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

drop policy if exists "Owners can manage product categories" on public.product_categories;
create policy "Owners can manage product categories"
on public.product_categories
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

create or replace function public.enforce_product_category_business_match()
returns trigger
language plpgsql
as $$
begin
  if new.category_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.product_categories
    where product_categories.id = new.category_id
      and product_categories.business_id = new.business_id
  ) then
    raise exception 'Product category must belong to the same business.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_product_category_business_match on public.products;
create trigger enforce_product_category_business_match
before insert or update of business_id, category_id
on public.products
for each row execute function public.enforce_product_category_business_match();
