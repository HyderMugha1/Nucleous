import { load } from "cheerio";
import { supabaseAdmin } from "../../../../supabase.js";
import { getScraper } from "../scraperFactory.js";
import { DEFAULT_SITEMAP_CANDIDATES } from "../websiteConfigs.js";
import { getLastCompleteMonthRange, isDateWithinRange } from "../utils/dateRange.js";
import { safeRequest } from "../utils/safeRequest.js";
import { normalizeUrl } from "../utils/url.js";
import { saveArticle } from "./articleService.js";
import { acquireCrawlLock, releaseCrawlLock } from "./lockService.js";
import { createCrawlLog, updateCrawlLog } from "./logService.js";
import { ensureCrawlerSettings } from "./settingsService.js";
import { ensureDefaultWebsites, getWebsiteById, listOrganizations, listWebsites } from "./websiteService.js";

async function expandSitemapCandidates(website, context, seeds) {
  const urls = new Set();

  for (const seed of seeds) {
    const normalizedSeed = normalizeUrl(seed, website.base_url);
    if (!normalizedSeed) continue;
    try {
      const response = await safeRequest(normalizedSeed, context.requestOptions(website.base_url));
      const $ = load(response.text, { xmlMode: true });
      const nested = [];
      $("sitemap > loc").each((_, element) => {
        const value = $(element).text().trim();
        if (value) nested.push(value);
      });

      if (nested.length > 0) {
        nested.forEach((item) => urls.add(item));
        continue;
      }

      urls.add(normalizedSeed);
    } catch {
      // ignore missing sitemap candidates
    }
  }

  return Array.from(urls);
}

function buildContext(website, settings, dateFrom, dateTo, onWarning) {
  return {
    dateFrom,
    dateTo,
    sitemapCandidates: DEFAULT_SITEMAP_CANDIDATES.map((path) => new URL(path, website.base_url).toString()),
    onWarning,
    requestOptions: (baseUrl) => ({
      retries: settings.max_retries,
      timeoutMs: settings.request_timeout_seconds * 1000,
      delayMs: settings.delay_between_requests_seconds * 1000,
      baseUrl,
      respectRobots: true,
    }),
  };
}

async function discoverArticleLinks(website, scraper, context) {
  const listingPages = await scraper.fetchListingPages(website, context);
  const links = new Set();

  for (const page of listingPages) {
    const pageLinks = scraper.extractArticleLinks(page, website, context);
    const candidates = Array.isArray(pageLinks) ? pageLinks : [];

    if (page.kind === "sitemap") {
      const expandedSitemaps = await expandSitemapCandidates(website, context, candidates);
      for (const sitemapUrl of expandedSitemaps) {
        try {
          const response = await safeRequest(sitemapUrl, context.requestOptions(website.base_url));
          const linksFromSitemap = scraper.extractArticleLinks({ kind: "sitemap", html: response.text, url: sitemapUrl }, website, context);
          for (const link of linksFromSitemap) {
            links.add(link);
          }
        } catch (error) {
          context.onWarning?.(`Unable to parse sitemap ${sitemapUrl}: ${error instanceof Error ? error.message : "Failed"}`);
        }
      }
      continue;
    }

    for (const link of candidates) {
      links.add(link);
    }
  }

  return Array.from(links);
}

async function processWebsiteRun({ organizationId, website, settings, jobType, dateFrom, dateTo }) {
  const lockKey = `${jobType}:${website.id}`;
  const locked = await acquireCrawlLock(organizationId, lockKey, 20);
  if (!locked) {
    return { skipped: true, reason: "Crawler lock active" };
  }

  const warnings = [];
  const context = buildContext(website, settings, dateFrom, dateTo, (message) => warnings.push(message));
  const log = await createCrawlLog({
    organization_id: organizationId,
    website_id: website.id,
    job_type: jobType,
    status: "running",
    message: `Starting ${jobType} crawl for ${website.name}`,
    date_from: dateFrom?.toISOString() || null,
    date_to: dateTo?.toISOString() || null,
  });

  let articlesFound = 0;
  let articlesSaved = 0;
  let articlesSkipped = 0;
  const errorDetails = [];

  try {
    const scraper = getScraper(website.scraper_key);
    const links = await discoverArticleLinks(website, scraper, context);
    const boundedLinks = jobType === "backfill" ? links : links.slice(0, settings.max_articles_per_crawl);
    articlesFound = boundedLinks.length;

    for (const link of boundedLinks) {
      try {
        const html = await scraper.fetchArticlePage(link, website, context);
        const article = await scraper.parseArticle(html, link, website, context);

        if (dateFrom && dateTo && article.published_at && !isDateWithinRange(article.published_at, dateFrom, dateTo)) {
          articlesSkipped += 1;
          errorDetails.push({ level: "info", url: link, reason: "Published date outside requested range" });
          continue;
        }

        const result = await saveArticle(organizationId, website, article, settings);
        if (result.saved) {
          articlesSaved += 1;
        } else {
          articlesSkipped += 1;
          errorDetails.push({ level: "info", url: link, reason: result.reason || "Skipped" });
        }
      } catch (error) {
        articlesSkipped += 1;
        errorDetails.push({ level: "error", url: link, reason: error instanceof Error ? error.message : "Article processing failed" });
      }
    }

    await supabaseAdmin
      .from("web_paper_websites")
      .update({
        last_crawled_at: new Date().toISOString(),
        last_successful_crawl_at: new Date().toISOString(),
        ...(jobType === "backfill"
          ? {
              is_backfill_completed: true,
              last_backfill_completed_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", website.id);

    const updatedLog = await updateCrawlLog(log.id, {
      status: errorDetails.some((item) => item.level === "error") ? "partial_success" : "success",
      message: warnings[0] || `${jobType} finished for ${website.name}`,
      articles_found: articlesFound,
      articles_saved: articlesSaved,
      articles_skipped: articlesSkipped,
      errors_count: errorDetails.filter((item) => item.level === "error").length,
      error_details: [...warnings.map((message) => ({ level: "warning", reason: message })), ...errorDetails],
      finished_at: new Date().toISOString(),
    });

    return {
      skipped: false,
      log: updatedLog,
      summary: { articlesFound, articlesSaved, articlesSkipped, warnings },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${jobType} failed`;
    await updateCrawlLog(log.id, {
      status: "failed",
      message,
      articles_found: articlesFound,
      articles_saved: articlesSaved,
      articles_skipped: articlesSkipped,
      errors_count: errorDetails.length + 1,
      error_details: [...warnings.map((item) => ({ level: "warning", reason: item })), ...errorDetails, { level: "error", reason: message }],
      finished_at: new Date().toISOString(),
    });
    throw error;
  } finally {
    await releaseCrawlLock(organizationId, lockKey);
  }
}

function shouldCrawlWebsite(website, settings) {
  if (!website.is_active) return false;
  const interval = Number(website.crawl_interval_minutes || settings.crawl_interval_minutes || 15);
  if (!website.last_crawled_at) return true;
  const nextRunAt = new Date(website.last_crawled_at).getTime() + interval * 60 * 1000;
  return Date.now() >= nextRunAt;
}

export async function runBackfillForOrganization(organizationId) {
  await ensureDefaultWebsites(organizationId);
  const settings = await ensureCrawlerSettings(organizationId);
  const { start, end } = getLastCompleteMonthRange();
  const websites = await listWebsites(organizationId);
  const results = [];

  for (const website of websites.filter((item) => item.is_active)) {
    await supabaseAdmin
      .from("web_paper_websites")
      .update({
        last_backfill_started_at: new Date().toISOString(),
      })
      .eq("id", website.id);
    const result = await processWebsiteRun({
      organizationId,
      website,
      settings,
      jobType: "backfill",
      dateFrom: start,
      dateTo: end,
    }).catch((error) => ({ skipped: false, error: error instanceof Error ? error.message : "Backfill failed" }));
    results.push({ websiteId: website.id, name: website.name, ...result });
  }

  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
    results,
  };
}

export async function runWebsiteCrawl(organizationId, websiteId, jobType = "manual_crawl") {
  await ensureDefaultWebsites(organizationId);
  const settings = await ensureCrawlerSettings(organizationId);
  const website = await getWebsiteById(organizationId, websiteId);
  if (!website) throw new Error("Website not found");
  return processWebsiteRun({ organizationId, website, settings, jobType });
}

export async function runDueCrawlsForOrganization(organizationId) {
  await ensureDefaultWebsites(organizationId);
  const settings = await ensureCrawlerSettings(organizationId);
  if (!settings.crawler_enabled) return [];

  const websites = await listWebsites(organizationId);
  const results = [];
  for (const website of websites) {
    if (!shouldCrawlWebsite(website, settings)) continue;
    const result = await processWebsiteRun({
      organizationId,
      website,
      settings,
      jobType: "scheduled_crawl",
    }).catch((error) => ({ skipped: false, error: error instanceof Error ? error.message : "Scheduled crawl failed" }));
    results.push({ websiteId: website.id, name: website.name, ...result });
  }
  return results;
}

export async function runManualCrawlForOrganization(organizationId) {
  await ensureDefaultWebsites(organizationId);
  const settings = await ensureCrawlerSettings(organizationId);
  const websites = await listWebsites(organizationId);
  const results = [];
  for (const website of websites.filter((item) => item.is_active)) {
    const result = await processWebsiteRun({
      organizationId,
      website,
      settings,
      jobType: "manual_crawl",
    }).catch((error) => ({ skipped: false, error: error instanceof Error ? error.message : "Manual crawl failed" }));
    results.push({ websiteId: website.id, name: website.name, ...result });
  }
  return results;
}

export async function runCrawlerTick() {
  const organizations = await listOrganizations();
  for (const organization of organizations) {
    try {
      await ensureDefaultWebsites(organization.id);
      const settings = await ensureCrawlerSettings(organization.id);
      const websites = await listWebsites(organization.id);
      const pendingBackfill = settings.initial_backfill_enabled && websites.some((item) => item.is_active && !item.is_backfill_completed);
      if (pendingBackfill) {
        await runBackfillForOrganization(organization.id);
      } else {
        await runDueCrawlsForOrganization(organization.id);
      }
    } catch (error) {
      console.error(`Web paper crawler tick failed for organization ${organization.id}`, error);
    }
  }
}

export async function getCrawlerStatus(organizationId) {
  await ensureDefaultWebsites(organizationId);
  const settings = await ensureCrawlerSettings(organizationId);
  const websites = await listWebsites(organizationId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [articleCount, fetchedToday, failedCrawls] = await Promise.all([
    supabaseAdmin.from("web_paper_articles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabaseAdmin.from("web_paper_articles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("fetched_at", todayStart.toISOString()),
    supabaseAdmin.from("web_paper_crawl_logs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["failed", "partial_success"]),
  ]);

  const lastCrawl = websites
    .map((item) => item.last_crawled_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

  return {
    settings,
    summary: {
      totalArticles: articleCount.count || 0,
      articlesFetchedToday: fetchedToday.count || 0,
      activeWebsites: websites.filter((item) => item.is_active).length,
      lastCrawlTime: lastCrawl,
      failedCrawls: failedCrawls.count || 0,
    },
    websites,
  };
}
