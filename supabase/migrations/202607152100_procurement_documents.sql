alter table public.purchases
add column if not exists expected_delivery_date date,
add column if not exists payment_terms text,
add column if not exists internal_notes text,
add column if not exists procurement_documents jsonb not null default '[]'::jsonb;

alter table public.purchases
drop constraint if exists purchases_procurement_documents_array_check;

alter table public.purchases
add constraint purchases_procurement_documents_array_check
check (jsonb_typeof(procurement_documents) = 'array');

create or replace function public.sync_employee_purchase_metadata(
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
  requested_purchase_id text := nullif(trim(coalesce(purchase_payload->>'id', '')), '');
  requested_documents jsonb := coalesce(purchase_payload->'documents', '[]'::jsonb);
begin
  if requested_purchase_id is null then raise exception 'Purchase id is required'; end if;

  select * into employee_record
  from public.employee_credentials
  where account_status = 'active'
    and password_hash is not null
    and password_hash = extensions.crypt(trim(credential_password), password_hash)
    and (lower(email) = lower(trim(credential_identifier)) or lower(username) = lower(trim(credential_identifier)))
  limit 1;

  if employee_record.id is null then raise exception 'Invalid employee credentials'; end if;
  if employee_record.role not in ('GeneralManager', 'Accountant', 'InventoryManager') then
    raise exception 'This employee role cannot update procurement documents';
  end if;

  select * into existing_purchase from public.purchases
  where id = requested_purchase_id and business_id = employee_record.business_id limit 1;
  if existing_purchase.id is null then raise exception 'Purchase not found'; end if;
  if jsonb_typeof(requested_documents) <> 'array' then raise exception 'Procurement documents must be an array'; end if;

  update public.purchases
  set expected_delivery_date = nullif(purchase_payload->>'expectedDeliveryDate', '')::date,
      payment_terms = nullif(trim(coalesce(purchase_payload->>'paymentTerms', '')), ''),
      internal_notes = nullif(trim(coalesce(purchase_payload->>'internalNotes', '')), ''),
      procurement_documents = requested_documents,
      updated_at = coalesce(nullif(purchase_payload->>'updatedAt', '')::timestamptz, now())
  where id = existing_purchase.id and business_id = employee_record.business_id;

  return true;
end;
$$;

revoke all on function public.sync_employee_purchase_metadata(text, text, jsonb) from public;
grant execute on function public.sync_employee_purchase_metadata(text, text, jsonb) to anon, authenticated;
