import { GenericNewsScraper } from "../generic.js";

export class DawnScraper extends GenericNewsScraper {
  constructor() {
    super({
      language: "en",
      listingPaths: ["/latest-news", "/pakistan", "/world"],
      contentSelectors: [".story__content p", '[itemprop="articleBody"] p', "article p", "main p"],
      authorSelector: ".story__byline, [rel='author']",
      categorySelector: ".story__content .story__link a, .breadcrumbs a",
      timeSelector: "time",
    });
  }
}
