create table public.branding_scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  news_website_id uuid not null references public.web_paper_websites(id) on delete cascade,
  status text not null default 'queued',
  total_urls integer not null default 0,
  completed_urls integer not null default 0,
  failed_urls integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  urls jsonb not null default '[]'::jsonb,
  device_types text[] not null default array['desktop']::text[],
  capture_full_page boolean not null default true,
  capture_ad_elements boolean not null default true,
  use_ai_classification boolean not null default true,
  requested_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branding_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scan_id uuid not null references public.branding_scans(id) on delete cascade,
  news_website_id uuid not null references public.web_paper_websites(id) on delete cascade,
  page_url text not null,
  brand_name varchar(255),
  ad_type varchar(100),
  placement varchar(100),
  confidence numeric(5,4),
  selector text,
  element_text text,
  screenshot_path text,
  full_page_screenshot_path text,
  device_type varchar(50),
  viewport_width integer,
  viewport_height integer,
  captured_at timestamptz,
  status varchar(50) not null default 'detected',
  is_false_positive boolean not null default false,
  screenshot_hash text,
  bounding_box jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branding_scan_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  news_website_id uuid not null references public.web_paper_websites(id) on delete cascade,
  enabled boolean not null default false,
  frequency varchar(50) not null default 'daily',
  time_of_day varchar(5) not null default '09:00',
  device_types text[] not null default array['desktop']::text[],
  max_urls_per_scan integer not null default 50,
  capture_full_page boolean not null default true,
  capture_ad_elements boolean not null default true,
  use_ai_classification boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, news_website_id)
);

create index branding_scans_lookup_idx on public.branding_scans (organization_id, news_website_id, created_at desc);
create index branding_scans_status_idx on public.branding_scans (organization_id, status, created_at desc);
create index branding_results_lookup_idx on public.branding_results (organization_id, news_website_id, captured_at desc);
create index branding_results_brand_idx on public.branding_results (organization_id, brand_name, captured_at desc);
create index branding_results_status_idx on public.branding_results (organization_id, status, captured_at desc);
create index branding_schedule_due_idx on public.branding_scan_schedules (enabled, next_run_at asc);

create trigger branding_scans_set_updated_at before update on public.branding_scans for each row execute function public.set_updated_at();
create trigger branding_results_set_updated_at before update on public.branding_results for each row execute function public.set_updated_at();
create trigger branding_scan_schedules_set_updated_at before update on public.branding_scan_schedules for each row execute function public.set_updated_at();

alter table public.branding_scans enable row level security;
alter table public.branding_results enable row level security;
alter table public.branding_scan_schedules enable row level security;

do $$
declare
  table_name text;
  org_tables text[] := array[
    'branding_scans',
    'branding_results',
    'branding_scan_schedules'
  ];
begin
  foreach table_name in array org_tables
  loop
    execute format(
      'create policy %I_select on public.%I for select using (app.is_service_role() or app.is_org_member(organization_id))',
      table_name,
      table_name
    );

    execute format(
      'create policy %I_insert on public.%I for insert with check (app.is_service_role() or app.is_org_member(organization_id))',
      table_name,
      table_name
    );

    execute format(
      'create policy %I_update on public.%I for update using (app.is_service_role() or app.is_org_member(organization_id)) with check (app.is_service_role() or app.is_org_member(organization_id))',
      table_name,
      table_name
    );

    execute format(
      'create policy %I_delete on public.%I for delete using (app.is_service_role() or app.is_org_admin(organization_id))',
      table_name,
      table_name
    );
  end loop;
end $$;
