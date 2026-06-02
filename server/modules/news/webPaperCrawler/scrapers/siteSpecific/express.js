import { GenericNewsScraper } from "../generic.js";

export class ExpressScraper extends GenericNewsScraper {
  constructor() {
    super({
      language: "ur",
      listingPaths: ["/latest-news", "/pakistan", "/business"],
      contentSelectors: [".story-content p", ".entry-content p", "article p", "main p"],
      authorSelector: ".author-name, [rel='author']",
      categorySelector: ".breadcrumb a, .story-category a",
      timeSelector: "time",
    });
  }
}
