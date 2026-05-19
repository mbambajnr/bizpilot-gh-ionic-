create table if not exists public.business_audit_events (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  activity_number text not null,
  entity_type text not null,
  entity_id text not null,
  action_type text not null,
  title text not null,
  detail text not null,
  status text not null default 'info' check (status in ('info', 'success', 'warning')),
  reference_number text,
  related_entity_id text,
  related_sale_id text,
  actor_user_id text,
  actor_role text,
  created_at timestamptz not null default now(),
  unique (business_id, activity_number)
);

create index if not exists business_audit_events_business_id_idx
  on public.business_audit_events(business_id);

create index if not exists business_audit_events_entity_idx
  on public.business_audit_events(business_id, entity_type, entity_id);

create index if not exists business_audit_events_created_at_idx
  on public.business_audit_events(business_id, created_at desc);

create table if not exists public.app_notifications (
  id text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  message text not null,
  recipient_user_ids text[] not null default '{}',
  recipient_roles text[] not null default '{}',
  entity_type text not null,
  entity_id text not null,
  reference_number text,
  action_url text,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_business_id_idx
  on public.app_notifications(business_id);

create index if not exists app_notifications_entity_idx
  on public.app_notifications(business_id, entity_type, entity_id);

create index if not exists app_notifications_created_at_idx
  on public.app_notifications(business_id, created_at desc);

create index if not exists app_notifications_recipient_user_ids_idx
  on public.app_notifications using gin(recipient_user_ids);

create index if not exists app_notifications_recipient_roles_idx
  on public.app_notifications using gin(recipient_roles);

create table if not exists public.app_notification_reads (
  notification_id text not null references public.app_notifications(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id text not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists app_notification_reads_business_id_idx
  on public.app_notification_reads(business_id);

alter table public.business_audit_events enable row level security;
alter table public.app_notifications enable row level security;
alter table public.app_notification_reads enable row level security;

drop policy if exists "Owners can manage audit events" on public.business_audit_events;
create policy "Owners can manage audit events"
  on public.business_audit_events
  for all
  using (public.user_owns_business(business_id))
  with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage app notifications" on public.app_notifications;
create policy "Owners can manage app notifications"
  on public.app_notifications
  for all
  using (public.user_owns_business(business_id))
  with check (public.user_owns_business(business_id));

drop policy if exists "Owners can manage notification reads" on public.app_notification_reads;
create policy "Owners can manage notification reads"
  on public.app_notification_reads
  for all
  using (public.user_owns_business(business_id))
  with check (public.user_owns_business(business_id));
