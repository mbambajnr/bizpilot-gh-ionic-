-- Harden employee credential handling before enterprise rollout.
-- Passwords are now stored as pgcrypto hashes, never returned by auth RPCs,
-- and legacy plaintext values are cleared after a one-time backfill.

create extension if not exists pgcrypto;

alter table public.employee_credentials
add column if not exists password_hash text;

alter table public.employee_credentials
add column if not exists requires_password_change boolean not null default false;

alter table public.purchases
drop constraint if exists purchases_status_check;

alter table public.purchases
add constraint purchases_status_check
check (status in ('draft', 'submitted', 'adminReviewed', 'approved', 'receivedToWarehouse', 'declined', 'cancelled'));

update public.employee_credentials
set
  password_hash = extensions.crypt(temporary_password, extensions.gen_salt('bf')),
  temporary_password = null,
  requires_password_change = true
where
  password_hash is null
  and temporary_password is not null
  and temporary_password <> '';

create or replace function public.upsert_employee_credential(
  credential_user_id text,
  credential_business_id uuid,
  credential_name text,
  credential_email text,
  credential_username text,
  credential_password text,
  credential_requires_password_change boolean,
  credential_generated_at timestamptz,
  credential_account_status text,
  credential_deactivated_at timestamptz,
  credential_role text,
  credential_role_label text,
  credential_granted_permissions text[],
  credential_revoked_permissions text[],
  credential_customer_email_sender_name text,
  credential_customer_email_sender_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_password text := trim(coalesce(credential_password, ''));
begin
  if not public.user_owns_business(credential_business_id) then
    raise exception 'Not authorized to manage employee credentials';
  end if;

  insert into public.employee_credentials (
    id,
    business_id,
    name,
    email,
    username,
    password_hash,
    temporary_password,
    requires_password_change,
    credentials_generated_at,
    account_status,
    deactivated_at,
    role,
    role_label,
    granted_permissions,
    revoked_permissions,
    customer_email_sender_name,
    customer_email_sender_email
  )
  values (
    credential_user_id,
    credential_business_id,
    trim(credential_name),
    lower(trim(credential_email)),
    lower(trim(credential_username)),
    case when cleaned_password = '' then null else extensions.crypt(cleaned_password, extensions.gen_salt('bf')) end,
    null,
    case
      when cleaned_password = '' then coalesce(credential_requires_password_change, false)
      else true
    end,
    credential_generated_at,
    coalesce(credential_account_status, 'active'),
    credential_deactivated_at,
    credential_role,
    nullif(trim(coalesce(credential_role_label, '')), ''),
    coalesce(credential_granted_permissions, '{}'),
    coalesce(credential_revoked_permissions, '{}'),
    nullif(trim(coalesce(credential_customer_email_sender_name, '')), ''),
    nullif(trim(coalesce(credential_customer_email_sender_email, '')), '')
  )
  on conflict (id) do update set
    business_id = excluded.business_id,
    name = excluded.name,
    email = excluded.email,
    username = excluded.username,
    password_hash = case
      when cleaned_password = '' then public.employee_credentials.password_hash
      else excluded.password_hash
    end,
    temporary_password = null,
    requires_password_change = case
      when cleaned_password = '' then coalesce(credential_requires_password_change, public.employee_credentials.requires_password_change)
      else true
    end,
    credentials_generated_at = coalesce(excluded.credentials_generated_at, public.employee_credentials.credentials_generated_at),
    account_status = excluded.account_status,
    deactivated_at = excluded.deactivated_at,
    role = excluded.role,
    role_label = excluded.role_label,
    granted_permissions = excluded.granted_permissions,
    revoked_permissions = excluded.revoked_permissions,
    customer_email_sender_name = excluded.customer_email_sender_name,
    customer_email_sender_email = excluded.customer_email_sender_email,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.upsert_employee_credential(
  text,
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz,
  text,
  timestamptz,
  text,
  text,
  text[],
  text[],
  text,
  text
) from public;
grant execute on function public.upsert_employee_credential(
  text,
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  timestamptz,
  text,
  timestamptz,
  text,
  text,
  text[],
  text[],
  text,
  text
) to authenticated;

-- PostgreSQL cannot replace a function when its OUT columns change.
drop function if exists public.authenticate_employee_credential(text, text);

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
  requires_password_change boolean,
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
    employee_credentials.requires_password_change,
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
    and employee_credentials.password_hash is not null
    and employee_credentials.password_hash = extensions.crypt(trim(credential_password), employee_credentials.password_hash)
    and (
      lower(employee_credentials.email) = lower(trim(credential_identifier))
      or lower(employee_credentials.username) = lower(trim(credential_identifier))
    )
  limit 1;
$$;

revoke all on function public.authenticate_employee_credential(text, text) from public;
grant execute on function public.authenticate_employee_credential(text, text) to anon, authenticated;

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
    password_hash = extensions.crypt(cleaned_next_password, extensions.gen_salt('bf')),
    temporary_password = null,
    requires_password_change = false,
    credentials_generated_at = now(),
    updated_at = now()
  where
    employee_credentials.account_status = 'active'
    and employee_credentials.password_hash is not null
    and employee_credentials.password_hash = extensions.crypt(cleaned_current_password, employee_credentials.password_hash)
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

create or replace function public.sync_employee_purchase(
  credential_identifier text,
  credential_password text,
  purchase_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_record public.employee_credentials%rowtype;
  existing_purchase public.purchases%rowtype;
  item jsonb;
  requested_purchase_id text := nullif(trim(coalesce(purchase_payload->>'id', '')), '');
  requested_status text := coalesce(nullif(trim(coalesce(purchase_payload->>'status', '')), ''), 'draft');
  safe_purchase_code text := nullif(trim(coalesce(purchase_payload->>'purchaseCode', '')), '');
  safe_vendor_id text := nullif(trim(coalesce(purchase_payload->>'vendorId', '')), '');
  safe_vendor_code text := nullif(trim(coalesce(purchase_payload->>'vendorCode', '')), '');
  safe_total_amount numeric := coalesce((purchase_payload->>'totalAmount')::numeric, 0);
  safe_status text := 'draft';
  safe_created_by text := employee_record.id;
  safe_submitted_at timestamptz := null;
  safe_approved_by text := null;
  safe_approved_at timestamptz := null;
  safe_declined_by text := null;
  safe_declined_at timestamptz := null;
  safe_decline_note text := null;
  safe_received_warehouse_id uuid := null;
  safe_created_at timestamptz := coalesce(nullif(purchase_payload->>'createdAt', '')::timestamptz, now());
  safe_updated_at timestamptz := coalesce(nullif(purchase_payload->>'updatedAt', '')::timestamptz, now());
  can_replace_items boolean := false;
begin
  if requested_purchase_id is null then
    raise exception 'Purchase id is required';
  end if;

  select *
  into employee_record
  from public.employee_credentials
  where
    account_status = 'active'
    and password_hash is not null
    and password_hash = extensions.crypt(trim(credential_password), password_hash)
    and (
      lower(email) = lower(trim(credential_identifier))
      or lower(username) = lower(trim(credential_identifier))
    )
  limit 1;

  if employee_record.id is null then
    raise exception 'Invalid employee credentials';
  end if;

  select *
  into existing_purchase
  from public.purchases
  where id = requested_purchase_id
    and business_id = employee_record.business_id
  limit 1;

  safe_created_by := coalesce(existing_purchase.created_by, employee_record.id);

  if employee_record.role = 'PurchaseManager' then
    if requested_status not in ('draft', 'submitted') then
      raise exception 'Purchase managers can only sync draft or submitted purchases';
    end if;

    if existing_purchase.id is not null and existing_purchase.status not in ('draft', 'submitted') then
      raise exception 'Approved, declined, or received purchases cannot be edited by purchase managers';
    end if;

    safe_status := requested_status;
    safe_submitted_at := case
      when requested_status = 'submitted' then coalesce(nullif(purchase_payload->>'submittedAt', '')::timestamptz, now())
      else null
    end;
    can_replace_items := true;
  elsif employee_record.role = 'GeneralManager' then
    if requested_status in ('draft', 'submitted') then
      if existing_purchase.id is not null and existing_purchase.status not in ('draft', 'submitted') then
        raise exception 'Approved, declined, or received purchases cannot be edited as drafts';
      end if;

      safe_status := requested_status;
      safe_submitted_at := case
        when requested_status = 'submitted' then coalesce(nullif(purchase_payload->>'submittedAt', '')::timestamptz, now())
        else null
      end;
      can_replace_items := true;
    elsif requested_status = 'approved' then
      if existing_purchase.id is null or existing_purchase.status not in ('submitted', 'adminReviewed', 'approved') then
        raise exception 'Only submitted purchases can be approved';
      end if;

      safe_purchase_code := existing_purchase.purchase_code;
      safe_vendor_id := existing_purchase.vendor_id;
      safe_vendor_code := existing_purchase.vendor_code;
      safe_total_amount := existing_purchase.total_amount;
      safe_status := 'approved';
      safe_created_by := existing_purchase.created_by;
      safe_submitted_at := existing_purchase.submitted_at;
      safe_approved_by := employee_record.id;
      safe_approved_at := coalesce(nullif(purchase_payload->>'approvedAt', '')::timestamptz, now());
      safe_created_at := existing_purchase.created_at;
    elsif requested_status in ('declined', 'cancelled') then
      if existing_purchase.id is null or existing_purchase.status not in ('submitted', 'adminReviewed', 'declined', 'cancelled') then
        raise exception 'Only submitted purchases can be declined or cancelled';
      end if;

      safe_purchase_code := existing_purchase.purchase_code;
      safe_vendor_id := existing_purchase.vendor_id;
      safe_vendor_code := existing_purchase.vendor_code;
      safe_total_amount := existing_purchase.total_amount;
      safe_status := requested_status;
      safe_created_by := existing_purchase.created_by;
      safe_submitted_at := existing_purchase.submitted_at;
      safe_declined_by := employee_record.id;
      safe_declined_at := coalesce(nullif(purchase_payload->>'declinedAt', '')::timestamptz, now());
      safe_decline_note := nullif(purchase_payload->>'declineNote', '');
      safe_created_at := existing_purchase.created_at;
    else
      raise exception 'General managers cannot sync this purchase status';
    end if;
  elsif employee_record.role = 'WarehouseManager' then
    if requested_status <> 'receivedToWarehouse' then
      raise exception 'Warehouse managers can only sync warehouse receipt status';
    end if;

    if existing_purchase.id is null or existing_purchase.status not in ('approved', 'receivedToWarehouse') then
      raise exception 'Only approved purchases can be received into warehouse';
    end if;

    safe_purchase_code := existing_purchase.purchase_code;
    safe_vendor_id := existing_purchase.vendor_id;
    safe_vendor_code := existing_purchase.vendor_code;
    safe_total_amount := existing_purchase.total_amount;
    safe_status := 'receivedToWarehouse';
    safe_created_by := existing_purchase.created_by;
    safe_submitted_at := existing_purchase.submitted_at;
    safe_approved_by := existing_purchase.approved_by;
    safe_approved_at := existing_purchase.approved_at;
    safe_declined_by := existing_purchase.declined_by;
    safe_declined_at := existing_purchase.declined_at;
    safe_decline_note := existing_purchase.decline_note;
    safe_received_warehouse_id := coalesce(nullif(purchase_payload->>'receivedWarehouseId', '')::uuid, existing_purchase.received_warehouse_id);
    safe_created_at := existing_purchase.created_at;
  else
    raise exception 'This employee role cannot sync purchases';
  end if;

  insert into public.purchases (
    id,
    business_id,
    purchase_code,
    vendor_id,
    vendor_code,
    total_amount,
    status,
    created_by,
    submitted_at,
    approved_by,
    approved_at,
    declined_by,
    declined_at,
    decline_note,
    received_warehouse_id,
    created_at,
    updated_at
  )
  values (
    requested_purchase_id,
    employee_record.business_id,
    safe_purchase_code,
    safe_vendor_id,
    safe_vendor_code,
    safe_total_amount,
    safe_status,
    safe_created_by,
    safe_submitted_at,
    safe_approved_by,
    safe_approved_at,
    safe_declined_by,
    safe_declined_at,
    safe_decline_note,
    safe_received_warehouse_id,
    safe_created_at,
    safe_updated_at
  )
  on conflict (id) do update set
    purchase_code = excluded.purchase_code,
    vendor_id = excluded.vendor_id,
    vendor_code = excluded.vendor_code,
    total_amount = excluded.total_amount,
    status = excluded.status,
    created_by = excluded.created_by,
    submitted_at = excluded.submitted_at,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    declined_by = excluded.declined_by,
    declined_at = excluded.declined_at,
    decline_note = excluded.decline_note,
    received_warehouse_id = excluded.received_warehouse_id,
    updated_at = excluded.updated_at
  where public.purchases.business_id = employee_record.business_id;

  if can_replace_items then
    delete from public.purchase_items
    where purchase_id = requested_purchase_id;

    for item in select * from jsonb_array_elements(coalesce(purchase_payload->'items', '[]'::jsonb))
    loop
      insert into public.purchase_items (
        purchase_id,
        product_id,
        product_name,
        quantity,
        unit_cost,
        total_cost,
        vendor_code
      )
      values (
        requested_purchase_id,
        item->>'productId',
        item->>'productName',
        (item->>'quantity')::numeric,
        (item->>'unitCost')::numeric,
        (item->>'totalCost')::numeric,
        item->>'vendorCode'
      );
    end loop;
  end if;

  return true;
end;
$$;

revoke all on function public.sync_employee_purchase(text, text, jsonb) from public;
grant execute on function public.sync_employee_purchase(text, text, jsonb) to anon, authenticated;
