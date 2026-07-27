alter table public.businesses
add column if not exists launched_at timestamptz;
