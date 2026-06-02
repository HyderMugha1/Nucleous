import fs from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx > 0) process.env[line.slice(0, idx)] = line.slice(idx + 1);
}

const { supabaseAdmin } = await import('./server/supabase.js');
const { getScraper } = await import('./server/modules/news/webPaperCrawler/scraperFactory.js');
const { saveArticle } = await import('./server/modules/news/webPaperCrawler/services/articleService.js');
const { ensureCrawlerSettings } = await import('./server/modules/news/webPaperCrawler/services/settingsService.js');
const { listWebsites } = await import('./server/modules/news/webPaperCrawler/services/websiteService.js');

const targets = [
  '9b8f11ed-25a6-4f8b-9bef-ddf324a85636',
  '88b94475-5bf1-4ece-93d4-a6acb69939ee',
];
const mayStart = new Date('2026-05-01T00:00:00.000Z');
const mayEnd = new Date('2026-05-31T23:59:59.999Z');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function clean(text) { return String(text || '').replace(/\s+/g, ' ').trim(); }

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function getTribuneCandidates() {
  const indexXml = await fetchText('https://tribune.com.pk/sitemap.xml');
  const $ = load(indexXml, { xmlMode: true });
  const sitemapUrls = [];
  $('sitemap loc').each((_, el) => {
    const url = clean($(el).text());
    if (/\/posts-\d+\.xml$/i.test(url)) sitemapUrls.push(url);
  });
  const urls = [];
  for (const sitemapUrl of sitemapUrls.slice(0, 8)) {
    const xml = await fetchText(sitemapUrl);
    const $xml = load(xml, { xmlMode: true });
    $xml('url').each((_, el) => {
      const loc = clean($xml(el).find('loc').text());
      const lastmod = clean($xml(el).find('lastmod').text());
      if (loc) urls.push({ url: loc, lastmod });
    });
  }
  return urls;
}

async function getAryCandidates() {
  const indexXml = await fetchText('https://arynews.tv/sitemap_index.xml');
  const $ = load(indexXml, { xmlMode: true });
  const sitemapUrls = [];
  $('sitemap loc').each((_, el) => {
    const url = clean($(el).text());
    if (/\/sitemap\/1-\d+\.xml$/i.test(url)) sitemapUrls.push(url);
  });
  const urls = [];
  for (const sitemapUrl of sitemapUrls.slice(0, 15)) {
    const xml = await fetchText(sitemapUrl);
    const $xml = load(xml, { xmlMode: true });
    $xml('url loc').each((_, el) => {
      const loc = clean($xml(el).text());
      if (loc) urls.push({ url: loc, lastmod: '' });
    });
  }
  return urls;
}

async function ingestForOrg(orgId) {
  const { data: org } = await supabaseAdmin.from('organizations').select('id,name').eq('id', orgId).maybeSingle();
  const settings = await ensureCrawlerSettings(orgId);
  const websites = await listWebsites(orgId);
  console.log(`[${new Date().toISOString()}] Org ${org?.name || orgId}: cleaning null-published placeholder rows`);
  await supabaseAdmin.from('web_paper_articles').delete().eq('organization_id', orgId).is('published_at', null);

  const siteRuns = [
    { key: 'tribune', getCandidates: getTribuneCandidates, maxSave: 15 },
    { key: 'ary', getCandidates: getAryCandidates, maxSave: 15 },
  ];

  for (const siteRun of siteRuns) {
    const website = websites.find(item => item.scraper_key === siteRun.key);
    if (!website) continue;
    const scraper = getScraper(siteRun.key);
    console.log(`[${new Date().toISOString()}] Org ${org?.name || orgId}: collecting ${siteRun.key} candidates`);
    const candidates = await siteRun.getCandidates();
    let saved = 0;
    let inspected = 0;
    for (const candidate of candidates) {
      if (saved >= siteRun.maxSave) break;
      inspected += 1;
      try {
        if (candidate.lastmod) {
          const lastmodDate = new Date(candidate.lastmod);
          if (!Number.isNaN(lastmodDate.getTime()) && lastmodDate < mayStart) break;
        }
        const html = await scraper.fetchArticlePage(candidate.url, website, {
          requestOptions: () => ({ retries: 2, timeoutMs: 20000, delayMs: 1000, baseUrl: website.base_url, respectRobots: true }),
        });
        const article = await scraper.parseArticle(html, candidate.url, website, {});
        const publishedAt = article.published_at ? new Date(article.published_at) : null;
        if (!publishedAt || Number.isNaN(publishedAt.getTime())) continue;
        if (publishedAt < mayStart || publishedAt > mayEnd) {
          if (publishedAt < mayStart) break;
          continue;
        }
        const result = await saveArticle(orgId, website, article, settings);
        if (result.saved) {
          saved += 1;
          console.log(`[${new Date().toISOString()}] Org ${org?.name || orgId}: saved ${siteRun.key} article ${saved}/${siteRun.maxSave} -> ${article.title}`);
        }
      } catch (error) {
        console.log(`[${new Date().toISOString()}] Org ${org?.name || orgId}: ${siteRun.key} candidate failed -> ${candidate.url} :: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(800);
    }
    console.log(`[${new Date().toISOString()}] Org ${org?.name || orgId}: ${siteRun.key} inspected ${inspected}, saved ${saved}`);
  }

  const { count } = await supabaseAdmin.from('web_paper_articles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
  console.log(`[${new Date().toISOString()}] Org ${org?.name || orgId}: final article count ${count}`);
}

for (const orgId of targets) {
  try {
    await ingestForOrg(orgId);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Org ${orgId} ingest failed`);
    console.error(error instanceof Error ? error.stack : String(error));
  }
}
