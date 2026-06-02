import crypto from "node:crypto";
import { config } from "../../config.js";

const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const TIKTOK_VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";
const TIKTOK_SCOPES = ["user.info.basic", "video.list"];

function ensureTikTokConfigured() {
  if (!config.tiktokClientKey || !config.tiktokClientSecret || !config.tiktokRedirectUri) {
    throw new Error("TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI are required");
  }
}

function normalizeBase64(input) {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signStatePayload(payload) {
  const secret = process.env.JWT_SECRET || "tiktok-state-secret";
  return normalizeBase64(crypto.createHmac("sha256", secret).update(payload).digest("base64"));
}

export function createTikTokState({ organizationId, userId }) {
  const payload = JSON.stringify({
    organizationId,
    userId,
    ts: Date.now(),
  });
  const encodedPayload = normalizeBase64(Buffer.from(payload).toString("base64"));
  return `${encodedPayload}.${signStatePayload(encodedPayload)}`;
}

export function parseTikTokState(value) {
  const [encodedPayload, signature] = String(value || "").split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Missing TikTok OAuth state");
  }

  const expectedSignature = signStatePayload(encodedPayload);
  if (signature !== expectedSignature) {
    throw new Error("Invalid TikTok OAuth state signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8"));
  if (!payload.organizationId || !payload.userId) {
    throw new Error("Invalid TikTok OAuth state payload");
  }

  return payload;
}

export function buildTikTokAuthUrl({ state }) {
  ensureTikTokConfigured();
  const query = new URLSearchParams({
    client_key: config.tiktokClientKey,
    response_type: "code",
    scope: TIKTOK_SCOPES.join(","),
    redirect_uri: config.tiktokRedirectUri,
    state,
  });

  return `${TIKTOK_AUTH_URL}?${query.toString()}`;
}

async function tiktokTokenRequest(params) {
  ensureTikTokConfigured();
  const body = new URLSearchParams({
    client_key: config.tiktokClientKey,
    client_secret: config.tiktokClientSecret,
    ...params,
  });

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || data.message || "TikTok token request failed");
  }

  return data;
}

export async function exchangeTikTokCodeForToken(code) {
  return tiktokTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.tiktokRedirectUri,
  });
}

export async function refreshTikTokAccessToken(refreshToken) {
  return tiktokTokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function tiktokGetJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();
  const errorCode = data?.error?.code;
  if (!response.ok || (errorCode && errorCode !== "ok")) {
    throw new Error(data?.error?.message || data?.message || "TikTok API request failed");
  }

  return data;
}

export async function fetchTikTokUserInfo(accessToken) {
  const fields = "open_id,union_id,display_name,avatar_url,bio_description,profile_deep_link";
  const url = `${TIKTOK_USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
  const data = await tiktokGetJson(url, accessToken);
  return data.data?.user || data.data || {};
}

export async function fetchTikTokVideoList(accessToken, cursor = undefined, maxCount = 20) {
  const fields = "id,title,video_description,create_time,cover_image_url,share_url,duration,width,height,embed_link,like_count,comment_count,share_count,view_count";
  const url = `${TIKTOK_VIDEO_LIST_URL}?fields=${encodeURIComponent(fields)}`;
  const body = {
    max_count: Math.min(20, Math.max(1, maxCount)),
  };
  if (cursor) body.cursor = cursor;
  const data = await tiktokGetJson(url, accessToken, { method: "POST", body });
  return data.data || {};
}

export async function fetchTikTokVideoDetails(accessToken, videoIds) {
  if (!videoIds.length) return [];
  const fields = "id,title,video_description,create_time,cover_image_url,share_url,duration,width,height,embed_html,embed_link,like_count,comment_count,share_count,view_count";
  const url = `${TIKTOK_VIDEO_QUERY_URL}?fields=${encodeURIComponent(fields)}`;
  const data = await tiktokGetJson(url, accessToken, {
    method: "POST",
    body: {
      filters: {
        video_ids: videoIds.slice(0, 20),
      },
    },
  });

  return data.data?.videos || [];
}
