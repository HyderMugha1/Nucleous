import { load } from "cheerio";

export function decodeHtml(html = "") {
  return load(html).text();
}

export function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function stripHtml(html) {
  return cleanText(load(html || "").text());
}

export function extractExcerpt(content, maxLength = 220) {
  const text = cleanText(content);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}
