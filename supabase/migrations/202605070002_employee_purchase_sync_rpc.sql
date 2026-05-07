-- Let custom employee sessions persist purchase drafts without owner Supabase Auth.

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
  item jsonb;
begin
  select *
  into employee_record
  from public.employee_credentials
  where
    account_status = 'active'
    and temporary_password = credential_password
    and (
      lower(email) = lower(trim(credential_identifier))
      or lower(username) = lower(trim(credential_identifier))
    )
  limit 1;

  if employee_record.id is null then
    raise exception 'Invalid employee credentials';
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
    purchase_payload->>'id',
    employee_record.business_id,
    purchase_payload->>'purchaseCode',
    purchase_payload->>'vendorId',
    purchase_payload->>'vendorCode',
    coalesce((purchase_payload->>'totalAmount')::numeric, 0),
    coalesce(purchase_payload->>'status', 'draft'),
    coalesce(purchase_payload->>'createdBy', employee_record.id),
    nullif(purchase_payload->>'submittedAt', '')::timestamptz,
    nullif(purchase_payload->>'approvedBy', ''),
    nullif(purchase_payload->>'approvedAt', '')::timestamptz,
    nullif(purchase_payload->>'declinedBy', ''),
    nullif(purchase_payload->>'declinedAt', '')::timestamptz,
    nullif(purchase_payload->>'declineNote', ''),
    nullif(purchase_payload->>'receivedWarehouseId', '')::uuid,
    coalesce(nullif(purchase_payload->>'createdAt', '')::timestamptz, now()),
    coalesce(nullif(purchase_payload->>'updatedAt', '')::timestamptz, now())
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

  delete from public.purchase_items
  where purchase_id = purchase_payload->>'id';

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
      purchase_payload->>'id',
      item->>'productId',
      item->>'productName',
      (item->>'quantity')::numeric,
      (item->>'unitCost')::numeric,
      (item->>'totalCost')::numeric,
      item->>'vendorCode'
    );
  end loop;

  return true;
end;
$$;

revoke all on function public.sync_employee_purchase(text, text, jsonb) from public;
grant execute on function public.sync_employee_purchase(text, text, jsonb) to anon, authenticated;
