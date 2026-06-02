import { processDueSummarySchedules, refreshMediaIntelligenceForAllOrganizations } from "./service.js";

let workerTimer = null;
let workerRunning = false;
let warnedMissingTables = false;

async function runWorkerTick() {
  if (workerRunning) return;
  workerRunning = true;

  try {
    try {
      await refreshMediaIntelligenceForAllOrganizations({
        days: 2,
        createAlerts: true,
      });
      await processDueSummarySchedules();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media intelligence worker failed";
      if (
        message.includes("organization_watch_terms") ||
        message.includes("media_keyword_daily_stats") ||
        message.includes("organization_summary_schedules") ||
        message.includes("summary_dispatch_logs") ||
        message.includes("schema cache")
      ) {
        if (!warnedMissingTables) {
          console.warn("Media intelligence worker paused until media intelligence migration tables are available.");
          warnedMissingTables = true;
        }
        return;
      }

      console.error("Media intelligence worker tick failed", error);
    }
  } finally {
    workerRunning = false;
  }
}

export function startMediaIntelligenceWorker() {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    void runWorkerTick();
  }, 10 * 60 * 1000);
}

export function stopMediaIntelligenceWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
