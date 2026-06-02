import dns from "node:dns/promises";

export const config = {
  port: Number(process.env.PORT || 5000),
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseDbUrl: process.env.SUPABASE_DB_URL || "",
  clientUrl: process.env.CLIENT_URL || "http://localhost:8080",
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  tiktokClientKey: process.env.TIKTOK_CLIENT_KEY || "",
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
  tiktokRedirectUri: process.env.TIKTOK_REDIRECT_URI || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  tvSrtBucket: process.env.SUPABASE_TV_SRT_BUCKET || "tv-subtitles",
  webPaperCrawlerEnabled: process.env.WEB_PAPER_CRAWLER_ENABLED || "true",
  webPaperCrawlIntervalMinutes: Number(process.env.WEB_PAPER_CRAWL_INTERVAL_MINUTES || 15),
  webPaperRequestTimeoutSeconds: Number(process.env.WEB_PAPER_REQUEST_TIMEOUT_SECONDS || 30),
  webPaperMaxRetries: Number(process.env.WEB_PAPER_MAX_RETRIES || 3),
  webPaperDelayBetweenRequestsSeconds: Number(process.env.WEB_PAPER_DELAY_BETWEEN_REQUESTS_SECONDS || 2),
  webPaperMaxArticlesPerCrawl: Number(process.env.WEB_PAPER_MAX_ARTICLES_PER_CRAWL || 50),
  webPaperSaveRawHtml: process.env.WEB_PAPER_SAVE_RAW_HTML || "false",
  webPaperInitialBackfillEnabled: process.env.WEB_PAPER_INITIAL_BACKFILL_ENABLED || "true",
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

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  await validateResolvableHostname("SUPABASE_URL", config.supabaseUrl);
}
