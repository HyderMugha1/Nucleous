import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { data, error, count } = await supabaseAdmin
      .from("ai_conversations")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("updated_at", { ascending: false })
      .range(skip, skip + limit - 1);
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, { items: data || [], pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) } });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("ai_conversations")
      .insert({
        organization_id: req.auth.organizationId,
        user_id: payload.userId || req.auth.userId,
        context_type: payload.contextType,
        context_ref_id: payload.contextRefId || null,
        title: payload.title || null,
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create conversation" });
    return created(res, { item: data });
  }),
);

export default router;
