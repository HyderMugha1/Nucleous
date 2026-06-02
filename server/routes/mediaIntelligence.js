import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function normalizeQuery(input) {
  return String(input || "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text, query) {
  const haystack = String(text || "");
  if (!haystack || !query) return 0;
  const matches = haystack.match(new RegExp(escapeRegExp(query), "gi"));
  return matches ? matches.length : 0;
}

function parseDateRange(query) {
  const from = query.from ? new Date(String(query.from)) : null;
  const to = query.to ? new Date(String(query.to)) : null;
  return { from: from && !Number.isNaN(from.getTime()) ? from : null, to: to && !Number.isNaN(to.getTime()) ? to : null };
}

function inDateRange(value, from, to) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < from) return false;
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    if (date > endOfDay) return false;
  }
  return true;
}

function toBucketDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toISOString().slice(0, 10);
}

async function getCurrentOrganization(organizationId) {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, competitor_names")
    .eq("id", organizationId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Organization not found");
  }

  return data;
}

async function getCompetitorTerms(organizationId) {
  const [entityCompetitors, watchTerms] = await Promise.all([
    supabaseAdmin.from("entities").select("name").eq("organization_id", organizationId).eq("is_competitor", true),
    supabaseAdmin.from("organization_watch_terms").select("term, term_type").eq("organization_id", organizationId).eq("is_active", true),
  ]);

  const competitors = new Set((entityCompetitors.data || []).map((item) => item.name).filter(Boolean));
  const brandTerms = new Set((watchTerms.data || []).filter((item) => item.term_type === "brand").map((item) => item.term));
  const competitorTerms = new Set((watchTerms.data || []).filter((item) => item.term_type === "competitor").map((item) => item.term));
  const keywordTerms = new Set((watchTerms.data || []).filter((item) => item.term_type === "keyword").map((item) => item.term));

  return {
    competitors: [...new Set([...competitors, ...competitorTerms])],
    brandTerms: [...brandTerms],
    keywordTerms: [...keywordTerms],
  };
}

async function fetchTvMatches(organizationId, normalizedQuery, from, to) {
  const { data, error } = await supabaseAdmin
    .from("tv_transcript_segments")
    .select("id, text, start_sec, end_sec, video_id, tv_youtube_videos!inner(id, title, thumbnail_url, youtube_video_id, youtube_url, published_at, tv_youtube_channels(channel_name, thumbnail_url))")
    .eq("organization_id", organizationId)
    .ilike("searchable_text", `%${normalizedQuery}%`)
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .filter((row) => inDateRange(row.tv_youtube_videos?.published_at, from, to))
    .map((row) => {
      const occurrenceCount = countOccurrences(row.text, normalizedQuery);
      return {
        sourceKind: "tv",
        occurrenceCount,
        timestamp: row.start_sec,
        date: row.tv_youtube_videos?.published_at,
        title: row.tv_youtube_videos?.title || "Untitled video",
        thumbnailUrl: row.tv_youtube_videos?.thumbnail_url || row.tv_youtube_videos?.tv_youtube_channels?.thumbnail_url || null,
        sourceName: row.tv_youtube_videos?.tv_youtube_channels?.channel_name || "Unknown channel",
        redirectUrl: row.tv_youtube_videos?.youtube_video_id
          ? `https://www.youtube.com/watch?v=${row.tv_youtube_videos.youtube_video_id}&t=${Math.max(0, Math.floor(Number(row.start_sec || 0)))}s`
          : row.tv_youtube_videos?.youtube_url || null,
        snippet: row.text,
      };
    })
    .filter((row) => row.occurrenceCount > 0);
}

async function fetchNewsMatches(organizationId, normalizedQuery, from, to) {
  const [articlesResult, epaperResult] = await Promise.all([
    supabaseAdmin
      .from("news_articles")
      .select("id, source_name, headline, summary, body, published_at, url, language, sentiment_label, sentiment_score")
      .eq("organization_id", organizationId)
      .or(`headline.ilike.%${normalizedQuery}%,summary.ilike.%${normalizedQuery}%,body.ilike.%${normalizedQuery}%`)
      .limit(300),
    supabaseAdmin
      .from("epaper_clips")
      .select("id, source_name, page_label, headline, ocr_text, published_at, image_url, language, sentiment_label, sentiment_score")
      .eq("organization_id", organizationId)
      .or(`headline.ilike.%${normalizedQuery}%,ocr_text.ilike.%${normalizedQuery}%`)
      .limit(300),
  ]);

  if (articlesResult.error) throw new Error(articlesResult.error.message);
  if (epaperResult.error) throw new Error(epaperResult.error.message);

  const articleMatches = (articlesResult.data || [])
    .filter((row) => inDateRange(row.published_at, from, to))
    .map((row) => {
      const text = [row.headline, row.summary, row.body].filter(Boolean).join(" ");
      return {
        sourceKind: "news",
        occurrenceCount: countOccurrences(text, normalizedQuery),
        timestamp: null,
        date: row.published_at,
        title: row.headline || "Untitled article",
        thumbnailUrl: null,
        sourceName: row.source_name,
        redirectUrl: row.url || null,
        snippet: row.summary || row.body || row.headline,
      };
    })
    .filter((row) => row.occurrenceCount > 0);

  const epaperMatches = (epaperResult.data || [])
    .filter((row) => inDateRange(row.published_at, from, to))
    .map((row) => {
      const text = [row.headline, row.ocr_text].filter(Boolean).join(" ");
      return {
        sourceKind: "epaper",
        occurrenceCount: countOccurrences(text, normalizedQuery),
        timestamp: null,
        date: row.published_at,
        title: row.headline || "Untitled e-paper clip",
        thumbnailUrl: row.image_url || null,
        sourceName: row.source_name,
        redirectUrl: row.image_url || null,
        snippet: row.ocr_text,
      };
    })
    .filter((row) => row.occurrenceCount > 0);

  return [...articleMatches, ...epaperMatches];
}

function groupTrendPoints(matches) {
  const buckets = new Map();
  for (const match of matches) {
    const bucket = toBucketDate(match.date);
    const current = buckets.get(bucket) || { date: bucket, occurrences: 0, documents: 0 };
    current.occurrences += match.occurrenceCount;
    current.documents += 1;
    buckets.set(bucket, current);
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildVideoResults(matches) {
  const grouped = new Map();
  for (const match of matches) {
    const key = `${match.sourceKind}:${match.title}:${match.redirectUrl || ""}`;
    const current = grouped.get(key) || {
      sourceKind: match.sourceKind,
      title: match.title,
      sourceName: match.sourceName,
      thumbnailUrl: match.thumbnailUrl,
      redirectUrl: match.redirectUrl,
      totalOccurrences: 0,
      timestamps: [],
      snippets: [],
      latestDate: match.date,
    };
    current.totalOccurrences += match.occurrenceCount;
    if (typeof match.timestamp === "number") {
      current.timestamps.push(match.timestamp);
    }
    if (match.snippet) {
      current.snippets.push(match.snippet);
    }
    if (match.date && (!current.latestDate || new Date(match.date) > new Date(current.latestDate))) {
      current.latestDate = match.date;
    }
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      timestamps: item.timestamps.sort((a, b) => a - b),
      snippets: item.snippets.slice(0, 3),
    }))
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences)
    .slice(0, 50);
}

async function collectMatchesForTerms(organizationId, terms, from, to, sourceKind = "all") {
  const results = [];
  for (const term of terms) {
    const normalized = normalizeQuery(term);
    if (!normalized) continue;
    const tvMatches = sourceKind === "all" || sourceKind === "tv" ? await fetchTvMatches(organizationId, normalized, from, to) : [];
    const newsMatches =
      sourceKind === "all" || sourceKind === "news" || sourceKind === "epaper"
        ? await fetchNewsMatches(organizationId, normalized, from, to)
        : [];
    results.push({
      keyword: term,
      normalizedKeyword: normalized,
      matches: [...tvMatches, ...newsMatches].sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())),
    });
  }
  return results;
}

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;
    const query = normalizeQuery(req.query.q);
    const sourceKind = normalizeQuery(req.query.source) || "all";
    const { from, to } = parseDateRange(req.query);

    if (!query) {
      return ok(res, {
        keyword: "",
        totalOccurrences: 0,
        totalResults: 0,
        items: [],
        trend: [],
        message: "Enter a keyword or phrase to search.",
      });
    }

    const tvMatches = sourceKind === "all" || sourceKind === "tv" ? await fetchTvMatches(organizationId, query, from, to) : [];
    const newsMatches = sourceKind === "all" || sourceKind === "news" || sourceKind === "epaper" ? await fetchNewsMatches(organizationId, query, from, to) : [];
    const matches = [...tvMatches, ...newsMatches].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    return ok(res, {
      keyword: query,
      totalOccurrences: matches.reduce((sum, item) => sum + item.occurrenceCount, 0),
      totalResults: matches.length,
      items: buildVideoResults(matches),
      trend: groupTrendPoints(matches),
      message: matches.length > 0 ? undefined : "No record found.",
    });
  }),
);

router.get(
  "/brand-monitor",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;
    const { from, to } = parseDateRange(req.query);
    const organization = await getCurrentOrganization(organizationId);
    const { competitors, brandTerms } = await getCompetitorTerms(organizationId);
    const resolvedBrandTerms = [...new Set([organization.name, ...(organization.competitor_names || []), ...brandTerms])].filter(Boolean);

    const brandMatches = await collectMatchesForTerms(organizationId, [organization.name, ...brandTerms], from, to);
    const competitorMatches = await collectMatchesForTerms(organizationId, competitors, from, to);
    const keywordMatches = await collectMatchesForTerms(organizationId, resolvedBrandTerms, from, to);

    const summarize = (entries) =>
      entries.map((entry) => ({
        keyword: entry.keyword,
        totalOccurrences: entry.matches.reduce((sum, item) => sum + item.occurrenceCount, 0),
        topSources: buildVideoResults(entry.matches).slice(0, 5),
        trend: groupTrendPoints(entry.matches),
      }));

    return ok(res, {
      brand: summarize(brandMatches),
      competitors: summarize(competitorMatches),
      trackedKeywords: summarize(keywordMatches),
      summary: {
        organizationName: organization.name,
        brandMentionCount: brandMatches.reduce((sum, item) => sum + item.matches.reduce((inner, row) => inner + row.occurrenceCount, 0), 0),
        competitorMentionCount: competitorMatches.reduce((sum, item) => sum + item.matches.reduce((inner, row) => inner + row.occurrenceCount, 0), 0),
      },
    });
  }),
);

router.get(
  "/trends",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;
    const sourceKind = normalizeQuery(req.query.source) || "all";
    const { from, to } = parseDateRange(req.query);
    const organization = await getCurrentOrganization(organizationId);
    const { competitors, brandTerms, keywordTerms } = await getCompetitorTerms(organizationId);

    const requestedKeywords = String(req.query.keywords || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const keywords = requestedKeywords.length > 0
      ? requestedKeywords
      : [...new Set([organization.name, ...brandTerms, ...competitors, ...keywordTerms])].filter(Boolean).slice(0, 12);

    const collected = await collectMatchesForTerms(organizationId, keywords, from, to, sourceKind);
    const trendItems = collected
      .map((entry) => {
        const points = groupTrendPoints(entry.matches);
        const totalOccurrences = entry.matches.reduce((sum, item) => sum + item.occurrenceCount, 0);
        const recentPoint = points[points.length - 1];
        const priorPoints = points.slice(0, -1);
        const priorAverage = priorPoints.length > 0 ? priorPoints.reduce((sum, item) => sum + item.occurrences, 0) / priorPoints.length : 0;
        const spikeRatio = priorAverage > 0 && recentPoint ? recentPoint.occurrences / priorAverage : recentPoint?.occurrences || 0;
        return {
          keyword: entry.keyword,
          totalOccurrences,
          trend: points,
          spikeRatio,
          isTrending: totalOccurrences > 0 && spikeRatio >= 1.5,
          topSources: buildVideoResults(entry.matches).slice(0, 5),
        };
      })
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    return ok(res, {
      keywords: trendItems,
      trending: trendItems.filter((item) => item.isTrending).slice(0, 10),
    });
  }),
);

export default router;
