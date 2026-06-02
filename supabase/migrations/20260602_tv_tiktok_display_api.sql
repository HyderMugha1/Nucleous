alter type public.tv_job_type add value if not exists 'tiktok_account_sync';

create table public.tv_tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tiktok_open_id text not null,
  union_id text,
  display_name text not null,
  username text,
  avatar_url text,
  profile_url text,
  bio_description text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  status public.tv_channel_status not null default 'active',
  last_synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, tiktok_open_id)
);

create table public.tv_tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.tv_tiktok_accounts(id) on delete cascade,
  tiktok_video_id text not null,
  title text,
  video_description text,
  cover_image_url text,
  share_url text not null,
  embed_link text,
  embed_html text,
  duration_seconds integer,
  width integer,
  height integer,
  like_count bigint,
  comment_count bigint,
  share_count bigint,
  view_count bigint,
  published_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, tiktok_video_id)
);

create index tv_tiktok_accounts_org_status_idx on public.tv_tiktok_accounts (organization_id, status);
create index tv_tiktok_videos_account_published_idx on public.tv_tiktok_videos (account_id, published_at desc);
create index tv_tiktok_videos_org_published_idx on public.tv_tiktok_videos (organization_id, published_at desc);

create trigger tv_tiktok_accounts_set_updated_at before update on public.tv_tiktok_accounts for each row execute function public.set_updated_at();
create trigger tv_tiktok_videos_set_updated_at before update on public.tv_tiktok_videos for each row execute function public.set_updated_at();

alter table public.tv_tiktok_accounts enable row level security;
alter table public.tv_tiktok_videos enable row level security;

create policy tv_tiktok_accounts_select on public.tv_tiktok_accounts
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_tiktok_accounts_insert on public.tv_tiktok_accounts
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_tiktok_accounts_update on public.tv_tiktok_accounts
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_tiktok_accounts_delete on public.tv_tiktok_accounts
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy tv_tiktok_videos_select on public.tv_tiktok_videos
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_tiktok_videos_insert on public.tv_tiktok_videos
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_tiktok_videos_update on public.tv_tiktok_videos
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_tiktok_videos_delete on public.tv_tiktok_videos
for delete using (app.is_service_role() or app.is_org_admin(organization_id));
