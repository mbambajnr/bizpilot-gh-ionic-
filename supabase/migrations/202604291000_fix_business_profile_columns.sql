alter table public.businesses
  add column if not exists waybill_prefix text,
  add column if not exists address text,
  add column if not exists website text;

update public.businesses
set
  waybill_prefix = coalesce(waybill_prefix, 'WAY-'),
  address = coalesce(address, '');

alter table public.businesses
  alter column waybill_prefix set default 'WAY-',
  alter column waybill_prefix set not null,
  alter column address set default '',
  alter column address set not null;
