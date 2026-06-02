create type public.watch_term_type as enum ('brand', 'competitor', 'keyword');

create table public.organization_watch_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  term text not null,
  normalized_term text generated always as (lower(trim(term))) stored,
  term_type public.watch_term_type not null,
  language text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, normalized_term, term_type)
);

create table public.media_keyword_daily_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  keyword text not null,
  normalized_keyword text generated always as (lower(trim(keyword))) stored,
  source_kind text not null check (source_kind in ('tv', 'news', 'epaper', 'all')),
  bucket_date date not null,
  occurrence_count integer not null default 0,
  document_count integer not null default 0,
  channel_count integer not null default 0,
  trend_score numeric(12,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, normalized_keyword, source_kind, bucket_date)
);

create index organization_watch_terms_org_type_idx on public.organization_watch_terms (organization_id, term_type, is_active);
create index organization_watch_terms_normalized_idx on public.organization_watch_terms (organization_id, normalized_term);
create index media_keyword_daily_stats_lookup_idx on public.media_keyword_daily_stats (organization_id, source_kind, bucket_date desc);
create index media_keyword_daily_stats_keyword_idx on public.media_keyword_daily_stats (organization_id, normalized_keyword, bucket_date desc);
create index tv_youtube_videos_org_published_idx on public.tv_youtube_videos (organization_id, published_at desc);
create index news_articles_org_source_idx on public.news_articles (organization_id, source_name, published_at desc);
create index epaper_clips_org_source_idx on public.epaper_clips (organization_id, source_name, published_at desc);

create trigger organization_watch_terms_set_updated_at before update on public.organization_watch_terms for each row execute function public.set_updated_at();
create trigger media_keyword_daily_stats_set_updated_at before update on public.media_keyword_daily_stats for each row execute function public.set_updated_at();

alter table public.organization_watch_terms enable row level security;
alter table public.media_keyword_daily_stats enable row level security;

create policy organization_watch_terms_select on public.organization_watch_terms
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy organization_watch_terms_insert on public.organization_watch_terms
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy organization_watch_terms_update on public.organization_watch_terms
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy organization_watch_terms_delete on public.organization_watch_terms
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy media_keyword_daily_stats_select on public.media_keyword_daily_stats
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy media_keyword_daily_stats_insert on public.media_keyword_daily_stats
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy media_keyword_daily_stats_update on public.media_keyword_daily_stats
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy media_keyword_daily_stats_delete on public.media_keyword_daily_stats
for delete using (app.is_service_role() or app.is_org_admin(organization_id));
