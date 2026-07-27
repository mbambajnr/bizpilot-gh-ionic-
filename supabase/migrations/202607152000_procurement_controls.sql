alter table public.purchases
add column if not exists receipts jsonb not null default '[]'::jsonb,
add column if not exists supplier_invoice_number text,
add column if not exists supplier_invoice_amount numeric(12, 2),
add column if not exists supplier_invoice_date date,
add column if not exists supplier_invoice_recorded_by text,
add column if not exists supplier_invoice_recorded_at timestamptz,
add column if not exists three_way_match_status text not null default 'pending',
add column if not exists three_way_match_variance numeric(12, 2);

alter table public.purchases
drop constraint if exists purchases_status_check;

alter table public.purchases
add constraint purchases_status_check
check (status in ('draft', 'submitted', 'adminReviewed', 'approved', 'partiallyReceived', 'receivedToWarehouse', 'declined', 'cancelled'));

alter table public.purchases
drop constraint if exists purchases_three_way_match_status_check;

alter table public.purchases
add constraint purchases_three_way_match_status_check
check (three_way_match_status in ('pending', 'matched', 'variance'));

alter table public.purchases
drop constraint if exists purchases_receipts_array_check;

alter table public.purchases
add constraint purchases_receipts_array_check
check (jsonb_typeof(receipts) = 'array');

create unique index if not exists purchases_supplier_invoice_unique_idx
on public.purchases (business_id, vendor_id, lower(supplier_invoice_number))
where supplier_invoice_number is not null;

create or replace function public.sync_employee_procurement_control(
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
  requested_status text := nullif(trim(coalesce(purchase_payload->>'status', '')), '');
  requested_receipts jsonb := coalesce(purchase_payload->'receipts', '[]'::jsonb);
  requested_invoice_number text := nullif(trim(coalesce(purchase_payload->>'supplierInvoiceNumber', '')), '');
  requested_invoice_amount numeric := nullif(purchase_payload->>'supplierInvoiceAmount', '')::numeric;
  requested_invoice_date date := nullif(purchase_payload->>'supplierInvoiceDate', '')::date;
  requested_match_status text := coalesce(nullif(trim(coalesce(purchase_payload->>'threeWayMatchStatus', '')), ''), 'pending');
  requested_match_variance numeric := nullif(purchase_payload->>'threeWayMatchVariance', '')::numeric;
  requested_updated_at timestamptz := coalesce(nullif(purchase_payload->>'updatedAt', '')::timestamptz, now());
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

  if existing_purchase.id is null then
    raise exception 'Purchase not found';
  end if;

  if employee_record.role = 'WarehouseManager' then
    if requested_status not in ('partiallyReceived', 'receivedToWarehouse') then
      raise exception 'Warehouse managers can only record partial or final purchase receipts';
    end if;
    if existing_purchase.status not in ('approved', 'partiallyReceived', 'receivedToWarehouse') then
      raise exception 'Only approved purchases can be received into warehouse';
    end if;
    if jsonb_typeof(requested_receipts) <> 'array' or jsonb_array_length(requested_receipts) < jsonb_array_length(existing_purchase.receipts) then
      raise exception 'Purchase receipt history is invalid';
    end if;

    update public.purchases
    set
      status = requested_status,
      received_warehouse_id = coalesce(nullif(purchase_payload->>'receivedWarehouseId', '')::uuid, received_warehouse_id),
      receipts = requested_receipts,
      three_way_match_status = requested_match_status,
      three_way_match_variance = requested_match_variance,
      updated_at = requested_updated_at
    where id = existing_purchase.id
      and business_id = employee_record.business_id;
  elsif employee_record.role in ('Accountant', 'GeneralManager') then
    if existing_purchase.status not in ('approved', 'partiallyReceived', 'receivedToWarehouse') then
      raise exception 'Supplier invoices require an approved purchase';
    end if;
    if requested_invoice_number is null or requested_invoice_amount is null or requested_invoice_amount <= 0 or requested_invoice_date is null then
      raise exception 'A valid supplier invoice number, amount, and date are required';
    end if;

    update public.purchases
    set
      supplier_invoice_number = requested_invoice_number,
      supplier_invoice_amount = requested_invoice_amount,
      supplier_invoice_date = requested_invoice_date,
      supplier_invoice_recorded_by = employee_record.id,
      supplier_invoice_recorded_at = coalesce(nullif(purchase_payload->>'supplierInvoiceRecordedAt', '')::timestamptz, now()),
      three_way_match_status = requested_match_status,
      three_way_match_variance = requested_match_variance,
      updated_at = requested_updated_at
    where id = existing_purchase.id
      and business_id = employee_record.business_id;
  else
    raise exception 'This employee role cannot update procurement controls';
  end if;

  return true;
end;
$$;

revoke all on function public.sync_employee_procurement_control(text, text, jsonb) from public;
grant execute on function public.sync_employee_procurement_control(text, text, jsonb) to anon, authenticated;
