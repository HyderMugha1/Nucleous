#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetEmail = (process.env.SEED_EMAIL || "admin@nucleus.local").toLowerCase();
const rowCount = Number(process.env.SEED_ROW_COUNT || 20);
const seedUserPrefix = "seed.user.";
const seedUserDomain = "nucleus.local";
const seedOrgSlugPrefix = "seed-org-";

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

const optionalWarnings = [];

const alertSeverities = ["low", "medium", "high", "critical"];
const alertStatuses = ["open", "acknowledged", "resolved"];
const campaignStatuses = ["draft", "active", "completed", "archived"];
const narrativeStatuses = ["active", "watching", "closed"];
const sentiments = ["positive", "neutral", "negative"];
const platforms = ["TV", "News", "E-Paper", "YouTube", "Instagram", "LinkedIn", "TikTok", "Website", "Facebook", "Twitter/X"];
const sourceTypes = ["tv", "news", "epaper", "influencer", "web", "social"];
const crisisStatuses = ["monitoring", "active", "contained", "resolved"];
const reportTypes = ["daily", "weekly", "campaign", "crisis", "quarterly", "custom"];
const reportStatuses = ["draft", "ready", "generated", "archived"];
const deliveryChannels = ["email", "app", "whatsapp", "sms"];
const membershipRoles = ["owner", "admin", "manager", "analyst", "executive"];
const entityTypes = ["brand", "competitor", "person", "institution", "regulator", "campaign", "topic"];
const sourceStatuses = ["active", "paused", "error"];
const watchStatuses = ["active", "paused", "archived"];
const alertRuleTypes = ["volume_spike", "negative_sentiment", "new_narrative", "crisis_keyword"];
const contentTypes = ["post", "article", "transcript", "clip", "reel", "video"];
const trendDirections = ["rising", "falling", "stable"];
const windows = ["hourly", "daily", "weekly"];
const aiContextTypes = ["dashboard", "report", "campaign", "crisis"];
const aiMessageRoles = ["user", "assistant", "system"];
const notificationStatuses = ["unread", "read", "archived"];
const inquiryTypes = ["general", "demo", "security", "onboarding"];
const inquiryStatuses = ["new", "reviewed", "resolved"];
const savedViewContexts = ["dashboard", "mentions", "narratives", "competitors", "reports", "campaigns", "crisis"];
const ingestTypes = ["crawler", "api_pull", "ocr", "transcript", "manual_import"];
const ingestStatuses = ["queued", "running", "completed", "failed"];
const tvChannelStatuses = ["active", "paused", "error"];
const tvVideoStatuses = ["pending", "queued", "processing", "completed", "failed"];
const tvJobTypes = ["channel_sync", "video_transcription", "srt_generation", "retry_failed"];
const tvJobStatuses = ["queued", "processing", "completed", "failed"];
const watchTermTypes = ["brand", "competitor", "keyword"];
const summaryFrequencies = ["daily", "weekly"];

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
  if (error && missingTable(error)) {
    optionalWarnings.push(`Skipped missing table ${table}`);
  }
}

async function safeInsert(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) {
    if (missingTable(error)) {
      optionalWarnings.push(`Skipped missing table ${table}`);
      return [];
    }
    throw new Error(`Unable to insert into ${table}: ${error.message}`);
  }
  return data || [];
}

async function safeCount(table, filterBuilder) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filterBuilder) {
    query = filterBuilder(query);
  }
  const { count, error } = await query;
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(`Unable to count ${table}: ${error.message}`);
  }
  return count || 0;
}

async function loadWorkspace() {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, default_organization_id")
    .eq("email", targetEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load admin profile: ${profileError.message}`);
  }
  if (!profile?.default_organization_id) {
    throw new Error(`No default workspace found for ${targetEmail}`);
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, competitor_names")
    .eq("id", profile.default_organization_id)
    .maybeSingle();

  if (organizationError) {
    throw new Error(`Unable to load admin organization: ${organizationError.message}`);
  }
  if (!organization) {
    throw new Error(`Workspace ${profile.default_organization_id} not found`);
  }

  return {
    adminUserId: profile.user_id,
    adminName: profile.full_name,
    organization,
  };
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }
    const pageUsers = data?.users || [];
    users.push(...pageUsers);
    if (pageUsers.length < 200) break;
    page += 1;
  }
  return users;
}

async function cleanupSeedAuthUsers() {
  const users = await listAllAuthUsers();
  const seedUsers = users.filter((user) => {
    const email = String(user.email || "").toLowerCase();
    return email.startsWith(seedUserPrefix) && email.endsWith(`@${seedUserDomain}`);
  });

  for (const user of seedUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`Unable to delete old seed auth user ${user.email}: ${error.message}`);
    }
  }
}

async function cleanupSeedOrganizations() {
  const { data: orgs, error } = await supabase
    .from("organizations")
    .select("id")
    .like("slug", `${seedOrgSlugPrefix}%`);

  if (error) {
    throw new Error(`Unable to load old seed organizations: ${error.message}`);
  }

  for (const org of orgs || []) {
    const { error: deleteError } = await supabase.from("organizations").delete().eq("id", org.id);
    if (deleteError) {
      throw new Error(`Unable to delete seed organization ${org.id}: ${deleteError.message}`);
    }
  }
}

async function createSeedUsers(total) {
  const createdUsers = [];

  for (const index of range(total)) {
    const email = `${seedUserPrefix}${pad(index + 1)}@${seedUserDomain}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: "SeedPass123!",
      email_confirm: true,
      user_metadata: {
        full_name: `Seed User ${pad(index + 1)}`,
      },
    });

    if (error) {
      throw new Error(`Unable to create auth user ${email}: ${error.message}`);
    }

    createdUsers.push({
      id: data.user.id,
      email,
      fullName: `Seed User ${pad(index + 1)}`,
      contactNumber: `0300${String(index + 1).padStart(7, "0")}`,
    });
  }

  return createdUsers;
}

async function createSeedOrganizations(total, adminUserId) {
  return safeInsert(
    "organizations",
    range(total).map((index) => ({
      name: `Seed Organization ${pad(index + 1)}`,
      slug: `${seedOrgSlugPrefix}${pad(index + 1)}`,
      industry: pick(["Telecom", "Retail", "Finance", "FMCG", "Technology"], index),
      country: pick(["Pakistan", "UAE", "Saudi Arabia", "Qatar", "UK"], index),
      subscription_plan: pick(["trial", "growth", "enterprise"], index),
      status: pick(["active", "trial", "inactive"], index),
      competitor_names: [`Rival ${pad(index + 1)}A`, `Rival ${pad(index + 1)}B`],
      created_by: adminUserId,
    })),
  );
}

async function main() {
  console.log(`\nCreating ${rowCount}+ dummy rows across the database for ${targetEmail}\n`);

  const { adminUserId, organization } = await loadWorkspace();
  const organizationId = organization.id;
  const brandName = organization.name.replace(/\s*workspace/i, "").trim() || organization.name;

  await cleanupSeedAuthUsers();
  await cleanupSeedOrganizations();

  const orgCleanupTables = [
    "summary_dispatch_logs",
    "organization_summary_schedules",
    "media_keyword_daily_stats",
    "organization_watch_terms",
    "tv_processing_logs",
    "tv_transcript_segments",
    "tv_youtube_videos",
    "tv_youtube_channels",
    "ai_messages",
    "ai_conversations",
    "influencer_post_entities",
    "influencer_posts",
    "influencers",
    "crisis_mentions",
    "crisis_narratives",
    "crisis_entities",
    "crisis_incidents",
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
    "ingestion_jobs",
    "audit_logs",
    "contact_inquiries",
    "reports",
    "organization_invitations",
    "entities",
    "sources",
    "saved_views",
    "app_notifications",
    "notification_preferences",
  ];

  for (const table of orgCleanupTables) {
    await safeDelete(table, (query) => query.eq("organization_id", organizationId));
  }
  await safeDelete("todos", (query) => query.like("name", "Seed todo %"));

  const createdUsers = await createSeedUsers(rowCount);
  const createdOrgs = await createSeedOrganizations(rowCount, adminUserId);

  await safeInsert(
    "profiles",
    createdUsers.map((user) => ({
      user_id: user.id,
      full_name: user.fullName,
      email: user.email,
      contact_number: user.contactNumber,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.fullName)}`,
      preferred_login_provider: "email",
      status: "active",
      default_organization_id: organizationId,
      last_login_at: isoDaysAgo(0, 10),
    })),
  );

  await safeInsert(
    "organization_members",
    createdUsers.map((user, index) => ({
      organization_id: organizationId,
      user_id: user.id,
      role: pick(membershipRoles, index),
      status: "active",
      joined_at: isoDaysAgo(index % 10, 9),
      invited_by: adminUserId,
    })),
  );

  await safeInsert(
    "organization_invitations",
    createdUsers.map((user, index) => ({
      organization_id: organizationId,
      email: `invite.${pad(index + 1)}@${seedUserDomain}`,
      role: pick(membershipRoles, index + 1),
      status: "invited",
      invited_by: adminUserId,
      expires_at: isoDaysAhead(7 + index, 12),
    })),
  );

  await safeInsert(
    "notification_preferences",
    createdUsers.map((user, index) => ({
      organization_id: organizationId,
      user_id: user.id,
      email_enabled: true,
      app_enabled: true,
      whatsapp_enabled: index % 2 === 0,
      sms_enabled: index % 3 === 0,
      quiet_hours: {
        start: "23:00",
        end: "07:00",
      },
    })),
  );

  await safeInsert(
    "app_notifications",
    createdUsers.map((user, index) => ({
      organization_id: organizationId,
      user_id: user.id,
      title: `Seed Alert ${pad(index + 1)}`,
      message: `Notification ${pad(index + 1)} for ${brandName} intelligence workspace.`,
      notification_type: pick(["media", "alert", "report", "system"], index),
      status: pick(notificationStatuses, index),
      payload: {
        seeded: true,
        rank: index + 1,
      },
      read_at: index % 3 === 0 ? isoDaysAgo(index % 5, 18) : null,
    })),
  );

  await safeInsert(
    "saved_views",
    createdUsers.map((user, index) => ({
      organization_id: organizationId,
      user_id: user.id,
      context: pick(savedViewContexts, index),
      name: `Seed View ${pad(index + 1)}`,
      layout_config: {
        density: index % 2 === 0 ? "comfortable" : "compact",
      },
      filter_config: {
        sentiment: pick(sentiments, index),
      },
      is_default: false,
    })),
  );

  const sources = await safeInsert(
    "sources",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `Seed Source ${pad(index + 1)}`,
      source_type: pick(sourceTypes, index),
      platform: pick(platforms, index),
      url: `https://example.com/source/${pad(index + 1)}`,
      language: index % 3 === 0 ? "ur" : "en",
      country: pick(["Pakistan", "UAE", "Saudi Arabia", "Qatar"], index),
      status: pick(sourceStatuses, index),
      last_ingested_at: isoDaysAgo(index % 7, 8 + (index % 10)),
    })),
  );

  const competitorNames = organization.competitor_names?.length
    ? organization.competitor_names
    : ["Pulse Metrics", "Signal Watch", "Market Vista", "Echo Track"];

  const entities = await safeInsert(
    "entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name:
        index === 0
          ? brandName
          : index < competitorNames.length + 1
            ? competitorNames[index - 1]
            : `Seed Entity ${pad(index + 1)}`,
      type: index === 0 ? "brand" : index < competitorNames.length + 1 ? "competitor" : pick(entityTypes, index + 1),
      aliases: [`Alias ${pad(index + 1)}A`, `Alias ${pad(index + 1)}B`],
      keywords: [`keyword-${pad(index + 1)}`, "media", "trend"],
      platform_links: [`https://example.com/entity/${pad(index + 1)}`],
      is_competitor: index > 0 && index < competitorNames.length + 1,
      watch_status: pick(watchStatuses, index),
      created_by: adminUserId,
    })),
  );

  const campaigns = await safeInsert(
    "campaigns",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `Seed Campaign ${pad(index + 1)}`,
      description: `Campaign ${pad(index + 1)} monitoring ${brandName} and category pressure.`,
      status: pick(campaignStatuses, index),
      goal: `Goal ${pad(index + 1)}: optimize brand visibility and competitor monitoring.`,
      start_date: isoDaysAgo(40 - index, 9),
      end_date: isoDaysAhead((index % 20) + 1, 18),
      owner_user_id: createdUsers[index % createdUsers.length].id,
      kpis: {
        reach: 100000 + index * 5000,
        sentimentGoal: 0.5,
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
      title: `Seed Narrative ${pad(index + 1)}`,
      summary: `Narrative ${pad(index + 1)} tracks how ${brandName} and peers are framed across channels.`,
      keywords: [brandName, pick(competitorNames, index), `theme-${pad(index + 1)}`],
      sentiment: pick(sentiments, index),
      trend: pick(trendDirections, index),
      mention_count: 12 + index,
      momentum_score: 40 + index * 1.7,
      risk_score: 15 + index * 1.3,
      status: pick(narrativeStatuses, index),
      first_detected_at: isoDaysAgo(25 - (index % 10), 8),
      last_detected_at: isoDaysAgo(index % 5, 20),
    })),
  );

  await safeInsert(
    "narrative_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      narrative_id: narratives[index % narratives.length]?.id,
      entity_id: entities[(index + 2) % entities.length]?.id,
    })),
  );

  const crisisIncidents = await safeInsert(
    "crisis_incidents",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      title: `Seed Crisis ${pad(index + 1)}`,
      summary: `Potential issue ${pad(index + 1)} affecting ${brandName} reputation tracking.`,
      severity: pick(alertSeverities, index),
      status: pick(crisisStatuses, index),
      response_owner_user_id: createdUsers[index % createdUsers.length].id,
      opened_at: isoDaysAgo(18 - (index % 10), 11),
      resolved_at: index % 4 === 0 ? isoDaysAgo(index % 3, 17) : null,
    })),
  );

  const mentions = await safeInsert(
    "mentions",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      crisis_incident_id: crisisIncidents[index % crisisIncidents.length]?.id,
      content_type: pick(contentTypes, index),
      platform: pick(platforms, index),
      source_type: pick(sourceTypes, index),
      headline: `Seed Mention ${pad(index + 1)} for ${brandName}`,
      body: `${brandName} appeared alongside ${pick(competitorNames, index)} while analysts discussed trend ${pad(index + 1)} and market confidence.`,
      snippet: `Snippet ${pad(index + 1)} referencing ${brandName} and ${pick(competitorNames, index)}.`,
      author_name: `Reporter ${pad(index + 1)}`,
      channel_or_publisher: `Publisher ${pad(index + 1)}`,
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
      url: `https://example.com/mentions/${pad(index + 1)}`,
      media_urls: [`https://images.example.com/mention-${pad(index + 1)}.jpg`],
      tags: ["seeded", pick(["brand", "competitor", "trend"], index)],
      raw_ingestion_id: `seed-mention-${pad(index + 1)}`,
      metadata: {
        seeded: true,
      },
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
      window: pick(windows, index),
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
      name: `Seed Alert Rule ${pad(index + 1)}`,
      type: pick(alertRuleTypes, index),
      threshold_value: 5 + index,
      threshold_window: pick(["1h", "6h", "24h", "7d"], index),
      delivery_channels: [pick(deliveryChannels, index), "app"],
      status: index % 5 === 0 ? "paused" : "active",
      created_by: adminUserId,
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
      message: `Alert ${pad(index + 1)} triggered for ${brandName} monitoring.`,
      status: pick(alertStatuses, index),
      delivery_channels: [pick(deliveryChannels, index), "app"],
      triggered_at: isoDaysAgo(index % 10, 13),
      acknowledged_by: index % 3 === 0 ? createdUsers[index % createdUsers.length].id : null,
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

  await safeInsert(
    "crisis_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      crisis_incident_id: crisisIncidents[index % crisisIncidents.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  await safeInsert(
    "crisis_narratives",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      crisis_incident_id: crisisIncidents[index % crisisIncidents.length]?.id,
      narrative_id: narratives[index % narratives.length]?.id,
    })),
  );

  await safeInsert(
    "crisis_mentions",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      crisis_incident_id: crisisIncidents[index % crisisIncidents.length]?.id,
      mention_id: mentions[index % mentions.length]?.id,
    })),
  );

  const influencers = await safeInsert(
    "influencers",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `Seed Influencer ${pad(index + 1)}`,
      handle: `@seedinfluencer${pad(index + 1)}`,
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
      profile_url: `https://example.com/influencers/${pad(index + 1)}`,
    })),
  );

  const influencerPosts = await safeInsert(
    "influencer_posts",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      influencer_id: influencers[index % influencers.length]?.id,
      campaign_id: campaigns[index % campaigns.length]?.id,
      platform: pick(["YouTube", "Instagram", "TikTok", "LinkedIn"], index),
      caption: `Influencer post ${pad(index + 1)} mentioning ${brandName} and ${pick(competitorNames, index)} trends.`,
      likes: 1000 + index * 120,
      comments: 80 + index * 8,
      views: 10000 + index * 900,
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 7) - 3) / 10).toFixed(2)),
      brand: index % 2 === 0 ? brandName : pick(competitorNames, index),
      posted_at: isoDaysAgo(index % 14, 12),
      url: `https://example.com/influencer-posts/${pad(index + 1)}`,
    })),
  );

  await safeInsert(
    "influencer_post_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      influencer_post_id: influencerPosts[index % influencerPosts.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  const reports = await safeInsert(
    "reports",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      title: `Seed Report ${pad(index + 1)}`,
      type: pick(reportTypes, index),
      status: pick(reportStatuses, index),
      date_range_from: isoDaysAgo(30 - (index % 10), 0),
      date_range_to: isoDaysAgo(index % 10, 0),
      filters: {
        keyword: index % 2 === 0 ? brandName : pick(competitorNames, index),
      },
      summary: `Report ${pad(index + 1)} summarizing how ${brandName} and competitors moved across tracked channels.`,
      asset_urls: [],
      created_by: createdUsers[index % createdUsers.length].id,
    })),
  );

  const aiConversations = await safeInsert(
    "ai_conversations",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      user_id: createdUsers[index % createdUsers.length].id,
      context_type: pick(aiContextTypes, index),
      context_ref_id: index % 2 === 0 ? reports[index % reports.length]?.id : null,
      title: `Seed AI Conversation ${pad(index + 1)}`,
    })),
  );

  await safeInsert(
    "ai_messages",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      conversation_id: aiConversations[index % aiConversations.length]?.id,
      role: pick(aiMessageRoles, index),
      content: `AI message ${pad(index + 1)} discussing ${brandName}, ${pick(competitorNames, index)}, and media momentum.`,
    })),
  );

  const tvSegments = await safeInsert(
    "tv_segments",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      channel: `Seed TV Channel ${pad(index + 1)}`,
      show_name: `Seed Show ${pad(index + 1)}`,
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
      source_name: `Seed News Outlet ${pad(index + 1)}`,
      headline: `News article ${pad(index + 1)} tracks ${brandName}`,
      summary: `Summary ${pad(index + 1)} covering ${brandName} and ${pick(competitorNames, index)}.`,
      body: `Full article ${pad(index + 1)} describing price pressure, trust recovery, and channel distribution for ${brandName}.`,
      language: index % 4 === 0 ? "ur" : "en",
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 9) - 4) / 10).toFixed(2)),
      published_at: isoDaysAgo(index % 15, 9),
      url: `https://example.com/news/${pad(index + 1)}`,
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

  const epaperClips = await safeInsert(
    "epaper_clips",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      source_name: `Seed E-Paper ${pad(index + 1)}`,
      page_label: `Page ${index + 1}`,
      headline: `E-paper clipping ${pad(index + 1)} for ${brandName}`,
      ocr_text: `OCR text ${pad(index + 1)} mentioning ${brandName} and ${pick(competitorNames, index)} in a printed summary.`,
      language: index % 2 === 0 ? "ur" : "en",
      sentiment_label: pick(sentiments, index),
      sentiment_score: Number((((index % 7) - 3) / 10).toFixed(2)),
      published_at: isoDaysAgo(index % 20, 7),
      image_url: `https://images.example.com/epaper-${pad(index + 1)}.jpg`,
    })),
  );

  await safeInsert(
    "epaper_clip_entities",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      epaper_clip_id: epaperClips[index % epaperClips.length]?.id,
      entity_id: entities[index % entities.length]?.id,
    })),
  );

  await safeInsert(
    "ingestion_jobs",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      source_id: sources[index % sources.length]?.id,
      type: pick(ingestTypes, index),
      status: pick(ingestStatuses, index),
      processed_count: 50 + index * 5,
      error_message: index % 5 === 0 ? "Transient parsing timeout" : null,
      started_at: isoDaysAgo(index % 6, 2),
      finished_at: isoDaysAgo(index % 6, 3),
      metadata: {
        seeded: true,
      },
    })),
  );

  await safeInsert(
    "audit_logs",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      user_id: createdUsers[index % createdUsers.length].id,
      action: pick(["created", "updated", "deleted", "acknowledged"], index),
      entity_type: pick(["mention", "alert", "report", "campaign"], index),
      entity_id: mentions[index % mentions.length]?.id,
      meta: {
        seeded: true,
        source: "seed-demo-data",
      },
    })),
  );

  await safeInsert(
    "contact_inquiries",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      full_name: `Inquiry User ${pad(index + 1)}`,
      email: `inquiry.${pad(index + 1)}@${seedUserDomain}`,
      company: `Company ${pad(index + 1)}`,
      contact_number: `0311${String(index + 1).padStart(7, "0")}`,
      inquiry_type: pick(inquiryTypes, index),
      message: `Inquiry ${pad(index + 1)} asking about ${brandName} media intelligence onboarding.`,
      status: pick(inquiryStatuses, index),
    })),
  );

  await safeInsert(
    "todos",
    range(rowCount).map((index) => ({
      name: `Seed todo ${pad(index + 1)}`,
      is_complete: index % 2 === 0,
    })),
  );

  const tvChannels = await safeInsert(
    "tv_youtube_channels",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      youtube_channel_id: `seed-channel-${pad(index + 1)}`,
      channel_name: `Seed YouTube Channel ${pad(index + 1)}`,
      thumbnail_url: `https://images.example.com/youtube-channel-${pad(index + 1)}.jpg`,
      channel_url: `https://www.youtube.com/@seedchannel${pad(index + 1)}`,
      status: pick(tvChannelStatuses, index),
      last_synced_at: isoDaysAgo(index % 7, 6),
      created_by: adminUserId,
    })),
  );

  const tvVideos = await safeInsert(
    "tv_youtube_videos",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      channel_id: tvChannels[index % tvChannels.length]?.id,
      youtube_video_id: `seed-video-${pad(index + 1)}`,
      title: `Seed YouTube Video ${pad(index + 1)} about ${brandName}`,
      thumbnail_url: `https://images.example.com/youtube-video-${pad(index + 1)}.jpg`,
      youtube_url: `https://www.youtube.com/watch?v=seedvideo${pad(index + 1)}`,
      published_at: isoDaysAgo(index % 12, 14),
      duration_iso: `PT${8 + (index % 10)}M${10 + (index % 50)}S`,
      duration_seconds: 480 + index * 9,
      processing_status: pick(tvVideoStatuses, index),
      srt_storage_path: `tv-subtitles/seed-video-${pad(index + 1)}.srt`,
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
      job_type: pick(tvJobTypes, index),
      job_status: pick(tvJobStatuses, index),
      provider: pick(["youtube", "gemini", "storage"], index),
      error_code: index % 6 === 0 ? "SEED_TIMEOUT" : null,
      error_message: index % 6 === 0 ? "Seeded timeout example" : null,
      payload: {
        seeded: true,
      },
      attempts: 1 + (index % 3),
    })),
  );

  await safeInsert(
    "organization_watch_terms",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      term: index === 0 ? brandName : index < competitorNames.length + 1 ? competitorNames[index - 1] : `watch-term-${pad(index + 1)}`,
      term_type: index === 0 ? "brand" : index < competitorNames.length + 1 ? "competitor" : pick(watchTermTypes, index + 2),
      language: index % 3 === 0 ? "ur" : "en",
      is_active: index % 5 !== 0,
      metadata: {
        seeded: true,
      },
      created_by: adminUserId,
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
      metadata: {
        seeded: true,
      },
    })),
  );

  const schedules = await safeInsert(
    "organization_summary_schedules",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      name: `Seed Summary Schedule ${pad(index + 1)}`,
      frequency: pick(summaryFrequencies, index),
      delivery_channels: [pick(deliveryChannels, index), "app"],
      hour_of_day: index % 24,
      day_of_week: index % 7,
      is_active: index % 5 !== 0,
      recipients: {
        emails: [createdUsers[index % createdUsers.length].email],
      },
      last_run_at: isoDaysAgo(index % 5, 9),
      next_run_at: isoDaysAhead((index % 5) + 1, 9),
      metadata: {
        seeded: true,
      },
      created_by: adminUserId,
    })),
  );

  await safeInsert(
    "summary_dispatch_logs",
    range(rowCount).map((index) => ({
      organization_id: organizationId,
      schedule_id: schedules[index % schedules.length]?.id,
      channel: pick(deliveryChannels, index),
      recipient: createdUsers[index % createdUsers.length].email,
      subject: `Seed Dispatch ${pad(index + 1)}`,
      body: `Summary dispatch ${pad(index + 1)} for ${brandName} intelligence.`,
      delivery_status: pick(["queued", "delivered", "failed", "skipped"], index),
      meta: {
        seeded: true,
      },
    })),
  );

  const verification = [
    ["organizations", null],
    ["profiles", (query) => query.like("email", `${seedUserPrefix}%@${seedUserDomain}`)],
    ["organization_members", (query) => query.eq("organization_id", organizationId)],
    ["organization_invitations", (query) => query.eq("organization_id", organizationId)],
    ["notification_preferences", (query) => query.eq("organization_id", organizationId)],
    ["app_notifications", (query) => query.eq("organization_id", organizationId)],
    ["saved_views", (query) => query.eq("organization_id", organizationId)],
    ["sources", (query) => query.eq("organization_id", organizationId)],
    ["entities", (query) => query.eq("organization_id", organizationId)],
    ["campaigns", (query) => query.eq("organization_id", organizationId)],
    ["campaign_entities", (query) => query.eq("organization_id", organizationId)],
    ["narratives", (query) => query.eq("organization_id", organizationId)],
    ["narrative_entities", (query) => query.eq("organization_id", organizationId)],
    ["mentions", (query) => query.eq("organization_id", organizationId)],
    ["mention_entities", (query) => query.eq("organization_id", organizationId)],
    ["mention_narratives", (query) => query.eq("organization_id", organizationId)],
    ["mention_campaigns", (query) => query.eq("organization_id", organizationId)],
    ["mention_trends", (query) => query.eq("organization_id", organizationId)],
    ["sentiment_snapshots", (query) => query.eq("organization_id", organizationId)],
    ["alert_rules", (query) => query.eq("organization_id", organizationId)],
    ["alert_rule_entities", (query) => query.eq("organization_id", organizationId)],
    ["alert_rule_narratives", (query) => query.eq("organization_id", organizationId)],
    ["alerts", (query) => query.eq("organization_id", organizationId)],
    ["alert_entities", (query) => query.eq("organization_id", organizationId)],
    ["alert_narratives", (query) => query.eq("organization_id", organizationId)],
    ["crisis_incidents", (query) => query.eq("organization_id", organizationId)],
    ["crisis_entities", (query) => query.eq("organization_id", organizationId)],
    ["crisis_narratives", (query) => query.eq("organization_id", organizationId)],
    ["crisis_mentions", (query) => query.eq("organization_id", organizationId)],
    ["influencers", (query) => query.eq("organization_id", organizationId)],
    ["influencer_posts", (query) => query.eq("organization_id", organizationId)],
    ["influencer_post_entities", (query) => query.eq("organization_id", organizationId)],
    ["reports", (query) => query.eq("organization_id", organizationId)],
    ["ai_conversations", (query) => query.eq("organization_id", organizationId)],
    ["ai_messages", (query) => query.eq("organization_id", organizationId)],
    ["tv_segments", (query) => query.eq("organization_id", organizationId)],
    ["tv_segment_entities", (query) => query.eq("organization_id", organizationId)],
    ["news_articles", (query) => query.eq("organization_id", organizationId)],
    ["news_article_entities", (query) => query.eq("organization_id", organizationId)],
    ["epaper_clips", (query) => query.eq("organization_id", organizationId)],
    ["epaper_clip_entities", (query) => query.eq("organization_id", organizationId)],
    ["ingestion_jobs", (query) => query.eq("organization_id", organizationId)],
    ["audit_logs", (query) => query.eq("organization_id", organizationId)],
    ["contact_inquiries", (query) => query.eq("organization_id", organizationId)],
    ["todos", (query) => query.like("name", "Seed todo %")],
    ["tv_youtube_channels", (query) => query.eq("organization_id", organizationId)],
    ["tv_youtube_videos", (query) => query.eq("organization_id", organizationId)],
    ["tv_transcript_segments", (query) => query.eq("organization_id", organizationId)],
    ["tv_processing_logs", (query) => query.eq("organization_id", organizationId)],
    ["organization_watch_terms", (query) => query.eq("organization_id", organizationId)],
    ["media_keyword_daily_stats", (query) => query.eq("organization_id", organizationId)],
    ["organization_summary_schedules", (query) => query.eq("organization_id", organizationId)],
    ["summary_dispatch_logs", (query) => query.eq("organization_id", organizationId)],
  ];

  console.log(`\nVerification counts (target >= ${rowCount}):`);
  for (const [table, filterBuilder] of verification) {
    const count = await safeCount(table, filterBuilder);
    if (count === null) {
      console.log(`- ${table}: missing remotely`);
    } else {
      console.log(`- ${table}: ${count}`);
    }
  }

  if (optionalWarnings.length) {
    console.log("\nWarnings:");
    for (const warning of [...new Set(optionalWarnings)]) {
      console.log(`- ${warning}`);
    }
  }

  console.log("\nFull dummy-data seed complete.");
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`);
  process.exit(1);
});
