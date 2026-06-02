import { GenericNewsScraper } from "../generic.js";

export class AryScraper extends GenericNewsScraper {
  constructor() {
    super({
      language: "en",
      listingPaths: ["/category/pakistan", "/category/world", "/category/business"],
      contentSelectors: [".entry-content p", ".single-content p", "article p", "main p"],
      authorSelector: ".author-name, .tdb-author-name, [rel='author']",
      categorySelector: ".tdb-entry-category a, .breadcrumb a",
      timeSelector: "time",
    });
  }
}
