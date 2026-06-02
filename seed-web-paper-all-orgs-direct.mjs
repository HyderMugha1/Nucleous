import fs from "node:fs";
import path from "node:path";

const rawEnv = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
for (const line of rawEnv.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const index = line.indexOf("=");
  if (index > 0) {
    process.env[line.slice(0, index)] = line.slice(index + 1);
  }
}

const { supabaseAdmin } = await import("./server/supabase.js");
const { getScraper } = await import("./server/modules/news/webPaperCrawler/scraperFactory.js");
const { ensureCrawlerSettings } = await import("./server/modules/news/webPaperCrawler/services/settingsService.js");
const { listWebsites } = await import("./server/modules/news/webPaperCrawler/services/websiteService.js");
const { normalizeUrl, buildUrlHash } = await import("./server/modules/news/webPaperCrawler/utils/url.js");
const { cleanText } = await import("./server/modules/news/webPaperCrawler/utils/content.js");
const { sha256 } = await import("./server/modules/news/webPaperCrawler/utils/hash.js");

const scraper = getScraper("tribune");
const websiteShape = {
  name: "The Express Tribune",
  base_url: "https://tribune.com.pk/",
  domain: "tribune.com.pk",
  scraper_key: "tribune",
  language: "en",
};

async function fetchMayTribuneArticles() {
  const response = await fetch("https://tribune.com.pk/sitemap/posts-1.xml", {
    headers: { "user-agent": "Mozilla/5.0 (compatible; Codex Web Paper Seeder/1.0)" },
  });
  const xml = await response.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>[\s\S]*?<lastmod>(.*?)<\/lastmod>/g)];
  const urls = matches
    .map((match) => ({ url: match[1], lastmod: match[2] }))
    .filter((item) => item.lastmod.startsWith("2026-05"))
    .slice(0, 8);

  const articles = [];
  for (const item of urls) {
    try {
      const html = await scraper.fetchArticlePage(item.url, websiteShape, {
        requestOptions: () => ({
          retries: 2,
          timeoutMs: 20000,
          delayMs: 500,
          baseUrl: websiteShape.base_url,
          respectRobots: true,
        }),
      });
      const article = await scraper.parseArticle(html, item.url, websiteShape, {});
      const content = cleanText(article.content);
      if (!content || content.length <= 100) continue;
      if (!article.published_at?.startsWith("2026-05")) continue;
      articles.push({
        ...article,
        content,
      });
    } catch (error) {
      console.log(`Skipped ${item.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return articles;
}

const parsedArticles = await fetchMayTribuneArticles();
console.log(`Prepared ${parsedArticles.length} Tribune articles for seeding`);

const { data: organizations, error: orgError } = await supabaseAdmin
  .from("organizations")
  .select("id, name")
  .order("created_at", { ascending: false });

if (orgError) {
  throw new Error(orgError.message);
}

for (const organization of organizations || []) {
  const settings = await ensureCrawlerSettings(organization.id);
  const websites = await listWebsites(organization.id);
  const tribuneWebsite = websites.find((website) => website.scraper_key === "tribune");
  if (!tribuneWebsite) {
    console.log(`${organization.name}: Tribune website missing`);
    continue;
  }

  const rows = parsedArticles.map((article) => {
    const normalizedUrl = normalizeUrl(article.canonical_url || article.url, tribuneWebsite.base_url);
    const contentHash = sha256(article.content);

    return {
      organization_id: organization.id,
      website_id: tribuneWebsite.id,
      source_name: article.source_name || tribuneWebsite.name,
      title: cleanText(article.title),
      slug: article.slug || null,
      url: article.url,
      canonical_url: article.canonical_url || normalizedUrl,
      normalized_url: normalizedUrl,
      excerpt: article.excerpt || null,
      content: article.content,
      author: article.author || null,
      category: article.category || null,
      language: article.language || null,
      image_url: article.image_url || null,
      published_at: article.published_at || null,
      content_hash: contentHash,
      url_hash: buildUrlHash(normalizedUrl),
      raw_html: settings.save_raw_html ? article.raw_html || null : null,
      status: article.status || "published",
    };
  });

  const { error: upsertError } = await supabaseAdmin
    .from("web_paper_articles")
    .upsert(rows, { onConflict: "organization_id,url_hash", ignoreDuplicates: false });

  if (upsertError) {
    console.log(`${organization.name}: upsert failed - ${upsertError.message}`);
    continue;
  }

  const { count } = await supabaseAdmin
    .from("web_paper_articles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id);

  console.log(`${organization.name}: now has ${count || 0} Web Paper articles`);
}

console.log("Direct Web Paper seeding complete");
