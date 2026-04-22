alter table public.customers
add column if not exists phone text,
add column if not exists whatsapp text,
add column if not exists email text;
