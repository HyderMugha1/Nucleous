import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeNarrative(item) {
  return {
    _id: item.id,
    title: item.title,
    summary: item.summary,
    keywords: item.keywords || [],
    sentiment: item.sentiment,
    trend: item.trend,
    mentionCount: item.mention_count,
    momentumScore: item.momentum_score,
    riskScore: item.risk_score,
    status: item.status,
    firstDetectedAt: item.first_detected_at,
    lastDetectedAt: item.last_detected_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;
    const [topNarratives, trendPoints, sentiment] = await Promise.all([
      supabaseAdmin.from("narratives").select("*").eq("organization_id", organizationId).order("mention_count", { ascending: false }).limit(5),
      supabaseAdmin.from("mention_trends").select("*").eq("organization_id", organizationId).order("bucket_start", { ascending: false }).limit(12),
      supabaseAdmin.from("sentiment_snapshots").select("*").eq("organization_id", organizationId).order("calculated_at", { ascending: false }).limit(5),
    ]);

    return ok(res, {
      topNarratives: (topNarratives.data || []).map(serializeNarrative),
      trendPoints: trendPoints.data || [],
      sentiment: sentiment.data || [],
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("narratives")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("created_at", { ascending: false })
      .range(skip, skip + limit - 1);

    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });

    return ok(res, {
      items: (data || []).map(serializeNarrative),
      pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("narratives")
      .insert({
        organization_id: req.auth.organizationId,
        title: payload.title,
        summary: payload.summary,
        keywords: payload.keywords || [],
        sentiment: payload.sentiment,
        trend: payload.trend || "stable",
        mention_count: payload.mentionCount || 0,
        momentum_score: payload.momentumScore || 0,
        risk_score: payload.riskScore || 0,
        status: payload.status || "active",
        first_detected_at: payload.firstDetectedAt || new Date().toISOString(),
        last_detected_at: payload.lastDetectedAt || new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create narrative" });
    return created(res, { item: serializeNarrative(data) });
  }),
);

export default router;
