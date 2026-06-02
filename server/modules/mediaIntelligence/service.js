import { supabaseAdmin } from "../../supabase.js";

function normalizeTerm(term) {
  return String(term || "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text, query) {
  const haystack = String(text || "");
  const needle = normalizeTerm(query);
  if (!haystack || !needle) return 0;
  const matches = haystack.match(new RegExp(escapeRegExp(needle), "gi"));
  return matches ? matches.length : 0;
}

function toIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function buildRange(days = 7) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - Math.max(0, days - 1));
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function inDateRange(value, from, to) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

async function fetchOrganizationContext(organizationId) {
  const [{ data: organization }, { data: competitorEntities }, { data: watchTerms }] = await Promise.all([
    supabaseAdmin.from("organizations").select("id, name, competitor_names").eq("id", organizationId).single(),
    supabaseAdmin.from("entities").select("name").eq("organization_id", organizationId).eq("is_competitor", true),
    supabaseAdmin
      .from("organization_watch_terms")
      .select("id, term, normalized_term, term_type, language, is_active, metadata, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  if (!organization) {
    throw new Error("Organization not found");
  }

  return {
    organization,
    competitorEntities: competitorEntities || [],
    watchTerms: watchTerms || [],
  };
}

function buildTrackedTerms(context) {
  const brandMap = new Map();
  const competitorMap = new Map();
  const keywordMap = new Map();

  const addTerm = (map, term, termType, metadata = {}) => {
    const normalized = normalizeTerm(term);
    if (!normalized) return;
    if (!map.has(normalized)) {
      map.set(normalized, {
        term: String(term).trim(),
        normalizedTerm: normalized,
        termType,
        metadata,
      });
    }
  };

  addTerm(brandMap, context.organization.name, "brand", { source: "organization.name" });

  for (const competitorName of context.organization.competitor_names || []) {
    addTerm(competitorMap, competitorName, "competitor", { source: "organization.competitor_names" });
  }

  for (const competitor of context.competitorEntities) {
    addTerm(competitorMap, competitor.name, "competitor", { source: "entities" });
  }

  for (const watchTerm of context.watchTerms) {
    if (!watchTerm.is_active) continue;
    const targetMap =
      watchTerm.term_type === "brand"
        ? brandMap
        : watchTerm.term_type === "competitor"
          ? competitorMap
          : keywordMap;
    addTerm(targetMap, watchTerm.term, watchTerm.term_type, { source: "watch_terms", watchTermId: watchTerm.id });
  }

  return [...brandMap.values(), ...competitorMap.values(), ...keywordMap.values()];
}

async function fetchTvMatches(organizationId, normalizedTerm, from, to) {
  const { data, error } = await supabaseAdmin
    .from("tv_transcript_segments")
    .select("id, text, searchable_text, start_sec, video_id, tv_youtube_videos!inner(id, title, published_at, tv_youtube_channels(channel_name))")
    .eq("organization_id", organizationId)
    .ilike("searchable_text", `%${normalizedTerm}%`)
    .limit(1000);

  if (error) {
    if (error.message?.includes("tv_transcript_segments")) return [];
    throw new Error(error.message);
  }

  return (data || [])
    .filter((row) => inDateRange(row.tv_youtube_videos?.published_at, from, to))
    .map((row) => ({
      sourceKind: "tv",
      date: row.tv_youtube_videos?.published_at,
      documentKey: `tv:${row.video_id}`,
      sourceName: row.tv_youtube_videos?.tv_youtube_channels?.channel_name || "Unknown channel",
      occurrenceCount: countOccurrences(row.text || row.searchable_text, normalizedTerm),
    }))
    .filter((row) => row.occurrenceCount > 0);
}

async function fetchNewsMatches(organizationId, normalizedTerm, from, to) {
  const [articlesResult, epaperResult] = await Promise.all([
    supabaseAdmin
      .from("news_articles")
      .select("id, source_name, headline, summary, body, published_at")
      .eq("organization_id", organizationId)
      .or(`headline.ilike.%${normalizedTerm}%,summary.ilike.%${normalizedTerm}%,body.ilike.%${normalizedTerm}%`)
      .limit(500),
    supabaseAdmin
      .from("epaper_clips")
      .select("id, source_name, headline, ocr_text, published_at")
      .eq("organization_id", organizationId)
      .or(`headline.ilike.%${normalizedTerm}%,ocr_text.ilike.%${normalizedTerm}%`)
      .limit(500),
  ]);

  if (articlesResult.error) throw new Error(articlesResult.error.message);
  if (epaperResult.error) throw new Error(epaperResult.error.message);

  const articles = (articlesResult.data || [])
    .filter((row) => inDateRange(row.published_at, from, to))
    .map((row) => {
      const text = [row.headline, row.summary, row.body].filter(Boolean).join(" ");
      return {
        sourceKind: "news",
        date: row.published_at,
        documentKey: `news:${row.id}`,
        sourceName: row.source_name || "Unknown source",
        occurrenceCount: countOccurrences(text, normalizedTerm),
      };
    })
    .filter((row) => row.occurrenceCount > 0);

  const epaper = (epaperResult.data || [])
    .filter((row) => inDateRange(row.published_at, from, to))
    .map((row) => {
      const text = [row.headline, row.ocr_text].filter(Boolean).join(" ");
      return {
        sourceKind: "epaper",
        date: row.published_at,
        documentKey: `epaper:${row.id}`,
        sourceName: row.source_name || "Unknown source",
        occurrenceCount: countOccurrences(text, normalizedTerm),
      };
    })
    .filter((row) => row.occurrenceCount > 0);

  return [...articles, ...epaper];
}

async function collectMatchesForTerm(organizationId, normalizedTerm, from, to) {
  const [tvMatches, newsMatches] = await Promise.all([
    fetchTvMatches(organizationId, normalizedTerm, from, to),
    fetchNewsMatches(organizationId, normalizedTerm, from, to),
  ]);
  return [...tvMatches, ...newsMatches];
}

function buildDailyStatRows(organizationId, trackedTerm, matches) {
  const buckets = new Map();

  const upsertBucket = (sourceKind, bucketDate, match) => {
    const key = `${sourceKind}:${bucketDate}`;
    const current = buckets.get(key) || {
      organization_id: organizationId,
      keyword: trackedTerm.term,
      normalized_keyword: trackedTerm.normalizedTerm,
      source_kind: sourceKind,
      bucket_date: bucketDate,
      occurrence_count: 0,
      document_count: 0,
      channel_count: 0,
      trend_score: 0,
      metadata: {
        termType: trackedTerm.termType,
        sources: [],
      },
      documentKeys: new Set(),
      sourceNames: new Set(),
    };

    current.occurrence_count += match.occurrenceCount;
    current.documentKeys.add(match.documentKey);
    current.sourceNames.add(match.sourceName);
    current.metadata.sources.push(match.sourceKind);
    buckets.set(key, current);
  };

  for (const match of matches) {
    const bucketDate = toIsoDate(match.date);
    if (!bucketDate) continue;
    upsertBucket(match.sourceKind, bucketDate, match);
    upsertBucket("all", bucketDate, match);
  }

  return Array.from(buckets.values()).map((row) => {
    const documentCount = row.documentKeys.size;
    const channelCount = row.sourceNames.size;
    return {
      organization_id: row.organization_id,
      keyword: row.keyword,
      normalized_keyword: row.normalized_keyword,
      source_kind: row.source_kind,
      bucket_date: row.bucket_date,
      occurrence_count: row.occurrence_count,
      document_count: documentCount,
      channel_count: channelCount,
      trend_score: Number((row.occurrence_count + documentCount * 0.5 + channelCount * 0.25).toFixed(4)),
      metadata: row.metadata,
    };
  });
}

async function createSpikeAlertIfNeeded(organizationId, trackedTerm, rows) {
  const allRows = rows
    .filter((row) => row.source_kind === "all")
    .sort((a, b) => String(a.bucket_date).localeCompare(String(b.bucket_date)));

  if (allRows.length < 2) return null;

  const latest = allRows[allRows.length - 1];
  const history = allRows.slice(Math.max(0, allRows.length - 4), allRows.length - 1);
  if (!latest || history.length === 0) return null;

  const baseline = history.reduce((sum, item) => sum + item.occurrence_count, 0) / history.length;
  const spikeRatio = baseline > 0 ? latest.occurrence_count / baseline : latest.occurrence_count;

  if (latest.occurrence_count < 3 || spikeRatio < 2) {
    return null;
  }

  const message = `${trackedTerm.term} spiked to ${latest.occurrence_count} mentions on ${latest.bucket_date}`;
  const dayStart = `${latest.bucket_date}T00:00:00.000Z`;

  const { data: existing } = await supabaseAdmin
    .from("alerts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("type", "media_keyword_spike")
    .eq("message", message)
    .gte("triggered_at", dayStart)
    .limit(1);

  if (existing?.length) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({
      organization_id: organizationId,
      severity: spikeRatio >= 4 ? "high" : "medium",
      type: "media_keyword_spike",
      message,
      status: "open",
      delivery_channels: ["app"],
      triggered_at: new Date().toISOString(),
      payload: {
        keyword: trackedTerm.term,
        normalizedKeyword: trackedTerm.normalizedTerm,
        termType: trackedTerm.termType,
        bucketDate: latest.bucket_date,
        occurrenceCount: latest.occurrence_count,
        baseline,
        spikeRatio: Number(spikeRatio.toFixed(2)),
      },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id || null;
}

export async function listOrganizationWatchTerms(organizationId) {
  const { data, error } = await supabaseAdmin
    .from("organization_watch_terms")
    .select("id, term, normalized_term, term_type, language, is_active, metadata, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createOrganizationWatchTerm(organizationId, userId, payload) {
  const { data, error } = await supabaseAdmin
    .from("organization_watch_terms")
    .insert({
      organization_id: organizationId,
      term: String(payload.term || "").trim(),
      term_type: payload.termType,
      language: payload.language || null,
      is_active: payload.isActive !== false,
      metadata: payload.metadata || {},
      created_by: userId,
    })
    .select("id, term, normalized_term, term_type, language, is_active, metadata, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create watch term");
  }

  return data;
}

export async function updateOrganizationWatchTerm(organizationId, watchTermId, payload) {
  const { data, error } = await supabaseAdmin
    .from("organization_watch_terms")
    .update({
      ...(payload.term !== undefined ? { term: String(payload.term).trim() } : {}),
      ...(payload.termType !== undefined ? { term_type: payload.termType } : {}),
      ...(payload.language !== undefined ? { language: payload.language || null } : {}),
      ...(payload.isActive !== undefined ? { is_active: Boolean(payload.isActive) } : {}),
      ...(payload.metadata !== undefined ? { metadata: payload.metadata || {} } : {}),
    })
    .eq("organization_id", organizationId)
    .eq("id", watchTermId)
    .select("id, term, normalized_term, term_type, language, is_active, metadata, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update watch term");
  }

  return data;
}

export async function deleteOrganizationWatchTerm(organizationId, watchTermId) {
  const { error } = await supabaseAdmin
    .from("organization_watch_terms")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", watchTermId);

  if (error) throw new Error(error.message);
}

export async function listMediaKeywordDailyStats(organizationId, options = {}) {
  let query = supabaseAdmin
    .from("media_keyword_daily_stats")
    .select("*")
    .eq("organization_id", organizationId)
    .order("bucket_date", { ascending: false })
    .order("occurrence_count", { ascending: false })
    .limit(options.limit || 50);

  if (options.sourceKind) {
    query = query.eq("source_kind", options.sourceKind);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listRecentMediaSpikeAlerts(organizationId, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .select("id, severity, type, message, status, triggered_at, payload, created_at")
    .eq("organization_id", organizationId)
    .eq("type", "media_keyword_spike")
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function refreshMediaIntelligenceForOrganization({
  organizationId,
  from,
  to,
  days = 7,
  createAlerts = true,
} = {}) {
  const range = {
    from: parseDateInput(from, buildRange(days).from),
    to: parseDateInput(to, buildRange(days).to),
  };

  const context = await fetchOrganizationContext(organizationId);
  const trackedTerms = buildTrackedTerms(context);
  const fromDate = range.from.toISOString().slice(0, 10);
  const toDate = range.to.toISOString().slice(0, 10);

  let updatedStatRows = 0;
  let generatedAlerts = 0;

  for (const trackedTerm of trackedTerms) {
    const matches = await collectMatchesForTerm(organizationId, trackedTerm.normalizedTerm, range.from, range.to);
    const rows = buildDailyStatRows(organizationId, trackedTerm, matches);

    const { error: deleteError } = await supabaseAdmin
      .from("media_keyword_daily_stats")
      .delete()
      .eq("organization_id", organizationId)
      .eq("normalized_keyword", trackedTerm.normalizedTerm)
      .gte("bucket_date", fromDate)
      .lte("bucket_date", toDate);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("media_keyword_daily_stats").upsert(rows, {
        onConflict: "organization_id,normalized_keyword,source_kind,bucket_date",
      });
      if (error) throw new Error(error.message);
      updatedStatRows += rows.length;
    }

    if (createAlerts) {
      const alertId = await createSpikeAlertIfNeeded(organizationId, trackedTerm, rows);
      if (alertId) generatedAlerts += 1;
    }
  }

  return {
    organizationId,
    trackedTerms: trackedTerms.length,
    updatedStatRows,
    generatedAlerts,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
}

export async function refreshMediaIntelligenceForAllOrganizations({ days = 2, createAlerts = true } = {}) {
  const { data: organizations, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .in("status", ["active", "trial"]);

  if (error) throw new Error(error.message);

  const results = [];
  for (const organization of organizations || []) {
    try {
      const result = await refreshMediaIntelligenceForOrganization({
        organizationId: organization.id,
        days,
        createAlerts,
      });
      results.push(result);
    } catch (error) {
      results.push({
        organizationId: organization.id,
        error: error instanceof Error ? error.message : "Refresh failed",
      });
    }
  }

  return results;
}

function computeNextRunAt({ frequency, hourOfDay = 9, dayOfWeek = null, now = new Date() }) {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hourOfDay);

  if (frequency === "daily") {
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.toISOString();
  }

  const targetDay = typeof dayOfWeek === "number" ? dayOfWeek : 1;
  const currentDay = next.getUTCDay();
  let delta = targetDay - currentDay;
  if (delta < 0 || (delta === 0 && next <= now)) {
    delta += 7;
  }
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString();
}

async function getSummaryAudience(organizationId) {
  const { data: members, error: membersError } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (membersError) {
    throw new Error(membersError.message);
  }

  const memberIds = (members || []).map((item) => item.user_id);
  const [{ data: preferences }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from("notification_preferences")
      .select("user_id, email_enabled, app_enabled")
      .eq("organization_id", organizationId),
    memberIds.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const prefMap = new Map((preferences || []).map((item) => [item.user_id, item]));
  const profileMap = new Map((profiles || []).map((item) => [item.user_id, item]));

  return (members || []).map((member) => ({
    userId: member.user_id,
    role: member.role,
    emailEnabled: prefMap.get(member.user_id)?.email_enabled !== false,
    appEnabled: prefMap.get(member.user_id)?.app_enabled !== false,
    email: profileMap.get(member.user_id)?.email || null,
    fullName: profileMap.get(member.user_id)?.full_name || null,
  }));
}

export async function buildSummaryDigestForOrganization(organizationId) {
  const context = await fetchOrganizationContext(organizationId);
  const watchTerms = buildTrackedTerms(context);
  const today = new Date().toISOString().slice(0, 10);
  const last7Start = new Date();
  last7Start.setUTCDate(last7Start.getUTCDate() - 6);
  const fromDate = last7Start.toISOString().slice(0, 10);

  const { data: stats, error } = await supabaseAdmin
    .from("media_keyword_daily_stats")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("source_kind", "all")
    .gte("bucket_date", fromDate)
    .order("bucket_date", { ascending: false })
    .order("occurrence_count", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const watchedTypeMap = new Map(watchTerms.map((item) => [item.normalizedTerm, item.termType]));
  const todayRows = (stats || []).filter((row) => row.bucket_date === today);
  const topBrand = todayRows
    .filter((row) => watchedTypeMap.get(row.normalized_keyword) === "brand")
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, 3);
  const topCompetitors = todayRows
    .filter((row) => watchedTypeMap.get(row.normalized_keyword) === "competitor")
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, 5);
  const topKeywords = todayRows
    .filter((row) => watchedTypeMap.get(row.normalized_keyword) === "keyword")
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, 5);

  const subject = `${context.organization.name} media summary for ${today}`;
  const lines = [
    `Media summary for ${context.organization.name}`,
    `Date: ${today}`,
    "",
    `Brand mentions today: ${topBrand.reduce((sum, item) => sum + item.occurrence_count, 0)}`,
    `Competitor mentions today: ${topCompetitors.reduce((sum, item) => sum + item.occurrence_count, 0)}`,
    "",
    "Top brand signals:",
    ...(topBrand.length > 0 ? topBrand.map((item) => `- ${item.keyword}: ${item.occurrence_count} mentions`) : ["- No brand mentions detected"]),
    "",
    "Top competitor signals:",
    ...(topCompetitors.length > 0 ? topCompetitors.map((item) => `- ${item.keyword}: ${item.occurrence_count} mentions`) : ["- No competitor mentions detected"]),
    "",
    "Top keyword trends:",
    ...(topKeywords.length > 0 ? topKeywords.map((item) => `- ${item.keyword}: ${item.occurrence_count} mentions`) : ["- No keyword spikes detected"]),
  ];

  return {
    organizationName: context.organization.name,
    subject,
    body: lines.join("\n"),
    metrics: {
      brandMentionsToday: topBrand.reduce((sum, item) => sum + item.occurrence_count, 0),
      competitorMentionsToday: topCompetitors.reduce((sum, item) => sum + item.occurrence_count, 0),
      topBrand,
      topCompetitors,
      topKeywords,
    },
  };
}

export async function listSummarySchedules(organizationId) {
  const { data, error } = await supabaseAdmin
    .from("organization_summary_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createSummarySchedule(organizationId, userId, payload) {
  const row = {
    organization_id: organizationId,
    name: String(payload.name || "").trim(),
    frequency: payload.frequency,
    delivery_channels: payload.deliveryChannels || ["app", "email"],
    hour_of_day: Number(payload.hourOfDay ?? 9),
    day_of_week: payload.frequency === "weekly" ? Number(payload.dayOfWeek ?? 1) : null,
    is_active: payload.isActive !== false,
    recipients: payload.recipients || {},
    metadata: payload.metadata || {},
    created_by: userId,
    next_run_at: computeNextRunAt({
      frequency: payload.frequency,
      hourOfDay: Number(payload.hourOfDay ?? 9),
      dayOfWeek: payload.frequency === "weekly" ? Number(payload.dayOfWeek ?? 1) : null,
    }),
  };

  const { data, error } = await supabaseAdmin
    .from("organization_summary_schedules")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create summary schedule");
  return data;
}

export async function updateSummarySchedule(organizationId, scheduleId, payload) {
  const update = {
    ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}),
    ...(payload.frequency !== undefined ? { frequency: payload.frequency } : {}),
    ...(payload.deliveryChannels !== undefined ? { delivery_channels: payload.deliveryChannels } : {}),
    ...(payload.hourOfDay !== undefined ? { hour_of_day: Number(payload.hourOfDay) } : {}),
    ...(payload.dayOfWeek !== undefined ? { day_of_week: payload.dayOfWeek === null ? null : Number(payload.dayOfWeek) } : {}),
    ...(payload.isActive !== undefined ? { is_active: Boolean(payload.isActive) } : {}),
    ...(payload.recipients !== undefined ? { recipients: payload.recipients || {} } : {}),
    ...(payload.metadata !== undefined ? { metadata: payload.metadata || {} } : {}),
  };

  const schedulePreview = {
    frequency: payload.frequency || "daily",
    hourOfDay: payload.hourOfDay ?? 9,
    dayOfWeek: payload.dayOfWeek ?? null,
  };
  update.next_run_at = computeNextRunAt(schedulePreview);

  const { data, error } = await supabaseAdmin
    .from("organization_summary_schedules")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to update summary schedule");
  return data;
}

export async function deleteSummarySchedule(organizationId, scheduleId) {
  const { error } = await supabaseAdmin
    .from("organization_summary_schedules")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", scheduleId);

  if (error) throw new Error(error.message);
}

export async function listSummaryDispatchLogs(organizationId, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("summary_dispatch_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function runSummarySchedule(schedule) {
  const digest = await buildSummaryDigestForOrganization(schedule.organization_id);
  const audience = await getSummaryAudience(schedule.organization_id);
  const deliveryChannels = schedule.delivery_channels || ["app"];
  let dispatched = 0;

  for (const recipient of audience) {
    if (deliveryChannels.includes("app") && recipient.appEnabled) {
      await supabaseAdmin.from("app_notifications").insert({
        organization_id: schedule.organization_id,
        user_id: recipient.userId,
        title: digest.subject,
        message: digest.body.slice(0, 500),
        notification_type: "media_summary",
        payload: {
          scheduleId: schedule.id,
          metrics: digest.metrics,
        },
      });

      await supabaseAdmin.from("summary_dispatch_logs").insert({
        organization_id: schedule.organization_id,
        schedule_id: schedule.id,
        channel: "app",
        recipient: recipient.userId,
        subject: digest.subject,
        body: digest.body,
        delivery_status: "delivered",
        meta: {
          fullName: recipient.fullName,
        },
      });
      dispatched += 1;
    }

    if (deliveryChannels.includes("email") && recipient.emailEnabled && recipient.email) {
      await supabaseAdmin.from("summary_dispatch_logs").insert({
        organization_id: schedule.organization_id,
        schedule_id: schedule.id,
        channel: "email",
        recipient: recipient.email,
        subject: digest.subject,
        body: digest.body,
        delivery_status: "queued",
        meta: {
          fullName: recipient.fullName,
          note: "Queued for external email provider integration",
        },
      });
      dispatched += 1;
    }
  }

  const nextRunAt = computeNextRunAt({
    frequency: schedule.frequency,
    hourOfDay: schedule.hour_of_day,
    dayOfWeek: schedule.day_of_week,
    now: new Date(),
  });

  await supabaseAdmin
    .from("organization_summary_schedules")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRunAt,
    })
    .eq("id", schedule.id);

  return {
    scheduleId: schedule.id,
    organizationId: schedule.organization_id,
    subject: digest.subject,
    dispatched,
    nextRunAt,
  };
}

export async function processDueSummarySchedules() {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("organization_summary_schedules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  const results = [];
  for (const schedule of data || []) {
    try {
      const result = await runSummarySchedule(schedule);
      results.push(result);
    } catch (error) {
      await supabaseAdmin.from("summary_dispatch_logs").insert({
        organization_id: schedule.organization_id,
        schedule_id: schedule.id,
        channel: "app",
        subject: `Failed summary run for ${schedule.name}`,
        body: error instanceof Error ? error.message : "Summary schedule failed",
        delivery_status: "failed",
        meta: {},
      });
      results.push({
        scheduleId: schedule.id,
        organizationId: schedule.organization_id,
        error: error instanceof Error ? error.message : "Summary schedule failed",
      });
    }
  }

  return results;
}
