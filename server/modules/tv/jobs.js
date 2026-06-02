import { supabaseAdmin } from "../../supabase.js";
import { generateAndStoreSrt, markJobFailed, processVideoTranscription, syncChannelVideos, syncTikTokAccountVideos } from "./service.js";

let workerTimer = null;
let workerRunning = false;
let warnedMissingTables = false;

async function claimNextJob() {
  const { data: jobs, error } = await supabaseAdmin
    .from("tv_processing_logs")
    .select("*")
    .eq("job_status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  const job = jobs?.[0];
  if (!job) return null;

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("tv_processing_logs")
    .update({
      job_status: "processing",
      attempts: (job.attempts || 0) + 1,
      error_message: null,
      error_code: null,
    })
    .eq("id", job.id)
    .eq("job_status", "queued")
    .select("*")
    .single();

  if (claimError || !claimed) return null;
  return claimed;
}

async function completeJob(jobId) {
  await supabaseAdmin
    .from("tv_processing_logs")
    .update({ job_status: "completed", updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function processJob(job) {
  if (job.job_type === "channel_sync") {
    await syncChannelVideos({ organizationId: job.organization_id, channelId: job.channel_id });
    return;
  }
  if (job.job_type === "video_transcription" || job.job_type === "retry_failed") {
    await processVideoTranscription({ organizationId: job.organization_id, videoId: job.video_id });
    return;
  }
  if (job.job_type === "tiktok_account_sync") {
    await syncTikTokAccountVideos({
      organizationId: job.organization_id,
      accountId: job.payload?.tiktokAccountId,
    });
    return;
  }
  if (job.job_type === "srt_generation") {
    await generateAndStoreSrt({ organizationId: job.organization_id, videoId: job.video_id });
  }
}

async function runWorkerTick() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    try {
      const job = await claimNextJob();
      if (!job) return;

      try {
        await processJob(job);
        await completeJob(job.id);
      } catch (error) {
        await markJobFailed(job.id, error instanceof Error ? error.message : "TV job failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "TV worker tick failed";
      if (message.includes("tv_processing_logs") || message.includes("schema cache")) {
        if (!warnedMissingTables) {
          console.warn("TV worker paused until TV migration tables are available.");
          warnedMissingTables = true;
        }
        return;
      }
      console.error("TV worker tick failed", error);
    }
  } finally {
    workerRunning = false;
  }
}

export function startTvJobWorker() {
  if (!supabaseAdmin || workerTimer) return;
  workerTimer = setInterval(() => {
    void runWorkerTick();
  }, 5000);
}

export function stopTvJobWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
