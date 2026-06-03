import { supabaseAdmin } from "../../supabase.js";
import { buildSrt } from "./srt.js";
import { transcribeYouTubeVideoWithGemini } from "./gemini.js";
import { normalizeSearchableText, buildYouTubeRedirect } from "./utils.js";
import { fetchAllChannelVideos, fetchChannelMetadata } from "./youtube.js";
import { config } from "../../config.js";
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
  return data || [];
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

  await queueTvJob({
    organizationId: parsedState.organizationId,
    jobType: "tiktok_account_sync",
    provider: "tiktok",
    payload: { tiktokAccountId: account.id },
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

export async function syncChannelVideos({ organizationId, channelId }) {
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
  const videos = await fetchAllChannelVideos(metadata.uploadsPlaylistId);

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
    processing_status: "pending",
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

  for (const video of savedVideos || []) {
    await queueTvJob({
      organizationId,
      channelId: channel.id,
      videoId: video.id,
      jobType: "video_transcription",
      provider: "gemini",
      payload: { youtubeVideoId: video.youtube_video_id },
    });

    await supabaseAdmin
      .from("tv_youtube_videos")
      .update({ processing_status: "queued" })
      .eq("id", video.id);
  }

  return { channel, videos: savedVideos || [] };
}

export async function listTvVideos({ organizationId, channelId = null, search = "", page = 1, limit = 20 }) {
  ensureAdminClient();
  const skip = (page - 1) * limit;
  let query = supabaseAdmin
    .from("tv_youtube_videos")
    .select("*, tv_youtube_channels(id, channel_name, thumbnail_url)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false })
    .range(skip, skip + limit - 1);

  if (channelId) query = query.eq("channel_id", channelId);
  if (search) query = query.or(`title.ilike.%${search}%,youtube_video_id.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: data || [], total: count || 0 };
}

export async function processVideoTranscription({ organizationId, videoId }) {
  ensureAdminClient();

  const { data: video, error: videoError } = await supabaseAdmin
    .from("tv_youtube_videos")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", videoId)
    .single();

  if (videoError || !video) {
    throw new Error(videoError?.message || "TV video not found");
  }

  await supabaseAdmin
    .from("tv_youtube_videos")
    .update({ processing_status: "processing" })
    .eq("id", video.id);

  const transcript = await transcribeYouTubeVideoWithGemini(video.youtube_url);
  const normalizedSegments = transcript.segments.map((segment) => ({
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
      transcript_language: transcript.language,
      processing_status: "queued",
      last_processed_at: new Date().toISOString(),
      transcript_version: (video.transcript_version || 0) + 1,
    })
    .eq("id", video.id);

  await queueTvJob({
    organizationId,
    channelId: video.channel_id,
    videoId: video.id,
    jobType: "srt_generation",
    provider: "supabase-storage",
    payload: { youtubeVideoId: video.youtube_video_id },
  });

  return { videoId: video.id, segmentCount: normalizedSegments.length };
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
