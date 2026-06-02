import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeSource(item) {
  return {
    _id: item.id,
    name: item.name,
    sourceType: item.source_type,
    platform: item.platform,
    url: item.url,
    language: item.language,
    country: item.country,
    status: item.status,
    lastIngestedAt: item.last_ingested_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("sources")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("created_at", { ascending: false })
      .range(skip, skip + limit - 1);
    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`name.ilike.%${search}%,platform.ilike.%${search}%,country.ilike.%${search}%,language.ilike.%${search}%`);
    }
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, { items: (data || []).map(serializeSource), pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) } });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("sources")
      .insert({
        organization_id: req.auth.organizationId,
        name: payload.name,
        source_type: payload.sourceType,
        platform: payload.platform || null,
        url: payload.url || null,
        language: payload.language || null,
        country: payload.country || null,
        status: payload.status || "active",
        last_ingested_at: payload.lastIngestedAt || null,
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create source" });
    return created(res, { item: serializeSource(data) });
  }),
);

export default router;
