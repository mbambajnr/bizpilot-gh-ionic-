alter table public.invoices
  add column if not exists credited_amount numeric(12, 2) not null default 0 check (credited_amount >= 0),
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.stock_movements drop constraint if exists stock_movements_movement_type_check;
alter table public.stock_movements add constraint stock_movements_movement_type_check
  check (movement_type in ('opening', 'sale', 'reversal', 'return', 'restock', 'transfer', 'purchase', 'adjustment'));
alter table public.stock_movements drop constraint if exists stock_movements_source_type_check;
alter table public.stock_movements add constraint stock_movements_source_type_check
  check (source_type is null or source_type in ('purchase', 'transfer', 'sale', 'credit_note', 'adjustment'));

alter table public.customer_ledger_entries drop constraint if exists customer_ledger_entries_entry_type_check;
alter table public.customer_ledger_entries add constraint customer_ledger_entries_entry_type_check
  check (entry_type in ('opening_balance', 'invoice_charge', 'payment_received', 'credit_note', 'refund', 'reversal'));

create table if not exists public.credit_notes (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  credit_note_number text not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  subtotal_amount numeric(12, 2) not null check (subtotal_amount >= 0),
  tax_amount numeric(12, 2) not null check (tax_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  receivable_credit_amount numeric(12, 2) not null check (receivable_credit_amount > 0),
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'issued' check (status = 'issued'),
  issued_by text not null,
  approved_by text not null,
  created_at timestamptz not null default now(),
  unique (business_id, credit_note_number)
);

create table if not exists public.credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  inventory_id text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal_amount numeric(12, 2) not null check (subtotal_amount >= 0),
  credit_amount numeric(12, 2) not null check (credit_amount >= 0),
  disposition text not null check (disposition in ('restock', 'damaged', 'quarantine', 'writeOff')),
  location_id uuid references public.business_locations(id) on delete set null
);

create table if not exists public.customer_refunds (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  refund_number text not null,
  credit_note_id uuid not null references public.credit_notes(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'bank', 'mobileMoney', 'creditCard')),
  reference text,
  status text not null default 'completed' check (status = 'completed'),
  processed_by text not null,
  approved_by text not null,
  created_at timestamptz not null default now(),
  unique (business_id, refund_number)
);

create index if not exists credit_notes_invoice_id_idx on public.credit_notes(invoice_id);
create index if not exists credit_notes_customer_id_idx on public.credit_notes(customer_id);
create index if not exists credit_note_items_credit_note_id_idx on public.credit_note_items(credit_note_id);
create index if not exists customer_refunds_invoice_id_idx on public.customer_refunds(invoice_id);

alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;
alter table public.customer_refunds enable row level security;

create policy "Owners can manage credit notes" on public.credit_notes for all
  using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));
create policy "Owners can manage credit note items" on public.credit_note_items for all
  using (exists (select 1 from public.credit_notes n where n.id = credit_note_id and public.user_owns_business(n.business_id)))
  with check (exists (select 1 from public.credit_notes n where n.id = credit_note_id and public.user_owns_business(n.business_id)));
create policy "Owners can manage customer refunds" on public.customer_refunds for all
  using (public.user_owns_business(business_id)) with check (public.user_owns_business(business_id));

create or replace function public.record_sales_return_command(
  credential_identifier text,
  credential_password text,
  workflow_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  employee_record public.employee_credentials%rowtype;
  invoice_record public.invoices%rowtype;
  item_payload jsonb;
  movement_payload jsonb;
  requested_business_id uuid;
  requested_invoice_id uuid;
  requested_credit_note_id uuid;
  requested_refund_id uuid;
  product_id_value uuid;
  requested_quantity numeric;
  sold_quantity numeric;
  sold_line_value numeric;
  returned_quantity numeric;
  invoice_line_basis numeric;
  returned_line_basis numeric := 0;
  expected_credit numeric;
  requested_credit numeric;
  previous_refunds numeric;
  remaining_receivable numeric;
  maximum_refund numeric;
  requested_refund numeric := 0;
  movement_quantity numeric;
  movement_location uuid;
  server_quantity_after numeric;
  restock_item_count integer;
  movement_count integer;
  ledger_count integer;
  returned_product_ids uuid[] := '{}';
  moved_product_ids uuid[] := '{}';
  actor_id text;
  actor_role text;
begin
  begin
    requested_business_id := (workflow_payload->>'businessId')::uuid;
    requested_invoice_id := (workflow_payload->>'saleId')::uuid;
    requested_credit_note_id := (workflow_payload->'creditNote'->>'id')::uuid;
    if workflow_payload->'refund' is not null then requested_refund_id := (workflow_payload->'refund'->>'id')::uuid; end if;
  exception when invalid_text_representation then raise exception 'Return command ids must be valid UUIDs'; end;
  if requested_business_id is null or requested_invoice_id is null or requested_credit_note_id is null then raise exception 'Business, invoice, and credit note ids are required'; end if;

  if auth.uid() is not null and exists (select 1 from public.businesses where id = requested_business_id and owner_id = auth.uid()) then
    actor_id := auth.uid()::text; actor_role := 'Owner';
  else
    select * into employee_record from public.employee_credentials
    where account_status = 'active' and business_id = requested_business_id and password_hash is not null
      and password_hash = extensions.crypt(trim(credential_password), password_hash)
      and (lower(email) = lower(trim(credential_identifier)) or lower(username) = lower(trim(credential_identifier))) limit 1;
    if employee_record.id is null then raise exception 'Invalid employee credentials'; end if;
    if 'sales.reverse' = any(coalesce(employee_record.revoked_permissions, '{}')) then raise exception 'Returns have been revoked for this employee'; end if;
    if employee_record.role <> 'GeneralManager' and not ('sales.reverse' = any(coalesce(employee_record.granted_permissions, '{}'))) then
      raise exception 'This employee is not authorized to issue credit notes';
    end if;
    actor_id := employee_record.id::text; actor_role := employee_record.role;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requested_business_id::text, 0));
  select * into invoice_record from public.invoices where id = requested_invoice_id and business_id = requested_business_id for update;
  if invoice_record.id is null then raise exception 'Invoice not found for this business'; end if;
  if lower(invoice_record.status) = 'reversed' then raise exception 'Returns cannot be posted against a reversed invoice'; end if;
  if exists (select 1 from public.credit_notes where id = requested_credit_note_id and business_id = requested_business_id) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  if jsonb_array_length(coalesce(workflow_payload->'creditNote'->'items', '[]'::jsonb)) = 0 then raise exception 'At least one returned item is required'; end if;

  select coalesce(sum((line->>'total')::numeric), 0) into invoice_line_basis from jsonb_array_elements(invoice_record.items) line;
  if invoice_line_basis <= 0 then raise exception 'Invoice line data is not available for returns'; end if;
  for item_payload in select * from jsonb_array_elements(workflow_payload->'creditNote'->'items') loop
    product_id_value := (item_payload->>'productId')::uuid;
    if product_id_value = any(returned_product_ids) then raise exception 'Each returned product can only appear once'; end if;
    returned_product_ids := array_append(returned_product_ids, product_id_value);
    requested_quantity := (item_payload->>'quantity')::numeric;
    if requested_quantity <= 0 or (item_payload->>'disposition') not in ('restock', 'damaged', 'quarantine', 'writeOff') then raise exception 'Invalid return item'; end if;
    select coalesce(sum((line->>'quantity')::numeric), 0), coalesce(sum((line->>'unitPrice')::numeric * requested_quantity), 0)
      into sold_quantity, sold_line_value
      from jsonb_array_elements(invoice_record.items) line where line->>'productId' = product_id_value::text;
    select coalesce(sum(i.quantity), 0) into returned_quantity from public.credit_note_items i join public.credit_notes n on n.id = i.credit_note_id
      where n.invoice_id = requested_invoice_id and i.product_id = product_id_value;
    if requested_quantity > sold_quantity - returned_quantity then raise exception 'Return quantity exceeds the remaining sold quantity'; end if;
    returned_line_basis := returned_line_basis + sold_line_value;
  end loop;

  requested_credit := (workflow_payload->'creditNote'->>'receivableCreditAmount')::numeric;
  expected_credit := round(coalesce(invoice_record.net_receivable_amount, invoice_record.total_amount) * returned_line_basis / invoice_line_basis, 2);
  if abs(requested_credit - expected_credit) > 0.02 then raise exception 'Credit amount does not match the returned invoice value'; end if;
  if invoice_record.credited_amount + expected_credit > coalesce(invoice_record.net_receivable_amount, invoice_record.total_amount) + 0.02 then raise exception 'Credit exceeds the invoice receivable'; end if;

  remaining_receivable := greatest(0, coalesce(invoice_record.net_receivable_amount, invoice_record.total_amount) - invoice_record.credited_amount - expected_credit);
  select coalesce(sum(amount), 0) into previous_refunds from public.customer_refunds where invoice_id = requested_invoice_id;
  maximum_refund := least(expected_credit, greatest(0, invoice_record.paid_amount - remaining_receivable - previous_refunds));
  if workflow_payload->'refund' is not null then
    requested_refund := (workflow_payload->'refund'->>'amount')::numeric;
    if requested_refund <= 0 or requested_refund > maximum_refund + 0.02 then raise exception 'Refund exceeds the refundable customer payment'; end if;
  end if;
  ledger_count := jsonb_array_length(coalesce(workflow_payload->'ledgerEntries', '[]'::jsonb));
  if ledger_count <> (case when requested_refund > 0 then 2 else 1 end) then raise exception 'Return ledger evidence is incomplete'; end if;

  insert into public.credit_notes (id, business_id, credit_note_number, invoice_id, invoice_number, customer_id, subtotal_amount, tax_amount, total_amount, receivable_credit_amount, reason, issued_by, approved_by, created_at)
  values (requested_credit_note_id, requested_business_id, workflow_payload->'creditNote'->>'creditNoteNumber', requested_invoice_id, invoice_record.invoice_number, invoice_record.customer_id,
    (workflow_payload->'creditNote'->>'subtotalAmount')::numeric, (workflow_payload->'creditNote'->>'taxAmount')::numeric, (workflow_payload->'creditNote'->>'totalAmount')::numeric,
    expected_credit, trim(workflow_payload->'creditNote'->>'reason'), actor_id, actor_id, (workflow_payload->'creditNote'->>'createdAt')::timestamptz);
  insert into public.credit_note_items (credit_note_id, product_id, product_name, inventory_id, quantity, unit_price, subtotal_amount, credit_amount, disposition, location_id)
  select requested_credit_note_id, (item->>'productId')::uuid, item->>'productName', item->>'inventoryId', (item->>'quantity')::numeric,
    (item->>'unitPrice')::numeric, (item->>'subtotalAmount')::numeric, (item->>'creditAmount')::numeric, item->>'disposition', nullif(item->>'locationId', '')::uuid
  from jsonb_array_elements(workflow_payload->'creditNote'->'items') item;
  update public.invoices set credited_amount = round(credited_amount + expected_credit, 2), updated_at = (workflow_payload->'creditNote'->>'createdAt')::timestamptz where id = requested_invoice_id;

  if workflow_payload->'refund' is not null then
    insert into public.customer_refunds (id, business_id, refund_number, credit_note_id, invoice_id, customer_id, amount, method, reference, processed_by, approved_by, created_at)
    values (requested_refund_id, requested_business_id, workflow_payload->'refund'->>'refundNumber', requested_credit_note_id, requested_invoice_id, invoice_record.customer_id,
      requested_refund, workflow_payload->'refund'->>'method', nullif(trim(workflow_payload->'refund'->>'reference'), ''), actor_id, actor_id, (workflow_payload->'refund'->>'createdAt')::timestamptz);
  end if;

  select count(*) into restock_item_count from public.credit_note_items where credit_note_id = requested_credit_note_id and disposition = 'restock';
  movement_count := jsonb_array_length(coalesce(workflow_payload->'stockMovements', '[]'::jsonb));
  if movement_count <> restock_item_count then raise exception 'Every restocked item requires one stock movement'; end if;
  for movement_payload in select * from jsonb_array_elements(coalesce(workflow_payload->'stockMovements', '[]'::jsonb)) loop
    product_id_value := (movement_payload->>'productId')::uuid;
    if product_id_value = any(moved_product_ids) then raise exception 'Each restocked product can only have one stock movement'; end if;
    moved_product_ids := array_append(moved_product_ids, product_id_value);
    movement_location := (movement_payload->>'locationId')::uuid;
    select quantity into movement_quantity from public.credit_note_items
      where credit_note_id = requested_credit_note_id and product_id = product_id_value and disposition = 'restock' and location_id = movement_location;
    if movement_quantity is null then raise exception 'Stock movement does not match a saleable returned item'; end if;
    select coalesce(sum(quantity_delta), 0) + movement_quantity into server_quantity_after from public.stock_movements
      where business_id = requested_business_id and product_id = product_id_value and location_id = movement_location;
    insert into public.stock_movements (business_id, movement_number, product_id, location_id, movement_type, quantity_delta, quantity_after, invoice_id, reference_number, source_type, source_id, to_store_id, performed_by, note, created_at)
    values (requested_business_id, movement_payload->>'movementNumber', product_id_value, movement_location, 'return',
      movement_quantity, server_quantity_after, requested_invoice_id, workflow_payload->'creditNote'->>'creditNoteNumber',
      'credit_note', requested_credit_note_id::text, movement_location, actor_id, movement_payload->>'note', (workflow_payload->'creditNote'->>'createdAt')::timestamptz);
  end loop;

  insert into public.customer_ledger_entries (business_id, entry_number, customer_id, entry_type, amount_delta, invoice_id, reference_number, payment_method, note, created_at)
  values (requested_business_id, workflow_payload->'ledgerEntries'->0->>'entryNumber', invoice_record.customer_id, 'credit_note', -expected_credit, requested_invoice_id,
    workflow_payload->'creditNote'->>'creditNoteNumber', null, 'Credit note issued for ' || invoice_record.invoice_number, (workflow_payload->'creditNote'->>'createdAt')::timestamptz);
  if requested_refund > 0 then
    insert into public.customer_ledger_entries (business_id, entry_number, customer_id, entry_type, amount_delta, invoice_id, reference_number, payment_method, note, created_at)
    values (requested_business_id, workflow_payload->'ledgerEntries'->1->>'entryNumber', invoice_record.customer_id, 'refund', requested_refund, requested_invoice_id,
      workflow_payload->'refund'->>'refundNumber', case workflow_payload->'refund'->>'method' when 'mobileMoney' then 'mobile_money' when 'cash' then 'cash' else null end,
      'Refund paid for ' || (workflow_payload->'creditNote'->>'creditNoteNumber'), (workflow_payload->'creditNote'->>'createdAt')::timestamptz);
  end if;
  insert into public.business_audit_events (id, business_id, activity_number, entity_type, entity_id, action_type, title, detail, status, reference_number, related_sale_id, actor_user_id, actor_role, created_at)
  select activity->>'id', requested_business_id, activity->>'activityNumber', activity->>'entityType', activity->>'entityId', activity->>'actionType', activity->>'title', activity->>'detail',
    activity->>'status', activity->>'referenceNumber', requested_invoice_id::text, actor_id, actor_role, (activity->>'createdAt')::timestamptz from jsonb_array_elements(workflow_payload->'activities') activity;
  insert into public.app_notifications (id, business_id, title, message, recipient_roles, entity_type, entity_id, reference_number, action_url, created_at)
  values (workflow_payload->'notification'->>'id', requested_business_id, workflow_payload->'notification'->>'title', workflow_payload->'notification'->>'message',
    array['SalesManager', 'GeneralManager', 'Accountant'], 'credit_note', requested_credit_note_id::text, workflow_payload->'creditNote'->>'creditNoteNumber',
    '/sales/' || requested_invoice_id::text, (workflow_payload->'creditNote'->>'createdAt')::timestamptz);
  return jsonb_build_object('ok', true, 'idempotent', false, 'creditAmount', expected_credit, 'refundAmount', requested_refund);
end;
$$;

revoke all on function public.record_sales_return_command(text, text, jsonb) from public;
grant execute on function public.record_sales_return_command(text, text, jsonb) to anon, authenticated;
