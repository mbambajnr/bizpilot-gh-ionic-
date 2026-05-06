-- Persist generated employee login credentials with the cloud workspace.

create table if not exists public.employee_credentials (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null,
  username text not null,
  temporary_password text,
  credentials_generated_at timestamptz,
  account_status text not null default 'active',
  deactivated_at timestamptz,
  role text not null,
  role_label text,
  granted_permissions text[] not null default '{}',
  revoked_permissions text[] not null default '{}',
  customer_email_sender_name text,
  customer_email_sender_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_credentials_status_check check (account_status in ('active', 'deactivated'))
);

create index if not exists employee_credentials_business_id_idx
on public.employee_credentials(business_id);

create index if not exists employee_credentials_email_idx
on public.employee_credentials(lower(email));

create unique index if not exists employee_credentials_business_email_key
on public.employee_credentials(business_id, lower(email));

create unique index if not exists employee_credentials_business_username_key
on public.employee_credentials(business_id, lower(username));

drop trigger if exists set_employee_credentials_updated_at on public.employee_credentials;
create trigger set_employee_credentials_updated_at
before update on public.employee_credentials
for each row execute function public.set_updated_at();

alter table public.employee_credentials enable row level security;

drop policy if exists "Owners can manage employee credentials" on public.employee_credentials;
create policy "Owners can manage employee credentials"
on public.employee_credentials
for all
using (public.user_owns_business(business_id))
with check (public.user_owns_business(business_id));

create or replace function public.authenticate_employee_credential(
  credential_identifier text,
  credential_password text
)
returns table (
  id text,
  business_id uuid,
  name text,
  email text,
  username text,
  temporary_password text,
  credentials_generated_at timestamptz,
  account_status text,
  deactivated_at timestamptz,
  role text,
  role_label text,
  granted_permissions text[],
  revoked_permissions text[],
  customer_email_sender_name text,
  customer_email_sender_email text
)
language sql
security definer
set search_path = public
as $$
  select
    employee_credentials.id,
    employee_credentials.business_id,
    employee_credentials.name,
    employee_credentials.email,
    employee_credentials.username,
    employee_credentials.temporary_password,
    employee_credentials.credentials_generated_at,
    employee_credentials.account_status,
    employee_credentials.deactivated_at,
    employee_credentials.role,
    employee_credentials.role_label,
    employee_credentials.granted_permissions,
    employee_credentials.revoked_permissions,
    employee_credentials.customer_email_sender_name,
    employee_credentials.customer_email_sender_email
  from public.employee_credentials
  where
    employee_credentials.account_status = 'active'
    and employee_credentials.temporary_password = credential_password
    and (
      lower(employee_credentials.email) = lower(trim(credential_identifier))
      or lower(employee_credentials.username) = lower(trim(credential_identifier))
    )
  limit 1;
$$;

revoke all on function public.authenticate_employee_credential(text, text) from public;
grant execute on function public.authenticate_employee_credential(text, text) to anon, authenticated;
