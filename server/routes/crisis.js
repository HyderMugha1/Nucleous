import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeIncident(item) {
  return {
    _id: item.id,
    title: item.title,
    summary: item.summary,
    severity: item.severity,
    status: item.status,
    responseOwnerUserId: item.response_owner_user_id,
    openedAt: item.opened_at,
    resolvedAt: item.resolved_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("crisis_incidents")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("opened_at", { ascending: false })
      .range(skip, skip + limit - 1);
    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, { items: (data || []).map(serializeIncident), pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) } });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("crisis_incidents")
      .insert({
        organization_id: req.auth.organizationId,
        title: payload.title,
        summary: payload.summary,
        severity: payload.severity,
        status: payload.status || "monitoring",
        response_owner_user_id: payload.responseOwnerUserId || null,
        opened_at: payload.openedAt || new Date().toISOString(),
        resolved_at: payload.resolvedAt || null,
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create crisis incident" });
    return created(res, { item: serializeIncident(data) });
  }),
);

router.patch(
  "/:id/resolve",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("crisis_incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("organization_id", req.auth.organizationId)
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error || !data) return res.status(404).json({ message: error?.message || "Crisis incident not found" });
    return ok(res, { item: serializeIncident(data) });
  }),
);

export default router;
