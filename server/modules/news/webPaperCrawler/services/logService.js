import { supabaseAdmin } from "../../../../supabase.js";

export async function createCrawlLog(payload) {
  const { data, error } = await supabaseAdmin
    .from("web_paper_crawl_logs")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to create crawl log");
  return data;
}

export async function updateCrawlLog(logId, payload) {
  const { data, error } = await supabaseAdmin
    .from("web_paper_crawl_logs")
    .update(payload)
    .eq("id", logId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to update crawl log");
  return data;
}

export async function listCrawlLogs(organizationId, query = {}) {
  let request = supabaseAdmin
    .from("web_paper_crawl_logs")
    .select("*, web_paper_websites(name, domain)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false });

  if (query.websiteId) request = request.eq("website_id", query.websiteId);
  if (query.status) request = request.eq("status", query.status);
  if (query.jobType) request = request.eq("job_type", query.jobType);
  if (query.skip !== undefined && query.limit !== undefined) {
    request = request.range(query.skip, query.skip + query.limit - 1);
  }

  const { data, error, count } = await request;
  if (error) throw new Error(error.message);
  return { items: data || [], total: count || 0 };
}
