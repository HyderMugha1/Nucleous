import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { supabaseAdmin } from "../supabase.js";
import {
  createOrganizationWatchTerm,
  createSummarySchedule,
  deleteOrganizationWatchTerm,
  deleteSummarySchedule,
  listMediaKeywordDailyStats,
  listOrganizationWatchTerms,
  listRecentMediaSpikeAlerts,
  listSummaryDispatchLogs,
  listSummarySchedules,
  refreshMediaIntelligenceForOrganization,
  runSummarySchedule,
  updateOrganizationWatchTerm,
  updateSummarySchedule,
} from "../modules/mediaIntelligence/service.js";

const router = express.Router();
router.use(requireAuth, requireRole(["admin", "manager", "executive", "owner"]));

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;
    const [users, activeSources, mentions, openAlerts, latestJobs, auditLogs] = await Promise.all([
      supabaseAdmin.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
      supabaseAdmin.from("sources").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
      supabaseAdmin.from("mentions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      supabaseAdmin.from("alerts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "open"),
      supabaseAdmin.from("ingestion_jobs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("audit_logs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
    ]);

    return ok(res, {
      metrics: {
        users: users.count || 0,
        activeSources: activeSources.count || 0,
        mentions: mentions.count || 0,
        openAlerts: openAlerts.count || 0,
      },
      latestJobs: latestJobs.data || [],
      auditLogs: auditLogs.data || [],
    });
  }),
);

async function getOrganizationMapByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabaseAdmin.from("organizations").select("id, name, slug").in("id", uniqueIds);
  return new Map((data || []).map((item) => [item.id, item]));
}

async function getCountForTable(table, organizationId) {
  const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  return count || 0;
}

async function getTvDistribution(table) {
  const { data, error } = await supabaseAdmin.from(table).select("organization_id");
  if (error) return [];

  const counts = new Map();
  for (const row of data || []) {
    const orgId = row.organization_id;
    counts.set(orgId, (counts.get(orgId) || 0) + 1);
  }

  const organizationMap = await getOrganizationMapByIds(Array.from(counts.keys()));
  return Array.from(counts.entries())
    .map(([organizationId, count]) => {
      const org = organizationMap.get(organizationId);
      return {
        organizationId,
        organizationName: org?.name || "Unknown organization",
        organizationSlug: org?.slug || null,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);
}

router.get(
  "/workspace-diagnostics",
  asyncHandler(async (req, res) => {
    const organizationId = req.auth.organizationId;

    const [{ data: currentOrg }, { data: currentProfile }, tvSegmentsDistribution, tvChannelsDistribution, tvVideosDistribution, transcriptDistribution] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, name, slug").eq("id", organizationId).single(),
      supabaseAdmin.from("profiles").select("user_id, full_name, email, default_organization_id").eq("user_id", req.auth.userId).maybeSingle(),
      getTvDistribution("tv_segments"),
      getTvDistribution("tv_youtube_channels"),
      getTvDistribution("tv_youtube_videos"),
      getTvDistribution("tv_transcript_segments"),
    ]);

    const currentCounts = {
      mentions: await getCountForTable("mentions", organizationId),
      narratives: await getCountForTable("narratives", organizationId),
      alerts: await getCountForTable("alerts", organizationId),
      competitors: await supabaseAdmin.from("entities").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_competitor", true).then((r) => r.count || 0),
      tvSegments: await getCountForTable("tv_segments", organizationId),
      tvYoutubeChannels: await getCountForTable("tv_youtube_channels", organizationId),
      tvYoutubeVideos: await getCountForTable("tv_youtube_videos", organizationId),
      tvTranscriptSegments: await getCountForTable("tv_transcript_segments", organizationId),
    };

    const tvOrganizationsInPlay = [
      ...tvSegmentsDistribution.map((item) => item.organizationId),
      ...tvChannelsDistribution.map((item) => item.organizationId),
      ...tvVideosDistribution.map((item) => item.organizationId),
      ...transcriptDistribution.map((item) => item.organizationId),
    ];

    const uniqueTvOrgIds = [...new Set(tvOrganizationsInPlay)];
    const recommendations = [];

    if (uniqueTvOrgIds.length > 1) {
      recommendations.push("TV data exists across multiple organizations. Login only shows rows for the current workspace.");
    }
    if (currentCounts.tvTranscriptSegments === 0) {
      recommendations.push("Transcript search is empty because this workspace has no transcript segments yet.");
    }
    if (currentCounts.tvSegments === 0 && currentCounts.tvYoutubeVideos > 0) {
      recommendations.push("YouTube video records exist, but the legacy TV segment feed is empty for this workspace.");
    }

    return ok(res, {
      currentOrganization: currentOrg,
      currentUser: {
        userId: req.auth.userId,
        role: req.auth.role,
        fullName: currentProfile?.full_name || null,
        email: currentProfile?.email || null,
        defaultOrganizationId: currentProfile?.default_organization_id || null,
      },
      currentCounts,
      tvDistribution: {
        tv_segments: tvSegmentsDistribution,
        tv_youtube_channels: tvChannelsDistribution,
        tv_youtube_videos: tvVideosDistribution,
        tv_transcript_segments: transcriptDistribution,
      },
      recommendations,
    });
  }),
);

router.post(
  "/tv/reconcile",
  asyncHandler(async (req, res) => {
    const targetOrganizationId = String(req.body.targetOrganizationId || req.auth.organizationId);
    const sourceOrganizationId = String(req.body.sourceOrganizationId || "").trim();
    const dryRun = req.body.dryRun !== false;

    if (!sourceOrganizationId) {
      return res.status(400).json({ message: "sourceOrganizationId is required" });
    }

    if (sourceOrganizationId === targetOrganizationId) {
      return ok(res, {
        dryRun,
        targetOrganizationId,
        sourceOrganizationId,
        moved: {
          tv_segments: 0,
          tv_youtube_channels: 0,
          tv_youtube_videos: 0,
          tv_transcript_segments: 0,
          tv_processing_logs: 0,
        },
        conflicts: {
          tv_youtube_channels: [],
          tv_youtube_videos: [],
        },
        warning: "Source and target organizations are the same.",
      });
    }

    const [
      sourceChannelsResult,
      targetChannelsResult,
      sourceVideosResult,
      targetVideosResult,
      sourceSegmentsCount,
      sourceTranscriptCount,
      sourceProcessingLogsCount,
    ] = await Promise.all([
      supabaseAdmin.from("tv_youtube_channels").select("id, youtube_channel_id").eq("organization_id", sourceOrganizationId),
      supabaseAdmin.from("tv_youtube_channels").select("id, youtube_channel_id").eq("organization_id", targetOrganizationId),
      supabaseAdmin.from("tv_youtube_videos").select("id, channel_id, youtube_video_id").eq("organization_id", sourceOrganizationId),
      supabaseAdmin.from("tv_youtube_videos").select("id, youtube_video_id").eq("organization_id", targetOrganizationId),
      supabaseAdmin.from("tv_segments").select("id", { count: "exact", head: true }).eq("organization_id", sourceOrganizationId),
      supabaseAdmin.from("tv_transcript_segments").select("id", { count: "exact", head: true }).eq("organization_id", sourceOrganizationId),
      supabaseAdmin.from("tv_processing_logs").select("id", { count: "exact", head: true }).eq("organization_id", sourceOrganizationId),
    ]);

    const targetChannelIds = new Set((targetChannelsResult.data || []).map((row) => row.youtube_channel_id));
    const movableChannels = (sourceChannelsResult.data || []).filter((row) => !targetChannelIds.has(row.youtube_channel_id));
    const conflictingChannels = (sourceChannelsResult.data || []).filter((row) => targetChannelIds.has(row.youtube_channel_id));

    const targetVideoIds = new Set((targetVideosResult.data || []).map((row) => row.youtube_video_id));
    const movableVideos = (sourceVideosResult.data || []).filter((row) => !targetVideoIds.has(row.youtube_video_id));
    const conflictingVideos = (sourceVideosResult.data || []).filter((row) => targetVideoIds.has(row.youtube_video_id));

    const plan = {
      tv_segments: sourceSegmentsCount.count || 0,
      tv_youtube_channels: movableChannels.length,
      tv_youtube_videos: movableVideos.length,
      tv_transcript_segments: sourceTranscriptCount.count || 0,
      tv_processing_logs: sourceProcessingLogsCount.count || 0,
    };

    if (dryRun) {
      return ok(res, {
        dryRun: true,
        sourceOrganizationId,
        targetOrganizationId,
        moved: plan,
        conflicts: {
          tv_youtube_channels: conflictingChannels.map((row) => row.youtube_channel_id),
          tv_youtube_videos: conflictingVideos.map((row) => row.youtube_video_id),
        },
      });
    }

    let movedSegments = 0;
    let movedChannels = 0;
    let movedVideos = 0;
    let movedTranscriptSegments = 0;
    let movedProcessingLogs = 0;

    if ((sourceSegmentsCount.count || 0) > 0) {
      const { data } = await supabaseAdmin
        .from("tv_segments")
        .update({ organization_id: targetOrganizationId })
        .eq("organization_id", sourceOrganizationId)
        .select("id");
      movedSegments = data?.length || 0;
    }

    if (movableChannels.length > 0) {
      const channelIds = movableChannels.map((row) => row.id);
      const { data } = await supabaseAdmin
        .from("tv_youtube_channels")
        .update({ organization_id: targetOrganizationId })
        .in("id", channelIds)
        .select("id");
      movedChannels = data?.length || 0;
    }

    if (movableVideos.length > 0) {
      const videoIds = movableVideos.map((row) => row.id);
      const { data: videosData } = await supabaseAdmin
        .from("tv_youtube_videos")
        .update({ organization_id: targetOrganizationId })
        .in("id", videoIds)
        .select("id");
      movedVideos = videosData?.length || 0;

      const { data: transcriptData } = await supabaseAdmin
        .from("tv_transcript_segments")
        .update({ organization_id: targetOrganizationId })
        .in("video_id", videoIds)
        .select("id");
      movedTranscriptSegments = transcriptData?.length || 0;

      const movableChannelIds = movableChannels.map((row) => row.id);
      const processingLogsByVideo = await supabaseAdmin
        .from("tv_processing_logs")
        .update({ organization_id: targetOrganizationId })
        .eq("organization_id", sourceOrganizationId)
        .in("video_id", videoIds)
        .select("id");
      const processingLogsByChannel = movableChannelIds.length > 0
        ? await supabaseAdmin
            .from("tv_processing_logs")
            .update({ organization_id: targetOrganizationId })
            .eq("organization_id", sourceOrganizationId)
            .is("video_id", null)
            .in("channel_id", movableChannelIds)
            .select("id")
        : { data: [] };
      movedProcessingLogs = (processingLogsByVideo.data?.length || 0) + (processingLogsByChannel.data?.length || 0);
    }

    return ok(res, {
      dryRun: false,
      sourceOrganizationId,
      targetOrganizationId,
      moved: {
        tv_segments: movedSegments,
        tv_youtube_channels: movedChannels,
        tv_youtube_videos: movedVideos,
        tv_transcript_segments: movedTranscriptSegments,
        tv_processing_logs: movedProcessingLogs,
      },
      conflicts: {
        tv_youtube_channels: conflictingChannels.map((row) => row.youtube_channel_id),
        tv_youtube_videos: conflictingVideos.map((row) => row.youtube_video_id),
      },
    });
  }),
);

router.get(
  "/media-intelligence/watch-terms",
  asyncHandler(async (req, res) => {
    const items = await listOrganizationWatchTerms(req.auth.organizationId);
    return ok(res, { items });
  }),
);

router.post(
  "/media-intelligence/watch-terms",
  asyncHandler(async (req, res) => {
    const term = String(req.body.term || "").trim();
    const termType = String(req.body.termType || "").trim();

    if (!term) {
      return res.status(400).json({ message: "term is required" });
    }

    if (!["brand", "competitor", "keyword"].includes(termType)) {
      return res.status(400).json({ message: "termType must be brand, competitor, or keyword" });
    }

    const item = await createOrganizationWatchTerm(req.auth.organizationId, req.auth.userId, {
      term,
      termType,
      language: req.body.language,
      isActive: req.body.isActive,
      metadata: req.body.metadata,
    });

    return created(res, { item });
  }),
);

router.patch(
  "/media-intelligence/watch-terms/:id",
  asyncHandler(async (req, res) => {
    const item = await updateOrganizationWatchTerm(req.auth.organizationId, req.params.id, {
      term: req.body.term,
      termType: req.body.termType,
      language: req.body.language,
      isActive: req.body.isActive,
      metadata: req.body.metadata,
    });

    return ok(res, { item });
  }),
);

router.delete(
  "/media-intelligence/watch-terms/:id",
  asyncHandler(async (req, res) => {
    await deleteOrganizationWatchTerm(req.auth.organizationId, req.params.id);
    return ok(res, { success: true });
  }),
);

router.get(
  "/media-intelligence/daily-stats",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 50);
    const sourceKind = req.query.sourceKind ? String(req.query.sourceKind) : undefined;
    const items = await listMediaKeywordDailyStats(req.auth.organizationId, { limit, sourceKind });
    return ok(res, { items });
  }),
);

router.get(
  "/media-intelligence/alerts",
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit || 20);
    const items = await listRecentMediaSpikeAlerts(req.auth.organizationId, limit);
    return ok(res, { items });
  }),
);

router.post(
  "/media-intelligence/refresh",
  asyncHandler(async (req, res) => {
    const days = Number(req.body.days || 7);
    const createAlerts = req.body.createAlerts !== false;
    const result = await refreshMediaIntelligenceForOrganization({
      organizationId: req.auth.organizationId,
      from: req.body.from,
      to: req.body.to,
      days,
      createAlerts,
    });

    return ok(res, { result });
  }),
);

router.get(
  "/media-intelligence/schedules",
  asyncHandler(async (req, res) => {
    const [items, dispatchLogs] = await Promise.all([
      listSummarySchedules(req.auth.organizationId),
      listSummaryDispatchLogs(req.auth.organizationId, Number(req.query.logLimit || 20)),
    ]);
    return ok(res, { items, dispatchLogs });
  }),
);

router.post(
  "/media-intelligence/schedules",
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const frequency = String(req.body.frequency || "").trim();

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!["daily", "weekly"].includes(frequency)) {
      return res.status(400).json({ message: "frequency must be daily or weekly" });
    }

    const item = await createSummarySchedule(req.auth.organizationId, req.auth.userId, {
      name,
      frequency,
      deliveryChannels: req.body.deliveryChannels,
      hourOfDay: req.body.hourOfDay,
      dayOfWeek: req.body.dayOfWeek,
      isActive: req.body.isActive,
      recipients: req.body.recipients,
      metadata: req.body.metadata,
    });

    return created(res, { item });
  }),
);

router.patch(
  "/media-intelligence/schedules/:id",
  asyncHandler(async (req, res) => {
    const item = await updateSummarySchedule(req.auth.organizationId, req.params.id, {
      name: req.body.name,
      frequency: req.body.frequency,
      deliveryChannels: req.body.deliveryChannels,
      hourOfDay: req.body.hourOfDay,
      dayOfWeek: req.body.dayOfWeek,
      isActive: req.body.isActive,
      recipients: req.body.recipients,
      metadata: req.body.metadata,
    });
    return ok(res, { item });
  }),
);

router.delete(
  "/media-intelligence/schedules/:id",
  asyncHandler(async (req, res) => {
    await deleteSummarySchedule(req.auth.organizationId, req.params.id);
    return ok(res, { success: true });
  }),
);

router.post(
  "/media-intelligence/schedules/:id/run",
  asyncHandler(async (req, res) => {
    const schedules = await listSummarySchedules(req.auth.organizationId);
    const schedule = schedules.find((item) => item.id === req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    const result = await runSummarySchedule(schedule);
    return ok(res, { result });
  }),
);

export default router;
