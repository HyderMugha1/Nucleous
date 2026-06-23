import { config, validateConfig } from "./config.js";
import { connectDatabase } from "./db.js";
import { app } from "./app.js";
import { startTvJobWorker } from "./modules/tv/jobs.js";
import { startMediaIntelligenceWorker } from "./modules/mediaIntelligence/jobs.js";
import { startWebPaperCrawlerWorker } from "./modules/news/webPaperCrawler/jobs.js";
import { startBrandingMonitorWorker } from "./modules/news/branding/jobs.js";

async function start() {
  validateConfig();
  await connectDatabase();
  startTvJobWorker();
  startMediaIntelligenceWorker();
  startWebPaperCrawlerWorker();
  startBrandingMonitorWorker();
  app.listen(config.port, () => {
    console.log(`API server running on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
