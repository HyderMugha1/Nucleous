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

const scraper = getScraper('tribune');
const websiteShape = { name: 'The Express Tribune', base_url: 'https://tribune.com.pk/', domain: 'tribune.com.pk', scraper_key: 'tribune', language: 'en' };
const res = await fetch('https://tribune.com.pk/sitemap/posts-1.xml', { headers: { 'user-agent': 'Mozilla/5.0' } });
const xml = await res.text();
const $ = load(xml, { xmlMode: true });
const urls = [];
$('url').each((_, el) => {
  const loc = $(el).find('loc').text().trim();
  const lastmod = $(el).find('lastmod').text().trim();
  if (lastmod.startsWith('2026-05')) urls.push(loc);
});
const selectedUrls = urls.slice(0, 12);
const parsedArticles = [];
for (const url of selectedUrls) {
  try {
    const html = await scraper.fetchArticlePage(url, websiteShape, { requestOptions: () => ({ retries: 2, timeoutMs: 20000, delayMs: 500, baseUrl: websiteShape.base_url, respectRobots: true }) });
    const article = await scraper.parseArticle(html, url, websiteShape, {});
    if (article.content && article.content.length > 100 && article.published_at?.startsWith('2026-05')) parsedArticles.push(article);
  } catch {}
}
console.log(`[${new Date().toISOString()}] Prepared ${parsedArticles.length} parsed Tribune articles`);
const { data: orgs } = await supabaseAdmin.from('organizations').select('id,name').order('created_at', { ascending: false });
for (const org of orgs || []) {
  try {
    await supabaseAdmin.from('web_paper_articles').delete().eq('organization_id', org.id).is('published_at', null);
    const settings = await ensureCrawlerSettings(org.id);
    const websites = await listWebsites(org.id);
    const website = websites.find(item => item.scraper_key === 'tribune');
    if (!website) continue;
    let saved = 0;
    for (const article of parsedArticles) {
      const result = await saveArticle(org.id, website, article, settings);
      if (result.saved) saved += 1;
    }
    const { count } = await supabaseAdmin.from('web_paper_articles').select('id', { count: 'exact', head: true }).eq('organization_id', org.id);
    console.log(`[${new Date().toISOString()}] ${org.name}: saved ${saved}, total ${count}`);
  } catch (error) {
    console.log(`[${new Date().toISOString()}] ${org.name}: failed ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`[${new Date().toISOString()}] Seed complete`);
