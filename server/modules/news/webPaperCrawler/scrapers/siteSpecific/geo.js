import { GenericNewsScraper } from "../generic.js";

export class GeoScraper extends GenericNewsScraper {
  constructor() {
    super({
      language: "en",
      listingPaths: ["/latest", "/category/pakistan", "/category/world"],
      contentSelectors: [".content-area p", ".detail p", "article p", "main p"],
      authorSelector: ".author, .reporter-name, [rel='author']",
      categorySelector: ".breadcrumb a, .category a",
      timeSelector: "time",
    });
  }
}
