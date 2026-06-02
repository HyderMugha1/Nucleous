export function parseYouTubeDuration(durationIso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(durationIso || "");
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 60 * 60) + (minutes * 60) + seconds;
}

export function normalizeSearchableText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function stripCodeFences(input) {
  return String(input || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function buildYouTubeRedirect(videoId, startSec) {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.floor(startSec))}s`;
}
