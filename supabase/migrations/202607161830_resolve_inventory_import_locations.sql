-- Resolve locally restored location ids to their canonical cloud location before importing opening stock.

create or replace function public.import_inventory_batch(
  credential_identifier text,
  credential_password text,
  batch_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_business_id uuid;
  employee_record public.employee_credentials%rowtype;
  product_count integer;
  movement_count integer;
  location_record record;
  movement_record record;
  resolved_location_id uuid;
  matching_location_count integer;
  resolved_locations jsonb := '{}'::jsonb;
begin
  target_business_id := nullif(batch_payload ->> 'business_id', '')::uuid;
  product_count := coalesce(jsonb_array_length(batch_payload -> 'products'), 0);
  movement_count := coalesce(jsonb_array_length(batch_payload -> 'stock_movements'), 0);

  if target_business_id is null then
    raise exception 'Business id is required';
  end if;
  if product_count < 1 or product_count > 10000 then
    raise exception 'Inventory batch must contain between 1 and 10000 products';
  end if;
  if movement_count > product_count then
    raise exception 'Opening stock movement count cannot exceed product count';
  end if;

  if nullif(trim(coalesce(credential_identifier, '')), '') is not null then
    select * into employee_record
    from public.employee_credentials
    where business_id = target_business_id
      and account_status = 'active'
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
    if employee_record.role not in ('GeneralManager', 'PurchaseManager') then
      raise exception 'This employee role cannot import inventory';
    end if;
  elsif not public.user_owns_business(target_business_id) then
    raise exception 'You do not own this business';
  end if;

  for location_record in
    select *
    from jsonb_to_recordset(coalesce(batch_payload -> 'locations', '[]'::jsonb)) as location_item(
      id uuid,
      location_code text,
      name text,
      type text
    )
  loop
    resolved_location_id := null;

    select id into resolved_location_id
    from public.business_locations
    where business_id = target_business_id and id = location_record.id;

    if resolved_location_id is null and nullif(trim(coalesce(location_record.location_code, '')), '') is not null then
      select id into resolved_location_id
      from public.business_locations
      where business_id = target_business_id
        and lower(trim(location_code)) = lower(trim(location_record.location_code))
      limit 1;
    end if;

    if resolved_location_id is null and nullif(trim(coalesce(location_record.name, '')), '') is not null then
      select count(*), min(id::text)::uuid into matching_location_count, resolved_location_id
      from public.business_locations
      where business_id = target_business_id
        and lower(trim(name)) = lower(trim(location_record.name))
        and type = location_record.type;

      if matching_location_count > 1 then
        raise exception 'Opening stock location "%" is ambiguous in this workspace', location_record.name;
      end if;
    end if;

    if resolved_location_id is null then
      raise exception 'Opening stock location "%" is not registered in this workspace', coalesce(location_record.name, location_record.id::text);
    end if;

    resolved_locations := resolved_locations || jsonb_build_object(location_record.id::text, resolved_location_id::text);
  end loop;

  for movement_record in
    select *
    from jsonb_to_recordset(coalesce(batch_payload -> 'stock_movements', '[]'::jsonb)) as movement_item(
      location_id uuid,
      from_warehouse_id uuid,
      to_store_id uuid
    )
  loop
    if movement_record.location_id is not null and not (resolved_locations ? movement_record.location_id::text) then
      raise exception 'Opening stock location is missing from the import command';
    end if;
    if movement_record.from_warehouse_id is not null and not (resolved_locations ? movement_record.from_warehouse_id::text) then
      raise exception 'Source warehouse is missing from the import command';
    end if;
    if movement_record.to_store_id is not null and not (resolved_locations ? movement_record.to_store_id::text) then
      raise exception 'Destination store is missing from the import command';
    end if;
  end loop;

  insert into public.products (
    id, business_id, inventory_id, name, unit, price, cost, reorder_level, image, category_id
  )
  select
    item.id, target_business_id, trim(item.inventory_id), trim(item.name), trim(item.unit),
    item.price, item.cost, item.reorder_level, item.image, item.category_id
  from jsonb_to_recordset(batch_payload -> 'products') as item(
    id uuid,
    inventory_id text,
    name text,
    unit text,
    price numeric,
    cost numeric,
    reorder_level integer,
    image text,
    category_id uuid
  );

  insert into public.stock_movements (
    id, business_id, movement_number, product_id, movement_type, quantity_delta,
    quantity_after, reference_number, note, created_at, location_id, source_type,
    source_id, from_warehouse_id, to_store_id, performed_by
  )
  select
    item.id, target_business_id, trim(item.movement_number), item.product_id,
    item.movement_type, item.quantity_delta, item.quantity_after, item.reference_number,
    coalesce(item.note, ''), coalesce(item.created_at, now()),
    nullif(resolved_locations ->> item.location_id::text, '')::uuid,
    item.source_type, item.source_id,
    nullif(resolved_locations ->> item.from_warehouse_id::text, '')::uuid,
    nullif(resolved_locations ->> item.to_store_id::text, '')::uuid,
    item.performed_by
  from jsonb_to_recordset(coalesce(batch_payload -> 'stock_movements', '[]'::jsonb)) as item(
    id uuid,
    movement_number text,
    product_id uuid,
    movement_type text,
    quantity_delta integer,
    quantity_after integer,
    reference_number text,
    note text,
    created_at timestamptz,
    location_id uuid,
    source_type text,
    source_id text,
    from_warehouse_id uuid,
    to_store_id uuid,
    performed_by text
  );

  return jsonb_build_object('products_imported', product_count, 'movements_imported', movement_count);
end;
$$;

revoke all on function public.import_inventory_batch(text, text, jsonb) from public;
grant execute on function public.import_inventory_batch(text, text, jsonb) to anon, authenticated;
