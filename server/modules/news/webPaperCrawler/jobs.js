import { runCrawlerTick } from "./services/crawlerService.js";

let workerTimer = null;
let workerRunning = false;
let warnedMissingTables = false;
const WORKER_POLL_INTERVAL_MS = 60 * 1000;

async function runWorkerTick() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    console.log(`[WebPaperCrawler] Tick started at ${new Date().toISOString()}`);
    await runCrawlerTick();
    console.log(`[WebPaperCrawler] Tick completed at ${new Date().toISOString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Web paper crawler worker failed";
    if (
      message.includes("web_paper_websites") ||
      message.includes("web_paper_articles") ||
      message.includes("web_paper_crawl_logs") ||
      message.includes("schema cache")
    ) {
      if (!warnedMissingTables) {
        console.warn("Web paper crawler worker paused until crawler tables are available.");
        warnedMissingTables = true;
      }
      return;
    }
    console.error("Web paper crawler worker failed", error);
  } finally {
    workerRunning = false;
  }
}

export function startWebPaperCrawlerWorker() {
  if (workerTimer || String(process.env.WEB_PAPER_CRAWLER_ENABLED || "true") === "false") return;
  console.log(`[WebPaperCrawler] Worker started with ${WORKER_POLL_INTERVAL_MS / 1000}s polling`);
  void runWorkerTick();
  workerTimer = setInterval(() => {
    void runWorkerTick();
  }, WORKER_POLL_INTERVAL_MS);
}

export function stopWebPaperCrawlerWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
