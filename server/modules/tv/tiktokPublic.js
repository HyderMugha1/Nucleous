import { supabaseAdmin } from "../../supabase.js";
import { config } from "../../config.js";
import { safeRequest } from "../news/webPaperCrawler/utils/safeRequest.js";

const TIKTOK_OEMBED_URL = "https://www.tiktok.com/oembed";
const PUBLIC_USER_AGENT = `NucleusTikTokPublicMonitor/1.0 (+${config.siteUrl || "https://app.your-domain.example.com"})`;

function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }
}

function ensureValidTikTokHostname(hostname) {
  return [
    "www.tiktok.com",
    "tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
  ].includes(hostname.toLowerCase());
}

export function normalizeTikTokPublicUrl(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) {
    throw new Error("TikTok URL is required");
  }

  let parsed;
  try {
    const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    parsed = new URL(candidate);
  } catch {
    throw new Error("Enter a valid TikTok public URL");
  }

  if (!ensureValidTikTokHostname(parsed.hostname)) {
    throw new Error("Enter a valid TikTok profile or video URL");
  }

  parsed.search = "";
  parsed.hash = "";
  const normalized = parsed.toString().replace(/\/$/, "");
  const segments = parsed.pathname.split("/").filter(Boolean);
  const handle = segments.find((segment) => segment.startsWith("@")) || null;
  const videoSegmentIndex = segments.findIndex((segment) => segment === "video");
  const videoId = videoSegmentIndex >= 0 ? segments[videoSegmentIndex + 1] || null : null;

  const sourceType = videoId ? "video" : handle ? "profile" : null;
  if (!sourceType) {
    throw new Error("Enter a TikTok profile URL like https://www.tiktok.com/@username or a video URL.");
  }

  return {
    normalizedUrl: normalized,
    sourceType,
    handle: handle ? handle.replace(/^@/, "") : null,
    videoId,
  };
}

async function fetchPublicHtml(url) {
  const response = await safeRequest(url, {
    retries: 2,
    timeoutMs: 20000,
    delayMs: 800,
    userAgent: PUBLIC_USER_AGENT,
    respectRobots: false,
  });
  return response.text;
}

async function fetchOEmbed(url) {
  const requestUrl = `${TIKTOK_OEMBED_URL}?url=${encodeURIComponent(url)}`;
  const response = await fetch(requestUrl, {
    headers: {
      "user-agent": PUBLIC_USER_AGENT,
      accept: "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "TikTok public embed lookup failed");
  }

  return data;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTagAttributes(attributesText) {
  const attributes = {};
  const pattern = /([:@\w-]+)\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = pattern.exec(attributesText))) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2]);
  }
  return attributes;
}

function findMetaContent(html, selectors) {
  const metaMatches = Array.from(html.matchAll(/<meta\b([^>]*?)>/gi));
  const linkMatches = Array.from(html.matchAll(/<link\b([^>]*?)>/gi));

  for (const selector of selectors) {
    if (selector.startsWith("meta[")) {
      const selectorMatch = /^meta\[(name|property)="([^"]+)"\]$/i.exec(selector);
      if (!selectorMatch) continue;
      const [, attrName, attrValue] = selectorMatch;

      for (const match of metaMatches) {
        const attrs = extractTagAttributes(match[1] || "");
        if ((attrs[attrName.toLowerCase()] || "").toLowerCase() === attrValue.toLowerCase() && attrs.content) {
          return attrs.content.trim();
        }
      }

      continue;
    }

    if (selector === 'link[rel="canonical"]') {
      for (const match of linkMatches) {
        const attrs = extractTagAttributes(match[1] || "");
        if ((attrs.rel || "").toLowerCase() === "canonical" && attrs.href) {
          return attrs.href.trim();
        }
      }
    }
  }

  return null;
}

function getPageTitle(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function findScriptContentById(html, id) {
  const pattern = new RegExp(`<script[^>]*id=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const match = pattern.exec(html);
  return match?.[1] || null;
}

function findFirstScriptContentByType(html, type) {
  const pattern = new RegExp(`<script[^>]*type=["']${escapeRegExp(type)}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const match = pattern.exec(html);
  return match?.[1] || null;
}

function findScriptJsonByIds(html) {
  for (const id of ["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE", "__NEXT_DATA__"]) {
    const content = findScriptContentById(html, id);
    if (!content) continue;
    try {
      return JSON.parse(content);
    } catch {
      // ignore parse failures and continue
    }
  }

  return null;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildTikTokVideoUrl(handle, postId) {
  if (!handle || !postId) return null;
  return `https://www.tiktok.com/@${handle.replace(/^@/, "")}/video/${postId}`;
}

function extractUserDetailSnapshot(jsonBlob) {
  const scope = asObject(jsonBlob?.__DEFAULT_SCOPE__);
  const detail = asObject(scope?.["webapp.user-detail"]);
  const userInfo = asObject(detail?.userInfo);
  const user = asObject(userInfo?.user);
  const statsV2 = asObject(userInfo?.statsV2);
  const stats = asObject(userInfo?.stats);

  if (!userInfo || !user) {
    return null;
  }

  const itemList = asArray(userInfo?.itemList)
    .map((item) => {
      if (typeof item === "string") return item;
      const record = asObject(item);
      return record?.id || record?.itemId || record?.videoId || null;
    })
    .filter((item) => typeof item === "string" && item.length > 0);

  return {
    handle: typeof user.uniqueId === "string" ? user.uniqueId : null,
    displayName: typeof user.nickname === "string" ? user.nickname : null,
    avatarUrl:
      (typeof user.avatarLarger === "string" && user.avatarLarger) ||
      (typeof user.avatarMedium === "string" && user.avatarMedium) ||
      (typeof user.avatarThumb === "string" && user.avatarThumb) ||
      null,
    bioDescription: typeof user.signature === "string" ? user.signature : null,
    secUid: typeof user.secUid === "string" ? user.secUid : null,
    verified: Boolean(user.verified),
    stats: {
      followerCount: toNumber(statsV2?.followerCount ?? stats?.followerCount),
      followingCount: toNumber(statsV2?.followingCount ?? stats?.followingCount),
      likeCount: toNumber(statsV2?.heartCount ?? statsV2?.heart ?? stats?.heartCount ?? stats?.heart),
      videoCount: toNumber(statsV2?.videoCount ?? stats?.videoCount),
    },
    itemIds: itemList,
  };
}

function collectVideoUrlsFromHtml(html) {
  const matches = html.match(/https?:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d+/gi) || [];
  const pathMatches = html.match(/\/@[\w.-]+\/video\/\d+/gi) || [];
  const combined = [
    ...matches,
    ...pathMatches.map((item) => `https://www.tiktok.com${item}`),
  ];

  return Array.from(new Set(combined.map((item) => item.replace(/[?#].*$/, "").replace(/\/$/, "")))).slice(0, 12);
}

function extractProfileSnapshot(html, url) {
  const pathname = new URL(url).pathname;
  const fallbackHandle = pathname.split("/").find((segment) => segment.startsWith("@"))?.replace(/^@/, "") || null;
  const title = findMetaContent(html, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || fallbackHandle;
  const description = findMetaContent(html, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]']);
  const image = findMetaContent(html, ['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  const canonical = findMetaContent(html, ['link[rel="canonical"]']) || url;
  const jsonBlob = findScriptJsonByIds(html);
  const userDetail = extractUserDetailSnapshot(jsonBlob);
  const jsonText = jsonBlob ? JSON.stringify(jsonBlob) : "";
  const handle = userDetail?.handle || fallbackHandle;
  const itemListUrls = (userDetail?.itemIds || [])
    .map((itemId) => buildTikTokVideoUrl(handle, itemId))
    .filter(Boolean);
  const videoUrls = Array.from(
    new Set([
      ...itemListUrls,
      ...collectVideoUrlsFromHtml(html + "\n" + jsonText),
    ]),
  ).slice(0, 12);
  const seoMeta = asObject(jsonBlob?.__DEFAULT_SCOPE__?.["seo.abtest"]);
  const seoVidList = asArray(seoMeta?.vidList).length;

  return {
    handle,
    displayName:
      userDetail?.displayName ||
      (title ? title.replace(/\s+on\s+TikTok.*$/i, "").trim() : handle || "TikTok public source"),
    avatarUrl: userDetail?.avatarUrl || image,
    profileUrl: canonical,
    bioDescription: userDetail?.bioDescription || description,
    videoUrls,
    metadata: {
      pageTitle: getPageTitle(html) || null,
      canonical,
      secUid: userDetail?.secUid || null,
      verified: userDetail?.verified || false,
      followerCount: userDetail?.stats?.followerCount ?? null,
      followingCount: userDetail?.stats?.followingCount ?? null,
      likeCount: userDetail?.stats?.likeCount ?? null,
      videoCount: userDetail?.stats?.videoCount ?? null,
      discoverableVideoUrlCount: videoUrls.length,
      itemListCount: userDetail?.itemIds?.length || 0,
      seoVidListCount: seoVidList || 0,
    },
  };
}

function extractVideoPostId(url) {
  const match = /\/video\/(\d+)/i.exec(url);
  return match?.[1] || null;
}

function extractPublishedAtFromVideoHtml(html) {
  const ldJson = findFirstScriptContentByType(html, "application/ld+json");
  if (ldJson) {
    try {
      const parsed = JSON.parse(ldJson);
      if (parsed?.uploadDate) return new Date(parsed.uploadDate).toISOString();
    } catch {
      // ignore
    }
  }

  const metaTime = findMetaContent(html, ['meta[property="article:published_time"]']);
  if (metaTime) {
    return new Date(metaTime).toISOString();
  }

  return null;
}

async function buildPublicPost(url) {
  const normalizedUrl = normalizeTikTokPublicUrl(url).normalizedUrl;
  const [oembed, html] = await Promise.all([
    fetchOEmbed(normalizedUrl),
    fetchPublicHtml(normalizedUrl).catch(() => ""),
  ]);

  return {
    external_post_id: extractVideoPostId(normalizedUrl),
    post_url: normalizedUrl,
    normalized_post_url: normalizedUrl,
    title: oembed.title || null,
    video_description: oembed.title || null,
    thumbnail_url: oembed.thumbnail_url || null,
    author_name: oembed.author_name || null,
    author_url: oembed.author_url || null,
    embed_html: oembed.html || null,
    published_at: html ? extractPublishedAtFromVideoHtml(html) : null,
    metadata: {
      width: oembed.width || null,
      height: oembed.height || null,
      provider_name: oembed.provider_name || "TikTok",
      provider_url: oembed.provider_url || "https://www.tiktok.com",
    },
  };
}

async function upsertPublicSourceRecord({ organizationId, createdBy, normalizedInput, snapshot }) {
  ensureAdminClient();

  const payload = {
    organization_id: organizationId,
    source_type: normalizedInput.sourceType,
    source_url: normalizedInput.normalizedUrl,
    normalized_url: normalizedInput.normalizedUrl,
    account_handle: snapshot.handle || normalizedInput.handle,
    display_name: snapshot.displayName || null,
    avatar_url: snapshot.avatarUrl || null,
    profile_url: snapshot.profileUrl || null,
    bio_description: snapshot.bioDescription || null,
    status: "active",
    last_synced_at: new Date().toISOString(),
    last_error_message: null,
    metadata: snapshot.metadata || {},
    created_by: createdBy || null,
  };

  const { data, error } = await supabaseAdmin
    .from("tv_tiktok_public_sources")
    .upsert(payload, { onConflict: "organization_id,normalized_url" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save TikTok public source");
  }

  return data;
}

async function upsertPublicPosts({ organizationId, sourceId, posts }) {
  ensureAdminClient();
  if (posts.length === 0) return [];

  const rows = posts.map((post) => ({
    organization_id: organizationId,
    source_id: sourceId,
    ...post,
  }));

  const { data, error } = await supabaseAdmin
    .from("tv_tiktok_public_posts")
    .upsert(rows, { onConflict: "organization_id,normalized_post_url" })
    .select("*");

  if (error) {
    throw new Error(error.message || "Unable to save TikTok public posts");
  }

  return data || [];
}

async function markSourceFailure(sourceId, message) {
  if (!sourceId || !supabaseAdmin) return;
  await supabaseAdmin
    .from("tv_tiktok_public_sources")
    .update({
      status: "error",
      last_error_message: message,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", sourceId);
}

export async function createOrSyncTikTokPublicSource({ organizationId, createdBy, url }) {
  ensureAdminClient();
  const normalizedInput = normalizeTikTokPublicUrl(url);
  let sourceId = null;

  try {
    if (normalizedInput.sourceType === "profile") {
      const html = await fetchPublicHtml(normalizedInput.normalizedUrl);
      const snapshot = extractProfileSnapshot(html, normalizedInput.normalizedUrl);
      const source = await upsertPublicSourceRecord({
        organizationId,
        createdBy,
        normalizedInput,
        snapshot,
      });
      sourceId = source.id;

      const videoUrls = snapshot.videoUrls.length > 0 ? snapshot.videoUrls : [];
      const posts = await Promise.all(videoUrls.map((videoUrl) => buildPublicPost(videoUrl)));
      const savedPosts = await upsertPublicPosts({ organizationId, sourceId: source.id, posts });

      return { source, posts: savedPosts };
    }

    const post = await buildPublicPost(normalizedInput.normalizedUrl);
    const source = await upsertPublicSourceRecord({
      organizationId,
      createdBy,
      normalizedInput,
      snapshot: {
        handle: normalizedInput.handle,
        displayName: post.author_name || normalizedInput.handle || "TikTok public video",
        avatarUrl: post.thumbnail_url || null,
        profileUrl: post.author_url || normalizedInput.normalizedUrl,
        bioDescription: post.video_description || null,
        metadata: { inputKind: "video" },
      },
    });
    sourceId = source.id;
    const savedPosts = await upsertPublicPosts({ organizationId, sourceId: source.id, posts: [post] });
    return { source, posts: savedPosts };
  } catch (error) {
    await markSourceFailure(sourceId, error instanceof Error ? error.message : "TikTok public sync failed");
    throw error;
  }
}

export async function syncTikTokPublicSourceById({ organizationId, sourceId }) {
  ensureAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tv_tiktok_public_sources")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", sourceId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "TikTok public source not found");
  }

  return createOrSyncTikTokPublicSource({
    organizationId,
    createdBy: data.created_by,
    url: data.source_url,
  });
}

export async function listTikTokPublicSources(organizationId) {
  ensureAdminClient();
  const { data, error } = await supabaseAdmin
    .from("tv_tiktok_public_sources")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Unable to load TikTok public sources");

  const sources = data || [];
  const enriched = await Promise.all(
    sources.map(async (source) => {
      const { count } = await supabaseAdmin
        .from("tv_tiktok_public_posts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("source_id", source.id);

      return {
        ...source,
        post_count: count || 0,
        discoverable_post_count: count || 0,
        profile_stats: {
          follower_count: source.metadata?.followerCount ?? null,
          following_count: source.metadata?.followingCount ?? null,
          like_count: source.metadata?.likeCount ?? null,
          video_count: source.metadata?.videoCount ?? null,
        },
      };
    }),
  );

  return enriched;
}

export async function listTikTokPublicPosts({ organizationId, sourceId = null, page = 1, limit = 20 }) {
  ensureAdminClient();
  const skip = (page - 1) * limit;
  let query = supabaseAdmin
    .from("tv_tiktok_public_posts")
    .select("*, tv_tiktok_public_sources(id, display_name, avatar_url, account_handle, source_type, profile_url)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(skip, skip + limit - 1);

  if (sourceId) {
    query = query.eq("source_id", sourceId);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message || "Unable to load TikTok public posts");

  return {
    items: data || [],
    total: count || 0,
  };
}
