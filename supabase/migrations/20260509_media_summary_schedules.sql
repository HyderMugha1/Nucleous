create table public.organization_summary_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('daily', 'weekly')),
  delivery_channels public.delivery_channel[] not null default array['app'::public.delivery_channel, 'email'::public.delivery_channel],
  hour_of_day integer not null default 9 check (hour_of_day between 0 and 23),
  day_of_week integer check (day_of_week between 0 and 6),
  is_active boolean not null default true,
  recipients jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.summary_dispatch_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid references public.organization_summary_schedules(id) on delete set null,
  channel public.delivery_channel not null,
  recipient text,
  subject text not null,
  body text not null,
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'delivered', 'failed', 'skipped')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index organization_summary_schedules_org_active_idx on public.organization_summary_schedules (organization_id, is_active, next_run_at);
create index summary_dispatch_logs_org_created_idx on public.summary_dispatch_logs (organization_id, created_at desc);
create index summary_dispatch_logs_schedule_idx on public.summary_dispatch_logs (schedule_id, created_at desc);

create trigger organization_summary_schedules_set_updated_at before update on public.organization_summary_schedules for each row execute function public.set_updated_at();
create trigger summary_dispatch_logs_set_updated_at before update on public.summary_dispatch_logs for each row execute function public.set_updated_at();

alter table public.organization_summary_schedules enable row level security;
alter table public.summary_dispatch_logs enable row level security;

create policy organization_summary_schedules_select on public.organization_summary_schedules
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy organization_summary_schedules_insert on public.organization_summary_schedules
for insert with check (app.is_service_role() or app.is_org_admin(organization_id));
create policy organization_summary_schedules_update on public.organization_summary_schedules
for update using (app.is_service_role() or app.is_org_admin(organization_id))
with check (app.is_service_role() or app.is_org_admin(organization_id));
create policy organization_summary_schedules_delete on public.organization_summary_schedules
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy summary_dispatch_logs_select on public.summary_dispatch_logs
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy summary_dispatch_logs_insert on public.summary_dispatch_logs
for insert with check (app.is_service_role() or app.is_org_admin(organization_id));
create policy summary_dispatch_logs_update on public.summary_dispatch_logs
for update using (app.is_service_role() or app.is_org_admin(organization_id))
with check (app.is_service_role() or app.is_org_admin(organization_id));
create policy summary_dispatch_logs_delete on public.summary_dispatch_logs
for delete using (app.is_service_role() or app.is_org_admin(organization_id));
