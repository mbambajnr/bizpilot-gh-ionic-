-- Let authenticated employee sessions sync quotation drafts and conversion updates
-- without granting direct table writes through row-level security.

alter table public.quotations
  add column if not exists client_purchase_orders jsonb not null default '[]'::jsonb;

create or replace function public.sync_employee_quotation(
  credential_identifier text,
  credential_password text,
  quotation_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_record public.employee_credentials%rowtype;
  requested_id uuid := nullif(quotation_payload->>'id', '')::uuid;
  requested_status text := lower(trim(coalesce(quotation_payload->>'status', 'draft')));
  item jsonb;
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

  if employee_record.role not in ('GeneralManager', 'SalesManager', 'StoreManager') then
    raise exception 'This role cannot sync quotations';
  end if;

  if requested_id is null then
    raise exception 'Quotation id is required';
  end if;

  if requested_status not in ('draft', 'open', 'approved', 'converted', 'rejected', 'expired', 'cancelled') then
    raise exception 'Unsupported quotation status';
  end if;

  insert into public.quotations (
    id,
    business_id,
    quotation_number,
    customer_id,
    prospect_details,
    prospect_converted_at,
    total_amount,
    subtotal_amount,
    tax_amount,
    tax_snapshot,
    withholding_tax_amount,
    net_receivable_amount,
    withholding_tax_snapshot,
    status,
    valid_until,
    rejection_reason,
    converted_at,
    converted_invoice_id,
    customer_type,
    customer_type_snapshot,
    client_purchase_orders,
    created_at
  )
  values (
    requested_id,
    employee_record.business_id,
    trim(coalesce(quotation_payload->>'quotationNumber', '')),
    nullif(quotation_payload->>'customerId', '')::uuid,
    quotation_payload->'prospect',
    nullif(quotation_payload->>'prospectConvertedAt', '')::timestamptz,
    coalesce(nullif(quotation_payload->>'totalAmount', '')::numeric, 0),
    nullif(quotation_payload->>'subtotalAmount', '')::numeric,
    nullif(quotation_payload->>'taxAmount', '')::numeric,
    quotation_payload->'taxSnapshot',
    nullif(quotation_payload->>'withholdingTaxAmount', '')::numeric,
    nullif(quotation_payload->>'netReceivableAmount', '')::numeric,
    quotation_payload->'withholdingTaxSnapshot',
    requested_status,
    nullif(quotation_payload->>'validUntil', '')::timestamptz,
    nullif(quotation_payload->>'rejectionReason', ''),
    nullif(quotation_payload->>'convertedAt', '')::timestamptz,
    nullif(quotation_payload->>'convertedInvoiceId', ''),
    nullif(quotation_payload->>'customerType', ''),
    nullif(quotation_payload->>'customerTypeSnapshot', ''),
    coalesce(quotation_payload->'clientPurchaseOrders', '[]'::jsonb),
    coalesce(nullif(quotation_payload->>'createdAt', '')::timestamptz, now())
  )
  on conflict (id) do update set
    customer_id = excluded.customer_id,
    prospect_details = excluded.prospect_details,
    prospect_converted_at = excluded.prospect_converted_at,
    total_amount = excluded.total_amount,
    subtotal_amount = excluded.subtotal_amount,
    tax_amount = excluded.tax_amount,
    tax_snapshot = excluded.tax_snapshot,
    withholding_tax_amount = excluded.withholding_tax_amount,
    net_receivable_amount = excluded.net_receivable_amount,
    withholding_tax_snapshot = excluded.withholding_tax_snapshot,
    status = excluded.status,
    valid_until = excluded.valid_until,
    rejection_reason = excluded.rejection_reason,
    converted_at = excluded.converted_at,
    converted_invoice_id = excluded.converted_invoice_id,
    customer_type = excluded.customer_type,
    customer_type_snapshot = excluded.customer_type_snapshot,
    client_purchase_orders = excluded.client_purchase_orders
  where public.quotations.business_id = employee_record.business_id;

  delete from public.quotation_items
  where quotation_id = requested_id
    and exists (
      select 1
      from public.quotations q
      where q.id = requested_id
        and q.business_id = employee_record.business_id
    );

  for item in select * from jsonb_array_elements(coalesce(quotation_payload->'items', '[]'::jsonb))
  loop
    insert into public.quotation_items (
      quotation_id,
      product_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      requested_id,
      (item->>'productId')::uuid,
      coalesce(nullif(item->>'quantity', '')::integer, 1),
      coalesce(nullif(item->>'unitPrice', '')::numeric, 0),
      coalesce(nullif(item->>'total', '')::numeric, 0)
    );
  end loop;

  return true;
end;
$$;

revoke all on function public.sync_employee_quotation(text, text, jsonb) from public;
grant execute on function public.sync_employee_quotation(text, text, jsonb) to anon, authenticated;
