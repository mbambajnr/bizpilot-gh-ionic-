alter table public.businesses
  add column if not exists tax_components jsonb not null default
    '[
      {"key":"vat","label":"VAT","rate":12.5,"enabled":true},
      {"key":"nhil","label":"NHIL","rate":2.5,"enabled":true},
      {"key":"getfund","label":"GETFund","rate":2.5,"enabled":true}
    ]'::jsonb;
