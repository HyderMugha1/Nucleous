import { config } from "../../config.js";
import { parseYouTubeDuration } from "./utils.js";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function ensureYouTubeConfigured() {
  if (!config.youtubeApiKey) {
    throw new Error("YouTube integration is not configured. Add YOUTUBE_API_KEY in Vercel Project Settings -> Environment Variables and redeploy.");
  }
}

async function youtubeGet(path, params) {
  ensureYouTubeConfigured();
  const filteredParams = Object.fromEntries(
    Object.entries({ ...params, key: config.youtubeApiKey }).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
  const query = new URLSearchParams(filteredParams);
  const response = await fetch(`${YOUTUBE_API_BASE}${path}?${query.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "YouTube API request failed");
  }
  return data;
}

function buildChannelLookupCandidates(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return [];

  const candidates = [];
  const pushCandidate = (type, value) => {
    if (!value) return;
    if (candidates.some((candidate) => candidate.type === type && candidate.value === value)) return;
    candidates.push({ type, value });
  };

  const addFreeformCandidates = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    if (/^UC[\w-]{20,}$/i.test(trimmed)) {
      pushCandidate("id", trimmed);
      return;
    }
    if (trimmed.startsWith("@")) {
      pushCandidate("handle", trimmed);
      return;
    }
    pushCandidate("handle", trimmed);
    pushCandidate("username", trimmed);
    pushCandidate("search", trimmed);
  };

  try {
    const url = new URL(input);
    if (url.hostname.includes("youtube.com")) {
      const segments = url.pathname.split("/").filter(Boolean);
      const [first, second] = segments;

      if (first === "channel") pushCandidate("id", second);
      if (first === "user") pushCandidate("username", second);
      if (first === "c") pushCandidate("search", second);
      if (first?.startsWith("@")) pushCandidate("handle", first);

      if (first && !["channel", "user", "c"].includes(first) && !first.startsWith("@")) {
        pushCandidate("search", first);
      }
    }
  } catch {
    addFreeformCandidates(input);
  }

  if (candidates.length === 0) {
    addFreeformCandidates(input);
  }

  return candidates;
}

async function lookupChannelById(channelId) {
  return youtubeGet("/channels", {
    part: "snippet,contentDetails",
    id: channelId,
  });
}

async function lookupChannelByHandle(handle) {
  return youtubeGet("/channels", {
    part: "snippet,contentDetails",
    forHandle: handle,
  });
}

async function lookupChannelByUsername(username) {
  return youtubeGet("/channels", {
    part: "snippet,contentDetails",
    forUsername: username,
  });
}

async function lookupChannelBySearch(query) {
  const search = await youtubeGet("/search", {
    part: "snippet",
    type: "channel",
    q: query,
    maxResults: "1",
  });

  const channelId = search.items?.[0]?.id?.channelId;
  if (!channelId) {
    return { items: [] };
  }

  return lookupChannelById(channelId);
}

async function resolveChannelLookup(input) {
  const candidates = buildChannelLookupCandidates(input);

  for (const candidate of candidates) {
    let data;

    if (candidate.type === "id") {
      data = await lookupChannelById(candidate.value);
    } else if (candidate.type === "handle") {
      data = await lookupChannelByHandle(candidate.value);
    } else if (candidate.type === "username") {
      data = await lookupChannelByUsername(candidate.value);
    } else if (candidate.type === "search") {
      data = await lookupChannelBySearch(candidate.value);
    }

    if (data?.items?.[0]) {
      return data.items[0];
    }
  }

  return null;
}

export async function fetchChannelMetadata(youtubeChannelInput) {
  const item = await resolveChannelLookup(youtubeChannelInput);

  if (!item) {
    throw new Error("YouTube channel not found. Enter a channel ID, @handle, or YouTube channel URL.");
  }

  return {
    youtubeChannelId: item.id,
    channelName: item.snippet?.title || "Untitled channel",
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
    channelUrl: `https://www.youtube.com/channel/${item.id}`,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

const DEFAULT_CHANNEL_SYNC_LIMIT = 200;

export async function fetchAllChannelVideos(uploadsPlaylistId, options = {}) {
  const maxVideos = Math.max(1, Number(options.maxVideos || DEFAULT_CHANNEL_SYNC_LIMIT));
  const playlistItems = [];
  let pageToken = undefined;

  do {
    const data = await youtubeGet("/playlistItems", {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      pageToken,
    });

    playlistItems.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken && playlistItems.length < maxVideos);

  const videoIds = playlistItems
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);

  const limitedVideoIds = videoIds.slice(0, maxVideos);

  const chunks = [];
  for (let index = 0; index < limitedVideoIds.length; index += 50) {
    chunks.push(limitedVideoIds.slice(index, index + 50));
  }

  const details = [];
  for (const chunk of chunks) {
    const data = await youtubeGet("/videos", {
      part: "snippet,contentDetails,status",
      id: chunk.join(","),
      maxResults: String(chunk.length),
    });
    details.push(...(data.items || []));
  }

  return details
    .filter((item) => item.status?.privacyStatus === "public")
    .map((item) => ({
      youtubeVideoId: item.id,
      title: item.snippet?.title || "Untitled video",
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
      youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
      publishedAt: item.snippet?.publishedAt,
      durationIso: item.contentDetails?.duration || null,
      durationSeconds: parseYouTubeDuration(item.contentDetails?.duration),
    }));
}
