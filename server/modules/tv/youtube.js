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
  const query = new URLSearchParams({ ...params, key: config.youtubeApiKey });
  const response = await fetch(`${YOUTUBE_API_BASE}${path}?${query.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "YouTube API request failed");
  }
  return data;
}

export async function fetchChannelMetadata(youtubeChannelId) {
  const data = await youtubeGet("/channels", {
    part: "snippet,contentDetails",
    id: youtubeChannelId,
  });

  const item = data.items?.[0];
  if (!item) {
    throw new Error("YouTube channel not found");
  }

  return {
    youtubeChannelId: item.id,
    channelName: item.snippet?.title || "Untitled channel",
    thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
    channelUrl: `https://www.youtube.com/channel/${item.id}`,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

export async function fetchAllChannelVideos(uploadsPlaylistId) {
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
  } while (pageToken);

  const videoIds = playlistItems
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);

  const chunks = [];
  for (let index = 0; index < videoIds.length; index += 50) {
    chunks.push(videoIds.slice(index, index + 50));
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
