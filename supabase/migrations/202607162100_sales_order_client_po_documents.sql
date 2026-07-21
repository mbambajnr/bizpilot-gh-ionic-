alter table public.quotations
  add column if not exists client_purchase_orders jsonb not null default '[]'::jsonb;

alter table public.quotations
  drop constraint if exists quotations_client_purchase_orders_array_check;

alter table public.quotations
  add constraint quotations_client_purchase_orders_array_check
  check (jsonb_typeof(client_purchase_orders) = 'array');

alter table public.invoices
  add column if not exists client_po_number text,
  add column if not exists client_po_document jsonb;

create index if not exists quotations_business_client_purchase_orders_idx
on public.quotations using gin (client_purchase_orders);

create index if not exists invoices_business_client_po_number_idx
on public.invoices(business_id, client_po_number);

comment on column public.quotations.client_purchase_orders is
  'Client-issued purchase order documents received after quotation approval and before invoicing.';

comment on column public.invoices.client_po_number is
  'Client purchase order number carried from the approved quotation into the invoice.';
