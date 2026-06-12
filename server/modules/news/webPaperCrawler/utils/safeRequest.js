import { cleanText } from "./content.js";
import { config } from "../../../../config.js";

const robotsCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    return await fetch(url, {
      headers: options.headers,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadRobotsRules(baseUrl, headers, timeoutMs) {
  if (robotsCache.has(baseUrl)) return robotsCache.get(baseUrl);

  try {
    const response = await fetchWithTimeout(new URL("/robots.txt", baseUrl).toString(), {
      headers,
      timeoutMs,
    });
    const text = response.ok ? await response.text() : "";
    const lines = text.split(/\r?\n/);
    const disallow = [];
    let appliesToAll = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const [directive, ...rest] = line.split(":");
      const value = cleanText(rest.join(":"));
      const key = directive.toLowerCase();
      if (key === "user-agent") {
        appliesToAll = value === "*" || value.toLowerCase().includes("mozilla");
      } else if (key === "disallow" && appliesToAll && value) {
        disallow.push(value);
      }
    }
    robotsCache.set(baseUrl, disallow);
    return disallow;
  } catch {
    robotsCache.set(baseUrl, []);
    return [];
  }
}

function isBlockedByRobots(url, disallowRules) {
  const pathname = new URL(url).pathname;
  return disallowRules.some((rule) => rule !== "/" && pathname.startsWith(rule));
}

export async function safeRequest(url, options) {
  const {
    retries = 3,
    timeoutMs = 30000,
    delayMs = 2000,
    userAgent = `NucleusWebPaperCrawler/1.0 (+${config.siteUrl || "https://app.your-domain.example.com"})`,
    respectRobots = true,
    baseUrl,
  } = options;

  const headers = {
    "user-agent": userAgent,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.8",
  };

  if (respectRobots && baseUrl) {
    const disallowRules = await loadRobotsRules(baseUrl, headers, timeoutMs);
    if (isBlockedByRobots(url, disallowRules)) {
      const error = new Error(`Blocked by robots.txt: ${url}`);
      error.code = "ROBOTS_BLOCKED";
      throw error;
    }
  }

  let attempt = 0;
  let lastError = null;
  while (attempt < retries) {
    attempt += 1;
    try {
      if (attempt > 1) {
        await sleep(delayMs);
      }
      const response = await fetchWithTimeout(url, { headers, timeoutMs });
      if (response.status === 404) {
        const error = new Error(`404 Not Found for ${url}`);
        error.code = "HTTP_404";
        throw error;
      }
      if (response.status === 403) {
        const error = new Error(`403 Forbidden for ${url}`);
        error.code = "HTTP_403";
        throw error;
      }
      if (response.status === 429) {
        const error = new Error(`429 Too Many Requests for ${url}`);
        error.code = "HTTP_429";
        throw error;
      }
      if (response.status >= 500) {
        const error = new Error(`HTTP ${response.status} for ${url}`);
        error.code = "HTTP_5XX";
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} for ${url}`);
        error.code = `HTTP_${response.status}`;
        throw error;
      }
      return {
        url: response.url,
        status: response.status,
        text: await response.text(),
      };
    } catch (error) {
      lastError = error;
      if (error instanceof Error && ["HTTP_404", "HTTP_403", "ROBOTS_BLOCKED"].includes(error.code)) {
        throw error;
      }
      if (attempt >= retries) {
        if (error instanceof Error && error.name === "AbortError") {
          const timeoutError = new Error(`Request timed out for ${url}`);
          timeoutError.code = "REQUEST_TIMEOUT";
          throw timeoutError;
        }
        throw error;
      }
    }
  }

  throw lastError || new Error(`Request failed for ${url}`);
}
