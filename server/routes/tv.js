import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";
import { config } from "../config.js";
import {
  createTvChannel,
  getTvProcessingLogs,
  listTvChannels,
  listTvVideos,
  processVideoTranscription,
  queueTvJob,
  searchTranscriptSegments,
} from "../modules/tv/service.js";

const router = express.Router();
router.use(requireAuth);

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    return ok(res, {
      integrations: {
        youtubeConfigured: Boolean(config.youtubeApiKey),
        geminiConfigured: Boolean(config.geminiApiKey),
        tiktokConfigured: Boolean(config.tiktokClientKey && config.tiktokClientSecret && config.tiktokRedirectUri),
      },
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("tv_segments")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("aired_at", { ascending: false })
      .range(skip, skip + limit - 1);

    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`channel.ilike.%${search}%,show_name.ilike.%${search}%,anchor_name.ilike.%${search}%,headline.ilike.%${search}%,transcript_snippet.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, {
      items: data || [],
      pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) },
    });
  }),
);

router.get(
  "/channels",
  asyncHandler(async (req, res) => {
    const items = await listTvChannels(req.auth.organizationId);
    return ok(res, { items });
  }),
);

router.post(
  "/channels",
  asyncHandler(async (req, res) => {
    const youtubeChannelId = String(req.body.youtubeChannelId || "").trim();
    if (!youtubeChannelId) {
      return res.status(400).json({ message: "youtubeChannelId is required" });
    }

    const item = await createTvChannel({
      organizationId: req.auth.organizationId,
      createdBy: req.auth.userId,
      youtubeChannelId,
    });

    await queueTvJob({
      organizationId: req.auth.organizationId,
      channelId: item.id,
      jobType: "channel_sync",
      provider: "youtube",
      payload: { youtubeChannelId },
    });

    return created(res, { item, queued: true });
  }),
);

router.post(
  "/channels/:id/sync",
  asyncHandler(async (req, res) => {
    const job = await queueTvJob({
      organizationId: req.auth.organizationId,
      channelId: req.params.id,
      jobType: "channel_sync",
      provider: "youtube",
      payload: { channelId: req.params.id },
    });

    return created(res, { queued: true, job });
  }),
);

router.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query);
    const result = await listTvVideos({
      organizationId: req.auth.organizationId,
      channelId: req.query.channelId ? String(req.query.channelId) : null,
      search: req.query.search ? String(req.query.search) : "",
      page,
      limit,
    });

    return ok(res, {
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.max(1, Math.ceil(result.total / limit)),
      },
    });
  }),
);

router.post(
  "/videos/:id/process",
  asyncHandler(async (req, res) => {
    const job = await queueTvJob({
      organizationId: req.auth.organizationId,
      videoId: req.params.id,
      jobType: "video_transcription",
      provider: "gemini",
      payload: { videoId: req.params.id },
    });

    await supabaseAdmin
      .from("tv_youtube_videos")
      .update({ processing_status: "queued" })
      .eq("organization_id", req.auth.organizationId)
      .eq("id", req.params.id);

    return created(res, { queued: true, job });
  }),
);

router.post(
  "/videos/:id/process-now",
  asyncHandler(async (req, res) => {
    const result = await processVideoTranscription({
      organizationId: req.auth.organizationId,
      videoId: req.params.id,
    });
    return ok(res, { item: result });
  }),
);

router.post(
  "/videos/:id/generate-srt",
  asyncHandler(async (req, res) => {
    const job = await queueTvJob({
      organizationId: req.auth.organizationId,
      videoId: req.params.id,
      jobType: "srt_generation",
      provider: "supabase-storage",
      payload: { videoId: req.params.id },
    });

    return created(res, { queued: true, job });
  }),
);

router.post(
  "/videos/:id/retry",
  asyncHandler(async (req, res) => {
    const job = await queueTvJob({
      organizationId: req.auth.organizationId,
      videoId: req.params.id,
      jobType: "retry_failed",
      provider: "gemini",
      payload: { videoId: req.params.id },
    });

    await supabaseAdmin
      .from("tv_youtube_videos")
      .update({ processing_status: "queued" })
      .eq("organization_id", req.auth.organizationId)
      .eq("id", req.params.id);

    return created(res, { queued: true, job });
  }),
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return ok(res, { items: [], message: "No record found." });
    }

    const items = await searchTranscriptSegments({
      organizationId: req.auth.organizationId,
      query: q,
      limit: Math.min(100, Number(req.query.limit || 50)),
    });

    return ok(res, {
      items,
      message: items.length > 0 ? undefined : "No record found.",
    });
  }),
);

router.get(
  "/jobs/logs",
  asyncHandler(async (req, res) => {
    const videoId = req.query.videoId ? String(req.query.videoId) : null;
    const items = await getTvProcessingLogs({
      organizationId: req.auth.organizationId,
      videoId,
    });

    return ok(res, { items });
  }),
);

export default router;
