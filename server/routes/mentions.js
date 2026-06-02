import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { addDateRange, parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeMention(item) {
  return {
    _id: item.id,
    sourceId: item.source_id,
    contentType: item.content_type,
    platform: item.platform,
    sourceType: item.source_type,
    headline: item.headline,
    body: item.body,
    snippet: item.snippet,
    authorName: item.author_name,
    channelOrPublisher: item.channel_or_publisher,
    language: item.language,
    country: item.country,
    publishedAt: item.published_at,
    engagement: {
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      views: item.views,
    },
    sentiment: {
      label: item.sentiment_label,
      score: item.sentiment_score,
    },
    riskScore: item.risk_score,
    url: item.url,
    mediaUrls: item.media_urls || [],
    tags: item.tags || [],
    rawIngestionId: item.raw_ingestion_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;
    const [total, positive, neutral, negative] = await Promise.all([
      supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("sentiment_label", "positive"),
      supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("sentiment_label", "neutral"),
      supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("sentiment_label", "negative"),
    ]);

    return ok(res, {
      total: total.count || 0,
      sentiment: {
        positive: positive.count || 0,
        neutral: neutral.count || 0,
        negative: negative.count || 0,
      },
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("mentions")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("published_at", { ascending: false })
      .range(skip, skip + limit - 1);

    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`headline.ilike.%${search}%,body.ilike.%${search}%,snippet.ilike.%${search}%,author_name.ilike.%${search}%,channel_or_publisher.ilike.%${search}%`);
    }
    if (req.query.platform) query = query.eq("platform", req.query.platform);
    if (req.query.sourceType) query = query.eq("source_type", req.query.sourceType);
    if (req.query.sentiment) query = query.eq("sentiment_label", req.query.sentiment);
    if (req.query.language) query = query.eq("language", req.query.language);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });

    return ok(res, {
      items: (data || []).map(serializeMention),
      pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("mentions")
      .insert({
        organization_id: req.auth.organizationId,
        source_id: payload.sourceId || null,
        crisis_incident_id: payload.crisisIncidentId || null,
        content_type: payload.contentType,
        platform: payload.platform,
        source_type: payload.sourceType,
        headline: payload.headline,
        body: payload.body,
        snippet: payload.snippet,
        author_name: payload.authorName,
        channel_or_publisher: payload.channelOrPublisher,
        language: payload.language,
        country: payload.country,
        published_at: payload.publishedAt || new Date().toISOString(),
        likes: payload.engagement?.likes || 0,
        comments: payload.engagement?.comments || 0,
        shares: payload.engagement?.shares || 0,
        views: payload.engagement?.views || 0,
        sentiment_label: payload.sentiment?.label || "neutral",
        sentiment_score: payload.sentiment?.score || 0,
        risk_score: payload.riskScore || null,
        url: payload.url || null,
        media_urls: payload.mediaUrls || [],
        tags: payload.tags || [],
        raw_ingestion_id: payload.rawIngestionId || null,
      })
      .select("*")
      .single();

    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create mention" });
    return created(res, { item: serializeMention(data) });
  }),
);

export default router;
