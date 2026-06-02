import { AryScraper } from "./scrapers/siteSpecific/ary.js";
import { DawnScraper } from "./scrapers/siteSpecific/dawn.js";
import { ExpressScraper } from "./scrapers/siteSpecific/express.js";
import { GeoScraper } from "./scrapers/siteSpecific/geo.js";
import { TribuneScraper } from "./scrapers/siteSpecific/tribune.js";

const SCRAPERS = {
  tribune: new TribuneScraper(),
  dawn: new DawnScraper(),
  geo: new GeoScraper(),
  ary: new AryScraper(),
  express: new ExpressScraper(),
};

export function getScraper(scraperKey) {
  const scraper = SCRAPERS[scraperKey];
  if (!scraper) {
    throw new Error(`Unsupported scraper key: ${scraperKey}`);
  }
  return scraper;
}

export function listScraperKeys() {
  return Object.keys(SCRAPERS);
}
