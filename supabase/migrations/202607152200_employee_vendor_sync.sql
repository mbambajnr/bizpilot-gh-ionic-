create or replace function public.sync_employee_vendor(
  credential_identifier text,
  credential_password text,
  vendor_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_record public.employee_credentials%rowtype;
  existing_vendor public.vendors%rowtype;
  requested_id text := nullif(trim(coalesce(vendor_payload->>'id', '')), '');
  requested_code text := nullif(trim(coalesce(vendor_payload->>'vendorCode', '')), '');
  requested_name text := nullif(trim(coalesce(vendor_payload->>'name', '')), '');
  requested_location text := nullif(trim(coalesce(vendor_payload->>'location', '')), '');
  requested_status text := lower(trim(coalesce(vendor_payload->>'status', 'active')));
begin
  select * into employee_record
  from public.employee_credentials
  where account_status = 'active'
    and password_hash is not null
    and password_hash = extensions.crypt(trim(credential_password), password_hash)
    and (lower(email) = lower(trim(credential_identifier)) or lower(username) = lower(trim(credential_identifier)))
  limit 1;

  if employee_record.id is null then raise exception 'Invalid employee credentials'; end if;
  if employee_record.role not in ('GeneralManager', 'PurchaseManager') then
    raise exception 'This employee role cannot manage vendors';
  end if;
  if requested_id is null or requested_code is null or requested_name is null or requested_location is null then
    raise exception 'Vendor id, code, name, and location are required';
  end if;
  if requested_status not in ('active', 'inactive') then raise exception 'Invalid vendor status'; end if;

  select * into existing_vendor from public.vendors where id = requested_id limit 1;
  if existing_vendor.id is not null and existing_vendor.business_id <> employee_record.business_id then
    raise exception 'Vendor belongs to another business';
  end if;

  insert into public.vendors (
    id, business_id, vendor_code, name, contact_email, location, status, created_at, updated_at
  ) values (
    requested_id,
    employee_record.business_id,
    requested_code,
    requested_name,
    nullif(trim(coalesce(vendor_payload->>'contactEmail', '')), ''),
    requested_location,
    requested_status,
    coalesce(nullif(vendor_payload->>'createdAt', '')::timestamptz, now()),
    coalesce(nullif(vendor_payload->>'updatedAt', '')::timestamptz, now())
  )
  on conflict (id) do update set
    vendor_code = excluded.vendor_code,
    name = excluded.name,
    contact_email = excluded.contact_email,
    location = excluded.location,
    status = excluded.status,
    updated_at = excluded.updated_at
  where public.vendors.business_id = employee_record.business_id;

  return true;
end;
$$;

revoke all on function public.sync_employee_vendor(text, text, jsonb) from public;
grant execute on function public.sync_employee_vendor(text, text, jsonb) to anon, authenticated;
