-- Keep purchase approval/decline fields in cloud sync.

alter table public.purchases
add column if not exists declined_by text,
add column if not exists declined_at timestamptz,
add column if not exists decline_note text;

alter table public.purchases
drop constraint if exists purchases_status_check;

alter table public.purchases
add constraint purchases_status_check
check (status in ('draft', 'submitted', 'adminReviewed', 'approved', 'receivedToWarehouse', 'cancelled', 'declined'));
