export const DEFAULT_WEB_PAPER_WEBSITES = [
  {
    name: "The Express Tribune",
    baseUrl: "https://tribune.com.pk/",
    domain: "tribune.com.pk",
    scraperKey: "tribune",
    language: "en",
    listingPaths: ["/latest", "/pakistan", "/business"],
  },
  {
    name: "Dawn",
    baseUrl: "https://www.dawn.com/",
    domain: "dawn.com",
    scraperKey: "dawn",
    language: "en",
    listingPaths: ["/latest-news", "/pakistan", "/world"],
  },
  {
    name: "Geo News",
    baseUrl: "https://www.geo.tv/",
    domain: "geo.tv",
    scraperKey: "geo",
    language: "en",
    listingPaths: ["/latest", "/category/pakistan", "/category/world"],
  },
  {
    name: "ARY News",
    baseUrl: "https://arynews.tv/",
    domain: "arynews.tv",
    scraperKey: "ary",
    language: "en",
    listingPaths: ["/category/pakistan", "/category/world", "/category/business"],
  },
  {
    name: "Express News",
    baseUrl: "https://www.express.pk/",
    domain: "express.pk",
    scraperKey: "express",
    language: "ur",
    listingPaths: ["/latest-news", "/pakistan", "/business"],
  },
];

export const DEFAULT_SITEMAP_CANDIDATES = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/news-sitemap.xml",
  "/post-sitemap.xml",
  "/sitemap-news.xml",
];
