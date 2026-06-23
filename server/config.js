import dns from "node:dns/promises";

const DEFAULT_SUPABASE_URL = "https://csuzochqnfkbmtgglvje.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzdXpvY2hxbmZrYm10Z2dsdmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjAwNTMsImV4cCI6MjA5MzAzNjA1M30.EOmBXe5oOQ98jOHSbM95PsxZTdQ0JKvAbDgtHuFFVfk";
const LOCAL_CLIENT_URL = "http://localhost:8080";

function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";

  try {
    const candidate = String(rawUrl).trim();
    const withScheme = /^[a-z]+:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    const url = new URL(withScheme);
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(rawUrl).trim();
  }
}

function isLocalhostUrl(rawUrl) {
  if (!rawUrl) return false;

  try {
    const url = new URL(rawUrl);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isHttpsUrl(rawUrl) {
  if (!rawUrl) return false;

  try {
    return new URL(rawUrl).protocol === "https:";
  } catch {
    return false;
  }
}

const rawSiteUrl =
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  process.env.APP_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  process.env.VERCEL_URL ||
  process.env.CLIENT_URL ||
  "";
const siteUrl = normalizeUrl(rawSiteUrl);
const clientUrl = siteUrl || LOCAL_CLIENT_URL;
const tiktokRedirectUri = normalizeUrl(process.env.TIKTOK_REDIRECT_URI || (siteUrl ? `${siteUrl}/api/tiktok/callback` : ""));
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

export const config = {
  port: Number(process.env.PORT || 5000),
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseDbUrl: process.env.SUPABASE_DB_URL || "",
  siteUrl,
  clientUrl,
  isProduction,
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  tiktokClientKey: process.env.TIKTOK_CLIENT_KEY || "",
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
  tiktokRedirectUri,
  apifyToken: process.env.APIFY_TOKEN || "",
  tvTranscriptionActorId: process.env.TV_TRANSCRIPTION_ACTOR_ID || "Uwpce1RSXlrzF6WBA",
  cronSecret: process.env.CRON_SECRET || "",
  tvAutoTranscribeEnabled: process.env.TV_AUTO_TRANSCRIBE_ENABLED || "true",
  tvAutoTranscribeDailyLimit: Number(process.env.TV_AUTO_TRANSCRIBE_DAILY_LIMIT || 50),
  tvAutoTranscribeBatchSize: Number(process.env.TV_AUTO_TRANSCRIBE_BATCH_SIZE || 50),
  tvAutoTranscribeWindowHours: Number(process.env.TV_AUTO_TRANSCRIBE_WINDOW_HOURS || 24),
  tvAutoTranscribeRetryFailedAfterHours: Number(process.env.TV_AUTO_TRANSCRIBE_RETRY_FAILED_AFTER_HOURS || 12),
  tvSrtBucket: process.env.SUPABASE_TV_SRT_BUCKET || "tv-subtitles",
  webPaperCrawlerEnabled: process.env.WEB_PAPER_CRAWLER_ENABLED || "true",
  webPaperCrawlIntervalMinutes: Number(process.env.WEB_PAPER_CRAWL_INTERVAL_MINUTES || 15),
  webPaperRequestTimeoutSeconds: Number(process.env.WEB_PAPER_REQUEST_TIMEOUT_SECONDS || 30),
  webPaperMaxRetries: Number(process.env.WEB_PAPER_MAX_RETRIES || 3),
  webPaperDelayBetweenRequestsSeconds: Number(process.env.WEB_PAPER_DELAY_BETWEEN_REQUESTS_SECONDS || 2),
  webPaperMaxArticlesPerCrawl: Number(process.env.WEB_PAPER_MAX_ARTICLES_PER_CRAWL || 50),
  webPaperSaveRawHtml: process.env.WEB_PAPER_SAVE_RAW_HTML || "false",
  webPaperInitialBackfillEnabled: process.env.WEB_PAPER_INITIAL_BACKFILL_ENABLED || "true",
  brandingMonitorEnabled: process.env.BRANDING_MONITOR_ENABLED || "true",
  brandingMonitorBucket: process.env.SUPABASE_BRANDING_BUCKET || "branding-monitor",
  brandingMonitorContactEmail: process.env.BRANDING_MONITOR_CONTACT_EMAIL || "contact@example.com",
};

async function validateResolvableHostname(label, rawUrl) {
  if (!rawUrl) return;

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  try {
    await dns.lookup(parsedUrl.hostname);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "UNKNOWN";
    throw new Error(`${label} hostname could not be resolved: ${parsedUrl.hostname} (${code})`);
  }
}

export async function validateConfig() {
  const missing = [];

  if (!config.supabaseUrl) missing.push("SUPABASE_URL or VITE_SUPABASE_URL");
  if (!config.supabaseAnonKey) missing.push("SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY");
  if (config.tiktokClientKey && !config.tiktokClientSecret) missing.push("TIKTOK_CLIENT_SECRET");
  if (config.tiktokClientKey && !config.tiktokRedirectUri) missing.push("TIKTOK_REDIRECT_URI or PUBLIC_SITE_URL");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (config.tiktokRedirectUri) {
    await validateResolvableHostname("TIKTOK_REDIRECT_URI", config.tiktokRedirectUri);
  }

  if (config.siteUrl) {
    await validateResolvableHostname("PUBLIC_SITE_URL", config.siteUrl);
  }

  if (isProduction) {
    if (!config.siteUrl) {
      throw new Error("PUBLIC_SITE_URL (or SITE_URL / APP_URL) is required in production");
    }
    if (isLocalhostUrl(config.siteUrl) || !isHttpsUrl(config.siteUrl)) {
      throw new Error("PUBLIC_SITE_URL must use HTTPS and cannot point to localhost in production");
    }
    if (config.tiktokRedirectUri && (isLocalhostUrl(config.tiktokRedirectUri) || !isHttpsUrl(config.tiktokRedirectUri))) {
      throw new Error("TIKTOK_REDIRECT_URI must use HTTPS and cannot point to localhost in production");
    }
  }

  await validateResolvableHostname("SUPABASE_URL", config.supabaseUrl);
}
