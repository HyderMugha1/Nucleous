create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

create type public.organization_status as enum ('active', 'trial', 'inactive');
create type public.membership_role as enum ('owner', 'admin', 'manager', 'analyst', 'executive');
create type public.membership_status as enum ('active', 'inactive', 'invited', 'suspended');
create type public.watch_status as enum ('active', 'paused', 'archived');
create type public.entity_type as enum ('brand', 'competitor', 'person', 'institution', 'regulator', 'campaign', 'topic');
create type public.source_type as enum ('social', 'news', 'tv', 'epaper', 'web', 'influencer');
create type public.platform_type as enum ('Twitter/X', 'Facebook', 'Instagram', 'YouTube', 'LinkedIn', 'TikTok', 'Reddit', 'TV', 'News', 'E-Paper', 'Website');
create type public.sentiment_label as enum ('positive', 'neutral', 'negative');
create type public.trend_direction as enum ('rising', 'falling', 'stable');
create type public.alert_severity as enum ('low', 'medium', 'high', 'critical');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved');
create type public.campaign_status as enum ('draft', 'active', 'completed', 'archived');
create type public.crisis_status as enum ('monitoring', 'active', 'contained', 'resolved');
create type public.report_type as enum ('daily', 'weekly', 'campaign', 'crisis', 'quarterly', 'custom');
create type public.report_status as enum ('draft', 'ready', 'generated', 'archived');
create type public.content_type as enum ('post', 'article', 'transcript', 'clip', 'reel', 'video');
create type public.ingestion_job_type as enum ('crawler', 'api_pull', 'ocr', 'transcript', 'manual_import');
create type public.ingestion_job_status as enum ('queued', 'running', 'completed', 'failed');
create type public.delivery_channel as enum ('email', 'app', 'whatsapp', 'sms');
create type public.alert_rule_type as enum ('volume_spike', 'negative_sentiment', 'new_narrative', 'crisis_keyword');
create type public.narrative_status as enum ('active', 'watching', 'closed');
create type public.source_status as enum ('active', 'paused', 'error');
create type public.ai_context_type as enum ('dashboard', 'report', 'campaign', 'crisis');
create type public.ai_message_role as enum ('user', 'assistant', 'system');
create type public.contact_inquiry_type as enum ('general', 'demo', 'security', 'onboarding');
create type public.contact_inquiry_status as enum ('new', 'reviewed', 'resolved');
create type public.saved_view_context as enum ('dashboard', 'mentions', 'narratives', 'competitors', 'reports', 'campaigns', 'crisis');
create type public.notification_status as enum ('unread', 'read', 'archived');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'role') = 'service_role', false);
$$;

create or replace function app.is_org_member(target_organization uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function app.is_org_admin(target_organization uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager')
  );
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  industry text,
  country text,
  subscription_plan text,
  status public.organization_status not null default 'trial',
  competitor_names text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email citext not null unique,
  contact_number text,
  avatar_url text,
  preferred_login_provider text not null default 'email' check (preferred_login_provider in ('email', 'google', 'microsoft')),
  status public.membership_status not null default 'active',
  default_organization_id uuid references public.organizations(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'analyst',
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default timezone('utc', now()),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email citext not null,
  role public.membership_role not null default 'analyst',
  status public.membership_status not null default 'invited',
  invitation_token uuid not null default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, email)
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  app_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  status public.notification_status not null default 'unread',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  context public.saved_view_context not null,
  name text not null,
  layout_config jsonb not null default '{}'::jsonb,
  filter_config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  source_type public.source_type not null,
  platform public.platform_type,
  url text,
  language text,
  country text,
  status public.source_status not null default 'active',
  last_ingested_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type public.entity_type not null,
  aliases text[] not null default '{}',
  keywords text[] not null default '{}',
  platform_links text[] not null default '{}',
  is_competitor boolean not null default false,
  watch_status public.watch_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, name)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status public.campaign_status not null default 'draft',
  goal text,
  start_date timestamptz not null,
  end_date timestamptz,
  owner_user_id uuid references auth.users(id) on delete set null,
  kpis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.campaign_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, entity_id)
);

create table public.narratives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text not null,
  keywords text[] not null default '{}',
  sentiment public.sentiment_label not null,
  trend public.trend_direction not null default 'stable',
  mention_count integer not null default 0,
  momentum_score numeric(12,4) not null default 0,
  risk_score numeric(12,4) not null default 0,
  status public.narrative_status not null default 'active',
  first_detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.narrative_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (narrative_id, entity_id)
);

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  crisis_incident_id uuid,
  content_type public.content_type not null,
  platform public.platform_type not null,
  source_type public.source_type not null,
  headline text,
  body text,
  snippet text,
  author_name text,
  channel_or_publisher text,
  language text,
  country text,
  published_at timestamptz not null,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  views integer not null default 0,
  sentiment_label public.sentiment_label not null,
  sentiment_score numeric(8,4) not null default 0,
  risk_score numeric(8,4),
  url text,
  media_urls text[] not null default '{}',
  tags text[] not null default '{}',
  raw_ingestion_id text,
  metadata jsonb not null default '{}'::jsonb,
  searchable tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(headline, '') || ' ' ||
      coalesce(body, '') || ' ' ||
      coalesce(snippet, '') || ' ' ||
      coalesce(author_name, '') || ' ' ||
      coalesce(channel_or_publisher, '')
    )
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.mention_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mention_id uuid not null references public.mentions(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (mention_id, entity_id)
);

create table public.mention_narratives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mention_id uuid not null references public.mentions(id) on delete cascade,
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (mention_id, narrative_id)
);

create table public.mention_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mention_id uuid not null references public.mentions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (mention_id, campaign_id)
);

create table public.mention_trends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete set null,
  narrative_id uuid references public.narratives(id) on delete set null,
  platform public.platform_type,
  window text not null check (window in ('hourly', 'daily', 'weekly')),
  bucket_start timestamptz not null,
  bucket_end timestamptz not null,
  mention_count integer not null default 0,
  engagement_count integer not null default 0,
  sentiment_score numeric(12,4) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.sentiment_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete set null,
  narrative_id uuid references public.narratives(id) on delete set null,
  platform public.platform_type,
  positive integer not null default 0,
  neutral integer not null default 0,
  negative integer not null default 0,
  calculated_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type public.alert_rule_type not null,
  threshold_value numeric(12,4) not null,
  threshold_window text not null,
  delivery_channels public.delivery_channel[] not null default array['email'::public.delivery_channel, 'app'::public.delivery_channel],
  status text not null default 'active' check (status in ('active', 'paused')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.alert_rule_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_rule_id uuid not null references public.alert_rules(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (alert_rule_id, entity_id)
);

create table public.alert_rule_narratives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_rule_id uuid not null references public.alert_rules(id) on delete cascade,
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (alert_rule_id, narrative_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete set null,
  severity public.alert_severity not null,
  type text not null,
  message text not null,
  status public.alert_status not null default 'open',
  delivery_channels public.delivery_channel[] not null default array['app'::public.delivery_channel],
  triggered_at timestamptz not null,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.alert_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (alert_id, entity_id)
);

create table public.alert_narratives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_id uuid not null references public.alerts(id) on delete cascade,
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (alert_id, narrative_id)
);

create table public.crisis_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text not null,
  severity public.alert_severity not null,
  status public.crisis_status not null default 'monitoring',
  response_owner_user_id uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.mentions
  add constraint mentions_crisis_incident_id_fkey
  foreign key (crisis_incident_id) references public.crisis_incidents(id) on delete set null;

create table public.crisis_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  crisis_incident_id uuid not null references public.crisis_incidents(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (crisis_incident_id, entity_id)
);

create table public.crisis_narratives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  crisis_incident_id uuid not null references public.crisis_incidents(id) on delete cascade,
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (crisis_incident_id, narrative_id)
);

create table public.crisis_mentions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  crisis_incident_id uuid not null references public.crisis_incidents(id) on delete cascade,
  mention_id uuid not null references public.mentions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (crisis_incident_id, mention_id)
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  handle text not null,
  primary_platform public.platform_type not null,
  followers integer not null default 0,
  following integer not null default 0,
  posts integer not null default 0,
  engagement numeric(12,4) not null default 0,
  reach numeric(12,4) not null default 0,
  sentiment numeric(12,4) not null default 0,
  risk_score numeric(12,4) not null default 0,
  category text,
  niche text,
  geography text,
  active_platforms public.platform_type[] not null default '{}',
  worked_with text[] not null default '{}',
  topics text[] not null default '{}',
  profile_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, handle, primary_platform)
);

create table public.influencer_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform public.platform_type not null,
  caption text not null,
  likes integer not null default 0,
  comments integer not null default 0,
  views integer not null default 0,
  sentiment_label public.sentiment_label,
  sentiment_score numeric(8,4),
  brand text,
  posted_at timestamptz not null,
  url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.influencer_post_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  influencer_post_id uuid not null references public.influencer_posts(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (influencer_post_id, entity_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  type public.report_type not null,
  status public.report_status not null default 'draft',
  date_range_from timestamptz,
  date_range_to timestamptz,
  filters jsonb not null default '{}'::jsonb,
  summary text,
  asset_urls text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  context_type public.ai_context_type not null,
  context_ref_id uuid,
  title text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.tv_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  channel text not null,
  show_name text not null,
  anchor_name text,
  headline text not null,
  transcript_snippet text,
  language text,
  sentiment_label public.sentiment_label,
  sentiment_score numeric(8,4),
  aired_at timestamptz not null,
  searchable tsvector generated always as (
    to_tsvector('simple', coalesce(headline, '') || ' ' || coalesce(transcript_snippet, ''))
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tv_segment_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tv_segment_id uuid not null references public.tv_segments(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tv_segment_id, entity_id)
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  source_name text not null,
  headline text not null,
  summary text,
  body text,
  language text,
  sentiment_label public.sentiment_label,
  sentiment_score numeric(8,4),
  published_at timestamptz not null,
  url text,
  searchable tsvector generated always as (
    to_tsvector('simple', coalesce(headline, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body, ''))
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.news_article_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  news_article_id uuid not null references public.news_articles(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (news_article_id, entity_id)
);

create table public.epaper_clips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  source_name text not null,
  page_label text,
  headline text,
  ocr_text text not null,
  language text,
  sentiment_label public.sentiment_label,
  sentiment_score numeric(8,4),
  published_at timestamptz not null,
  image_url text,
  searchable tsvector generated always as (
    to_tsvector('simple', coalesce(headline, '') || ' ' || coalesce(ocr_text, ''))
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.epaper_clip_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  epaper_clip_id uuid not null references public.epaper_clips(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (epaper_clip_id, entity_id)
);

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  type public.ingestion_job_type not null,
  status public.ingestion_job_status not null default 'queued',
  processed_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  email citext not null,
  company text,
  contact_number text,
  inquiry_type public.contact_inquiry_type not null default 'general',
  message text not null,
  status public.contact_inquiry_status not null default 'new',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_complete boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index organizations_slug_idx on public.organizations (slug);
create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_members_org_role_idx on public.organization_members (organization_id, role, status);
create index app_notifications_user_status_idx on public.app_notifications (user_id, status, created_at desc);
create unique index saved_views_default_idx on public.saved_views (organization_id, user_id, context) where is_default = true;
create index sources_org_status_idx on public.sources (organization_id, status);
create index entities_org_competitor_idx on public.entities (organization_id, is_competitor, watch_status);
create index campaigns_org_status_idx on public.campaigns (organization_id, status, start_date desc);
create index narratives_org_status_idx on public.narratives (organization_id, status, last_detected_at desc);
create index mentions_org_published_idx on public.mentions (organization_id, published_at desc);
create index mentions_org_platform_published_idx on public.mentions (organization_id, platform, published_at desc);
create index mentions_org_sentiment_published_idx on public.mentions (organization_id, sentiment_label, published_at desc);
create index mentions_org_source_type_published_idx on public.mentions (organization_id, source_type, published_at desc);
create index mentions_crisis_idx on public.mentions (crisis_incident_id);
create index mention_entities_entity_idx on public.mention_entities (organization_id, entity_id);
create index mention_narratives_narrative_idx on public.mention_narratives (organization_id, narrative_id);
create index mention_campaigns_campaign_idx on public.mention_campaigns (organization_id, campaign_id);
create index mention_trends_lookup_idx on public.mention_trends (organization_id, window, bucket_start desc);
create index sentiment_snapshots_lookup_idx on public.sentiment_snapshots (organization_id, calculated_at desc);
create index alert_rules_org_status_idx on public.alert_rules (organization_id, status);
create index alerts_org_status_triggered_idx on public.alerts (organization_id, status, triggered_at desc);
create index alerts_org_severity_triggered_idx on public.alerts (organization_id, severity, triggered_at desc);
create index crisis_incidents_org_status_idx on public.crisis_incidents (organization_id, status, opened_at desc);
create index influencers_org_platform_idx on public.influencers (organization_id, primary_platform, followers desc);
create index influencer_posts_org_posted_idx on public.influencer_posts (organization_id, posted_at desc);
create index reports_org_status_idx on public.reports (organization_id, status, created_at desc);
create index ai_conversations_org_user_idx on public.ai_conversations (organization_id, user_id, updated_at desc);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index tv_segments_org_aired_idx on public.tv_segments (organization_id, aired_at desc);
create index news_articles_org_published_idx on public.news_articles (organization_id, published_at desc);
create index epaper_clips_org_published_idx on public.epaper_clips (organization_id, published_at desc);
create index ingestion_jobs_org_status_idx on public.ingestion_jobs (organization_id, status, created_at desc);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index contact_inquiries_status_idx on public.contact_inquiries (status, created_at desc);
create index todos_created_idx on public.todos (created_at desc);
create index mentions_search_idx on public.mentions using gin (searchable);
create index tv_segments_search_idx on public.tv_segments using gin (searchable);
create index news_articles_search_idx on public.news_articles using gin (searchable);
create index epaper_clips_search_idx on public.epaper_clips using gin (searchable);

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members for each row execute function public.set_updated_at();
create trigger organization_invitations_set_updated_at before update on public.organization_invitations for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
create trigger app_notifications_set_updated_at before update on public.app_notifications for each row execute function public.set_updated_at();
create trigger saved_views_set_updated_at before update on public.saved_views for each row execute function public.set_updated_at();
create trigger sources_set_updated_at before update on public.sources for each row execute function public.set_updated_at();
create trigger entities_set_updated_at before update on public.entities for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();
create trigger narratives_set_updated_at before update on public.narratives for each row execute function public.set_updated_at();
create trigger mentions_set_updated_at before update on public.mentions for each row execute function public.set_updated_at();
create trigger mention_trends_set_updated_at before update on public.mention_trends for each row execute function public.set_updated_at();
create trigger sentiment_snapshots_set_updated_at before update on public.sentiment_snapshots for each row execute function public.set_updated_at();
create trigger alert_rules_set_updated_at before update on public.alert_rules for each row execute function public.set_updated_at();
create trigger alerts_set_updated_at before update on public.alerts for each row execute function public.set_updated_at();
create trigger crisis_incidents_set_updated_at before update on public.crisis_incidents for each row execute function public.set_updated_at();
create trigger influencers_set_updated_at before update on public.influencers for each row execute function public.set_updated_at();
create trigger influencer_posts_set_updated_at before update on public.influencer_posts for each row execute function public.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function public.set_updated_at();
create trigger ai_conversations_set_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();
create trigger tv_segments_set_updated_at before update on public.tv_segments for each row execute function public.set_updated_at();
create trigger news_articles_set_updated_at before update on public.news_articles for each row execute function public.set_updated_at();
create trigger epaper_clips_set_updated_at before update on public.epaper_clips for each row execute function public.set_updated_at();
create trigger ingestion_jobs_set_updated_at before update on public.ingestion_jobs for each row execute function public.set_updated_at();
create trigger contact_inquiries_set_updated_at before update on public.contact_inquiries for each row execute function public.set_updated_at();
create trigger todos_set_updated_at before update on public.todos for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.app_notifications enable row level security;
alter table public.saved_views enable row level security;
alter table public.sources enable row level security;
alter table public.entities enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_entities enable row level security;
alter table public.narratives enable row level security;
alter table public.narrative_entities enable row level security;
alter table public.mentions enable row level security;
alter table public.mention_entities enable row level security;
alter table public.mention_narratives enable row level security;
alter table public.mention_campaigns enable row level security;
alter table public.mention_trends enable row level security;
alter table public.sentiment_snapshots enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_rule_entities enable row level security;
alter table public.alert_rule_narratives enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_entities enable row level security;
alter table public.alert_narratives enable row level security;
alter table public.crisis_incidents enable row level security;
alter table public.crisis_entities enable row level security;
alter table public.crisis_narratives enable row level security;
alter table public.crisis_mentions enable row level security;
alter table public.influencers enable row level security;
alter table public.influencer_posts enable row level security;
alter table public.influencer_post_entities enable row level security;
alter table public.reports enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.tv_segments enable row level security;
alter table public.tv_segment_entities enable row level security;
alter table public.news_articles enable row level security;
alter table public.news_article_entities enable row level security;
alter table public.epaper_clips enable row level security;
alter table public.epaper_clip_entities enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.todos enable row level security;

create policy organizations_select on public.organizations
for select
using (app.is_service_role() or app.is_org_member(id));

create policy organizations_insert on public.organizations
for insert
with check (app.is_service_role() or created_by = auth.uid());

create policy organizations_update on public.organizations
for update
using (app.is_service_role() or app.is_org_admin(id))
with check (app.is_service_role() or app.is_org_admin(id));

create policy profiles_select on public.profiles
for select
using (
  app.is_service_role()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = profiles.user_id
      and app.is_org_member(om.organization_id)
  )
);

create policy profiles_insert on public.profiles
for insert
with check (app.is_service_role() or user_id = auth.uid());

create policy profiles_update on public.profiles
for update
using (app.is_service_role() or user_id = auth.uid())
with check (app.is_service_role() or user_id = auth.uid());

create policy organization_members_select on public.organization_members
for select
using (app.is_service_role() or app.is_org_member(organization_id));

create policy organization_members_insert on public.organization_members
for insert
with check (app.is_service_role() or app.is_org_admin(organization_id));

create policy organization_members_update on public.organization_members
for update
using (app.is_service_role() or app.is_org_admin(organization_id))
with check (app.is_service_role() or app.is_org_admin(organization_id));

create policy organization_invitations_all on public.organization_invitations
for all
using (app.is_service_role() or app.is_org_admin(organization_id))
with check (app.is_service_role() or app.is_org_admin(organization_id));

do $$
declare
  table_name text;
  org_tables text[] := array[
    'notification_preferences',
    'app_notifications',
    'saved_views',
    'sources',
    'entities',
    'campaigns',
    'campaign_entities',
    'narratives',
    'narrative_entities',
    'mentions',
    'mention_entities',
    'mention_narratives',
    'mention_campaigns',
    'mention_trends',
    'sentiment_snapshots',
    'alert_rules',
    'alert_rule_entities',
    'alert_rule_narratives',
    'alerts',
    'alert_entities',
    'alert_narratives',
    'crisis_incidents',
    'crisis_entities',
    'crisis_narratives',
    'crisis_mentions',
    'influencers',
    'influencer_posts',
    'influencer_post_entities',
    'reports',
    'ai_conversations',
    'ai_messages',
    'tv_segments',
    'tv_segment_entities',
    'news_articles',
    'news_article_entities',
    'epaper_clips',
    'epaper_clip_entities',
    'ingestion_jobs',
    'audit_logs',
    'contact_inquiries'
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

create policy contact_inquiries_public_insert on public.contact_inquiries
for insert
with check (true);

create policy todos_public_select on public.todos
for select
using (true);

create policy todos_public_insert on public.todos
for insert
with check (true);

create policy todos_public_update on public.todos
for update
using (true)
with check (true);

create policy todos_public_delete on public.todos
for delete
using (true);
