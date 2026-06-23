import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, created, ok } from "../utils/http.js";
import { parsePagination } from "../utils/query.js";
import { supabaseAdmin } from "../supabase.js";
import { deleteArticle as deleteWebPaperArticle, getArticle as getWebPaperArticle, listArticles as listWebPaperArticles } from "../modules/news/webPaperCrawler/services/articleService.js";
import {
  deleteBrandingResult,
  exportBrandingResults,
  getBrandingScanStatus,
  getBrandingSchedule,
  listBrandingResults,
  listBrandingScans,
  startBrandingScan,
  stopBrandingScan,
  upsertBrandingSchedule,
  updateBrandingResult,
} from "../modules/news/branding/service.js";
import { getCrawlerStatus, runBackfillForOrganization, runManualCrawlForOrganization, runWebsiteCrawl } from "../modules/news/webPaperCrawler/services/crawlerService.js";
import { listCrawlLogs } from "../modules/news/webPaperCrawler/services/logService.js";
import { ensureCrawlerSettings, updateCrawlerSettings } from "../modules/news/webPaperCrawler/services/settingsService.js";
import { createWebsite, deleteWebsite, listWebsites, updateWebsite } from "../modules/news/webPaperCrawler/services/websiteService.js";
import { listScraperKeys } from "../modules/news/webPaperCrawler/scraperFactory.js";

const router = express.Router();
router.use(requireAuth);

router.get(
  "/articles",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("news_articles")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("published_at", { ascending: false })
      .range(skip, skip + limit - 1);
    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`source_name.ilike.%${search}%,headline.ilike.%${search}%,summary.ilike.%${search}%,body.ilike.%${search}%`);
    }
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, { items: data || [], pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) } });
  }),
);

router.post(
  "/articles",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("news_articles")
      .insert({
        organization_id: req.auth.organizationId,
        source_id: payload.sourceId || null,
        source_name: payload.sourceName,
        headline: payload.headline,
        summary: payload.summary,
        body: payload.body,
        language: payload.language,
        sentiment_label: payload.sentiment?.label || null,
        sentiment_score: payload.sentiment?.score || null,
        published_at: payload.publishedAt || new Date().toISOString(),
        url: payload.url || null,
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create news article" });
    return created(res, { item: data });
  }),
);

router.get(
  "/epaper",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    let query = supabaseAdmin
      .from("epaper_clips")
      .select("*", { count: "exact" })
      .eq("organization_id", req.auth.organizationId)
      .order("published_at", { ascending: false })
      .range(skip, skip + limit - 1);
    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = query.or(`source_name.ilike.%${search}%,page_label.ilike.%${search}%,headline.ilike.%${search}%,ocr_text.ilike.%${search}%`);
    }
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ message: error.message });
    return ok(res, { items: data || [], pagination: { page, limit, total: count || 0, pages: Math.max(1, Math.ceil((count || 0) / limit)) } });
  }),
);

router.post(
  "/epaper",
  asyncHandler(async (req, res) => {
    const payload = req.body;
    const { data, error } = await supabaseAdmin
      .from("epaper_clips")
      .insert({
        organization_id: req.auth.organizationId,
        source_id: payload.sourceId || null,
        source_name: payload.sourceName,
        page_label: payload.pageLabel,
        headline: payload.headline,
        ocr_text: payload.ocrText,
        language: payload.language,
        sentiment_label: payload.sentiment?.label || null,
        sentiment_score: payload.sentiment?.score || null,
        published_at: payload.publishedAt || new Date().toISOString(),
        image_url: payload.imageUrl || null,
      })
      .select("*")
      .single();
    if (error || !data) return res.status(400).json({ message: error?.message || "Unable to create e-paper clip" });
    return created(res, { item: data });
  }),
);

router.get(
  "/web-paper/websites",
  asyncHandler(async (req, res) => {
    const items = await listWebsites(req.auth.organizationId);
    return ok(res, { items, availableScrapers: listScraperKeys() });
  }),
);

router.post(
  "/web-paper/websites",
  asyncHandler(async (req, res) => {
    const item = await createWebsite(req.auth.organizationId, req.body || {});
    return created(res, { item });
  }),
);

router.patch(
  "/web-paper/websites/:id",
  asyncHandler(async (req, res) => {
    const item = await updateWebsite(req.auth.organizationId, req.params.id, req.body || {});
    return ok(res, { item });
  }),
);

router.delete(
  "/web-paper/websites/:id",
  asyncHandler(async (req, res) => {
    await deleteWebsite(req.auth.organizationId, req.params.id);
    return ok(res, { success: true });
  }),
);

router.get(
  "/web-paper/articles",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const result = await listWebPaperArticles(req.auth.organizationId, {
      source: req.query.source ? String(req.query.source) : undefined,
      websiteId: req.query.websiteId ? String(req.query.websiteId) : undefined,
      dateFrom: req.query.date_from ? String(req.query.date_from) : undefined,
      dateTo: req.query.date_to ? String(req.query.date_to) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      limit,
      skip,
    });
    return ok(res, {
      items: result.items,
      pagination: { page, limit, total: result.total, pages: Math.max(1, Math.ceil(result.total / limit)) },
    });
  }),
);

router.get(
  "/web-paper/articles/:id",
  asyncHandler(async (req, res) => {
    const item = await getWebPaperArticle(req.auth.organizationId, req.params.id);
    if (!item) return res.status(404).json({ message: "Article not found" });
    return ok(res, { item });
  }),
);

router.delete(
  "/web-paper/articles/:id",
  asyncHandler(async (req, res) => {
    await deleteWebPaperArticle(req.auth.organizationId, req.params.id);
    return ok(res, { success: true });
  }),
);

router.post(
  "/web-paper/crawler/run-now",
  asyncHandler(async (req, res) => {
    void runManualCrawlForOrganization(req.auth.organizationId).catch((error) => {
      console.error(`Manual web paper crawl failed for organization ${req.auth.organizationId}`, error);
    });
    return ok(res, { queued: true });
  }),
);

router.post(
  "/web-paper/crawler/backfill-last-month",
  asyncHandler(async (req, res) => {
    void runBackfillForOrganization(req.auth.organizationId).catch((error) => {
      console.error(`Web paper backfill failed for organization ${req.auth.organizationId}`, error);
    });
    return ok(res, { queued: true });
  }),
);

router.post(
  "/web-paper/crawler/run-website/:websiteId",
  asyncHandler(async (req, res) => {
    void runWebsiteCrawl(req.auth.organizationId, req.params.websiteId).catch((error) => {
      console.error(`Web paper single-site crawl failed for organization ${req.auth.organizationId} and website ${req.params.websiteId}`, error);
    });
    return ok(res, { queued: true });
  }),
);

router.get(
  "/web-paper/crawler/logs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const result = await listCrawlLogs(req.auth.organizationId, {
      websiteId: req.query.websiteId ? String(req.query.websiteId) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      jobType: req.query.jobType ? String(req.query.jobType) : undefined,
      limit,
      skip,
    });
    return ok(res, {
      items: result.items,
      pagination: { page, limit, total: result.total, pages: Math.max(1, Math.ceil(result.total / limit)) },
    });
  }),
);

router.get(
  "/web-paper/crawler/status",
  asyncHandler(async (req, res) => {
    const status = await getCrawlerStatus(req.auth.organizationId);
    return ok(res, status);
  }),
);

router.get(
  "/web-paper/crawler/settings",
  asyncHandler(async (req, res) => {
    const item = await ensureCrawlerSettings(req.auth.organizationId);
    return ok(res, { item });
  }),
);

router.patch(
  "/web-paper/crawler/settings",
  asyncHandler(async (req, res) => {
    const item = await updateCrawlerSettings(req.auth.organizationId, req.body || {});
    return ok(res, { item });
  }),
);

router.get(
  "/:newsId/branding/scans",
  asyncHandler(async (req, res) => {
    const items = await listBrandingScans(req.auth.organizationId, req.params.newsId, {
      limit: Number(req.query.limit || 20),
    });
    return ok(res, { items });
  }),
);

router.post(
  "/:newsId/branding/scans",
  asyncHandler(async (req, res) => {
    const item = await startBrandingScan({
      organizationId: req.auth.organizationId,
      newsWebsiteId: req.params.newsId,
      payload: req.body || {},
      userId: req.auth.supabaseUser?.id,
    });
    return created(res, {
      scan_id: item.id,
      status: item.status,
      item,
    });
  }),
);

router.get(
  "/:newsId/branding/scans/:scanId",
  asyncHandler(async (req, res) => {
    const item = await getBrandingScanStatus(req.auth.organizationId, req.params.newsId, req.params.scanId);
    return ok(res, {
      scan_id: item.id,
      status: item.status,
      progress: item.progress,
      total_urls: item.total_urls,
      completed_urls: item.completed_urls,
      failed_urls: item.failed_urls,
      item,
    });
  }),
);

router.post(
  "/:newsId/branding/scans/:scanId/stop",
  asyncHandler(async (req, res) => {
    const item = await stopBrandingScan(req.auth.organizationId, req.params.newsId, req.params.scanId);
    return ok(res, { item });
  }),
);

router.get(
  "/:newsId/branding/results",
  asyncHandler(async (req, res) => {
    const result = await listBrandingResults(req.auth.organizationId, req.params.newsId, {
      date_from: req.query.date_from ? String(req.query.date_from) : undefined,
      date_to: req.query.date_to ? String(req.query.date_to) : undefined,
      page_url: req.query.page_url ? String(req.query.page_url) : undefined,
      brand_name: req.query.brand_name ? String(req.query.brand_name) : undefined,
      ad_type: req.query.ad_type ? String(req.query.ad_type) : undefined,
      placement: req.query.placement ? String(req.query.placement) : undefined,
      device_type: req.query.device_type ? String(req.query.device_type) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return ok(res, result);
  }),
);

router.patch(
  "/:newsId/branding/results/:resultId",
  asyncHandler(async (req, res) => {
    const item = await updateBrandingResult(req.auth.organizationId, req.params.newsId, req.params.resultId, req.body || {});
    return ok(res, { item });
  }),
);

router.delete(
  "/:newsId/branding/results/:resultId",
  asyncHandler(async (req, res) => {
    await deleteBrandingResult(req.auth.organizationId, req.params.newsId, req.params.resultId);
    return ok(res, { success: true });
  }),
);

router.get(
  "/:newsId/branding/export",
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "csv").toLowerCase();
    const exported = await exportBrandingResults(req.auth.organizationId, req.params.newsId, format, {
      date_from: req.query.date_from ? String(req.query.date_from) : undefined,
      date_to: req.query.date_to ? String(req.query.date_to) : undefined,
      page_url: req.query.page_url ? String(req.query.page_url) : undefined,
      brand_name: req.query.brand_name ? String(req.query.brand_name) : undefined,
      ad_type: req.query.ad_type ? String(req.query.ad_type) : undefined,
      placement: req.query.placement ? String(req.query.placement) : undefined,
      device_type: req.query.device_type ? String(req.query.device_type) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
    });
    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.fileName}"`);
    return res.send(exported.buffer);
  }),
);

router.get(
  "/:newsId/branding/schedule",
  asyncHandler(async (req, res) => {
    const item = await getBrandingSchedule(req.auth.organizationId, req.params.newsId);
    return ok(res, { item });
  }),
);

router.put(
  "/:newsId/branding/schedule",
  asyncHandler(async (req, res) => {
    const item = await upsertBrandingSchedule(req.auth.organizationId, req.params.newsId, req.body || {}, req.auth.supabaseUser?.id);
    return ok(res, { item });
  }),
);

export default router;
