import { supabaseAdmin } from "../../supabase.js";
import { buildSrt } from "./srt.js";
import { transcribeVideoWithApifyLanguage } from "./apify.js";
import { normalizeSearchableText, buildYouTubeRedirect } from "./utils.js";
import { fetchAllChannelVideos, fetchChannelMetadata } from "./youtube.js";
import { config } from "../../config.js";
import {
  mapOutputLanguageLabel,
  normalizeTranscriptOutputLanguage,
  translateSegments,
  transliterateSegmentsToRomanUrdu,
} from "./translation.js";
import {
  buildTikTokAuthUrl,
  createTikTokState,
  exchangeTikTokCodeForToken,
  fetchTikTokUserInfo,
  fetchTikTokVideoDetails,
  fetchTikTokVideoList,
  parseTikTokState,
  refreshTikTokAccessToken,
} from "./tiktok.js";

function isTranscriptionQuotaErrorMessage(message) {
  return /quota exceeded|rate limit|429|usage limit|insufficient/i.test(String(message || ""));
}

function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }
}

export async function createTvChannel({ organizationId, createdBy, youtubeChannelId }) {
  ensureAdminClient();
  const channel = await fetchChannelMetadata(youtubeChannelId);

  const { data: existingChannel, error: existingError } = await supabaseAdmin
    .from("tv_youtube_channels")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("youtube_channel_id", channel.youtubeChannelId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Unable to check existing TV channel");
  }

  if (existingChannel) {
    const { data: refreshedChannel, error: refreshError } = await supabaseAdmin
      .from("tv_youtube_channels")
      .update({
        channel_name: channel.channelName,
        thumbnail_url: channel.thumbnailUrl,
        channel_url: channel.channelUrl,
        status: "active",
      })
      .eq("id", existingChannel.id)
      .select("*")
      .single();

    if (refreshError || !refreshedChannel) {
      throw new Error(refreshError?.message || "Unable to refresh existing TV channel");
    }

    return { ...refreshedChannel, uploadsPlaylistId: channel.uploadsPlaylistId };
  }

  const { data, error } = await supabaseAdmin
    .from("tv_youtube_channels")
    .insert({
      organization_id: organizationId,
      youtube_channel_id: channel.youtubeChannelId,
      channel_name: channel.channelName,
      thumbnail_url: channel.thumbnailUrl,
      channel_url: channel.channelUrl,
      created_by: createdBy || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      const { data: duplicateChannel, error: duplicateError } = await supabaseAdmin
        .from("tv_youtube_channels")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("youtube_channel_id", channel.youtubeChannelId)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message || "Unable to load existing TV channel");
      }

      if (duplicateChannel) {
        return { ...duplicateChannel, uploadsPlaylistId: channel.uploadsPlaylistId };
      }
    }

    throw new Error(error?.message || "Unable to create TV channel");
  }

  return { ...data, uploadsPlaylistId: channel.uploadsPlaylistId };
}

export async function listTvChannels(organizationId) {
  ensureAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tv_youtube_channels")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const channels = data || [];
  const enrichedChannels = await Promise.all(
    channels.map(async (channel) => {
      const [videosCountResponse, completedCountResponse, latestVideoResponse] = await Promise.all([
        supabaseAdmin
          .from("tv_youtube_videos")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("channel_id", channel.id),
        supabaseAdmin
          .from("tv_youtube_videos")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("channel_id", channel.id)
          .not("transcript_text", "is", null),
        supabaseAdmin
          .from("tv_youtube_videos")
          .select("published_at")
          .eq("organization_id", organizationId)
          .eq("channel_id", channel.id)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        ...channel,
        video_count: videosCountResponse.count || 0,
        transcribed_video_count: completedCountResponse.count || 0,
        latest_video_published_at: latestVideoResponse.data?.published_at || null,
      };
    }),
  );

  return enrichedChannels;
}

export async function queueTvJob({ organizationId, channelId = null, videoId = null, jobType, provider = null, payload = {} }) {
  ensureAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tv_processing_logs")
    .insert({
      organization_id: organizationId,
      channel_id: channelId,
      video_id: videoId,
      job_type: jobType,
      job_status: "queued",
      provider,
      payload,
      attempts: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to queue TV job");
  }

  return data;
}

export async function getTikTokConnectUrl({ organizationId, userId }) {
  ensureAdminClient();
  const state = createTikTokState({ organizationId, userId });
  return { url: buildTikTokAuthUrl({ state }) };
}

async function upsertTikTokAccountTokens({ organizationId, userId, profile, tokenData, existingId = null }) {
  const payload = {
    organization_id: organizationId,
    tiktok_open_id: profile.open_id,
    union_id: profile.union_id || null,
    display_name: profile.display_name || "TikTok Creator",
    username: profile.display_name || null,
    avatar_url: profile.avatar_url || null,
    profile_url: profile.profile_deep_link || null,
    bio_description: profile.bio_description || null,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : null,
    refresh_expires_at: tokenData.refresh_expires_in ? new Date(Date.now() + Number(tokenData.refresh_expires_in) * 1000).toISOString() : null,
    scopes: String(tokenData.scope || "").split(",").map((item) => item.trim()).filter(Boolean),
    status: "active",
    created_by: userId,
  };

  const { data, error } = await supabaseAdmin
    .from("tv_tiktok_accounts")
    .upsert(payload, { onConflict: "organization_id,tiktok_open_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save TikTok account");
  }

  if (existingId && existingId !== data.id) {
    await supabaseAdmin
      .from("tv_tiktok_videos")
      .update({ account_id: data.id })
      .eq("organization_id", organizationId)
      .eq("account_id", existingId);
  }

  return data;
}

export async function connectTikTokAccountFromCallback({ code, state }) {
  ensureAdminClient();
  const parsedState = parseTikTokState(state);
  const tokenData = await exchangeTikTokCodeForToken(code);
  const profile = await fetchTikTokUserInfo(tokenData.access_token);
  const account = await upsertTikTokAccountTokens({
    organizationId: parsedState.organizationId,
    userId: parsedState.userId,
    profile,
    tokenData,
  });

  return {
    account,
    organizationId: parsedState.organizationId,
  };
}

export async function listTikTokAccounts(organizationId) {
  ensureAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tv_tiktok_accounts")
    .select("id, tiktok_open_id, display_name, username, avatar_url, profile_url, bio_description, status, last_synced_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function listTikTokVideos({ organizationId, accountId = null, page = 1, limit = 20 }) {
  ensureAdminClient();
  const skip = (page - 1) * limit;
  let query = supabaseAdmin
    .from("tv_tiktok_videos")
    .select("*, tv_tiktok_accounts(id, display_name, avatar_url)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false })
    .range(skip, skip + limit - 1);

  if (accountId) query = query.eq("account_id", accountId);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: data || [], total: count || 0 };
}

async function ensureFreshTikTokAccessToken(account) {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  const shouldRefresh = !expiresAt || expiresAt - Date.now() < 5 * 60 * 1000;
  if (!shouldRefresh) return account;

  const refreshed = await refreshTikTokAccessToken(account.refresh_token);
  const profile = await fetchTikTokUserInfo(refreshed.access_token);
  return upsertTikTokAccountTokens({
    organizationId: account.organization_id,
    userId: account.created_by,
    profile,
    tokenData: refreshed,
    existingId: account.id,
  });
}

export async function syncTikTokAccountVideos({ organizationId, accountId }) {
  ensureAdminClient();

  const { data: existingAccount, error: accountError } = await supabaseAdmin
    .from("tv_tiktok_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", accountId)
    .single();

  if (accountError || !existingAccount) {
    throw new Error(accountError?.message || "TikTok account not found");
  }

  const account = await ensureFreshTikTokAccessToken(existingAccount);
  const collected = [];
  let cursor = undefined;
  let hasMore = true;
  let pages = 0;

  while (hasMore && pages < 5) {
    const batch = await fetchTikTokVideoList(account.access_token, cursor, 20);
    const videos = Array.isArray(batch.videos) ? batch.videos : [];
    collected.push(...videos);
    hasMore = Boolean(batch.has_more);
    cursor = batch.cursor;
    pages += 1;
  }

  const detailMap = new Map();
  for (let index = 0; index < collected.length; index += 20) {
    const ids = collected.slice(index, index + 20).map((item) => item.id).filter(Boolean);
    const details = await fetchTikTokVideoDetails(account.access_token, ids);
    for (const item of details) {
      detailMap.set(item.id, item);
    }
  }

  const rows = collected
    .filter((item) => item.id && item.share_url && item.create_time)
    .map((item) => {
      const detail = detailMap.get(item.id) || item;
      return {
        organization_id: organizationId,
        account_id: account.id,
        tiktok_video_id: item.id,
        title: detail.title || item.title || null,
        video_description: detail.video_description || item.video_description || null,
        cover_image_url: detail.cover_image_url || item.cover_image_url || null,
        share_url: detail.share_url || item.share_url,
        embed_link: detail.embed_link || null,
        embed_html: detail.embed_html || null,
        duration_seconds: detail.duration ? Number(detail.duration) : null,
        width: detail.width ? Number(detail.width) : null,
        height: detail.height ? Number(detail.height) : null,
        like_count: detail.like_count ? Number(detail.like_count) : null,
        comment_count: detail.comment_count ? Number(detail.comment_count) : null,
        share_count: detail.share_count ? Number(detail.share_count) : null,
        view_count: detail.view_count ? Number(detail.view_count) : null,
        published_at: new Date(Number(detail.create_time || item.create_time) * 1000).toISOString(),
      };
    });

  if (rows.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from("tv_tiktok_videos")
      .upsert(rows, { onConflict: "organization_id,tiktok_video_id" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  await supabaseAdmin
    .from("tv_tiktok_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", account.id);

  return { account, videos: rows };
}

export async function queueTikTokAccountSync({ organizationId, accountId }) {
  ensureAdminClient();
  return queueTvJob({
    organizationId,
    jobType: "tiktok_account_sync",
    provider: "tiktok",
    payload: { tiktokAccountId: accountId },
  });
}

export async function syncChannelVideos({ organizationId, channelId, maxVideos = 40 }) {
  ensureAdminClient();

  const { data: channel, error: channelError } = await supabaseAdmin
    .from("tv_youtube_channels")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", channelId)
    .single();

  if (channelError || !channel) {
    throw new Error(channelError?.message || "TV channel not found");
  }

  const metadata = await fetchChannelMetadata(channel.youtube_channel_id);
  const videos = await fetchAllChannelVideos(metadata.uploadsPlaylistId, { maxVideos });

  const upsertRows = videos.map((video) => ({
    organization_id: organizationId,
    channel_id: channel.id,
    youtube_video_id: video.youtubeVideoId,
    title: video.title,
    thumbnail_url: video.thumbnailUrl,
    youtube_url: video.youtubeUrl,
    published_at: video.publishedAt,
    duration_iso: video.durationIso,
    duration_seconds: video.durationSeconds,
  }));

  const { data: savedVideos, error: upsertError } = await supabaseAdmin
    .from("tv_youtube_videos")
    .upsert(upsertRows, { onConflict: "organization_id,youtube_video_id" })
    .select("*");

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  await supabaseAdmin
    .from("tv_youtube_channels")
    .update({ last_synced_at: new Date().toISOString(), status: "active" })
    .eq("id", channel.id);

  return { channel, videos: savedVideos || [] };
}

export async function listTvVideos({
  organizationId,
  channelId = null,
  search = "",
  page = 1,
  limit = 20,
  status = "all",
}) {
  ensureAdminClient();
  let query = supabaseAdmin
    .from("tv_youtube_videos")
    .select("*, tv_youtube_channels(id, channel_name, thumbnail_url)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false })
    .range(0, Math.max(limit * page, limit) - 1);

  if (channelId) query = query.eq("channel_id", channelId);
  if (search) query = query.or(`title.ilike.%${search}%,youtube_video_id.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const items = data || [];
  const videoIds = items.map((item) => item.id).filter(Boolean);

  let transcriptCounts = new Map();
  let latestLogs = new Map();

  if (videoIds.length > 0) {
    const [{ data: transcriptRows, error: transcriptError }, { data: logRows, error: logError }] = await Promise.all([
      supabaseAdmin
        .from("tv_transcript_segments")
        .select("video_id")
        .eq("organization_id", organizationId)
        .in("video_id", videoIds),
      supabaseAdmin
        .from("tv_processing_logs")
        .select("video_id, job_status, error_message, created_at")
        .eq("organization_id", organizationId)
        .in("video_id", videoIds)
        .order("created_at", { ascending: false }),
    ]);

    if (transcriptError) throw new Error(transcriptError.message);
    if (logError) throw new Error(logError.message);

    transcriptCounts = new Map();
    for (const row of transcriptRows || []) {
      transcriptCounts.set(row.video_id, (transcriptCounts.get(row.video_id) || 0) + 1);
    }

    latestLogs = new Map();
    for (const row of logRows || []) {
      if (!row.video_id || latestLogs.has(row.video_id)) continue;
      latestLogs.set(row.video_id, row);
    }
  }

  const enrichedItems = items.map((item) => {
      const latestLog = latestLogs.get(item.id);
      const transcriptPreview = item.transcript_text
        ? String(item.transcript_text).replace(/\s+/g, " ").trim().slice(0, 280)
        : null;
      const transcriptCount = transcriptCounts.get(item.id) || 0;
      const effectiveStatus = transcriptCount > 0 || transcriptPreview ? "completed" : item.processing_status;

      return {
        ...item,
        processing_status: effectiveStatus,
        transcript_segment_count: transcriptCount,
        transcript_preview: transcriptPreview,
        latest_job_status: latestLog?.job_status || null,
        latest_job_error: latestLog?.error_message || null,
      };
    });

  const filteredItems = enrichedItems.filter((item) => {
    if (status === "transcribed") {
      return item.processing_status === "completed";
    }

    if (status === "non_transcribed") {
      return ["pending", "failed"].includes(item.processing_status);
    }

    if (status === "processing") {
      return ["queued", "processing"].includes(item.processing_status);
    }

    return true;
  });

  const skip = (page - 1) * limit;

  return {
    items: filteredItems.slice(skip, skip + limit),
    total: filteredItems.length,
    unfilteredTotal: count || 0,
  };
}

export async function processVideoTranscription({
  organizationId,
  videoId,
  generateSrt = true,
  processingLogId = null,
  jobType = "video_transcription",
  trigger = "manual",
  outputLanguage = "original",
}) {
  ensureAdminClient();
  const normalizedOutputLanguage = normalizeTranscriptOutputLanguage(outputLanguage);

  const { data: video, error: videoError } = await supabaseAdmin
    .from("tv_youtube_videos")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", videoId)
    .single();

  if (videoError || !video) {
    throw new Error(videoError?.message || "TV video not found");
  }

  let createdLogId = null;

  await supabaseAdmin
    .from("tv_youtube_videos")
    .update({ processing_status: "processing" })
    .eq("id", video.id);

  try {
    if (!processingLogId) {
      const { data: logRow, error: logError } = await supabaseAdmin
        .from("tv_processing_logs")
        .insert({
          organization_id: organizationId,
          channel_id: video.channel_id,
          video_id: video.id,
          job_type: jobType,
          job_status: "processing",
          provider: "apify",
          payload: { trigger, outputLanguage: normalizedOutputLanguage },
          attempts: 1,
        })
        .select("id")
        .single();

      if (!logError && logRow?.id) {
        createdLogId = logRow.id;
      }
    }

    let transcript = await transcribeVideoWithApifyLanguage(
      video.youtube_url,
      normalizedOutputLanguage === "english"
        ? "en"
        : normalizedOutputLanguage === "urdu" || normalizedOutputLanguage === "roman_urdu"
          ? "ur"
          : null,
    );

    let outputSegments = transcript.segments;
    let outputLanguageLabel = transcript.language || "unknown";

    if (normalizedOutputLanguage === "english" && !/^en/i.test(String(transcript.language || ""))) {
      outputSegments = await translateSegments(outputSegments, "en");
      outputLanguageLabel = "english";
    } else if (normalizedOutputLanguage === "urdu" && !/^ur/i.test(String(transcript.language || ""))) {
      outputSegments = await translateSegments(outputSegments, "ur");
      outputLanguageLabel = "urdu";
    } else if (normalizedOutputLanguage === "roman_urdu") {
      const urduSegments = /^ur/i.test(String(transcript.language || ""))
        ? outputSegments
        : await translateSegments(outputSegments, "ur");
      outputSegments = transliterateSegmentsToRomanUrdu(urduSegments);
      outputLanguageLabel = "roman-urdu";
    }

    const normalizedSegments = outputSegments.map((segment) => ({
      organization_id: organizationId,
      video_id: video.id,
      segment_index: segment.segment_index,
      start_sec: segment.start_sec,
      end_sec: segment.end_sec,
      text: segment.text,
      searchable_text: normalizeSearchableText(segment.text),
    }));

    await supabaseAdmin.from("tv_transcript_segments").delete().eq("video_id", video.id);

    if (normalizedSegments.length > 0) {
      const { error: segmentError } = await supabaseAdmin
        .from("tv_transcript_segments")
        .insert(normalizedSegments);

      if (segmentError) {
        throw new Error(segmentError.message);
      }
    }

    const transcriptText = normalizedSegments.map((segment) => segment.text).join(" ");

    await supabaseAdmin
      .from("tv_youtube_videos")
      .update({
        transcript_text: transcriptText,
        transcript_language: outputLanguageLabel,
        processing_status: generateSrt ? "processing" : "completed",
        last_processed_at: new Date().toISOString(),
        transcript_version: (video.transcript_version || 0) + 1,
      })
      .eq("id", video.id);

    if (generateSrt) {
      await generateAndStoreSrt({ organizationId, videoId: video.id });
    }

    if (createdLogId) {
      await supabaseAdmin
        .from("tv_processing_logs")
        .update({
          job_status: "completed",
          provider: "apify",
          error_message: null,
          error_code: null,
          payload: {
            trigger,
            segmentCount: normalizedSegments.length,
            generatedSrt: generateSrt,
            actorId: config.tvTranscriptionActorId,
            outputLanguage: normalizedOutputLanguage,
            outputLanguageLabel: mapOutputLanguageLabel(normalizedOutputLanguage),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", createdLogId);
    }

    return { videoId: video.id, segmentCount: normalizedSegments.length };
  } catch (error) {
    await supabaseAdmin
      .from("tv_youtube_videos")
      .update({ processing_status: "failed", last_processed_at: new Date().toISOString() })
      .eq("id", video.id);

    if (createdLogId) {
      await supabaseAdmin
        .from("tv_processing_logs")
        .update({
          job_status: "failed",
          provider: "apify",
          error_message: error instanceof Error ? error.message : "TV transcription failed",
          error_code: isTranscriptionQuotaErrorMessage(error instanceof Error ? error.message : "") ? "TRANSCRIPTION_QUOTA" : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", createdLogId);
    }
    throw error;
  }
}

export async function getTvAutoTranscriptionQuotaStatus() {
  ensureAdminClient();

  const windowStart = new Date(Date.now() - config.tvAutoTranscribeWindowHours * 60 * 60 * 1000).toISOString();
  const dailyLimit = Math.max(0, config.tvAutoTranscribeDailyLimit);

  const { count, error } = await supabaseAdmin
    .from("tv_processing_logs")
    .select("id", { count: "exact", head: true })
    .in("job_type", ["video_transcription", "retry_failed"])
    .eq("job_status", "completed")
    .gte("updated_at", windowStart);

  if (error) {
    throw new Error(error.message);
  }

  const used = count || 0;

  return {
    dailyLimit,
    used,
    remaining: Math.max(0, dailyLimit - used),
    windowStart,
  };
}

async function listAutoTranscriptionCandidates({ limit }) {
  ensureAdminClient();

  if (limit <= 0) {
    return [];
  }

  const pendingResponse = await supabaseAdmin
    .from("tv_youtube_videos")
    .select("id, organization_id, processing_status, published_at, last_processed_at")
    .is("transcript_text", null)
    .eq("processing_status", "pending")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (pendingResponse.error) {
    throw new Error(pendingResponse.error.message);
  }

  const pendingItems = pendingResponse.data || [];
  if (pendingItems.length >= limit) {
    return pendingItems;
  }

  const retryCutoff = new Date(Date.now() - config.tvAutoTranscribeRetryFailedAfterHours * 60 * 60 * 1000).toISOString();
  const failedResponse = await supabaseAdmin
    .from("tv_youtube_videos")
    .select("id, organization_id, processing_status, published_at, last_processed_at")
    .is("transcript_text", null)
    .eq("processing_status", "failed")
    .lt("last_processed_at", retryCutoff)
    .order("last_processed_at", { ascending: true })
    .limit(limit - pendingItems.length);

  if (failedResponse.error) {
    throw new Error(failedResponse.error.message);
  }

  return [...pendingItems, ...(failedResponse.data || [])];
}

export async function runTvAutoTranscriptionCycle() {
  ensureAdminClient();

  if (config.tvAutoTranscribeEnabled !== "true") {
    return {
      enabled: false,
      processed: 0,
      failed: 0,
      dailyLimit: Math.max(0, config.tvAutoTranscribeDailyLimit),
      used: 0,
      remaining: 0,
      stoppedReason: "Auto transcription disabled",
      items: [],
    };
  }

  if (!config.apifyToken) {
    return {
      enabled: true,
      processed: 0,
      failed: 0,
      dailyLimit: Math.max(0, config.tvAutoTranscribeDailyLimit),
      used: 0,
      remaining: 0,
      stoppedReason: "Apify token missing",
      items: [],
    };
  }

  const quota = await getTvAutoTranscriptionQuotaStatus();
  const allowedThisRun = Math.min(
    Math.max(0, config.tvAutoTranscribeBatchSize),
    quota.remaining,
  );

  if (allowedThisRun <= 0) {
    return {
      enabled: true,
      processed: 0,
      failed: 0,
      dailyLimit: quota.dailyLimit,
      used: quota.used,
      remaining: quota.remaining,
      stoppedReason: "Daily transcription limit reached",
      items: [],
    };
  }

  const candidates = await listAutoTranscriptionCandidates({ limit: allowedThisRun });
  const results = [];
  let processed = 0;
  let failed = 0;
  let stoppedReason = candidates.length === 0 ? "No queued videos are eligible for automatic transcription" : null;

  for (const candidate of candidates) {
    try {
      const item = await processVideoTranscription({
        organizationId: candidate.organization_id,
        videoId: candidate.id,
        generateSrt: true,
        jobType: candidate.processing_status === "failed" ? "retry_failed" : "video_transcription",
        trigger: "auto-cron",
      });
      processed += 1;
      results.push({ videoId: candidate.id, organizationId: candidate.organization_id, status: "completed", segmentCount: item.segmentCount });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Auto transcription failed";
      results.push({ videoId: candidate.id, organizationId: candidate.organization_id, status: "failed", error: message });

      if (isTranscriptionQuotaErrorMessage(message)) {
        stoppedReason = "Transcription provider quota exhausted during auto transcription";
        break;
      }
    }
  }

  const refreshedQuota = await getTvAutoTranscriptionQuotaStatus();

  return {
    enabled: true,
    processed,
    failed,
    dailyLimit: refreshedQuota.dailyLimit,
    used: refreshedQuota.used,
    remaining: refreshedQuota.remaining,
    stoppedReason,
    items: results,
  };
}

export async function generateAndStoreSrt({ organizationId, videoId }) {
  ensureAdminClient();

  const { data: video, error: videoError } = await supabaseAdmin
    .from("tv_youtube_videos")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", videoId)
    .single();
  if (videoError || !video) throw new Error(videoError?.message || "TV video not found");

  const { data: segments, error: segmentError } = await supabaseAdmin
    .from("tv_transcript_segments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("video_id", videoId)
    .order("segment_index", { ascending: true });
  if (segmentError) throw new Error(segmentError.message);

  const srtContent = buildSrt(segments || []);
  const storagePath = `${organizationId}/tv-srt/${video.youtube_video_id}.srt`;
  const bucket = config.tvSrtBucket;

  if (!bucket) {
    throw new Error("SUPABASE_TV_SRT_BUCKET is required");
  }

  const uploadResponse = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, new TextEncoder().encode(srtContent), {
      contentType: "application/x-subrip",
      upsert: true,
    });

  if (uploadResponse.error) {
    throw new Error(uploadResponse.error.message);
  }

  await supabaseAdmin
    .from("tv_youtube_videos")
    .update({
      srt_storage_path: storagePath,
      processing_status: "completed",
      last_processed_at: new Date().toISOString(),
    })
    .eq("id", video.id);

  return { storagePath };
}

export async function searchTranscriptSegments({ organizationId, query, limit = 50 }) {
  ensureAdminClient();
  const normalizedQuery = normalizeSearchableText(query);
  if (!normalizedQuery) return [];

  const { data, error } = await supabaseAdmin
    .from("tv_transcript_segments")
    .select("id, text, start_sec, end_sec, video_id, tv_youtube_videos!inner(title, thumbnail_url, youtube_video_id, youtube_url)")
    .eq("organization_id", organizationId)
    .or(`searchable_text.ilike.%${normalizedQuery}%`)
    .order("start_sec", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((item) => ({
    id: item.id,
    matchText: item.text,
    startSec: item.start_sec,
    endSec: item.end_sec,
    videoTitle: item.tv_youtube_videos?.title || "Untitled video",
    videoThumbnail: item.tv_youtube_videos?.thumbnail_url || null,
    youtubeRedirectUrl: buildYouTubeRedirect(item.tv_youtube_videos?.youtube_video_id, item.start_sec),
  }));
}

export async function getTvProcessingLogs({ organizationId, videoId = null }) {
  ensureAdminClient();
  let query = supabaseAdmin
    .from("tv_processing_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (videoId) query = query.eq("video_id", videoId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTvDashboard({ organizationId }) {
  ensureAdminClient();

  const [
    channelsCountResponse,
    videosCountResponse,
    completedCountResponse,
    processingCountResponse,
    queuedCountResponse,
    failedCountResponse,
    pendingCountResponse,
    transcriptsCountResponse,
    latestVideoResponse,
    latestSyncResponse,
    recentTranscribedResponse,
  ] = await Promise.all([
    supabaseAdmin.from("tv_youtube_channels").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("tv_youtube_videos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("tv_youtube_videos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("transcript_text", "is", null),
    supabaseAdmin.from("tv_youtube_videos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("processing_status", "processing").is("transcript_text", null),
    supabaseAdmin.from("tv_youtube_videos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("processing_status", "queued").is("transcript_text", null),
    supabaseAdmin.from("tv_youtube_videos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("processing_status", "failed").is("transcript_text", null),
    supabaseAdmin.from("tv_youtube_videos").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("processing_status", "pending").is("transcript_text", null),
    supabaseAdmin.from("tv_transcript_segments").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin
      .from("tv_youtube_videos")
      .select("published_at")
      .eq("organization_id", organizationId)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("tv_youtube_channels")
      .select("last_synced_at")
      .eq("organization_id", organizationId)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("tv_youtube_videos")
      .select("id, title, youtube_url, thumbnail_url, published_at, processing_status, transcript_text, tv_youtube_channels(channel_name)")
      .eq("organization_id", organizationId)
      .not("transcript_text", "is", null)
      .order("last_processed_at", { ascending: false })
      .limit(6),
  ]);

  return {
    summary: {
      channels: channelsCountResponse.count || 0,
      videos: videosCountResponse.count || 0,
      transcriptSegments: transcriptsCountResponse.count || 0,
      completedVideos: completedCountResponse.count || 0,
      processingVideos: processingCountResponse.count || 0,
      queuedVideos: queuedCountResponse.count || 0,
      failedVideos: failedCountResponse.count || 0,
      pendingVideos: pendingCountResponse.count || 0,
      latestVideoPublishedAt: latestVideoResponse.data?.published_at || null,
      latestChannelSyncAt: latestSyncResponse.data?.last_synced_at || null,
    },
    recentTranscripts: (recentTranscribedResponse.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      youtube_url: item.youtube_url,
      thumbnail_url: item.thumbnail_url,
      published_at: item.published_at,
      processing_status: item.processing_status,
      transcript_preview: String(item.transcript_text || "").replace(/\s+/g, " ").trim().slice(0, 220),
      channel_name: item.tv_youtube_channels?.channel_name || "Unknown channel",
    })),
  };
}

export async function markJobFailed(jobId, message, code = null) {
  ensureAdminClient();
  await supabaseAdmin
    .from("tv_processing_logs")
    .update({
      job_status: "failed",
      error_message: message,
      error_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
