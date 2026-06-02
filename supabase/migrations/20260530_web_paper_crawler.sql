create table public.web_paper_websites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  base_url text not null,
  domain text not null,
  scraper_key text not null,
  crawl_interval_minutes integer not null default 15,
  is_active boolean not null default true,
  is_backfill_completed boolean not null default false,
  last_backfill_started_at timestamptz,
  last_backfill_completed_at timestamptz,
  last_crawled_at timestamptz,
  last_successful_crawl_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, domain),
  unique (organization_id, scraper_key)
);

create table public.web_paper_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.web_paper_websites(id) on delete cascade,
  source_name text,
  title text not null,
  slug text,
  url text not null,
  canonical_url text,
  normalized_url text not null,
  excerpt text,
  content text,
  author text,
  category text,
  language text,
  image_url text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text,
  url_hash text not null,
  raw_html text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, url_hash)
);

create table public.web_paper_crawl_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid references public.web_paper_websites(id) on delete set null,
  job_type text not null,
  status text not null,
  message text,
  date_from timestamptz,
  date_to timestamptz,
  articles_found integer not null default 0,
  articles_saved integer not null default 0,
  articles_skipped integer not null default 0,
  errors_count integer not null default 0,
  error_details jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.web_paper_crawl_locks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lock_key text not null,
  is_locked boolean not null default false,
  locked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lock_key)
);

create table public.web_paper_crawler_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  crawler_enabled boolean not null default true,
  crawl_interval_minutes integer not null default 15,
  request_timeout_seconds integer not null default 30,
  max_retries integer not null default 3,
  delay_between_requests_seconds integer not null default 2,
  max_articles_per_crawl integer not null default 50,
  save_raw_html boolean not null default false,
  initial_backfill_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index web_paper_websites_org_active_idx on public.web_paper_websites (organization_id, is_active, updated_at desc);
create index web_paper_articles_org_published_idx on public.web_paper_articles (organization_id, published_at desc);
create index web_paper_articles_org_status_idx on public.web_paper_articles (organization_id, status, published_at desc);
create index web_paper_articles_website_idx on public.web_paper_articles (website_id, published_at desc);
create index web_paper_articles_source_idx on public.web_paper_articles (organization_id, source_name);
create index web_paper_articles_title_idx on public.web_paper_articles using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, '')));
create index web_paper_logs_org_started_idx on public.web_paper_crawl_logs (organization_id, started_at desc);
create index web_paper_logs_status_idx on public.web_paper_crawl_logs (organization_id, status, started_at desc);

create trigger web_paper_websites_set_updated_at before update on public.web_paper_websites for each row execute function public.set_updated_at();
create trigger web_paper_articles_set_updated_at before update on public.web_paper_articles for each row execute function public.set_updated_at();
create trigger web_paper_crawl_locks_set_updated_at before update on public.web_paper_crawl_locks for each row execute function public.set_updated_at();
create trigger web_paper_crawler_settings_set_updated_at before update on public.web_paper_crawler_settings for each row execute function public.set_updated_at();

alter table public.web_paper_websites enable row level security;
alter table public.web_paper_articles enable row level security;
alter table public.web_paper_crawl_logs enable row level security;
alter table public.web_paper_crawl_locks enable row level security;
alter table public.web_paper_crawler_settings enable row level security;

do $$
declare
  table_name text;
  org_tables text[] := array[
    'web_paper_websites',
    'web_paper_articles',
    'web_paper_crawl_logs',
    'web_paper_crawl_locks',
    'web_paper_crawler_settings'
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
