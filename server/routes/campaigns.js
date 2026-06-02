import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeCampaign(item) {
  return {
    _id: item.id,
    name: item.name,
    description: item.description,
    status: item.status,
    goal: item.goal,
    startDate: item.start_date,
    endDate: item.end_date,
    kpis: item.kpis || {},
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const { data, error, count } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, description, status, goal, start_date, end_date, kpis, created_at, updated_at", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("start_date", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return ok(res, {
      items: (data || []).map(serializeCampaign),
      pagination: { total: count || 0 },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, description, status, goal, startDate, endDate, kpis } = req.body;

    if (!name || !startDate) {
      return res.status(400).json({ message: "Name and startDate are required" });
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        organization_id: req.auth.organizationId,
        name,
        description,
        status: status || "draft",
        goal,
        start_date: startDate,
        end_date: endDate || null,
        owner_user_id: req.auth.userId,
        kpis: kpis || {},
      })
      .select("id, name, description, status, goal, start_date, end_date, kpis, created_at, updated_at")
      .single();

    if (error || !data) {
      return res.status(400).json({ message: error?.message || "Unable to create campaign" });
    }

    return created(res, { item: serializeCampaign(data) });
  }),
);

export default router;
