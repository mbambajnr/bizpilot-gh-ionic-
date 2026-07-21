create or replace function public.enforce_stock_transfer_separation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text;
  actor_role text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    if old.status <> 'pending' then
      raise exception 'Only pending transfers can be approved';
    end if;
    actor_id := new.approved_by;
    if actor_id is null or actor_id = new.initiated_by then
      raise exception 'The transfer initiator cannot approve the same transfer';
    end if;
    select role into actor_role from public.employee_credentials where id::text = actor_id limit 1;
    if actor_role is distinct from 'GeneralManager' then
      raise exception 'Only a General Manager can approve stock transfers';
    end if;
  elsif new.status = 'dispatched' then
    if old.status <> 'approved' then
      raise exception 'Only approved transfers can be dispatched';
    end if;
    actor_id := new.dispatched_by;
    if actor_id is null or actor_id = new.approved_by then
      raise exception 'The transfer approver cannot dispatch the same transfer';
    end if;
    select role into actor_role from public.employee_credentials where id::text = actor_id limit 1;
    if actor_role is distinct from 'WarehouseManager' then
      raise exception 'Only a Warehouse Manager can dispatch stock transfers';
    end if;
  elsif new.status = 'received' then
    if old.status <> 'dispatched' then
      raise exception 'A transfer must be dispatched before receipt';
    end if;
    actor_id := new.received_by;
    if actor_id is null or actor_id = new.dispatched_by or actor_id = new.approved_by then
      raise exception 'Destination receipt requires an independent receiving custodian';
    end if;
    select role into actor_role from public.employee_credentials where id::text = actor_id limit 1;
    if actor_role is distinct from 'StoreManager' then
      raise exception 'Only a Store Manager can confirm destination receipt';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_stock_transfer_separation_trigger on public.stock_transfers;

create trigger enforce_stock_transfer_separation_trigger
before update on public.stock_transfers
for each row
execute function public.enforce_stock_transfer_separation();
