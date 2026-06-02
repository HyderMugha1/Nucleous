import { load } from "cheerio";
import { BaseScraper } from "./base.js";
import { cleanText, extractExcerpt } from "../utils/content.js";
import { coerceDate } from "../utils/dateRange.js";
import { safeRequest } from "../utils/safeRequest.js";
import { isAllowedArticleUrl, normalizeUrl } from "../utils/url.js";

const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

function flattenJsonLd(input) {
  if (Array.isArray(input)) return input.flatMap(flattenJsonLd);
  if (input && Array.isArray(input["@graph"])) return input["@graph"].flatMap(flattenJsonLd);
  return input ? [input] : [];
}

function parseJsonLd($) {
  const entries = [];
  $(JSON_LD_SELECTOR).each((_, element) => {
    const raw = $(element).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      entries.push(...flattenJsonLd(parsed));
    } catch {
      // ignore malformed json-ld blocks
    }
  });
  return entries;
}

function pickJsonLdArticle(entries) {
  return entries.find((entry) => {
    const type = entry?.["@type"];
    if (Array.isArray(type)) return type.some((item) => String(item).toLowerCase().includes("article"));
    return String(type || "").toLowerCase().includes("article");
  });
}

function getMeta($, name) {
  return (
    $(`meta[property="${name}"]`).attr("content") ||
    $(`meta[name="${name}"]`).attr("content") ||
    ""
  );
}

function getContentFromSelectors($, selectors) {
  for (const selector of selectors) {
    const parts = [];
    $(selector).each((_, element) => {
      const text = cleanText($(element).text());
      if (text) parts.push(text);
    });
    if (parts.length > 0) return parts.join("\n\n");
  }
  return "";
}

function deriveLanguage($, fallback) {
  return (
    $("html").attr("lang") ||
    getMeta($, "og:locale")?.split("_")[0] ||
    fallback ||
    ""
  );
}

export class GenericNewsScraper extends BaseScraper {
  async fetchListingPages(website, context) {
    const pages = [];
    const candidates = [];

    for (const sitemapUrl of context.sitemapCandidates || []) {
      candidates.push({ kind: "sitemap", url: sitemapUrl });
    }
    for (const listingPath of this.config.listingPaths || []) {
      candidates.push({ kind: "listing", url: new URL(listingPath, website.base_url).toString() });
    }
    candidates.push({ kind: "listing", url: website.base_url });

    for (const candidate of candidates) {
      try {
        const response = await safeRequest(candidate.url, context.requestOptions(website.base_url));
        pages.push({ ...candidate, html: response.text, finalUrl: response.url });
      } catch (error) {
        context.onWarning?.(`Unable to fetch ${candidate.url}: ${error instanceof Error ? error.message : "Request failed"}`);
      }
    }

    return pages;
  }

  extractArticleLinks(page, website, context) {
    if (page.kind === "sitemap") {
      return this.extractLinksFromSitemap(page.html, website, context);
    }
    return this.extractLinksFromHtml(page.html, page.finalUrl || page.url, website, context);
  }

  extractLinksFromSitemap(xml, website, context) {
    const $ = load(xml, { xmlMode: true });
    const urls = new Set();
    const nestedSitemaps = [];

    $("sitemap > loc").each((_, element) => {
      const loc = cleanText($(element).text());
      if (!loc) return;
      nestedSitemaps.push(loc);
    });

    if (nestedSitemaps.length > 0) {
      return nestedSitemaps;
    }

    $("url").each((_, element) => {
      const loc = cleanText($(element).find("loc").first().text());
      const lastmod = cleanText($(element).find("lastmod").first().text());
      const normalized = normalizeUrl(loc, website.base_url);
      if (!normalized || !isAllowedArticleUrl(normalized, website.domain)) return;
      if (context.dateFrom && context.dateTo) {
        const candidateDate = coerceDate(lastmod);
        if (candidateDate && (candidateDate < context.dateFrom || candidateDate > context.dateTo)) {
          return;
        }
      }
      urls.add(normalized);
    });

    return Array.from(urls);
  }

  extractLinksFromHtml(html, pageUrl, website) {
    const $ = load(html);
    const urls = new Set();
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      const normalized = normalizeUrl(href, pageUrl || website.base_url);
      if (!normalized || !isAllowedArticleUrl(normalized, website.domain)) return;
      if (this.isLikelyArticleUrl(normalized, website)) {
        urls.add(normalized);
      }
    });
    return Array.from(urls);
  }

  isLikelyArticleUrl(url) {
    return /\/(news|story|stories|article|articles|category|world|business|sport|sports|pakistan)\//i.test(url) || /-\d{4,}/.test(url);
  }

  async fetchArticlePage(url, website, context) {
    const response = await safeRequest(url, context.requestOptions(website.base_url));
    return response.text;
  }

  async parseArticle(html, url, website) {
    const $ = load(html);
    const jsonLdEntries = parseJsonLd($);
    const articleLd = pickJsonLdArticle(jsonLdEntries) || {};

    const title =
      cleanText(articleLd.headline) ||
      cleanText(getMeta($, "og:title")) ||
      cleanText($("h1").first().text());

    const canonicalUrl = normalizeUrl(
      cleanText(articleLd.mainEntityOfPage?.["@id"]) ||
      cleanText(getMeta($, "og:url")) ||
      $('link[rel="canonical"]').attr("href") ||
      url,
      url,
    );

    const content = getContentFromSelectors($, this.config.contentSelectors || [
      "article p",
      '[itemprop="articleBody"] p',
      ".story__content p",
      ".story-detail__content p",
      ".entry-content p",
      ".post-content p",
      ".content-area p",
      "main p",
    ]);

    const excerpt =
      cleanText(articleLd.description) ||
      cleanText(getMeta($, "description")) ||
      extractExcerpt(content);

    const imageUrl =
      cleanText(articleLd.image?.url || articleLd.image?.[0]?.url || articleLd.image?.[0]) ||
      cleanText(getMeta($, "og:image"));

    const author =
      cleanText(articleLd.author?.name || articleLd.author?.[0]?.name || articleLd.creator?.name) ||
      cleanText(getMeta($, "author")) ||
      cleanText($(this.config.authorSelector || ".author, .story__author, [rel='author']").first().text());

    const category =
      cleanText(articleLd.articleSection) ||
      cleanText($(this.config.categorySelector || "a[rel='category tag'], .breadcrumb a").last().text());

    const publishedAt =
      coerceDate(articleLd.datePublished) ||
      coerceDate(getMeta($, "article:published_time")) ||
      coerceDate($("time").first().attr("datetime")) ||
      coerceDate($(this.config.timeSelector || "time").first().text());

    return {
      source_name: website.name,
      title,
      url,
      canonical_url: canonicalUrl || url,
      excerpt,
      content,
      author: author || null,
      category: category || null,
      language: deriveLanguage($, this.config.language || website.language || null) || null,
      image_url: imageUrl || null,
      published_at: publishedAt ? publishedAt.toISOString() : null,
      raw_html: html,
    };
  }
}
