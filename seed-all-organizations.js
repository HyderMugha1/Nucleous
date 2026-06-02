#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rowCount = Number(process.env.SEED_ROW_COUNT || 20);
const fallbackSeederEmail = (process.env.SEED_EMAIL || "admin@nucleus.local").toLowerCase();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const sentiments = ["positive", "neutral", "negative"];
const platforms = ["TV", "News", "YouTube", "Instagram", "LinkedIn", "Twitter/X"];
const sourceTypes = ["tv", "news", "social", "web"];
const campaignStatuses = ["draft", "active", "completed"];
const narrativeStatuses = ["active", "watching", "closed"];
const alertSeverities = ["low", "medium", "high", "critical"];
const alertStatuses = ["open", "acknowledged", "resolved"];
const tvVideoStatuses = ["pending", "queued", "processing", "completed"];
const tvChannelStatuses = ["active", "paused", "error"];
const summaryFrequencies = ["daily", "weekly"];
const deliveryChannels = ["email", "app", "whatsapp", "sms"];

function range(total) {
  return Array.from({ length: total }, (_, index) => index);
}

function pick(list, index) {
  return list[index % list.length];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoDaysAgo(days, hour = 9, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function isoDaysAhead(days, hour = 9) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function asDateOnly(daysAgoValue) {
  return isoDaysAgo(daysAgoValue).slice(0, 10);
}

function missingTable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("relation")
  );
}

async function safeDelete(table, queryBuilder) {
  const { error } = await queryBuilder(supabase.from(table).delete());
  if (error && !missingTable(error)) {
    throw new Error(`Unable to clear ${table}: ${error.message}`);
  }
}

async function safeInsert(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`Unable to insert into ${table}: ${error.message}`);
  }
  return data || [];
}

async function getOrganizations() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, competitor_names")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load organizations: ${error.message}`);
  }

  return data || [];
}

async function getOrganizationMembers() {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, user_id, role, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load organization members: ${error.message}`);
  }

  return data || [];
}

async function getFallbackSeederUserId() {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, email")
    .eq("email", fallbackSeederEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load fallback seeder profile: ${error.message}`);
  }

  if (profile?.user_id) {
    return profile.user_id;
  }

  const { data: firstProfile, error: firstProfileError } = await supabase
    .from("profiles")
    .select("user_id")
    .limit(1)
    .maybeSingle();

  if (firstProfileError || !firstProfile?.user_id) {
    throw new Error(firstProfileError?.message || "Unable to find any profile to use as fallback seeder");
  }

  return firstProfile.user_id;
}

async function clearOrganizationData(organizationId) {
  const cleanupTables = [
    "summary_dispatch_logs",
    "organization_summary_schedules",
    "media_keyword_daily_stats",
    "organization_watch_terms",
    "tv_processing_logs",
    "tv_transcript_segments",
    "tv_youtube_videos",
    "tv_youtube_channels",
    "influencer_post_entities",
    "influencer_posts",
    "influencers",
    "alert_narratives",
    "alert_entities",
    "alerts",
    "alert_rule_narratives",
    "alert_rule_entities",
    "alert_rules",
    "sentiment_snapshots",
    "mention_trends",
    "mention_campaigns",
    "mention_narratives",
    "mention_entities",
    "mentions",
    "narrative_entities",
    "narratives",
    "campaign_entities",
    "campaigns",
    "news_article_entities",
    "news_articles",
    "epaper_clip_entities",
    "epaper_clips",
    "tv_segment_entities",
    "tv_segments",
    "reports",
    "entities",
    "sources",
  ];

  for (const table of cleanupTables) {
    await safeDelete(table, (query) => query.eq("organization_id", organizationId));
  }
}

async function seedOrganization(organization, memberUserId) {
  const organizationId = organization.id;
  const brandName = organization.name.replace(/\s*workspace/i, "").trim() || organization.name;
  const competitorNames = organization.competitor_names?.length
    ? organization.competitor_names
    : ["Pulse Metrics", "Signal Watch", "Market Vista", "Echo Track"];

  await clearOrganizationData(organizationId);

  const sources = await safeInsert(
    "sources",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `${organization.slug}-source-${pad(index + 1)}`,
      source_type: pick(sourceTypes, index),
      platform: pick(platforms, index),
      url: `https://example.com/${organization.slug}/source/${pad(index + 1)}`,
      language: index % 3 === 0 ? "ur" : "en",
      country: pick(["Pakistan", "UAE", "Saudi Arabia"], index),
      status: "active",
      last_ingested_at: isoDaysAgo(index % 7, 8 + (index % 10)),
    })),
  );

  const entities = await safeInsert(
    "entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name:
        index === 0
          ? brandName
          : index < competitorNames.length + 1
            ? competitorNames[index - 1]
            : `${organization.slug}-entity-${pad(index + 1)}`,
      type: index === 0 ? "brand" : index < competitorNames.length + 1 ? "competitor" : "topic",
      aliases: [`${organization.slug}-alias-${pad(index + 1)}a`, `${organization.slug}-alias-${pad(index + 1)}b`],
      keywords: [brandName, `keyword-${pad(index + 1)}`, organization.slug],
      platform_links: [`https://example.com/${organization.slug}/entity/${pad(index + 1)}`],
      is_competitor: index > 0 && index < competitorNames.length + 1,
      watch_status: "active",
      created_by: memberUserId,
    })),
  );

  const campaigns = await safeInsert(
    "campaigns",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `${brandName} Campaign ${pad(index + 1)}`,
      description: `Campaign ${pad(index + 1)} for ${brandName}.`,
      status: pick(campaignStatuses, index),
      goal: `Track brand and competitor movement for ${brandName}.`,
      start_date: isoDaysAgo(40 - index, 9),
      end_date: isoDaysAhead((index % 20) + 1, 18),
      owner_user_id: memberUserId,
      kpis: {
        mentions: 100 + index * 10,
        reach: 10000 + index * 750,
      },
    })),
  );

  await safeInsert(
    "campaign_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      campaign_id: campaigns[index % campaigns.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  const narratives = await safeInsert(
    "narratives",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      title: `${brandName} Narrative ${pad(index + 1)}`,
      summary: `Narrative ${pad(index + 1)} for ${brandName} across media channels.`,
      keywords: [brandName, pick(competitorNames, index), `theme-${pad(index + 1)}`],
      sentiment: pick(sentiments, index),
      trend: pick(["rising", "falling", "stable"], index),
      mention_count: 12 + index,
      momentum_score: 30 + index * 1.5,
      risk_score: 10 + index * 1.2,
      status: pick(narrativeStatuses, index),
      first_detected_at: isoDaysAgo(20 - (index % 8), 8),
      last_detected_at: isoDaysAgo(index % 5, 18),
    })),
  );

  await safeInsert(
    "narrative_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      narrative_id: narratives[index % narratives.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  const mentions = await safeInsert(
    "mentions",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      content_type: pick(["post", "article", "transcript", "clip"], index),
      platform: pick(platforms, index),
      source_type: pick(sourceTypes, index),
      headline: `${brandName} Mention ${pad(index + 1)}`,
      body: `${brandName} and ${pick(competitorNames, index)} were discussed in seeded mention ${pad(index + 1)} for ${organization.slug}.`,
      snippet: `Seeded mention ${pad(index + 1)} for ${brandName}.`,
      author_name: `Reporter ${pad(index + 1)}`,
      channel_or_publisher: `${organization.name} Publisher ${pad(index + 1)}`,
      language: index % 4 === 0 ? "ur" : "en",
      country: pick(["Pakistan", "UAE", "Saudi Arabia"], index),
      published_at: isoDaysAgo(index % 12, 7 + (index % 12), index % 60),
      likes: 100 + index * 7,
      comments: 20 + index * 2,
      shares: 10 + index,
      views: 1000 + index * 120,
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 9) - 4) / 10).toFixed(2)),
      risk_score: Number((0.2 + (index % 7) * 0.1).toFixed(2)),
      url: `https://example.com/${organization.slug}/mentions/${pad(index + 1)}`,
      media_urls: [`https://images.example.com/${organization.slug}-mention-${pad(index + 1)}.jpg`],
      tags: ["seeded", organization.slug],
      raw_ingestion_id: `${organization.slug}-mention-${pad(index + 1)}`,
    })),
  );

  await safeInsert(
    "mention_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      mention_id: mentions[index % mentions.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  await safeInsert(
    "mention_narratives",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      mention_id: mentions[index % mentions.length]?.id,
      narrative_id: narratives[index % narratives.length]?.id,
    })),
  );

  await safeInsert(
    "mention_campaigns",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      mention_id: mentions[index % mentions.length]?.id,
      campaign_id: campaigns[index % campaigns.length]?.id,
    })),
  );

  await safeInsert(
    "mention_trends",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      entity_id: entities[index % entities.length]?.id,
      narrative_id: narratives[index % narratives.length]?.id,
      platform: pick(platforms, index),
      window: pick(["hourly", "daily", "weekly"], index),
      bucket_start: isoDaysAgo(index % 10, 0),
      bucket_end: isoDaysAgo(index % 10, 23),
      mention_count: 20 + index,
      engagement_count: 400 + index * 40,
      sentiment_score: Number((((index % 7) - 3) / 10).toFixed(2)),
    })),
  );

  await safeInsert(
    "sentiment_snapshots",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      entity_id: entities[index % entities.length]?.id,
      narrative_id: narratives[index % narratives.length]?.id,
      platform: pick(platforms, index),
      positive: 10 + index,
      neutral: 8 + (index % 5),
      negative: 4 + (index % 6),
      calculated_at: isoDaysAgo(index % 10, 22),
    })),
  );

  const alertRules = await safeInsert(
    "alert_rules",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `${brandName} Alert Rule ${pad(index + 1)}`,
      type: pick(["volume_spike", "negative_sentiment", "new_narrative", "crisis_keyword"], index),
      threshold_value: 5 + index,
      threshold_window: pick(["1h", "6h", "24h", "7d"], index),
      delivery_channels: [pick(deliveryChannels, index), "app"],
      status: index % 5 === 0 ? "paused" : "active",
      created_by: memberUserId,
    })),
  );

  await safeInsert(
    "alert_rule_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      alert_rule_id: alertRules[index % alertRules.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  await safeInsert(
    "alert_rule_narratives",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      alert_rule_id: alertRules[index % alertRules.length]?.id,
      narrative_id: narratives[index % narratives.length]?.id,
    })),
  );

  const alerts = await safeInsert(
    "alerts",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      rule_id: alertRules[index % alertRules.length]?.id,
      severity: pick(alertSeverities, index),
      type: index % 4 === 0 ? "media_keyword_spike" : "seed_alert",
      message: `Alert ${pad(index + 1)} triggered for ${brandName}.`,
      status: pick(alertStatuses, index),
      delivery_channels: [pick(deliveryChannels, index), "app"],
      triggered_at: isoDaysAgo(index % 10, 13),
      acknowledged_by: index % 3 === 0 ? memberUserId : null,
      acknowledged_at: index % 3 === 0 ? isoDaysAgo(index % 10, 15) : null,
      payload: {
        seeded: true,
        keyword: index % 2 === 0 ? brandName : pick(competitorNames, index),
      },
    })),
  );

  await safeInsert(
    "alert_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      alert_id: alerts[index % alerts.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  await safeInsert(
    "alert_narratives",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      alert_id: alerts[index % alerts.length]?.id,
      narrative_id: narratives[index % narratives.length]?.id,
    })),
  );

  const influencers = await safeInsert(
    "influencers",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `${brandName} Influencer ${pad(index + 1)}`,
      handle: `@${organization.slug.replace(/-/g, "")}inf${pad(index + 1)}`,
      primary_platform: pick(["YouTube", "Instagram", "TikTok", "LinkedIn"], index),
      followers: 10000 + index * 5000,
      following: 200 + index * 7,
      posts: 50 + index * 4,
      engagement: Number((2.5 + (index % 7) * 0.8).toFixed(2)),
      reach: 15000 + index * 6000,
      sentiment: Number((0.1 + (index % 6) * 0.12).toFixed(2)),
      risk_score: Number((0.2 + (index % 5) * 0.14).toFixed(2)),
      category: pick(["Business", "Politics", "Retail", "Technology"], index),
      niche: pick(["Media", "Finance", "Consumer", "Growth"], index),
      geography: pick(["Pakistan", "UAE", "Saudi Arabia"], index),
      active_platforms: [pick(["YouTube", "Instagram", "TikTok", "LinkedIn"], index), pick(["Facebook", "Twitter/X"], index)],
      worked_with: [brandName, pick(competitorNames, index)],
      topics: [brandName, "trust", "pricing"],
      profile_url: `https://example.com/${organization.slug}/influencers/${pad(index + 1)}`,
    })),
  );

  await safeInsert(
    "influencer_posts",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      influencer_id: influencers[index % influencers.length]?.id,
      campaign_id: campaigns[index % campaigns.length]?.id,
      platform: pick(["YouTube", "Instagram", "TikTok", "LinkedIn"], index),
      caption: `Influencer post ${pad(index + 1)} mentioning ${brandName} and ${pick(competitorNames, index)}.`,
      likes: 1000 + index * 120,
      comments: 80 + index * 8,
      views: 10000 + index * 900,
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 7) - 3) / 10).toFixed(2)),
      brand: index % 2 === 0 ? brandName : pick(competitorNames, index),
      posted_at: isoDaysAgo(index % 14, 12),
      url: `https://example.com/${organization.slug}/influencer-posts/${pad(index + 1)}`,
    })),
  );

  const reports = await safeInsert(
    "reports",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      title: `${brandName} Report ${pad(index + 1)}`,
      type: pick(["daily", "weekly", "campaign", "crisis", "custom"], index),
      status: pick(["draft", "ready", "generated"], index),
      date_range_from: isoDaysAgo(30 - (index % 10), 0),
      date_range_to: isoDaysAgo(index % 10, 0),
      filters: {
        keyword: index % 2 === 0 ? brandName : pick(competitorNames, index),
      },
      summary: `Seed report ${pad(index + 1)} for ${brandName}.`,
      asset_urls: [],
      created_by: memberUserId,
    })),
  );

  const tvSegments = await safeInsert(
    "tv_segments",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      channel: `${brandName} TV Channel ${pad(index + 1)}`,
      show_name: `${brandName} Show ${pad(index + 1)}`,
      anchor_name: `Anchor ${pad(index + 1)}`,
      headline: `TV discussion ${pad(index + 1)} about ${brandName}`,
      transcript_snippet: `${brandName} and ${pick(competitorNames, index)} were discussed in TV segment ${pad(index + 1)}.`,
      language: index % 4 === 0 ? "ur" : "en",
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 7) - 3) / 10).toFixed(2)),
      aired_at: isoDaysAgo(index % 10, 18),
    })),
  );

  await safeInsert(
    "tv_segment_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      tv_segment_id: tvSegments[index % tvSegments.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  const newsArticles = await safeInsert(
    "news_articles",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      source_name: `${brandName} News Outlet ${pad(index + 1)}`,
      headline: `News article ${pad(index + 1)} tracks ${brandName}`,
      summary: `Summary ${pad(index + 1)} covering ${brandName} and ${pick(competitorNames, index)}.`,
      body: `Full article ${pad(index + 1)} describing price pressure, trust recovery, and channel distribution for ${brandName}.`,
      language: index % 4 === 0 ? "ur" : "en",
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 9) - 4) / 10).toFixed(2)),
      published_at: isoDaysAgo(index % 15, 9),
      url: `https://example.com/${organization.slug}/news/${pad(index + 1)}`,
    })),
  );

  await safeInsert(
    "news_article_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      news_article_id: newsArticles[index % newsArticles.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  await safeInsert(
    "epaper_clips",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      source_name: `${brandName} E-Paper ${pad(index + 1)}`,
      page_label: `Page ${index + 1}`,
      headline: `E-paper clipping ${pad(index + 1)} for ${brandName}`,
      ocr_text: `OCR text ${pad(index + 1)} mentioning ${brandName} and ${pick(competitorNames, index)}.`,
      language: index % 2 === 0 ? "ur" : "en",
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 7) - 3) / 10).toFixed(2)),
      published_at: isoDaysAgo(index % 20, 7),
      image_url: `https://images.example.com/${organization.slug}-epaper-${pad(index + 1)}.jpg`,
    })),
  );

  const tvChannels = await safeInsert(
    "tv_youtube_channels",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      youtube_channel_id: `${organization.slug}-channel-${pad(index + 1)}`,
      channel_name: `${brandName} YouTube Channel ${pad(index + 1)}`,
      thumbnail_url: `https://images.example.com/${organization.slug}-youtube-channel-${pad(index + 1)}.jpg`,
      channel_url: `https://www.youtube.com/@${organization.slug.replace(/-/g, "")}${pad(index + 1)}`,
      status: pick(tvChannelStatuses, index),
      last_synced_at: isoDaysAgo(index % 7, 6),
      created_by: memberUserId,
    })),
  );

  const tvVideos = await safeInsert(
    "tv_youtube_videos",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      channel_id: tvChannels[index % tvChannels.length]?.id,
      youtube_video_id: `${organization.slug}-video-${pad(index + 1)}`,
      title: `${brandName} YouTube Video ${pad(index + 1)}`,
      thumbnail_url: `https://images.example.com/${organization.slug}-youtube-video-${pad(index + 1)}.jpg`,
      youtube_url: `https://www.youtube.com/watch?v=${organization.slug.replace(/-/g, "")}${pad(index + 1)}`,
      published_at: isoDaysAgo(index % 12, 14),
      duration_iso: `PT${8 + (index % 10)}M${10 + (index % 50)}S`,
      duration_seconds: 480 + index * 9,
      processing_status: pick(tvVideoStatuses, index),
      srt_storage_path: `tv-subtitles/${organization.slug}-video-${pad(index + 1)}.srt`,
      transcript_text: `Transcript ${pad(index + 1)} mentioning ${brandName} and ${pick(competitorNames, index)}.`,
      transcript_language: index % 4 === 0 ? "ur" : "en",
      transcript_version: 1,
      last_processed_at: isoDaysAgo(index % 8, 15),
    })),
  );

  await safeInsert(
    "tv_transcript_segments",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      video_id: tvVideos[index % tvVideos.length]?.id,
      segment_index: index + 1,
      start_sec: index * 12,
      end_sec: index * 12 + 10,
      text: `Transcript segment ${pad(index + 1)} says ${brandName} and ${pick(competitorNames, index)} are trending.`,
      searchable_text: `transcript segment ${pad(index + 1)} says ${brandName.toLowerCase()} and ${pick(competitorNames, index).toLowerCase()} are trending.`,
    })),
  );

  await safeInsert(
    "tv_processing_logs",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      video_id: tvVideos[index % tvVideos.length]?.id,
      channel_id: tvChannels[index % tvChannels.length]?.id,
      job_type: pick(["channel_sync", "video_transcription", "srt_generation", "retry_failed"], index),
      job_status: pick(["queued", "processing", "completed", "failed"], index),
      provider: pick(["youtube", "gemini", "storage"], index),
      error_code: index % 6 === 0 ? "SEED_TIMEOUT" : null,
      error_message: index % 6 === 0 ? "Seeded timeout example" : null,
      payload: { seeded: true },
      attempts: 1 + (index % 3),
    })),
  );

  await safeInsert(
    "organization_watch_terms",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      term: index === 0 ? brandName : index < competitorNames.length + 1 ? competitorNames[index - 1] : `${organization.slug}-watch-${pad(index + 1)}`,
      term_type: index === 0 ? "brand" : index < competitorNames.length + 1 ? "competitor" : "keyword",
      language: index % 3 === 0 ? "ur" : "en",
      is_active: index % 5 !== 0,
      metadata: { seeded: true },
      created_by: memberUserId,
    })),
  );

  await safeInsert(
    "media_keyword_daily_stats",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      keyword: index % 3 === 0 ? brandName : index % 3 === 1 ? pick(competitorNames, index) : `theme-${pad(index + 1)}`,
      source_kind: pick(["tv", "news", "epaper", "all"], index),
      bucket_date: asDateOnly(index % 20),
      occurrence_count: 5 + index,
      document_count: 2 + (index % 6),
      channel_count: 1 + (index % 4),
      trend_score: Number((1 + index * 0.2).toFixed(2)),
      metadata: { seeded: true },
    })),
  );

  const schedules = await safeInsert(
    "organization_summary_schedules",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `${brandName} Summary Schedule ${pad(index + 1)}`,
      frequency: pick(summaryFrequencies, index),
      delivery_channels: [pick(deliveryChannels, index), "app"],
      hour_of_day: index % 24,
      day_of_week: index % 7,
      is_active: index % 5 !== 0,
      recipients: {
        emails: [],
      },
      last_run_at: isoDaysAgo(index % 5, 9),
      next_run_at: isoDaysAhead((index % 5) + 1, 9),
      metadata: { seeded: true },
      created_by: memberUserId,
    })),
  );

  await safeInsert(
    "summary_dispatch_logs",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      schedule_id: schedules[index % schedules.length]?.id,
      channel: pick(deliveryChannels, index),
      recipient: null,
      subject: `${brandName} Dispatch ${pad(index + 1)}`,
      body: `Summary dispatch ${pad(index + 1)} for ${brandName}.`,
      delivery_status: pick(["queued", "delivered", "failed", "skipped"], index),
      meta: { seeded: true },
    })),
  );

  return {
    organizationId,
    organizationName: organization.name,
    counts: {
      mentions: mentions.length,
      narratives: narratives.length,
      alerts: alerts.length,
      campaigns: campaigns.length,
      influencers: influencers.length,
      reports: reports.length,
      tvSegments: tvSegments.length,
      newsArticles: newsArticles.length,
    },
  };
}

async function main() {
  console.log(`\nSeeding ${rowCount} rows into every organization workspace...\n`);

  const organizations = await getOrganizations();
  const members = await getOrganizationMembers();
  const fallbackSeederUserId = await getFallbackSeederUserId();
  const firstMemberByOrganization = new Map();

  for (const member of members) {
    if (!firstMemberByOrganization.has(member.organization_id)) {
      firstMemberByOrganization.set(member.organization_id, member.user_id);
    }
  }

  const results = [];
  for (const organization of organizations) {
    const memberUserId = firstMemberByOrganization.get(organization.id) || fallbackSeederUserId;

    console.log(
      firstMemberByOrganization.has(organization.id)
        ? `Seeding ${organization.name}...`
        : `Seeding ${organization.name} with fallback seeder...`,
    );
    const result = await seedOrganization(organization, memberUserId);
    results.push(result);
  }

  console.log("\nSeed complete:\n");
  for (const result of results) {
    console.log(
      `${result.organizationName}: mentions=${result.counts.mentions}, narratives=${result.counts.narratives}, alerts=${result.counts.alerts}, influencers=${result.counts.influencers}, tv=${result.counts.tvSegments}, news=${result.counts.newsArticles}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
