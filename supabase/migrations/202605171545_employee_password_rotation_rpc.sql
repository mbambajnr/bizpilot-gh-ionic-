-- Allow employees to replace an admin-issued temporary password after sign-in.
-- TODO(security): This still depends on plaintext password comparison.
-- Migrate this flow to hashed verification or Supabase Auth-backed employee sign-in.

create or replace function public.rotate_employee_credential_password(
  credential_identifier text,
  current_password text,
  next_password text
)
returns table (
  id text,
  business_id uuid,
  email text,
  username text,
  credentials_generated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text := lower(trim(coalesce(credential_identifier, '')));
  cleaned_current_password text := trim(coalesce(current_password, ''));
  cleaned_next_password text := trim(coalesce(next_password, ''));
begin
  if normalized_identifier = '' or cleaned_current_password = '' or cleaned_next_password = '' then
    return;
  end if;

  if cleaned_current_password = cleaned_next_password then
    return;
  end if;

  return query
  update public.employee_credentials
  set
    temporary_password = cleaned_next_password,
    credentials_generated_at = now()
  where
    employee_credentials.account_status = 'active'
    and employee_credentials.temporary_password = cleaned_current_password
    and (
      lower(employee_credentials.email) = normalized_identifier
      or lower(employee_credentials.username) = normalized_identifier
    )
  returning
    employee_credentials.id,
    employee_credentials.business_id,
    employee_credentials.email,
    employee_credentials.username,
    employee_credentials.credentials_generated_at;
end;
$$;

revoke all on function public.rotate_employee_credential_password(text, text, text) from public;
grant execute on function public.rotate_employee_credential_password(text, text, text) to anon, authenticated;
