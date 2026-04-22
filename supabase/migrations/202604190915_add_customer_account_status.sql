alter table public.customers
add column if not exists status text not null default 'active',
add column if not exists terminated_at timestamptz,
add column if not exists termination_reason text;

alter table public.customers
drop constraint if exists customers_status_check;

alter table public.customers
add constraint customers_status_check check (status in ('active', 'terminated'));
