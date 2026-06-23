import { config } from "../../../config.js";
import { runDueBrandingSchedules } from "./service.js";

let workerTimer = null;
let workerRunning = false;
const WORKER_POLL_INTERVAL_MS = 5 * 60 * 1000;

async function runWorkerTick() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    await runDueBrandingSchedules();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Branding monitor worker failed";
    if (
      message.includes("branding_scans") ||
      message.includes("branding_results") ||
      message.includes("branding_scan_schedules") ||
      message.includes("schema cache")
    ) {
      console.warn("Branding monitor worker paused until branding tables are available.");
      return;
    }
    console.error("Branding monitor worker failed", error);
  } finally {
    workerRunning = false;
  }
}

export function startBrandingMonitorWorker() {
  if (workerTimer || String(config.brandingMonitorEnabled || "true") === "false") return;
  void runWorkerTick();
  workerTimer = setInterval(() => {
    void runWorkerTick();
  }, WORKER_POLL_INTERVAL_MS);
}

export function stopBrandingMonitorWorker() {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}
