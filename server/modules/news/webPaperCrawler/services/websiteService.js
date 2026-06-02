import { supabaseAdmin } from "../../../../supabase.js";
import { DEFAULT_WEB_PAPER_WEBSITES } from "../websiteConfigs.js";

export async function ensureDefaultWebsites(organizationId) {
  const { data: existing, error } = await supabaseAdmin
    .from("web_paper_websites")
    .select("id, scraper_key")
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);

  const existingKeys = new Set((existing || []).map((item) => item.scraper_key));
  const missingRows = DEFAULT_WEB_PAPER_WEBSITES.filter((item) => !existingKeys.has(item.scraperKey)).map((item) => ({
    organization_id: organizationId,
    name: item.name,
    base_url: item.baseUrl,
    domain: item.domain,
    scraper_key: item.scraperKey,
    crawl_interval_minutes: 15,
    is_active: true,
  }));

  if (missingRows.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from("web_paper_websites")
      .upsert(missingRows, {
        onConflict: "organization_id,scraper_key",
        ignoreDuplicates: true,
      });
    if (upsertError) throw new Error(upsertError.message);
  }
}

export async function listWebsites(organizationId) {
  await ensureDefaultWebsites(organizationId);
  const { data, error } = await supabaseAdmin
    .from("web_paper_websites")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getWebsiteById(organizationId, websiteId) {
  const { data, error } = await supabaseAdmin
    .from("web_paper_websites")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", websiteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createWebsite(organizationId, payload) {
  const { data, error } = await supabaseAdmin
    .from("web_paper_websites")
    .insert({
      organization_id: organizationId,
      name: payload.name,
      base_url: payload.baseUrl,
      domain: payload.domain,
      scraper_key: payload.scraperKey,
      crawl_interval_minutes: payload.crawlIntervalMinutes || 15,
      is_active: payload.isActive ?? true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to create website");
  return data;
}

export async function updateWebsite(organizationId, websiteId, payload) {
  const update = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.baseUrl !== undefined) update.base_url = payload.baseUrl;
  if (payload.domain !== undefined) update.domain = payload.domain;
  if (payload.scraperKey !== undefined) update.scraper_key = payload.scraperKey;
  if (payload.crawlIntervalMinutes !== undefined) update.crawl_interval_minutes = payload.crawlIntervalMinutes;
  if (payload.isActive !== undefined) update.is_active = payload.isActive;

  const { data, error } = await supabaseAdmin
    .from("web_paper_websites")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", websiteId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to update website");
  return data;
}

export async function deleteWebsite(organizationId, websiteId) {
  const { error } = await supabaseAdmin
    .from("web_paper_websites")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", websiteId);
  if (error) throw new Error(error.message);
}

export async function listOrganizations() {
  const { data, error } = await supabaseAdmin.from("organizations").select("id");
  if (error) throw new Error(error.message);
  return data || [];
}
