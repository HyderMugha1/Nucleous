import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeInfluencer(item) {
  return {
    _id: item.id,
    name: item.name,
    handle: item.handle,
    primaryPlatform: item.primary_platform,
    followers: item.followers,
    following: item.following,
    posts: item.posts,
    engagement: item.engagement,
    reach: item.reach,
    sentiment: item.sentiment,
    riskScore: item.risk_score,
    category: item.category,
    niche: item.niche,
    geography: item.geography,
    activePlatforms: item.active_platforms || [],
    workedWith: item.worked_with || [],
    topics: item.topics || [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/:id/posts",
  asyncHandler(async (req, res) => {
    const { data: influencer } = await supabaseAdmin
      .from("influencers")
      .select("id")
      .eq("organization_id", req.auth.organizationId)
      .eq("id", req.params.id)
      .maybeSingle();

    if (!influencer) {
      return res.status(404).json({ message: "Influencer not found" });
    }

    const { data, error } = await supabaseAdmin
      .from("influencer_posts")
      .select("*")
      .eq("organization_id", req.auth.organizationId)
      .eq("influencer_id", req.params.id)
      .order("posted_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });
    return ok(res, { items: data || [] });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("influencers")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("followers", { ascending: false })
      .range(skip, skip + limit - 1);

    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`name.ilike.%${search}%,handle.ilike.%${search}%,category.ilike.%${search}%,niche.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });

    return ok(res, {
      items: (data || []).map(serializeInfluencer),
      pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("influencers")
      .insert({
        organization_id: req.auth.organizationId,
        name: payload.name,
        handle: payload.handle,
        primary_platform: payload.primaryPlatform,
        followers: payload.followers || 0,
        following: payload.following || 0,
        posts: payload.posts || 0,
        engagement: payload.engagement || 0,
        reach: payload.reach || 0,
        sentiment: payload.sentiment || 0,
        risk_score: payload.riskScore || 0,
        category: payload.category,
        niche: payload.niche,
        geography: payload.geography,
        active_platforms: payload.activePlatforms || [],
        worked_with: payload.workedWith || [],
        topics: payload.topics || [],
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create influencer" });
    return created(res, { item: serializeInfluencer(data) });
  }),
);

export default router;
