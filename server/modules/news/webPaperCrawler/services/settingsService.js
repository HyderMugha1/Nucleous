import { supabaseAdmin } from "../../../../supabase.js";

const DEFAULT_SETTINGS = {
  crawler_enabled: String(process.env.WEB_PAPER_CRAWLER_ENABLED || "true") !== "false",
  crawl_interval_minutes: Number(process.env.WEB_PAPER_CRAWL_INTERVAL_MINUTES || 15),
  request_timeout_seconds: Number(process.env.WEB_PAPER_REQUEST_TIMEOUT_SECONDS || 30),
  max_retries: Number(process.env.WEB_PAPER_MAX_RETRIES || 3),
  delay_between_requests_seconds: Number(process.env.WEB_PAPER_DELAY_BETWEEN_REQUESTS_SECONDS || 2),
  max_articles_per_crawl: Number(process.env.WEB_PAPER_MAX_ARTICLES_PER_CRAWL || 50),
  save_raw_html: String(process.env.WEB_PAPER_SAVE_RAW_HTML || "false") === "true",
  initial_backfill_enabled: String(process.env.WEB_PAPER_INITIAL_BACKFILL_ENABLED || "true") !== "false",
};

export function getDefaultCrawlerSettings() {
  return { ...DEFAULT_SETTINGS };
}

export async function ensureCrawlerSettings(organizationId) {
  const { data: existing, error } = await supabaseAdmin
    .from("web_paper_crawler_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing) return existing;

  const { error: upsertError } = await supabaseAdmin
    .from("web_paper_crawler_settings")
    .upsert({
      organization_id: organizationId,
      ...DEFAULT_SETTINGS,
    }, {
      onConflict: "organization_id",
      ignoreDuplicates: true,
    });

  if (upsertError) throw new Error(upsertError.message);

  const { data, error: refetchError } = await supabaseAdmin
    .from("web_paper_crawler_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  if (refetchError || !data) {
    throw new Error(refetchError?.message || "Unable to create crawler settings");
  }

  return data;
}

export async function updateCrawlerSettings(organizationId, payload) {
  await ensureCrawlerSettings(organizationId);
  const update = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (value !== undefined) update[key] = value;
  }
  const { data, error } = await supabaseAdmin
    .from("web_paper_crawler_settings")
    .update(update)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to update crawler settings");
  return data;
}
