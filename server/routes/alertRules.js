import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();
router.use(requireAuth);

function serializeAlertRule(rule, entityIds = [], narrativeIds = []) {
  return {
    _id: rule.id,
    name: rule.name,
    type: rule.type,
    entityIds,
    narrativeIds,
    thresholdValue: rule.threshold_value,
    thresholdWindow: rule.threshold_window,
    deliveryChannels: rule.delivery_channels || [],
    status: rule.status,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const { data: rules, error, count } = await supabaseAdmin
      .from("alert_rules")
      .select("id, name, type, threshold_value, threshold_window, delivery_channels, status, created_at, updated_at", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const ruleIds = (rules || []).map((rule) => rule.id);
    let entityRows = [];
    let narrativeRows = [];

    if (ruleIds.length > 0) {
      const [{ data: entities }, { data: narratives }] = await Promise.all([
        supabaseAdmin
          .from("alert_rule_entities")
          .select("alert_rule_id, entity_id")
          .in("alert_rule_id", ruleIds),
        supabaseAdmin
          .from("alert_rule_narratives")
          .select("alert_rule_id, narrative_id")
          .in("alert_rule_id", ruleIds),
      ]);

      entityRows = entities || [];
      narrativeRows = narratives || [];
    }

    return ok(res, {
      items: (rules || []).map((rule) =>
        serializeAlertRule(
          rule,
          entityRows.filter((row) => row.alert_rule_id === rule.id).map((row) => row.entity_id),
          narrativeRows.filter((row) => row.alert_rule_id === rule.id).map((row) => row.narrative_id),
        ),
      ),
      pagination: { total: count || 0 },
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, type, entityIds, narrativeIds, thresholdValue, thresholdWindow, deliveryChannels, status } = req.body;

    if (!name || !type || thresholdValue === undefined || !thresholdWindow) {
      return res.status(400).json({ message: "Missing required alert rule fields" });
    }

    const { data: rule, error } = await supabaseAdmin
      .from("alert_rules")
      .insert({
        organization_id: req.auth.organizationId,
        name,
        type,
        threshold_value: thresholdValue,
        threshold_window: thresholdWindow,
        delivery_channels: deliveryChannels || ["email", "app"],
        status: status || "active",
        created_by: req.auth.userId,
      })
      .select("id, name, type, threshold_value, threshold_window, delivery_channels, status, created_at, updated_at")
      .single();

    if (error || !rule) {
      return res.status(400).json({ message: error?.message || "Unable to create alert rule" });
    }

    if (Array.isArray(entityIds) && entityIds.length > 0) {
      await supabaseAdmin.from("alert_rule_entities").insert(
        entityIds.map((entityId) => ({
          organization_id: req.auth.organizationId,
          alert_rule_id: rule.id,
          entity_id: entityId,
        })),
      );
    }

    if (Array.isArray(narrativeIds) && narrativeIds.length > 0) {
      await supabaseAdmin.from("alert_rule_narratives").insert(
        narrativeIds.map((narrativeId) => ({
          organization_id: req.auth.organizationId,
          alert_rule_id: rule.id,
          narrative_id: narrativeId,
        })),
      );
    }

    return created(res, {
      item: serializeAlertRule(rule, entityIds || [], narrativeIds || []),
    });
  }),
);

export default router;
