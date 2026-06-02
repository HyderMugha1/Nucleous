import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializePost(item) {
  return {
    _id: item.id,
    influencerId: item.influencer_id,
    campaignId: item.campaign_id,
    platform: item.platform,
    caption: item.caption,
    likes: item.likes,
    comments: item.comments,
    views: item.views,
    postedAt: item.posted_at,
    sentiment: item.sentiment_label ? { label: item.sentiment_label, score: item.sentiment_score } : undefined,
    brand: item.brand,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("influencer_posts")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("posted_at", { ascending: false })
      .range(skip, skip + limit - 1);

    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`caption.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, {
      items: (data || []).map(serializePost),
      pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("influencer_posts")
      .insert({
        organization_id: req.auth.organizationId,
        influencer_id: payload.influencerId,
        campaign_id: payload.campaignId || null,
        platform: payload.platform,
        caption: payload.caption,
        likes: payload.likes || 0,
        comments: payload.comments || 0,
        views: payload.views || 0,
        posted_at: payload.postedAt || new Date().toISOString(),
        sentiment_label: payload.sentiment?.label || null,
        sentiment_score: payload.sentiment?.score || null,
        brand: payload.brand || null,
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create influencer post" });
    return created(res, { item: serializePost(data) });
  }),
);

export default router;
