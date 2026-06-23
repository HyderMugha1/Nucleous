import { ApifyClient } from "apify-client";
import { config } from "../../config.js";

function ensureApifyConfigured() {
  if (!config.apifyToken) {
    throw new Error("APIFY_TOKEN is required");
  }

  if (!config.tvTranscriptionActorId) {
    throw new Error("TV_TRANSCRIPTION_ACTOR_ID is required");
  }
}

function normalizeApifyError(message) {
  const rawMessage = String(message || "").trim();

  if (/quota|rate limit|429|usage limit|insufficient/i.test(rawMessage)) {
    return "Apify transcription capacity is temporarily exhausted. Please wait and try again.";
  }

  return rawMessage || "Apify transcription request failed";
}

function createClient() {
  ensureApifyConfigured();
  return new ApifyClient({
    token: config.apifyToken,
  });
}

function isValidYouTubeUrl(videoUrl) {
  try {
    const parsed = new URL(String(videoUrl || "").trim());
    return /(^|\.)youtube\.com$/i.test(parsed.hostname) || /^youtu\.be$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizeTranscriptSegments(transcriptSegments) {
  return transcriptSegments
    .map((segment, index) => {
      const start = Number(segment.start || segment.start_sec || 0);
      const end = segment.end !== undefined
        ? Number(segment.end)
        : segment.end_sec !== undefined
          ? Number(segment.end_sec)
          : start + Number(segment.duration || 0);

      return {
        segment_index: index,
        start_sec: Number.isFinite(start) ? start : 0,
        end_sec: Number.isFinite(end) ? end : start,
        text: String(segment.text || "").trim(),
      };
    })
    .filter((segment) => segment.text);
}

async function runActor(client, videoUrl, language) {
  const input = {
    youtube_url: videoUrl,
    include_transcript_text: false,
  };

  if (language) {
    input.language = language;
  }

  const run = await client.actor(config.tvTranscriptionActorId).call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items || [];
}

export async function transcribeVideoWithApify(videoUrl) {
  return transcribeVideoWithApifyLanguage(videoUrl);
}

export async function transcribeVideoWithApifyLanguage(videoUrl, preferredLanguage = null) {
  const client = createClient();

  if (!isValidYouTubeUrl(videoUrl)) {
    throw new Error("Only synced YouTube video URLs can be transcribed with the current Apify actor");
  }

  try {
    let items = await runActor(client, videoUrl, preferredLanguage);
    if (!items || items.length === 0) {
      throw new Error("No transcript was returned by the Apify actor");
    }

    let result = items[0];
    const availableLanguages = Array.isArray(result.available_languages) ? result.available_languages.filter(Boolean) : [];

    if (
      String(result.status || "").toLowerCase() === "error" &&
      /requested language/i.test(String(result.message || "")) &&
      availableLanguages.length > 0
    ) {
      items = await runActor(client, videoUrl, availableLanguages[0]);
      result = items[0];
    }

    if (String(result.status || "").toLowerCase() === "error") {
      throw new Error(String(result.message || "Apify could not transcribe this YouTube video"));
    }

    const transcriptSegments = Array.isArray(result.transcript) ? result.transcript : [];
    if (transcriptSegments.length === 0) {
      throw new Error(String(result.message || "Transcript segments with timestamps were not returned by the Apify actor"));
    }

    return {
      language: result.language || "unknown",
      segments: normalizeTranscriptSegments(transcriptSegments),
      rawResult: result,
    };
  } catch (error) {
    throw new Error(normalizeApifyError(error instanceof Error ? error.message : "Apify transcription failed"));
  }
}
