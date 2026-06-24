import crypto from "node:crypto";
import JSZip from "jszip";
import { chromium } from "playwright";
import chromiumForServerless from "@sparticuz/chromium";
import { config } from "../../../config.js";
import { supabaseAdmin } from "../../../supabase.js";
import { getWebsiteById } from "../webPaperCrawler/services/websiteService.js";
import { assertRobotsAllowed, buildCrawlerUserAgent } from "../webPaperCrawler/utils/safeRequest.js";

const BRANDING_BUCKET_SIGNED_URL_TTL_SECONDS = 60 * 60;
const MIN_ELEMENT_WIDTH = 80;
const MIN_ELEMENT_HEIGHT = 40;
const MAX_URLS_PER_SCAN = 50;
const STALE_QUEUED_SCAN_MINUTES = 10;
const STALE_RUNNING_SCAN_MINUTES = 60;
const BRANDING_SELECTORS = [
  '[id*="ad"]',
  '[class*="ad"]',
  '[class*="ads"]',
  '[class*="ad-"]',
  '[class*="-ad"]',
  '[class*="adslot"]',
  '[class*="ad-slot"]',
  '[class*="advert"]',
  '[class*="advertisement"]',
  '[class*="sponsor"]',
  '[class*="sponsored"]',
  '[class*="brand"]',
  '[class*="promo"]',
  '[class*="banner-ad"]',
  '[class*="google-ad"]',
  '[class*="dfp"]',
  "[data-ad]",
  "[data-ad-slot]",
  "[data-ad-client]",
  "[data-ad-wrapper]",
  "[data-google-query-id]",
  '[data-testid*="ad"]',
  '[aria-label*="advert"]',
  '[aria-label*="sponsor"]',
  "ins.adsbygoogle",
  'iframe[id^="google_ads_iframe"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="adservice"]',
  'iframe[src*="taboola"]',
  'iframe[src*="outbrain"]',
  "amp-ad",
];
const BRANDING_TEXT_LABELS = [
  "Advertisement",
  "Advert",
  "Sponsored",
  "Sponsored Content",
  "Promoted",
  "Partner Content",
  "Brand Studio",
  "Paid Content",
  "Presented by",
  "In partnership with",
];
const VIEWPORTS = {
  desktop: { width: 1440, height: 1200 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

let brandingBucketEnsured = false;
const runningScanIds = new Set();

function ensureAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Branding Monitor");
  }
}

function getBrandingUserAgent() {
  return `BrandingMonitorBot/1.0 ${config.brandingMonitorContactEmail}`;
}

function roundBox(box) {
  return {
    x: Math.round(Number(box?.x || 0)),
    y: Math.round(Number(box?.y || 0)),
    width: Math.round(Number(box?.width || 0)),
    height: Math.round(Number(box?.height || 0)),
  };
}

function clampConfidence(value) {
  return Math.max(0, Math.min(0.9999, Number(value || 0)));
}

function slugify(value, fallback = "item") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function cleanVisibleText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function isProbablyArticleUrl(urlString, websiteBaseUrl) {
  try {
    const url = new URL(urlString, websiteBaseUrl);
    const baseUrl = new URL(websiteBaseUrl);
    if (url.hostname !== baseUrl.hostname) return false;
    const path = url.pathname.toLowerCase();
    if (!path || path === "/" || path.length < 8) return false;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4|mov|avi|css|js|xml)$/i.test(path)) return false;
    if (/\/(tag|tags|topic|topics|author|authors|search|privacy|about|contact|video|videos|opinion|gallery)\b/.test(path)) return false;
    return path.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

function hashBuffer(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function overlapRatio(a, b) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const intersectionWidth = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const intersectionHeight = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersectionArea = intersectionWidth * intersectionHeight;
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? intersectionArea / minArea : 0;
}

function formatCsvValue(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function buildCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => formatCsvValue(row[header])).join(",")),
  ].join("\n");
}

function normalizeDeviceTypes(deviceTypes = []) {
  const normalized = Array.from(
    new Set(
      deviceTypes
        .map((value) => String(value || "").toLowerCase())
        .filter((value) => value in VIEWPORTS),
    ),
  );
  return normalized.length > 0 ? normalized : ["desktop"];
}

function shouldRunBrandingScanInline() {
  return Boolean(process.env.VERCEL || config.isProduction);
}

async function launchBrandingBrowser() {
  if (shouldRunBrandingScanInline()) {
    const executablePath = await chromiumForServerless.executablePath();
    return chromium.launch({
      args: chromiumForServerless.args,
      executablePath,
      headless: true,
    });
  }

  return chromium.launch({ headless: true });
}

function normalizeUrls(urls = [], baseUrl) {
  const unique = new Set();
  for (const rawUrl of urls) {
    if (!rawUrl) continue;
    try {
      const normalized = new URL(String(rawUrl).trim(), baseUrl).toString();
      unique.add(normalized);
    } catch {
      // ignore malformed URL candidates
    }
  }
  return Array.from(unique).slice(0, MAX_URLS_PER_SCAN);
}

function collectArticleUrlFields(items = []) {
  const urls = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    if (item.canonical_url) urls.push(item.canonical_url);
    if (item.normalized_url) urls.push(item.normalized_url);
    if (item.url) urls.push(item.url);
  }
  return urls;
}

function inferPlacement(box, viewport, pageMetrics = {}) {
  const { x, y, width, height } = roundBox(box);
  const pageHeight = Number(pageMetrics.pageHeight || viewport.height);
  if (y <= 180 && width >= viewport.width * 0.6) return "header";
  if (y + height >= pageHeight - 220) return "footer";
  if (x + width >= viewport.width * 0.72) return "sidebar";
  if (y >= viewport.height * 0.7 && height <= 160 && width >= viewport.width * 0.45) return "sticky";
  if (width >= viewport.width * 0.7 && height >= 280) return "homepage_hero";
  return "in_article";
}

function inferAdType({ selector, text, placement, metadata }) {
  const haystack = `${selector || ""} ${text || ""} ${metadata?.iframeSrc || ""}`.toLowerCase();
  if (haystack.includes("video")) return "video_ad";
  if (haystack.includes("sponsored content") || haystack.includes("partner content")) return "sponsored_article";
  if (placement === "sidebar") return "sidebar_ad";
  if (placement === "header") return "header_banner";
  if (placement === "footer") return "footer_banner";
  if (haystack.includes("taboola") || haystack.includes("outbrain")) return "native_ad";
  if (placement === "in_article") return "in_article_ad";
  return "display_banner";
}

function extractBrandName(text, metadata = {}) {
  const combined = cleanVisibleText(`${text || ""} ${metadata?.altText || ""} ${metadata?.ariaLabel || ""}`);
  const partnershipMatch = combined.match(/(?:presented by|in partnership with|partner content by)\s+([A-Z][A-Za-z0-9&.' -]{1,80})/i);
  if (partnershipMatch?.[1]) return partnershipMatch[1].trim();

  const directMatch = combined.match(/\b([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,3})\b/);
  if (directMatch?.[1] && !BRANDING_TEXT_LABELS.some((label) => directMatch[1].toLowerCase() === label.toLowerCase())) {
    return directMatch[1].trim();
  }

  if (metadata?.iframeSrc) {
    try {
      const hostname = new URL(metadata.iframeSrc).hostname.replace(/^www\./, "");
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const domain = parts[parts.length - 2];
        if (!["doubleclick", "googlesyndication", "google", "adservice", "taboola", "outbrain"].includes(domain)) {
          return domain.charAt(0).toUpperCase() + domain.slice(1);
        }
      }
    } catch {
      // ignore malformed iframe src
    }
  }

  return null;
}

function classifyDetection(candidate, viewport, pageMetrics) {
  const text = cleanVisibleText(candidate.elementText);
  const selector = String(candidate.selector || "");
  const placement = inferPlacement(candidate.boundingBox, viewport, pageMetrics);
  const adType = inferAdType({ selector, text, placement, metadata: candidate.metadata });
  const brandName = extractBrandName(text, candidate.metadata);
  const lowerText = text.toLowerCase();

  let confidence = 0.45;
  if (BRANDING_TEXT_LABELS.some((label) => lowerText.includes(label.toLowerCase()))) confidence += 0.25;
  if (/doubleclick|googlesyndication|adservice|taboola|outbrain/i.test(selector) || /doubleclick|googlesyndication|adservice|taboola|outbrain/i.test(candidate.metadata?.iframeSrc || "")) {
    confidence += 0.2;
  }
  if (brandName) confidence += 0.1;

  return {
    brand_name: brandName,
    ad_type: adType,
    placement,
    confidence: clampConfidence(confidence),
    status: "detected",
    is_false_positive: false,
    metadata: {
      ...candidate.metadata,
      reason: brandName
        ? "Brand-like text or source metadata was visible inside the detected ad container."
        : "Detected through ad-related selector, placement, or sponsored labeling heuristics.",
      visibleText: text,
    },
  };
}

function dedupeDetections(detections) {
  const kept = [];
  for (const candidate of detections) {
    const existingIndex = kept.findIndex((item) => {
      if (item.page_url !== candidate.page_url) return false;
      if (item.device_type !== candidate.device_type) return false;
      const sameHash = item.screenshot_hash && candidate.screenshot_hash && item.screenshot_hash === candidate.screenshot_hash;
      const sameBrand = item.brand_name && candidate.brand_name && item.brand_name === candidate.brand_name;
      const highlyOverlapping = overlapRatio(item.bounding_box, candidate.bounding_box) >= 0.8;
      const sameSelector = item.selector === candidate.selector;
      return sameHash || (highlyOverlapping && sameSelector) || (highlyOverlapping && sameBrand);
    });

    if (existingIndex === -1) {
      kept.push(candidate);
      continue;
    }

    if (Number(candidate.confidence || 0) > Number(kept[existingIndex].confidence || 0)) {
      kept[existingIndex] = candidate;
    }
  }
  return kept;
}

function computeNextRunAt({ frequency, timeOfDay }, referenceDate = new Date()) {
  const [hours, minutes] = String(timeOfDay || "09:00")
    .split(":")
    .map((value) => Number(value || 0));

  const next = new Date(referenceDate);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(hours, minutes, 0, 0);

  if (frequency === "daily") {
    if (next <= referenceDate) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }

  if (frequency === "weekly") {
    const currentDay = referenceDate.getUTCDay();
    const targetDay = 1;
    const delta = (targetDay - currentDay + 7) % 7;
    next.setUTCDate(referenceDate.getUTCDate() + delta);
    if (next <= referenceDate) next.setUTCDate(next.getUTCDate() + 7);
    return next.toISOString();
  }

  if (frequency === "monthly") {
    next.setUTCDate(1);
    if (next <= referenceDate) next.setUTCMonth(next.getUTCMonth() + 1);
    return next.toISOString();
  }

  if (next <= referenceDate) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

async function ensureBrandingBucket() {
  ensureAdminClient();
  if (brandingBucketEnsured) return;

  const bucket = config.brandingMonitorBucket;
  if (!bucket) {
    throw new Error("SUPABASE_BRANDING_BUCKET is required");
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw new Error(listError.message);
  const exists = (buckets || []).some((item) => item.name === bucket);
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: "10MB",
    });
    if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) {
      throw new Error(createError.message);
    }
  }

  brandingBucketEnsured = true;
}

async function uploadScreenshotBuffer(path, buffer) {
  await ensureBrandingBucket();
  const { error } = await supabaseAdmin.storage
    .from(config.brandingMonitorBucket)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || `Unable to upload screenshot: ${path}`);
  }
}

async function createSignedAssetUrl(path) {
  if (!path) return null;
  await ensureBrandingBucket();
  const { data, error } = await supabaseAdmin.storage
    .from(config.brandingMonitorBucket)
    .createSignedUrl(path, BRANDING_BUCKET_SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl || null;
}

async function enrichResultsWithAssetUrls(items) {
  return Promise.all(
    (items || []).map(async (item) => ({
      ...item,
      screenshot_url: await createSignedAssetUrl(item.screenshot_path),
      full_page_screenshot_url: await createSignedAssetUrl(item.full_page_screenshot_path),
    })),
  );
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const distance = Math.max(300, Math.floor(window.innerHeight * 0.65));
      const timer = window.setInterval(() => {
        window.scrollBy(0, distance);
        total += distance;
        if (total >= document.body.scrollHeight) {
          window.clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 250);
    });
  });
}

async function dismissCookieBanners(page) {
  const candidates = [
    "Accept",
    "Accept all",
    "I agree",
    "Agree",
    "Got it",
    "Allow all",
    "Continue",
  ];

  for (const label of candidates) {
    try {
      const locator = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
      if (await locator.isVisible({ timeout: 500 })) {
        await locator.click({ timeout: 1000 });
        return;
      }
    } catch {
      // continue scanning labels
    }
  }
}

async function discoverArticleUrlsFromHomepage(baseUrl, maxUrls = 12) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(baseUrl, {
      headers: {
        "user-agent": getBrandingUserAgent(),
        accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const html = await response.text();
    const hrefMatches = Array.from(html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi));
    const discovered = [];
    const seen = new Set();
    for (const match of hrefMatches) {
      const href = match[1];
      if (!href) continue;
      let absoluteUrl = null;
      try {
        absoluteUrl = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
      if (!isProbablyArticleUrl(absoluteUrl, baseUrl) || seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);
      discovered.push(absoluteUrl);
      if (discovered.length >= maxUrls) break;
    }
    return discovered;
  } catch {
    return [];
  }
}

async function collectCandidates(page) {
  return page.evaluate(({ selectors, labels }) => {
    const MAX_TEXT_LENGTH = 900;
    const MIN_DOM_SCORE = 4.5;
    const MIN_TEXT_SCORE = 3;
    const STRUCTURAL_TAGS = new Set(["html", "body", "main", "header", "footer", "nav", "article"]);

    function buildCssPath(node) {
      if (!node || !(node instanceof Element)) return "";
      if (node.id) return `#${node.id}`;
      const parts = [];
      let current = node;
      while (current && current instanceof Element && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        if (current.classList?.length) {
          part += `.${Array.from(current.classList).slice(0, 2).join(".")}`;
        }
        const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName) : [];
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function hasVisualMedia(element) {
      if (!(element instanceof Element)) return false;
      if (/^(iframe|img|ins|video|amp-ad|canvas)$/i.test(element.tagName)) return true;
      if (element.matches("ins.adsbygoogle, amp-ad")) return true;
      if (element.querySelector("iframe, img, ins.adsbygoogle, video, amp-ad, canvas")) return true;
      const computed = window.getComputedStyle(element);
      return Boolean(computed.backgroundImage && computed.backgroundImage !== "none");
    }

    function hasAdInfrastructure(element) {
      if (!(element instanceof Element)) return false;
      if (/^(iframe|amp-ad|ins)$/i.test(element.tagName)) return true;
      if (element.matches("ins.adsbygoogle, amp-ad, iframe[id^='google_ads_iframe'], iframe[src*='doubleclick'], iframe[src*='googlesyndication'], iframe[src*='adservice'], iframe[src*='taboola'], iframe[src*='outbrain']")) {
        return true;
      }
      return Boolean(
        element.querySelector(
          "iframe[id^='google_ads_iframe'], iframe[src*='doubleclick'], iframe[src*='googlesyndication'], iframe[src*='adservice'], iframe[src*='taboola'], iframe[src*='outbrain'], ins.adsbygoogle, amp-ad, [data-ad], [data-ad-slot], [data-ad-client], [data-ad-wrapper], [data-google-query-id]",
        ),
      );
    }

    function hasSponsoredLabelNearby(element) {
      if (!(element instanceof Element)) return false;
      const nearbyText = [
        element.textContent || "",
        element.previousElementSibling?.textContent || "",
        element.nextElementSibling?.textContent || "",
        element.parentElement?.textContent || "",
      ].join(" ");
      return /advertisement|advert|sponsored|sponsored content|promoted|partner content|paid content|presented by|in partnership with/i.test(nearbyText);
    }

    function looksAdLike(element) {
      if (!(element instanceof Element)) return false;
      const haystack = [
        element.id || "",
        element.className || "",
        element.getAttribute("data-ad") || "",
        element.getAttribute("data-ad-slot") || "",
        element.getAttribute("data-testid") || "",
        element.getAttribute("aria-label") || "",
        element.tagName || "",
      ].join(" ").toLowerCase();
      return /(advert|sponsor|promo|adsbygoogle|doubleclick|googlesyndication|outbrain|taboola|\bad\b|adslot|ad-slot|dfp|banner)/i.test(haystack);
    }

    function isStructuralContainer(element) {
      if (!(element instanceof Element)) return false;
      const tagName = element.tagName.toLowerCase();
      if (STRUCTURAL_TAGS.has(tagName)) return true;
      const className = String(element.className || "").toLowerCase();
      const id = String(element.id || "").toLowerCase();
      if (/story__|template__|mainheader|article-body|content-wrapper|container/.test(`${className} ${id}`) && !looksAdLike(element)) {
        return true;
      }
      return false;
    }

    function scoreElement(element, originRect = null) {
      if (!(element instanceof Element)) return -1;
      const rect = element.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 40) return -1;
      const text = (element.innerText || element.textContent || "").trim().replace(/\s+/g, " ");
      if (text.length > MAX_TEXT_LENGTH && !hasVisualMedia(element)) return -1;

      let score = 0;
      if (hasVisualMedia(element)) score += 4;
      if (looksAdLike(element)) score += 4;
      if (text.length > 0 && text.length <= 180) score += 1.5;
      if (rect.width >= 220 && rect.height >= 120) score += 1.5;
      if (rect.width >= window.innerWidth * 0.2) score += 0.5;
      if (rect.height <= window.innerHeight * 0.6) score += 0.5;
      if (originRect) {
        const dx = Math.abs((rect.x + rect.width / 2) - (originRect.x + originRect.width / 2));
        const dy = Math.abs((rect.y + rect.height / 2) - (originRect.y + originRect.height / 2));
        const distancePenalty = Math.min(4, (dx + dy) / 300);
        score -= distancePenalty;
      }
      return score;
    }

    function pickBestElement(elements, originRect = null) {
      let best = null;
      let bestScore = -1;
      for (const element of elements) {
        const score = scoreElement(element, originRect);
        if (score > bestScore) {
          best = element;
          bestScore = score;
        }
      }
      return bestScore >= 1 ? best : null;
    }

    function gatherNearbyAdCandidates(host, originRect = null) {
      if (!(host instanceof Element)) return [];
      const candidates = new Set();
      const add = (element) => {
        if (element instanceof Element) candidates.add(element);
      };

      add(host);
      add(host.closest("section,article,aside,div,li,figure,iframe"));
      add(host.parentElement);
      add(host.previousElementSibling);
      add(host.nextElementSibling);

      const parent = host.parentElement;
      if (parent) {
        for (const sibling of Array.from(parent.children).slice(0, 12)) {
          add(sibling);
          if (sibling instanceof Element) {
            sibling
              .querySelectorAll("iframe, img, ins.adsbygoogle, amp-ad, [data-ad], [data-ad-slot], [class*='ad'], [class*='advert'], [class*='sponsor'], [class*='promo']")
              .forEach((element) => add(element.closest("section,article,aside,div,li,figure,iframe") || element));
          }
        }
      }

      host
        .querySelectorAll("iframe, img, ins.adsbygoogle, amp-ad, [data-ad], [data-ad-slot], [class*='ad'], [class*='advert'], [class*='sponsor'], [class*='promo']")
        .forEach((element) => add(element.closest("section,article,aside,div,li,figure,iframe") || element));

      const chosen = pickBestElement(Array.from(candidates), originRect);
      return chosen ? [chosen] : [];
    }

    function extractCandidate(element, selector, sourceType) {
      if (!(element instanceof Element)) return null;
      if (isStructuralContainer(element)) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 40) return null;
      const text = (element.innerText || element.textContent || "").trim().replace(/\s+/g, " ");
      if (text.length > MAX_TEXT_LENGTH && !hasVisualMedia(element)) return null;
      const adInfrastructure = hasAdInfrastructure(element);
      const sponsoredLabel = hasSponsoredLabelNearby(element);
      if (sourceType === "dom" && !adInfrastructure && !sponsoredLabel && !looksAdLike(element)) {
        return null;
      }
      if (sourceType === "dom" && !adInfrastructure && hasVisualMedia(element) && !sponsoredLabel) {
        return null;
      }
      const score = scoreElement(element);
      if (score < (sourceType === "text" ? MIN_TEXT_SCORE : MIN_DOM_SCORE)) return null;
      const iframeSrc = element.tagName.toLowerCase() === "iframe" ? element.getAttribute("src") || "" : "";
      const img = element.querySelector("img");
      return {
        selector,
        sourceType,
        score,
        cssPath: buildCssPath(element),
        elementText: text.slice(0, 500),
        boundingBox: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height,
        },
        metadata: {
          tagName: element.tagName.toLowerCase(),
          iframeSrc,
          imageSrc: img?.getAttribute("src") || "",
          altText: img?.getAttribute("alt") || "",
          ariaLabel: element.getAttribute("aria-label") || "",
          classes: element.className || "",
          score,
          adInfrastructure,
          sponsoredLabel,
        },
      };
    }

    const results = [];
    const seen = new Set();
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      for (const element of elements) {
        const key = `${selector}:${buildCssPath(element)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const candidate = extractCandidate(element, selector, "dom");
        if (candidate) results.push(candidate);
      }
    }

    const labelRegex = new RegExp(labels.join("|"), "i");
    const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textSeen = new Set();
    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode;
      const rawText = String(node.textContent || "").trim();
      if (!rawText || !labelRegex.test(rawText)) continue;
      const seed = node.parentElement?.closest("section,article,aside,div,li,figure,iframe");
      const originRect = seed instanceof Element ? seed.getBoundingClientRect() : null;
      const hosts = seed ? gatherNearbyAdCandidates(seed, originRect) : [];
      for (const host of hosts) {
        const key = buildCssPath(host);
        if (!key || textSeen.has(key)) continue;
        textSeen.add(key);
        const candidate = extractCandidate(host, `text:${rawText.slice(0, 60)}`, "text");
        if (candidate) results.push(candidate);
      }
    }

    return {
      candidates: results,
      pageMetrics: {
        pageHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        pageWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      },
    };
  }, { selectors: BRANDING_SELECTORS, labels: BRANDING_TEXT_LABELS });
}

async function captureElementScreenshot(page, candidate, fallbackIndex) {
  const candidatePath = String(candidate.cssPath || "").trim();
  let locator = candidatePath ? page.locator(candidatePath).first() : null;
  if (locator) {
    try {
      if (await locator.count()) {
        return Buffer.from(await locator.screenshot({ type: "png", animations: "disabled" }));
      }
    } catch {
      // fallback to clip-based screenshot
    }
  }

  const box = roundBox(candidate.boundingBox);
  try {
    return Buffer.from(
      await page.screenshot({
        type: "png",
        clip: {
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.max(MIN_ELEMENT_WIDTH, box.width),
          height: Math.max(MIN_ELEMENT_HEIGHT, box.height),
        },
        animations: "disabled",
        path: undefined,
      }),
    );
  } catch {
    return null;
  }
}

async function updateScan(scanId, payload) {
  const { error } = await supabaseAdmin.from("branding_scans").update(payload).eq("id", scanId);
  if (error) throw new Error(error.message);
}

async function getScanById(organizationId, scanId) {
  const { data, error } = await supabaseAdmin
    .from("branding_scans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", scanId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function getMinutesSince(timestamp) {
  const parsed = new Date(timestamp || "");
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - parsed.getTime()) / (1000 * 60);
}

function isScanStale(scan) {
  const status = String(scan?.status || "");
  if (!["queued", "running", "stopping"].includes(status)) return false;

  const minutesSinceUpdate = getMinutesSince(scan?.updated_at || scan?.created_at || scan?.started_at);
  if (status === "queued") {
    return minutesSinceUpdate >= STALE_QUEUED_SCAN_MINUTES;
  }

  if (runningScanIds.has(scan.id)) {
    return false;
  }

  return minutesSinceUpdate >= STALE_RUNNING_SCAN_MINUTES;
}

async function releaseStaleActiveScans(organizationId, newsWebsiteId) {
  const { data, error } = await supabaseAdmin
    .from("branding_scans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .in("status", ["queued", "running", "stopping"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const scan of data || []) {
    if (!isScanStale(scan)) continue;
    const staleStatus = scan.status === "queued" ? "stopped" : "failed";
    const staleMessage = scan.status === "queued"
      ? "Queued branding scan expired before processing."
      : "Branding scan was marked stale and automatically released.";
    await updateScan(scan.id, {
      status: staleStatus,
      completed_at: new Date().toISOString(),
      error_message: staleMessage,
      metadata: {
        ...(scan.metadata || {}),
        stale_recovery: {
          previous_status: scan.status,
          recovered_at: new Date().toISOString(),
        },
      },
    });
  }
}

async function listCandidateUrlsForWebsite(organizationId, websiteId, providedUrls = [], maxUrlsPerScan = MAX_URLS_PER_SCAN) {
  const website = await getWebsiteById(organizationId, websiteId);
  if (!website) throw new Error("News website not found");

  if (providedUrls.length > 0) {
    return normalizeUrls(providedUrls, website.base_url).slice(0, maxUrlsPerScan);
  }

  const { data, error } = await supabaseAdmin
    .from("web_paper_articles")
    .select("url, canonical_url, normalized_url")
    .eq("organization_id", organizationId)
    .eq("website_id", websiteId)
    .order("published_at", { ascending: false })
    .order("fetched_at", { ascending: false })
    .limit(Math.max(25, maxUrlsPerScan));
  if (error) throw new Error(error.message);

  const storedArticleUrls = normalizeUrls(collectArticleUrlFields(data || []), website.base_url).slice(0, maxUrlsPerScan);
  if (storedArticleUrls.length >= maxUrlsPerScan) {
    return storedArticleUrls;
  }

  const homepageDiscoveries = await discoverArticleUrlsFromHomepage(website.base_url, Math.max(6, maxUrlsPerScan - storedArticleUrls.length));

  return normalizeUrls(
    [...storedArticleUrls, website.base_url, ...homepageDiscoveries],
    website.base_url,
  ).slice(0, maxUrlsPerScan);
}

function mapScanStatus(scan) {
  const total = Math.max(0, Number(scan?.total_urls || 0));
  const completed = Math.max(0, Number(scan?.completed_urls || 0));
  const failed = Math.max(0, Number(scan?.failed_urls || 0));
  const progress = total > 0 ? Math.round((Math.min(total, completed + failed) / total) * 100) : 0;
  return {
    ...scan,
    progress,
  };
}

async function processScanInternal(scan, website) {
  const urls = Array.isArray(scan.urls) ? scan.urls : [];
  const deviceTypes = normalizeDeviceTypes(scan.device_types);
  const fullMetadata = { ...(scan.metadata || {}), failures: [] };
  let browser = null;

  try {
    await updateScan(scan.id, {
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
      metadata: fullMetadata,
    });

    browser = await launchBrandingBrowser();

    for (let urlIndex = 0; urlIndex < urls.length; urlIndex += 1) {
      const freshScan = await getScanById(scan.organization_id, scan.id);
      if (freshScan?.status === "stopping") {
        await updateScan(scan.id, {
          status: "stopped",
          completed_at: new Date().toISOString(),
        });
        return;
      }

      const pageUrl = urls[urlIndex];
      let pageFailed = false;
      for (const deviceType of deviceTypes) {
        const viewport = VIEWPORTS[deviceType] || VIEWPORTS.desktop;
        const context = await browser.newContext({
          viewport,
          userAgent: getBrandingUserAgent(),
          locale: "en-US",
        });
        const page = await context.newPage();
        const consoleErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error") {
            consoleErrors.push(cleanVisibleText(message.text()));
          }
        });

        try {
          await assertRobotsAllowed(pageUrl, {
            baseUrl: website.base_url,
            timeoutMs: 30000,
            userAgent: buildCrawlerUserAgent("BrandingMonitorBot"),
          });

          await page.goto(pageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await dismissCookieBanners(page);
          await autoScroll(page);
          await page.waitForTimeout(1000);

          const fullPageBuffer = scan.capture_full_page
            ? Buffer.from(await page.screenshot({ type: "png", fullPage: true, animations: "disabled" }))
            : null;
          const fullPagePath = fullPageBuffer
            ? `${scan.organization_id}/branding/${website.id}/${scan.id}/full-page/${slugify(pageUrl, "page")}-${deviceType}.png`
            : null;

          if (fullPageBuffer && fullPagePath) {
            await uploadScreenshotBuffer(fullPagePath, fullPageBuffer);
          }

          const { candidates, pageMetrics } = await collectCandidates(page);
          const preparedDetections = [];

          for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
            const candidate = candidates[candidateIndex];
            const boundingBox = roundBox(candidate.boundingBox);
            if (boundingBox.width < MIN_ELEMENT_WIDTH || boundingBox.height < MIN_ELEMENT_HEIGHT) continue;

            const screenshotBuffer = scan.capture_ad_elements
              ? await captureElementScreenshot(page, candidate, candidateIndex)
              : null;
            const screenshotPath = screenshotBuffer
              ? `${scan.organization_id}/branding/${website.id}/${scan.id}/elements/${deviceType}-${String(candidateIndex + 1).padStart(3, "0")}.png`
              : null;

            if (screenshotBuffer && screenshotPath) {
              await uploadScreenshotBuffer(screenshotPath, screenshotBuffer);
            }

            const classification = classifyDetection(candidate, viewport, pageMetrics);
            preparedDetections.push({
              organization_id: scan.organization_id,
              scan_id: scan.id,
              news_website_id: website.id,
              page_url: pageUrl,
              brand_name: classification.brand_name,
              ad_type: classification.ad_type,
              placement: classification.placement,
              confidence: classification.confidence,
              selector: candidate.selector,
              element_text: cleanVisibleText(candidate.elementText),
              screenshot_path: screenshotPath,
              full_page_screenshot_path: fullPagePath,
              device_type: deviceType,
              viewport_width: viewport.width,
              viewport_height: viewport.height,
              captured_at: new Date().toISOString(),
              status: classification.status,
              is_false_positive: classification.is_false_positive,
              screenshot_hash: screenshotBuffer ? hashBuffer(screenshotBuffer) : null,
              bounding_box: boundingBox,
              metadata: {
                ...classification.metadata,
                consoleErrors,
              },
            });
          }

          const deduped = dedupeDetections(preparedDetections);
          if (deduped.length > 0) {
            const { error } = await supabaseAdmin.from("branding_results").insert(deduped);
            if (error) throw new Error(error.message);
          }
        } catch (error) {
          pageFailed = true;
          fullMetadata.failures.push({
            url: pageUrl,
            device_type: deviceType,
            error_message: error instanceof Error ? error.message : "Branding scan failed",
            failed_at: new Date().toISOString(),
          });
        } finally {
          await page.close().catch(() => {});
          await context.close().catch(() => {});
        }
      }

      await updateScan(scan.id, {
        completed_urls: urlIndex + 1,
        failed_urls: pageFailed ? Number(scan.failed_urls || 0) + 1 : Number(scan.failed_urls || 0),
        metadata: fullMetadata,
      });
      scan.failed_urls = pageFailed ? Number(scan.failed_urls || 0) + 1 : Number(scan.failed_urls || 0);
    }

    await updateScan(scan.id, {
      status: fullMetadata.failures.length > 0 ? "completed_with_errors" : "completed",
      completed_at: new Date().toISOString(),
      metadata: fullMetadata,
    });
  } catch (error) {
    await updateScan(scan.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : "Branding scan failed",
      metadata: fullMetadata,
    });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function startBrandingScan({ organizationId, newsWebsiteId, payload = {}, userId }) {
  ensureAdminClient();
  const website = await getWebsiteById(organizationId, newsWebsiteId);
  if (!website) throw new Error("News website not found");

  await releaseStaleActiveScans(organizationId, newsWebsiteId);

  const deviceTypes = normalizeDeviceTypes(payload.device_types || ["desktop"]);
  const inlineExecution = shouldRunBrandingScanInline();
  const requestedMaxUrls = Number(payload.max_urls_per_scan || MAX_URLS_PER_SCAN);
  const effectiveMaxUrls = inlineExecution
    ? Math.min(
        Math.max(1, Number(config.brandingMonitorInlineUrlLimit || 3)),
        Math.max(1, requestedMaxUrls || MAX_URLS_PER_SCAN),
      )
    : requestedMaxUrls;
  const urls = await listCandidateUrlsForWebsite(
    organizationId,
    newsWebsiteId,
    payload.urls || [],
    effectiveMaxUrls,
  );

  const { data: activeScans, error: activeScanError } = await supabaseAdmin
    .from("branding_scans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .in("status", ["queued", "running", "stopping"])
    .limit(1);
  if (activeScanError) throw new Error(activeScanError.message);
  if ((activeScans || []).length > 0) {
    throw new Error("A branding scan is already queued or running for this website.");
  }

  const insertPayload = {
    organization_id: organizationId,
    news_website_id: newsWebsiteId,
    status: "queued",
    total_urls: urls.length,
    completed_urls: 0,
    failed_urls: 0,
    urls,
    device_types: deviceTypes,
    capture_full_page: payload.capture_full_page !== false,
    capture_ad_elements: payload.capture_ad_elements !== false,
    use_ai_classification: payload.use_ai_classification !== false,
    requested_by: userId || null,
    metadata: {
      websiteName: website.name,
      baseUrl: website.base_url,
      urlSource: payload.urls?.length ? "manual" : "stored_articles",
      selectedUrlCount: urls.length,
      executionMode: inlineExecution ? "inline" : "background",
    },
  };

  const { data, error } = await supabaseAdmin.from("branding_scans").insert(insertPayload).select("*").single();
  if (error || !data) throw new Error(error?.message || "Unable to start branding scan");

  if (inlineExecution) {
    try {
      await runBrandingScan(organizationId, data.id);
    } catch (scanError) {
      console.error(`Branding scan failed for website ${newsWebsiteId}`, scanError);
    }
    const freshScan = await getScanById(organizationId, data.id);
    return mapScanStatus(freshScan || data);
  }

  void runBrandingScan(organizationId, data.id).catch((scanError) => {
    console.error(`Branding scan failed for website ${newsWebsiteId}`, scanError);
  });

  return mapScanStatus(data);
}

export async function runBrandingScan(organizationId, scanId) {
  ensureAdminClient();
  if (runningScanIds.has(scanId)) return;
  runningScanIds.add(scanId);
  try {
    const scan = await getScanById(organizationId, scanId);
    if (!scan) throw new Error("Branding scan not found");
    const website = await getWebsiteById(organizationId, scan.news_website_id);
    if (!website) throw new Error("News website not found");
    await processScanInternal(scan, website);
  } finally {
    runningScanIds.delete(scanId);
  }
}

export async function stopBrandingScan(organizationId, newsWebsiteId, scanId) {
  const scan = await getScanById(organizationId, scanId);
  if (!scan || scan.news_website_id !== newsWebsiteId) {
    throw new Error("Branding scan not found");
  }
  await updateScan(scanId, {
    status: scan.status === "queued" ? "stopped" : "stopping",
  });
  return mapScanStatus({ ...scan, status: scan.status === "queued" ? "stopped" : "stopping" });
}

export async function listBrandingScans(organizationId, newsWebsiteId, { limit = 20 } = {}) {
  const { data, error } = await supabaseAdmin
    .from("branding_scans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map(mapScanStatus);
}

export async function getBrandingScanStatus(organizationId, newsWebsiteId, scanId) {
  const scan = await getScanById(organizationId, scanId);
  if (!scan || scan.news_website_id !== newsWebsiteId) {
    throw new Error("Branding scan not found");
  }
  return mapScanStatus(scan);
}

export async function getBrandingSchedule(organizationId, newsWebsiteId) {
  const { data, error } = await supabaseAdmin
    .from("branding_scan_schedules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertBrandingSchedule(organizationId, newsWebsiteId, payload = {}, userId) {
  const existing = await getBrandingSchedule(organizationId, newsWebsiteId);
  const nextRunAt = payload.enabled === false
    ? null
    : computeNextRunAt({
        frequency: payload.frequency || existing?.frequency || "daily",
        timeOfDay: payload.time || payload.time_of_day || existing?.time_of_day || "09:00",
      });

  const updatePayload = {
    organization_id: organizationId,
    news_website_id: newsWebsiteId,
    enabled: payload.enabled ?? existing?.enabled ?? false,
    frequency: payload.frequency || existing?.frequency || "daily",
    time_of_day: payload.time || payload.time_of_day || existing?.time_of_day || "09:00",
    device_types: normalizeDeviceTypes(payload.device_types || existing?.device_types || ["desktop"]),
    max_urls_per_scan: Math.min(MAX_URLS_PER_SCAN, Math.max(1, Number(payload.max_urls_per_scan || existing?.max_urls_per_scan || 50))),
    capture_full_page: payload.capture_full_page ?? existing?.capture_full_page ?? true,
    capture_ad_elements: payload.capture_ad_elements ?? existing?.capture_ad_elements ?? true,
    use_ai_classification: payload.use_ai_classification ?? existing?.use_ai_classification ?? true,
    created_by: existing?.created_by || userId || null,
    metadata: {
      ...(existing?.metadata || {}),
      ...(payload.metadata || {}),
    },
    next_run_at: nextRunAt,
  };

  const { data, error } = await supabaseAdmin
    .from("branding_scan_schedules")
    .upsert(updatePayload, {
      onConflict: "organization_id,news_website_id",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to save branding schedule");
  return data;
}

export async function listBrandingResults(organizationId, newsWebsiteId, params = {}) {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(100, Math.max(1, Number(params.limit || 25)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from("branding_results")
    .select("*, branding_scans(status), web_paper_websites(name)", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .order("captured_at", { ascending: false })
    .range(from, to);

  if (params.date_from) query = query.gte("captured_at", params.date_from);
  if (params.date_to) query = query.lte("captured_at", params.date_to);
  if (params.page_url) query = query.ilike("page_url", `%${params.page_url}%`);
  if (params.brand_name) query = query.ilike("brand_name", `%${params.brand_name}%`);
  if (params.ad_type) query = query.eq("ad_type", params.ad_type);
  if (params.placement) query = query.eq("placement", params.placement);
  if (params.device_type) query = query.eq("device_type", params.device_type);
  if (params.status) query = query.eq("status", params.status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const items = await enrichResultsWithAssetUrls(data || []);

  const [summaryResponse, scans, schedule] = await Promise.all([
    supabaseAdmin
      .from("branding_results")
      .select("ad_type, placement, brand_name, page_url, status, captured_at")
      .eq("organization_id", organizationId)
      .eq("news_website_id", newsWebsiteId),
    listBrandingScans(organizationId, newsWebsiteId, { limit: 10 }),
    getBrandingSchedule(organizationId, newsWebsiteId),
  ]);

  if (summaryResponse.error) throw new Error(summaryResponse.error.message);
  const summaryRows = summaryResponse.data || [];
  const mostCommonPlacement = Object.entries(
    summaryRows.reduce((acc, row) => {
      const key = row.placement || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

  const pagesScanned = new Set(summaryRows.map((row) => row.page_url)).size;
  const uniqueBrands = new Set(summaryRows.map((row) => row.brand_name).filter(Boolean)).size;
  const failedScans = scans.filter((scan) => ["failed", "completed_with_errors"].includes(scan.status)).length;

  return {
    results: items,
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.max(1, Math.ceil((count || 0) / limit)),
    },
    summary: {
      totalPagesScanned: pagesScanned,
      totalAdsDetected: summaryRows.length,
      totalUniqueBrands: uniqueBrands,
      lastScanTime: scans[0]?.created_at || null,
      mostCommonAdPlacement: mostCommonPlacement,
      failedScans,
      averageAdsPerPage: pagesScanned > 0 ? Number((summaryRows.length / pagesScanned).toFixed(2)) : 0,
    },
    scans,
    schedule,
  };
}

export async function updateBrandingResult(organizationId, newsWebsiteId, resultId, payload = {}) {
  const update = {};
  if (payload.brand_name !== undefined) update.brand_name = payload.brand_name || null;
  if (payload.ad_type !== undefined) update.ad_type = payload.ad_type || null;
  if (payload.placement !== undefined) update.placement = payload.placement || null;
  if (payload.is_false_positive !== undefined) update.is_false_positive = Boolean(payload.is_false_positive);
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.confidence !== undefined) update.confidence = clampConfidence(payload.confidence);

  const { data, error } = await supabaseAdmin
    .from("branding_results")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .eq("id", resultId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to update branding result");
  const [item] = await enrichResultsWithAssetUrls([data]);
  return item;
}

export async function deleteBrandingResult(organizationId, newsWebsiteId, resultId) {
  const { data, error } = await supabaseAdmin
    .from("branding_results")
    .delete()
    .eq("organization_id", organizationId)
    .eq("news_website_id", newsWebsiteId)
    .eq("id", resultId)
    .select("screenshot_path, full_page_screenshot_path")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const paths = [data?.screenshot_path, data?.full_page_screenshot_path].filter(Boolean);
  if (paths.length > 0) {
    await ensureBrandingBucket();
    await supabaseAdmin.storage.from(config.brandingMonitorBucket).remove(paths).catch(() => {});
  }
}

export async function exportBrandingResults(organizationId, newsWebsiteId, format = "csv", params = {}) {
  const { results } = await listBrandingResults(organizationId, newsWebsiteId, {
    ...params,
    page: 1,
    limit: 100,
  });
  const exportRows = results.map((item) => ({
    website: item.web_paper_websites?.name || "",
    page_url: item.page_url,
    brand_name: item.brand_name || "",
    ad_type: item.ad_type || "",
    placement: item.placement || "",
    captured_at: item.captured_at || "",
    device_type: item.device_type || "",
    status: item.status || "",
    selector: item.selector || "",
    confidence: item.confidence ?? "",
  }));

  if (format === "json") {
    return {
      contentType: "application/json",
      fileName: `branding-results-${newsWebsiteId}.json`,
      buffer: Buffer.from(JSON.stringify(results, null, 2), "utf8"),
    };
  }

  if (format === "zip") {
    const zip = new JSZip();
    zip.file("branding-results.csv", buildCsv(exportRows));
    zip.file("branding-results.json", JSON.stringify(results, null, 2));

    for (const item of results) {
      const assetEntries = [
        { path: item.screenshot_path, folder: "elements" },
        { path: item.full_page_screenshot_path, folder: "full-page" },
      ].filter((entry) => entry.path);

      for (const entry of assetEntries) {
        const { data, error } = await supabaseAdmin.storage.from(config.brandingMonitorBucket).download(entry.path);
        if (error || !data) continue;
        const arrayBuffer = await data.arrayBuffer();
        zip.file(`${entry.folder}/${entry.path.split("/").pop()}`, Buffer.from(arrayBuffer));
      }
    }

    return {
      contentType: "application/zip",
      fileName: `branding-results-${newsWebsiteId}.zip`,
      buffer: Buffer.from(await zip.generateAsync({ type: "nodebuffer" })),
    };
  }

  return {
    contentType: "text/csv",
    fileName: `branding-results-${newsWebsiteId}.csv`,
    buffer: Buffer.from(buildCsv(exportRows), "utf8"),
  };
}

export async function runDueBrandingSchedules() {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("branding_scan_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(10);
  if (error) throw new Error(error.message);

  const results = [];
  for (const schedule of data || []) {
    try {
      const scan = await startBrandingScan({
        organizationId: schedule.organization_id,
        newsWebsiteId: schedule.news_website_id,
        userId: schedule.created_by,
        payload: {
          device_types: schedule.device_types,
          capture_full_page: schedule.capture_full_page,
          capture_ad_elements: schedule.capture_ad_elements,
          use_ai_classification: schedule.use_ai_classification,
          max_urls_per_scan: schedule.max_urls_per_scan,
        },
      });

      await supabaseAdmin
        .from("branding_scan_schedules")
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: computeNextRunAt({
            frequency: schedule.frequency,
            timeOfDay: schedule.time_of_day,
          }),
        })
        .eq("id", schedule.id);

      results.push({
        scheduleId: schedule.id,
        scanId: scan.id,
        status: "queued",
      });
    } catch (error) {
      results.push({
        scheduleId: schedule.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Branding schedule failed",
      });
    }
  }

  return results;
}
