-- Allow a quotation request to begin before the client has completed customer onboarding.
-- The prospect snapshot remains on the quotation after registration for audit history.

alter table public.quotations
  alter column customer_id drop not null,
  add column if not exists prospect_details jsonb,
  add column if not exists prospect_converted_at timestamptz;

alter table public.quotations
  drop constraint if exists quotations_customer_type_check;

alter table public.quotations
  add constraint quotations_customer_type_check
  check (customer_type is null or customer_type in ('registered', 'walkIn', 'prospect'));

alter table public.quotations
  drop constraint if exists quotations_customer_or_prospect_check;

alter table public.quotations
  add constraint quotations_customer_or_prospect_check
  check (
    customer_id is not null
    or (
      prospect_details is not null
      and nullif(btrim(prospect_details ->> 'name'), '') is not null
      and (
        nullif(btrim(prospect_details ->> 'phone'), '') is not null
        or nullif(btrim(prospect_details ->> 'email'), '') is not null
      )
    )
  );

create index if not exists quotations_business_prospect_idx
on public.quotations (business_id, created_at desc)
where customer_id is null;

comment on column public.quotations.prospect_details is
  'Immutable-at-creation contact snapshot for an unregistered quotation client; retained after customer conversion.';

comment on column public.quotations.prospect_converted_at is
  'Timestamp when the quotation prospect was linked to a registered customer.';
