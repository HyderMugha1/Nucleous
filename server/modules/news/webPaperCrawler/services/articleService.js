import { supabaseAdmin } from "../../../../supabase.js";
import { cleanText } from "../utils/content.js";
import { sha256 } from "../utils/hash.js";
import { buildUrlHash, getDomain, isAllowedArticleUrl, normalizeUrl } from "../utils/url.js";

function slugify(title) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || null;
}

export async function articleExists(organizationId, normalizedUrl, contentHash, websiteId, title) {
  const checks = [
    supabaseAdmin
      .from("web_paper_articles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("url_hash", buildUrlHash(normalizedUrl))
      .limit(1),
  ];

  if (contentHash) {
    checks.push(
      supabaseAdmin
        .from("web_paper_articles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("content_hash", contentHash)
        .limit(1),
    );
  }

  if (websiteId && title) {
    checks.push(
      supabaseAdmin
        .from("web_paper_articles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("website_id", websiteId)
        .ilike("title", title)
        .limit(1),
    );
  }

  const results = await Promise.all(checks);
  return results.some((result) => (result.data || []).length > 0);
}

export function validateArticle(article, website) {
  const normalizedUrl = normalizeUrl(article.canonical_url || article.url, website.base_url);
  if (!normalizedUrl) return { valid: false, reason: "Missing or invalid URL" };
  if (!article.title || cleanText(article.title).length === 0) return { valid: false, reason: "Missing title" };
  const content = cleanText(article.content);
  if (!content) return { valid: false, reason: "Missing content" };
  if (content.length <= 100) return { valid: false, reason: "Content shorter than 100 characters" };
  if (!isAllowedArticleUrl(normalizedUrl, website.domain)) return { valid: false, reason: `URL domain ${getDomain(normalizedUrl)} not allowed` };
  return { valid: true, normalizedUrl, content };
}

export async function saveArticle(organizationId, website, article, settings) {
  const validation = validateArticle(article, website);
  if (!validation.valid) {
    return { saved: false, skipped: true, reason: validation.reason };
  }

  const contentHash = sha256(validation.content);
  const duplicate = await articleExists(organizationId, validation.normalizedUrl, contentHash, website.id, article.title);
  if (duplicate) {
    return { saved: false, skipped: true, reason: "Duplicate article" };
  }

  const payload = {
    organization_id: organizationId,
    website_id: website.id,
    source_name: article.source_name || website.name,
    title: cleanText(article.title),
    slug: article.slug || slugify(article.title),
    url: article.url,
    canonical_url: article.canonical_url || validation.normalizedUrl,
    normalized_url: validation.normalizedUrl,
    excerpt: article.excerpt || null,
    content: validation.content,
    author: article.author || null,
    category: article.category || null,
    language: article.language || null,
    image_url: article.image_url || null,
    published_at: article.published_at || null,
    content_hash: contentHash,
    url_hash: buildUrlHash(validation.normalizedUrl),
    raw_html: settings.save_raw_html ? article.raw_html || null : null,
    status: article.status || "published",
  };

  const { data, error } = await supabaseAdmin
    .from("web_paper_articles")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    return { saved: false, skipped: true, reason: error?.message || "Database save failed" };
  }

  return { saved: true, skipped: false, item: data };
}

export async function listArticles(organizationId, query = {}) {
  let request = supabaseAdmin
    .from("web_paper_articles")
    .select("*, web_paper_websites(name, domain)", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false });

  if (query.websiteId) request = request.eq("website_id", query.websiteId);
  if (query.source) request = request.ilike("source_name", query.source);
  if (query.category) request = request.ilike("category", query.category);
  if (query.status) request = request.eq("status", query.status);
  if (query.dateFrom) request = request.gte("published_at", query.dateFrom);
  if (query.dateTo) request = request.lte("published_at", query.dateTo);
  if (query.search) {
    const search = query.search.replace(/,/g, " ");
    request = request.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
  }
  if (query.skip !== undefined && query.limit !== undefined) {
    request = request.range(query.skip, query.skip + query.limit - 1);
  }

  const { data, error, count } = await request;
  if (error) throw new Error(error.message);
  return { items: data || [], total: count || 0 };
}

export async function getArticle(organizationId, articleId) {
  const { data, error } = await supabaseAdmin
    .from("web_paper_articles")
    .select("*, web_paper_websites(name, domain)")
    .eq("organization_id", organizationId)
    .eq("id", articleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteArticle(organizationId, articleId) {
  const { error } = await supabaseAdmin
    .from("web_paper_articles")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", articleId);
  if (error) throw new Error(error.message);
}
