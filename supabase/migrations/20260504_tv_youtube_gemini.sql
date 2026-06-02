create extension if not exists pg_trgm;

create type public.tv_channel_status as enum ('active', 'paused', 'error');
create type public.tv_video_processing_status as enum ('pending', 'queued', 'processing', 'completed', 'failed');
create type public.tv_job_type as enum ('channel_sync', 'video_transcription', 'srt_generation', 'retry_failed');
create type public.tv_job_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.tv_youtube_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  youtube_channel_id text not null,
  channel_name text not null,
  thumbnail_url text,
  channel_url text,
  status public.tv_channel_status not null default 'active',
  last_synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, youtube_channel_id)
);

create table public.tv_youtube_videos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid not null references public.tv_youtube_channels(id) on delete cascade,
  youtube_video_id text not null,
  title text not null,
  thumbnail_url text,
  youtube_url text not null,
  published_at timestamptz not null,
  duration_iso text,
  duration_seconds integer,
  processing_status public.tv_video_processing_status not null default 'pending',
  srt_storage_path text,
  transcript_text text,
  transcript_language text,
  transcript_version integer not null default 1,
  last_processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, youtube_video_id)
);

create table public.tv_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  video_id uuid not null references public.tv_youtube_videos(id) on delete cascade,
  segment_index integer not null,
  start_sec numeric(10,3) not null,
  end_sec numeric(10,3) not null,
  text text not null,
  searchable_text text not null,
  search_vector tsvector generated always as (to_tsvector('simple', searchable_text)) stored,
  created_at timestamptz not null default timezone('utc', now()),
  unique (video_id, segment_index)
);

create table public.tv_processing_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  video_id uuid references public.tv_youtube_videos(id) on delete cascade,
  channel_id uuid references public.tv_youtube_channels(id) on delete cascade,
  job_type public.tv_job_type not null,
  job_status public.tv_job_status not null default 'queued',
  provider text,
  error_code text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index tv_youtube_channels_org_status_idx on public.tv_youtube_channels (organization_id, status);
create index tv_youtube_videos_channel_published_idx on public.tv_youtube_videos (channel_id, published_at desc);
create index tv_youtube_videos_org_status_idx on public.tv_youtube_videos (organization_id, processing_status);
create index tv_transcript_segments_video_time_idx on public.tv_transcript_segments (video_id, start_sec);
create index tv_transcript_segments_search_idx on public.tv_transcript_segments using gin (search_vector);
create index tv_transcript_segments_trgm_idx on public.tv_transcript_segments using gin (searchable_text gin_trgm_ops);
create index tv_processing_logs_queue_idx on public.tv_processing_logs (job_status, created_at);
create index tv_processing_logs_video_idx on public.tv_processing_logs (video_id, created_at desc);

create trigger tv_youtube_channels_set_updated_at before update on public.tv_youtube_channels for each row execute function public.set_updated_at();
create trigger tv_youtube_videos_set_updated_at before update on public.tv_youtube_videos for each row execute function public.set_updated_at();
create trigger tv_processing_logs_set_updated_at before update on public.tv_processing_logs for each row execute function public.set_updated_at();

alter table public.tv_youtube_channels enable row level security;
alter table public.tv_youtube_videos enable row level security;
alter table public.tv_transcript_segments enable row level security;
alter table public.tv_processing_logs enable row level security;

create policy tv_youtube_channels_select on public.tv_youtube_channels
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_youtube_channels_insert on public.tv_youtube_channels
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_youtube_channels_update on public.tv_youtube_channels
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_youtube_channels_delete on public.tv_youtube_channels
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy tv_youtube_videos_select on public.tv_youtube_videos
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_youtube_videos_insert on public.tv_youtube_videos
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_youtube_videos_update on public.tv_youtube_videos
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_youtube_videos_delete on public.tv_youtube_videos
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy tv_transcript_segments_select on public.tv_transcript_segments
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_transcript_segments_insert on public.tv_transcript_segments
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_transcript_segments_update on public.tv_transcript_segments
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_transcript_segments_delete on public.tv_transcript_segments
for delete using (app.is_service_role() or app.is_org_admin(organization_id));

create policy tv_processing_logs_select on public.tv_processing_logs
for select using (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_processing_logs_insert on public.tv_processing_logs
for insert with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_processing_logs_update on public.tv_processing_logs
for update using (app.is_service_role() or app.is_org_member(organization_id))
with check (app.is_service_role() or app.is_org_member(organization_id));
create policy tv_processing_logs_delete on public.tv_processing_logs
for delete using (app.is_service_role() or app.is_org_admin(organization_id));
