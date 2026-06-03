import express from "express";
import { asyncHandler, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";
import { config } from "../config.js";

const router = express.Router();

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Unknown error";
}

// Public endpoint - no auth required for diagnostics
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ message: "SUPABASE_SERVICE_ROLE_KEY not configured" });
    }

    try {
      const { data: organizations, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .limit(10);

      if (orgError) throw orgError;

      const { data: influencers, error: infError } = await supabaseAdmin
        .from("influencers")
        .select("id, organization_id, name, handle")
        .limit(5);

      if (infError) throw infError;

      const { data: mentions, error: mentError } = await supabaseAdmin
        .from("mentions")
        .select("id, organization_id, headline")
        .limit(5);

      if (mentError) throw mentError;

      const { data: tvSegments, error: tvError } = await supabaseAdmin
        .from("tv_segments")
        .select("id, organization_id, channel, headline")
        .limit(5);

      // TV segments might not exist in all migrations, that's ok
      let tvSegmentsData = null;
      if (tvError && !tvError.message.includes("relation")) {
        throw tvError;
      }
      if (!tvError) {
        tvSegmentsData = tvSegments;
      }

      const { data: youtubeChannels, error: ytError } = await supabaseAdmin
        .from("tv_youtube_channels")
        .select("id, organization_id, channel_name")
        .limit(5);

      let youtubeChannelsData = null;
      if (ytError && !ytError.message.includes("relation")) {
        throw ytError;
      }
      if (!ytError) {
        youtubeChannelsData = youtubeChannels;
      }

      return ok(res, {
        database: "connected",
        integrations: {
          youtubeConfigured: Boolean(config.youtubeApiKey),
          geminiConfigured: Boolean(config.geminiApiKey),
          tiktokConfigured: Boolean(config.tiktokClientKey && config.tiktokClientSecret && config.tiktokRedirectUri),
        },
        organizations: {
          total: organizations?.length || 0,
          items: organizations || [],
        },
        influencers: {
          total: influencers?.length || 0,
          items: influencers || [],
          issue: influencers?.some((i) => !i.organization_id)
            ? "Some influencers have NULL organization_id"
            : "All influencers have organization_id",
        },
        mentions: {
          total: mentions?.length || 0,
          items: mentions || [],
          issue: mentions?.some((m) => !m.organization_id)
            ? "Some mentions have NULL organization_id"
            : "All mentions have organization_id",
        },
        tv_segments: tvSegmentsData ? {
          total: tvSegmentsData?.length || 0,
          items: tvSegmentsData || [],
          issue: tvSegmentsData?.some((s) => !s.organization_id)
            ? "Some TV segments have NULL organization_id"
            : "All TV segments have organization_id",
        } : { total: 0, items: [], note: "Table not found in this migration" },
        tv_youtube_channels: youtubeChannelsData ? {
          total: youtubeChannelsData?.length || 0,
          items: youtubeChannelsData || [],
          issue: youtubeChannelsData?.some((c) => !c.organization_id)
            ? "Some YouTube channels have NULL organization_id"
            : "All YouTube channels have organization_id",
        } : { total: 0, items: [], note: "Table not found in this migration" },
      });
    } catch (error) {
      return res.status(500).json({
        message: "Database connection failed",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Fix data: Assign organization_id to rows that don't have it
router.post(
  "/fix-organization-ids",
  asyncHandler(async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ message: "SUPABASE_SERVICE_ROLE_KEY not configured" });
    }

    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ message: "organizationId is required in request body" });
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    try {
      const fixes = {};

      // Fix influencers
      const { data: influencersFix, error: infFixError } = await supabaseAdmin
        .from("influencers")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (infFixError) throw infFixError;
      fixes.influencers = { fixed: influencersFix?.length || 0 };

      // Fix influencer_posts
      const { data: postsFix, error: postsFixError } = await supabaseAdmin
        .from("influencer_posts")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (postsFixError) throw postsFixError;
      fixes.influencer_posts = { fixed: postsFix?.length || 0 };

      // Fix mentions
      const { data: mentionsFix, error: mentFixError } = await supabaseAdmin
        .from("mentions")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (mentFixError) throw mentFixError;
      fixes.mentions = { fixed: mentionsFix?.length || 0 };

      // Fix narratives
      const { data: narrativesFix, error: narFixError } = await supabaseAdmin
        .from("narratives")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (narFixError) throw narFixError;
      fixes.narratives = { fixed: narrativesFix?.length || 0 };

      // Fix campaigns
      const { data: campaignsFix, error: campFixError } = await supabaseAdmin
        .from("campaigns")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (campFixError) throw campFixError;
      fixes.campaigns = { fixed: campaignsFix?.length || 0 };

      // Fix alerts
      const { data: alertsFix, error: alertFixError } = await supabaseAdmin
        .from("alerts")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (alertFixError) throw alertFixError;
      fixes.alerts = { fixed: alertsFix?.length || 0 };

      // Fix alert rules
      const { data: alertRulesFix, error: alertRulesFixError } = await supabaseAdmin
        .from("alert_rules")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (alertRulesFixError) throw alertRulesFixError;
      fixes.alert_rules = { fixed: alertRulesFix?.length || 0 };

      // Fix TV segments
      const { data: tvSegmentsFix, error: tvSegmentsFixError } = await supabaseAdmin
        .from("tv_segments")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (tvSegmentsFixError && !tvSegmentsFixError.message.includes("relation")) {
        throw tvSegmentsFixError;
      }
      if (!tvSegmentsFixError) {
        fixes.tv_segments = { fixed: tvSegmentsFix?.length || 0 };
      }

      // Fix TV YouTube channels
      const { data: ytChannelsFix, error: ytChannelsFixError } = await supabaseAdmin
        .from("tv_youtube_channels")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (ytChannelsFixError && !ytChannelsFixError.message.includes("relation")) {
        throw ytChannelsFixError;
      }
      if (!ytChannelsFixError) {
        fixes.tv_youtube_channels = { fixed: ytChannelsFix?.length || 0 };
      }

      // Fix TV YouTube videos
      const { data: ytVideosFix, error: ytVideosFixError } = await supabaseAdmin
        .from("tv_youtube_videos")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (ytVideosFixError && !ytVideosFixError.message.includes("relation")) {
        throw ytVideosFixError;
      }
      if (!ytVideosFixError) {
        fixes.tv_youtube_videos = { fixed: ytVideosFix?.length || 0 };
      }

      // Fix TV jobs
      const { data: tvJobsFix, error: tvJobsFixError } = await supabaseAdmin
        .from("tv_jobs")
        .update({ organization_id: organizationId })
        .is("organization_id", null)
        .select("id");

      if (tvJobsFixError && !tvJobsFixError.message.includes("relation")) {
        throw tvJobsFixError;
      }
      if (!tvJobsFixError) {
        fixes.tv_jobs = { fixed: tvJobsFix?.length || 0 };
      }

      return ok(res, {
        message: "Data fixed successfully",
        organizationId,
        fixes,
        totalFixed: Object.values(fixes).reduce((sum, item) => sum + (item.fixed || 0), 0),
      });
    } catch (error) {
      return res.status(500).json({
        message: "Error fixing data",
        error: getErrorMessage(error),
      });
    }
  }),
);

// Get a specific organization's user
router.get(
  "/get-user-org",
  asyncHandler(async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ message: "SUPABASE_SERVICE_ROLE_KEY not configured" });
    }

    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "userId query parameter is required" });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, organization:organizations(id, name, slug)")
      .eq("user_id", userId)
      .eq("status", "active");

    if (membersError) {
      return res.status(500).json({ message: membersError.message });
    }

    if (!members || members.length === 0) {
      return res.status(404).json({ message: "No active organization memberships found for this user" });
    }

    return ok(res, {
      userId,
      organizations: members,
    });
  }),
);

export default router;
