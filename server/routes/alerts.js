import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeAlert(alert) {
  return {
    _id: alert.id,
    ruleId: alert.rule_id,
    severity: alert.severity,
    type: alert.type,
    message: alert.message,
    status: alert.status,
    deliveryChannels: alert.delivery_channels || [],
    triggeredAt: alert.triggered_at,
    createdAt: alert.created_at,
    updatedAt: alert.updated_at,
    payload: alert.payload || undefined,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 100);
    const { data, error, count } = await supabaseAdmin
      .from("alerts")
      .select("id, rule_id, severity, type, message, status, delivery_channels, triggered_at, payload, created_at, updated_at", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("triggered_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return ok(res, {
      items: (data || []).map(serializeAlert),
      pagination: { total: count || 0 },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { ruleId, severity, type, message, status, deliveryChannels, triggeredAt } = req.body;
    const { data, error } = await supabaseAdmin
      .from("alerts")
      .insert({
        organization_id: req.auth.organizationId,
        rule_id: ruleId || null,
        severity,
        type,
        message,
        status: status || "open",
        delivery_channels: deliveryChannels || ["app"],
        triggered_at: triggeredAt || new Date().toISOString(),
      })
      .select("id, rule_id, severity, type, message, status, delivery_channels, triggered_at, payload, created_at, updated_at")
      .single();

    if (error || !data) {
      return res.status(400).json({ message: error?.message || "Unable to create alert" });
    }

    return created(res, { item: serializeAlert(data) });
  }),
);

router.patch(
  "/:id/acknowledge",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_by: req.auth.userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("organization_id", req.auth.organizationId)
      .eq("id", req.params.id)
      .select("id, rule_id, severity, type, message, status, delivery_channels, triggered_at, payload, created_at, updated_at")
      .single();

    if (error || !data) {
      return res.status(404).json({ message: error?.message || "Alert not found" });
    }

    return ok(res, { item: serializeAlert(data) });
  }),
);

export default router;
