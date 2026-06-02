import { sha256 } from "./hash.js";

const TRACKING_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeUrl(inputUrl, baseUrl) {
  if (!inputUrl) return null;
  let url;
  try {
    url = new URL(inputUrl, baseUrl);
  } catch {
    return null;
  }

  url.protocol = "https:";
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  const nextParams = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (TRACKING_KEYS.has(key.toLowerCase())) continue;
    nextParams.append(key, value);
  }
  url.search = nextParams.toString() ? `?${nextParams.toString()}` : "";

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isAllowedArticleUrl(url, allowedDomain) {
  const domain = getDomain(url);
  const normalizedAllowed = String(allowedDomain || "").toLowerCase().replace(/^www\./, "");
  return Boolean(domain && normalizedAllowed && (domain === normalizedAllowed || domain.endsWith(`.${normalizedAllowed}`)));
}

export function buildUrlHash(url) {
  return sha256(normalizeUrl(url) || url || "");
}
