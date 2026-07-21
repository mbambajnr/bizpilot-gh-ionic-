-- Server-side workflow enforcement for employee-originated operating actions.
-- Owner sessions still use table RLS. Employee-local sessions must use this RPC,
-- which re-checks role and status transitions before writing operational records.

alter table public.expenses
add column if not exists recorded_by_user_id text;

alter table public.expenses
add column if not exists recorded_by_name text;

create table if not exists public.restock_requests (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  requested_by_user_id text not null,
  requested_by_name text not null,
  current_quantity numeric(12, 2) not null default 0,
  requested_quantity numeric(12, 2) not null check (requested_quantity > 0),
  urgency text not null check (urgency in ('Low', 'Medium', 'High')),
  note text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Fulfilled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id text,
  reviewed_by_name text,
  review_note text
);

create index if not exists restock_requests_business_id_idx
  on public.restock_requests(business_id);

create index if not exists restock_requests_product_id_idx
  on public.restock_requests(product_id);

alter table public.restock_requests enable row level security;

drop policy if exists "Owners can manage restock requests" on public.restock_requests;
create policy "Owners can manage restock requests"
  on public.restock_requests
  for all
  using (public.user_owns_business(business_id))
  with check (public.user_owns_business(business_id));

create or replace function public.sync_employee_workflow(
  credential_identifier text,
  credential_password text,
  workflow_type text,
  workflow_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_record public.employee_credentials%rowtype;
  existing_payable public.accounts_payable%rowtype;
  existing_transfer public.stock_transfers%rowtype;
  existing_restock public.restock_requests%rowtype;
  item jsonb;
  normalized_workflow text := lower(trim(coalesce(workflow_type, '')));
  requested_status text := nullif(trim(coalesce(workflow_payload->>'status', '')), '');
  requested_id text := nullif(trim(coalesce(workflow_payload->>'id', '')), '');
  payment_amount numeric := coalesce(nullif(workflow_payload->>'amount', '')::numeric, 0);
begin
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

  if requested_id is null then
    raise exception 'Workflow record id is required';
  end if;

  if normalized_workflow = 'expense' then
    if employee_record.role <> 'Accountant' then
      raise exception 'Only accountants can record expenses';
    end if;

    insert into public.expenses (
      id,
      business_id,
      category,
      amount,
      note,
      proof_url,
      recorded_by_user_id,
      recorded_by_name,
      created_at
    )
    values (
      requested_id,
      employee_record.business_id,
      trim(coalesce(workflow_payload->>'category', '')),
      coalesce(nullif(workflow_payload->>'amount', '')::numeric, 0),
      coalesce(workflow_payload->>'note', ''),
      '',
      employee_record.id,
      employee_record.name,
      coalesce(nullif(workflow_payload->>'createdAt', '')::timestamptz, now())
    )
    on conflict (id) do update set
      category = excluded.category,
      amount = excluded.amount,
      note = excluded.note,
      recorded_by_user_id = excluded.recorded_by_user_id,
      recorded_by_name = excluded.recorded_by_name
    where public.expenses.business_id = employee_record.business_id;

    return true;
  elsif normalized_workflow = 'payable' then
    select *
    into existing_payable
    from public.accounts_payable
    where id = requested_id
      and business_id = employee_record.business_id
    limit 1;

    if requested_status = 'pendingReview' then
      if employee_record.role not in ('Accountant', 'GeneralManager') then
        raise exception 'Only accounting roles can create payables';
      end if;
    elsif requested_status = 'approved' then
      if employee_record.role <> 'GeneralManager' then
        raise exception 'Only general managers can approve payables';
      end if;

      if existing_payable.id is not null and existing_payable.status <> 'pendingReview' and existing_payable.status <> 'approved' then
        raise exception 'Only pending payables can be approved';
      end if;
    elsif requested_status in ('partiallyPaid', 'paid', 'overdue') then
      if employee_record.role <> 'Accountant' then
        raise exception 'Only accountants can record payable payments';
      end if;

      if existing_payable.id is null or existing_payable.status not in ('approved', 'partiallyPaid', 'overdue', 'paid') then
        raise exception 'Approve the payable before recording payment';
      end if;
    else
      raise exception 'Unsupported payable status';
    end if;

    insert into public.accounts_payable (
      id,
      business_id,
      payable_code,
      vendor_id,
      vendor_code,
      purchase_id,
      amount_due,
      amount_paid,
      balance,
      due_date,
      status,
      payment_method,
      payment_reference,
      created_by,
      approved_by,
      paid_by,
      created_at,
      updated_at,
      paid_at
    )
    values (
      requested_id,
      employee_record.business_id,
      trim(coalesce(workflow_payload->>'payableCode', '')),
      trim(coalesce(workflow_payload->>'vendorId', '')),
      trim(coalesce(workflow_payload->>'vendorCode', '')),
      trim(coalesce(workflow_payload->>'purchaseId', '')),
      coalesce(nullif(workflow_payload->>'amountDue', '')::numeric, 0),
      coalesce(nullif(workflow_payload->>'amountPaid', '')::numeric, 0),
      coalesce(nullif(workflow_payload->>'balance', '')::numeric, 0),
      nullif(workflow_payload->>'dueDate', '')::timestamptz,
      requested_status,
      nullif(workflow_payload->>'paymentMethod', ''),
      nullif(workflow_payload->>'paymentReference', ''),
      coalesce(nullif(workflow_payload->>'createdBy', ''), employee_record.id),
      case when requested_status = 'approved' then employee_record.id else nullif(workflow_payload->>'approvedBy', '') end,
      case when requested_status in ('partiallyPaid', 'paid', 'overdue') then employee_record.id else nullif(workflow_payload->>'paidBy', '') end,
      coalesce(nullif(workflow_payload->>'createdAt', '')::timestamptz, now()),
      coalesce(nullif(workflow_payload->>'updatedAt', '')::timestamptz, now()),
      nullif(workflow_payload->>'paidAt', '')::timestamptz
    )
    on conflict (id) do update set
      amount_paid = excluded.amount_paid,
      balance = excluded.balance,
      due_date = excluded.due_date,
      status = excluded.status,
      payment_method = excluded.payment_method,
      payment_reference = excluded.payment_reference,
      approved_by = coalesce(excluded.approved_by, public.accounts_payable.approved_by),
      paid_by = coalesce(excluded.paid_by, public.accounts_payable.paid_by),
      updated_at = excluded.updated_at,
      paid_at = coalesce(excluded.paid_at, public.accounts_payable.paid_at)
    where public.accounts_payable.business_id = employee_record.business_id;

    return true;
  elsif normalized_workflow = 'payment' then
    if employee_record.role not in ('Accountant', 'StoreManager', 'SalesManager') then
      raise exception 'This role cannot record payments';
    end if;

    if payment_amount <= 0 then
      raise exception 'Payment amount must be greater than zero';
    end if;

    if workflow_payload->>'sourceType' = 'payable' and employee_record.role <> 'Accountant' then
      raise exception 'Only accountants can record supplier payments';
    end if;

    insert into public.payments (
      id,
      business_id,
      payment_code,
      source_type,
      source_id,
      amount,
      method,
      reference,
      recorded_by,
      created_at
    )
    values (
      requested_id,
      employee_record.business_id,
      trim(coalesce(workflow_payload->>'paymentCode', '')),
      trim(coalesce(workflow_payload->>'sourceType', '')),
      trim(coalesce(workflow_payload->>'sourceId', '')),
      payment_amount,
      trim(coalesce(workflow_payload->>'method', '')),
      nullif(workflow_payload->>'reference', ''),
      employee_record.id,
      coalesce(nullif(workflow_payload->>'createdAt', '')::timestamptz, now())
    )
    on conflict (id) do nothing;

    return true;
  elsif normalized_workflow = 'stock_transfer' then
    select *
    into existing_transfer
    from public.stock_transfers
    where id = requested_id
      and business_id = employee_record.business_id
    limit 1;

    if requested_status = 'pending' then
      if employee_record.role not in ('WarehouseManager', 'StoreManager', 'SalesManager') then
        raise exception 'This role cannot create stock transfers';
      end if;
    elsif requested_status = 'approved' then
      if employee_record.role not in ('GeneralManager', 'WarehouseManager') then
        raise exception 'This role cannot approve stock transfers';
      end if;

      if existing_transfer.id is null or existing_transfer.status not in ('pending', 'approved') then
        raise exception 'Only pending transfers can be approved';
      end if;
    elsif requested_status = 'dispatched' then
      if employee_record.role <> 'WarehouseManager' then
        raise exception 'Only warehouse managers can dispatch stock transfers';
      end if;

      if existing_transfer.id is null or existing_transfer.status not in ('approved', 'dispatched') then
        raise exception 'Only approved transfers can be dispatched';
      end if;
    elsif requested_status = 'received' then
      if employee_record.role not in ('WarehouseManager', 'StoreManager') then
        raise exception 'This role cannot receive stock transfers';
      end if;

      if existing_transfer.id is null or existing_transfer.status not in ('approved', 'dispatched', 'received') then
        raise exception 'Only approved or dispatched transfers can be received';
      end if;
    elsif requested_status = 'cancelled' then
      if employee_record.role not in ('GeneralManager', 'WarehouseManager') then
        raise exception 'This role cannot cancel stock transfers';
      end if;

      if existing_transfer.id is not null and existing_transfer.status = 'received' then
        raise exception 'Received transfers cannot be cancelled';
      end if;
    else
      raise exception 'Unsupported stock transfer status';
    end if;

    insert into public.stock_transfers (
      id,
      business_id,
      transfer_code,
      from_warehouse_id,
      to_store_id,
      status,
      initiated_by,
      approved_by,
      dispatched_by,
      received_by,
      created_at,
      approved_at,
      dispatched_at,
      received_at,
      cancelled_at
    )
    values (
      requested_id,
      employee_record.business_id,
      trim(coalesce(workflow_payload->>'transferCode', '')),
      (workflow_payload->>'fromWarehouseId')::uuid,
      (workflow_payload->>'toStoreId')::uuid,
      requested_status,
      coalesce(nullif(workflow_payload->>'initiatedBy', ''), employee_record.id),
      case when requested_status = 'approved' then employee_record.id else nullif(workflow_payload->>'approvedBy', '') end,
      case when requested_status = 'dispatched' then employee_record.id else nullif(workflow_payload->>'dispatchedBy', '') end,
      case when requested_status = 'received' then employee_record.id else nullif(workflow_payload->>'receivedBy', '') end,
      coalesce(nullif(workflow_payload->>'createdAt', '')::timestamptz, now()),
      nullif(workflow_payload->>'approvedAt', '')::timestamptz,
      nullif(workflow_payload->>'dispatchedAt', '')::timestamptz,
      nullif(workflow_payload->>'receivedAt', '')::timestamptz,
      nullif(workflow_payload->>'cancelledAt', '')::timestamptz
    )
    on conflict (id) do update set
      status = excluded.status,
      approved_by = coalesce(excluded.approved_by, public.stock_transfers.approved_by),
      dispatched_by = coalesce(excluded.dispatched_by, public.stock_transfers.dispatched_by),
      received_by = coalesce(excluded.received_by, public.stock_transfers.received_by),
      approved_at = coalesce(excluded.approved_at, public.stock_transfers.approved_at),
      dispatched_at = coalesce(excluded.dispatched_at, public.stock_transfers.dispatched_at),
      received_at = coalesce(excluded.received_at, public.stock_transfers.received_at),
      cancelled_at = coalesce(excluded.cancelled_at, public.stock_transfers.cancelled_at)
    where public.stock_transfers.business_id = employee_record.business_id;

    if requested_status = 'pending' then
      delete from public.stock_transfer_items where transfer_id = requested_id;

      for item in select * from jsonb_array_elements(coalesce(workflow_payload->'items', '[]'::jsonb))
      loop
        insert into public.stock_transfer_items (
          transfer_id,
          product_id,
          product_name,
          quantity
        )
        values (
          requested_id,
          item->>'productId',
          item->>'productName',
          (item->>'quantity')::numeric
        );
      end loop;
    end if;

    return true;
  elsif normalized_workflow = 'stock_movement' then
    if employee_record.role not in ('WarehouseManager', 'StoreManager') then
      raise exception 'This role cannot write stock movements';
    end if;

    if workflow_payload->>'sourceType' = 'adjustment' and employee_record.role <> 'WarehouseManager' then
      raise exception 'Only warehouse managers can adjust inventory';
    end if;

    insert into public.stock_movements (
      id,
      business_id,
      movement_number,
      product_id,
      location_id,
      movement_type,
      quantity_delta,
      quantity_after,
      transfer_id,
      from_location_id,
      to_location_id,
      invoice_id,
      reference_number,
      source_type,
      source_id,
      vendor_id,
      vendor_code,
      from_warehouse_id,
      to_store_id,
      performed_by,
      note,
      created_at
    )
    values (
      requested_id,
      employee_record.business_id,
      trim(coalesce(workflow_payload->>'movementNumber', '')),
      trim(coalesce(workflow_payload->>'productId', '')),
      nullif(workflow_payload->>'locationId', '')::uuid,
      trim(coalesce(workflow_payload->>'type', '')),
      coalesce(nullif(workflow_payload->>'quantityDelta', '')::numeric, 0),
      coalesce(nullif(workflow_payload->>'quantityAfter', '')::numeric, 0),
      nullif(workflow_payload->>'transferId', ''),
      nullif(workflow_payload->>'fromLocationId', '')::uuid,
      nullif(workflow_payload->>'toLocationId', '')::uuid,
      nullif(workflow_payload->>'relatedSaleId', '')::uuid,
      nullif(workflow_payload->>'referenceNumber', ''),
      nullif(workflow_payload->>'sourceType', ''),
      nullif(workflow_payload->>'sourceId', ''),
      nullif(workflow_payload->>'vendorId', ''),
      nullif(workflow_payload->>'vendorCode', ''),
      nullif(workflow_payload->>'fromWarehouseId', '')::uuid,
      nullif(workflow_payload->>'toStoreId', '')::uuid,
      employee_record.id,
      coalesce(workflow_payload->>'note', ''),
      coalesce(nullif(workflow_payload->>'createdAt', '')::timestamptz, now())
    )
    on conflict (id) do nothing;

    return true;
  elsif normalized_workflow = 'restock_request' then
    select *
    into existing_restock
    from public.restock_requests
    where id = requested_id
      and business_id = employee_record.business_id
    limit 1;

    if existing_restock.id is null then
      if employee_record.role <> 'StoreManager' then
        raise exception 'Only store managers can create restock requests';
      end if;
    else
      if employee_record.role not in ('WarehouseManager', 'GeneralManager') then
        raise exception 'Only warehouse or general managers can review restock requests';
      end if;
    end if;

    insert into public.restock_requests (
      id,
      business_id,
      product_id,
      product_name,
      requested_by_user_id,
      requested_by_name,
      current_quantity,
      requested_quantity,
      urgency,
      note,
      status,
      created_at,
      reviewed_at,
      reviewed_by_user_id,
      reviewed_by_name,
      review_note
    )
    values (
      requested_id,
      employee_record.business_id,
      trim(coalesce(workflow_payload->>'productId', '')),
      trim(coalesce(workflow_payload->>'productName', '')),
      coalesce(nullif(workflow_payload->>'requestedByUserId', ''), employee_record.id),
      coalesce(nullif(workflow_payload->>'requestedByName', ''), employee_record.name),
      coalesce(nullif(workflow_payload->>'currentQuantity', '')::numeric, 0),
      coalesce(nullif(workflow_payload->>'requestedQuantity', '')::numeric, 0),
      trim(coalesce(workflow_payload->>'urgency', 'Medium')),
      nullif(workflow_payload->>'note', ''),
      coalesce(requested_status, 'Pending'),
      coalesce(nullif(workflow_payload->>'createdAt', '')::timestamptz, now()),
      nullif(workflow_payload->>'reviewedAt', '')::timestamptz,
      nullif(workflow_payload->>'reviewedByUserId', ''),
      nullif(workflow_payload->>'reviewedByName', ''),
      nullif(workflow_payload->>'reviewNote', '')
    )
    on conflict (id) do update set
      status = excluded.status,
      reviewed_at = excluded.reviewed_at,
      reviewed_by_user_id = excluded.reviewed_by_user_id,
      reviewed_by_name = excluded.reviewed_by_name,
      review_note = excluded.review_note
    where public.restock_requests.business_id = employee_record.business_id;

    return true;
  end if;

  raise exception 'Unsupported employee workflow type';
end;
$$;

revoke all on function public.sync_employee_workflow(text, text, text, jsonb) from public;
grant execute on function public.sync_employee_workflow(text, text, text, jsonb) to anon, authenticated;
