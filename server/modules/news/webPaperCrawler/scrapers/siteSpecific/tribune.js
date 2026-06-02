import { load } from "cheerio";
import { GenericNewsScraper } from "../generic.js";
import { cleanText } from "../../utils/content.js";

export class TribuneScraper extends GenericNewsScraper {
  constructor() {
    super({
      language: "en",
      listingPaths: ["/latest", "/pakistan", "/business"],
      contentSelectors: [".story-detail__content p", ".story__content p", "article p", "main p"],
      authorSelector: ".author, .story__author, [rel='author']",
      categorySelector: ".breadcrumb a, .story__category a",
      timeSelector: "time",
    });
  }

  async parseArticle(html, url, website) {
    const article = await super.parseArticle(html, url, website);
    if (article.content && article.content.length > 100) {
      return article;
    }

    const $ = load(html);
    const storyRoot = $(".maincontent-customwidth.storypage").first();
    const rawText = cleanText(storyRoot.text());

    if (!rawText) {
      return article;
    }

    let content = rawText;
    const fragmentsToStrip = [
      article.title,
      article.excerpt,
      article.author,
      "facebook twitter whatsup linkded email",
      "COMMENTS Replying to X Saved !",
      "For more information, please see our Comments FAQ",
      "LATEST",
      "MOST READ",
    ].filter(Boolean);

    for (const fragment of fragmentsToStrip) {
      content = content.replace(fragment, " ");
    }

    content = cleanText(content);

    return {
      ...article,
      content,
    };
  }
}
