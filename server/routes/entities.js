import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeEntity(item) {
  return {
    _id: item.id,
    name: item.name,
    type: item.type,
    aliases: item.aliases || [],
    keywords: item.keywords || [],
    platformLinks: item.platform_links || [],
    isCompetitor: item.is_competitor,
    watchStatus: item.watch_status,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/competitors",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("entities")
      .select("id, name, type, aliases, keywords, platform_links, is_competitor, watch_status, created_at, updated_at")
      .eq("organization_id", req.auth.organizationId)
      .eq("is_competitor", true)
      .order("name", { ascending: true });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return ok(res, { items: (data || []).map(serializeEntity) });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, type, aliases, keywords, platformLinks, isCompetitor, watchStatus } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Name and type are required" });
    }

    const { data, error } = await supabaseAdmin
      .from("entities")
      .insert({
        organization_id: req.auth.organizationId,
        name,
        type,
        aliases: aliases || [],
        keywords: keywords || [],
        platform_links: platformLinks || [],
        is_competitor: Boolean(isCompetitor),
        watch_status: watchStatus || "active",
        created_by: req.auth.userId,
      })
      .select("id, name, type, aliases, keywords, platform_links, is_competitor, watch_status, created_at, updated_at")
      .single();

    if (error || !data) {
      return res.status(400).json({ message: error?.message || "Unable to create entity" });
    }

    return created(res, { item: serializeEntity(data) });
  }),
);

export default router;
