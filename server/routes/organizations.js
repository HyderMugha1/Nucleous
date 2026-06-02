import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeOrganization(item) {
  return {
    _id: item.id,
    name: item.name,
    slug: item.slug,
    industry: item.industry,
    country: item.country,
    subscriptionPlan: item.subscription_plan,
    status: item.status,
    competitorNames: item.competitor_names || [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", req.auth.organizationId)
      .single();
    if (error || !data) return res.status(404).json({ message: error?.message || "Organization not found" });
    return ok(res, { organization: serializeOrganization(data) });
  }),
);

router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update({
        name: payload.name,
        industry: payload.industry,
        country: payload.country,
        subscription_plan: payload.subscriptionPlan,
        status: payload.status,
        competitor_names: payload.competitorNames,
      })
      .eq("id", req.auth.organizationId)
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to update organization" });
    return ok(res, { organization: serializeOrganization(data) });
  }),
);

export default router;
