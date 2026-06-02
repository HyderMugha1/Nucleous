import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeReport(item) {
  return {
    _id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    summary: item.summary,
    dateRange: {
      from: item.date_range_from,
      to: item.date_range_to,
    },
    filters: item.filters || {},
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const { data, error, count } = await supabaseAdmin
      .from("reports")
      .select("id, title, type, status, summary, date_range_from, date_range_to, filters, created_at, updated_at", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return ok(res, {
      items: (data || []).map(serializeReport),
      pagination: { total: count || 0 },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, type, status, dateRange, filters, summary, assetUrls } = req.body;

    if (!title || !type) {
      return res.status(400).json({ message: "Title and type are required" });
    }

    const { data, error } = await supabaseAdmin
      .from("reports")
      .insert({
        organization_id: req.auth.organizationId,
        title,
        type,
        status: status || "draft",
        date_range_from: dateRange?.from || null,
        date_range_to: dateRange?.to || null,
        filters: filters || {},
        summary: summary || null,
        asset_urls: assetUrls || [],
        created_by: req.auth.userId,
      })
      .select("id, title, type, status, summary, date_range_from, date_range_to, filters, created_at, updated_at")
      .single();

    if (error || !data) {
      return res.status(400).json({ message: error?.message || "Unable to create report" });
    }

    return created(res, { item: serializeReport(data) });
  }),
);

export default router;
