create table if not exists public.tv_tiktok_public_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('profile', 'video')),
  source_url text not null,
  normalized_url text not null,
  account_handle text,
  display_name text,
  avatar_url text,
  profile_url text,
  bio_description text,
  status public.tv_channel_status not null default 'active',
  last_synced_at timestamptz,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, normalized_url)
);

create table if not exists public.tv_tiktok_public_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.tv_tiktok_public_sources(id) on delete cascade,
  external_post_id text,
  post_url text not null,
  normalized_post_url text not null,
  title text,
  video_description text,
  thumbnail_url text,
  author_name text,
  author_url text,
  embed_html text,
  published_at timestamptz,
  like_count bigint,
  comment_count bigint,
  share_count bigint,
  view_count bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, normalized_post_url)
);

create index if not exists tv_tiktok_public_sources_org_status_idx
  on public.tv_tiktok_public_sources (organization_id, status, created_at desc);

create index if not exists tv_tiktok_public_posts_source_created_idx
  on public.tv_tiktok_public_posts (source_id, created_at desc);

create index if not exists tv_tiktok_public_posts_org_created_idx
  on public.tv_tiktok_public_posts (organization_id, created_at desc);

create trigger tv_tiktok_public_sources_set_updated_at
before update on public.tv_tiktok_public_sources
for each row execute function public.set_updated_at();

create trigger tv_tiktok_public_posts_set_updated_at
before update on public.tv_tiktok_public_posts
for each row execute function public.set_updated_at();

alter table public.tv_tiktok_public_sources enable row level security;
alter table public.tv_tiktok_public_posts enable row level security;

create policy tv_tiktok_public_sources_select on public.tv_tiktok_public_sources
for select using (app.is_service_role() or app.is_org_member(organization_id));

create policy tv_tiktok_public_sources_insert on public.tv_tiktok_public_sources
for insert with check (app.is_service_role() or app.is_org_member(organization_id));

create policy tv_tiktok_public_sources_update on public.tv_tiktok_public_sources
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));

create policy tv_tiktok_public_sources_delete on public.tv_tiktok_public_sources
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy tv_tiktok_public_posts_select on public.tv_tiktok_public_posts
for select using (app.is_service_role() or app.is_org_member(organization_id));

create policy tv_tiktok_public_posts_insert on public.tv_tiktok_public_posts
for insert with check (app.is_service_role() or app.is_org_member(organization_id));

create policy tv_tiktok_public_posts_update on public.tv_tiktok_public_posts
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));

create policy tv_tiktok_public_posts_delete on public.tv_tiktok_public_posts
for delete using (app.is_service_role() or app.is_org_admin(organization_id));
