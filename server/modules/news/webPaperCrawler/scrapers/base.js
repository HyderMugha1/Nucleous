export class BaseScraper {
  constructor(config = {}) {
    this.config = config;
  }

  async fetchListingPages(_website, _context) {
    throw new Error("fetchListingPages must be implemented");
  }

  extractArticleLinks(_payload, _website, _context) {
    throw new Error("extractArticleLinks must be implemented");
  }

  async fetchArticlePage(_url, _website, _context) {
    throw new Error("fetchArticlePage must be implemented");
  }

  async parseArticle(_html, _url, _website, _context) {
    throw new Error("parseArticle must be implemented");
  }
}
