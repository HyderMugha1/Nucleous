export function toSrtTimestamp(totalSeconds) {
  const ms = Math.max(0, Math.round(Number(totalSeconds || 0) * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

export function buildSrt(segments) {
  return segments
    .map((segment, index) => [
      String(index + 1),
      `${toSrtTimestamp(segment.start_sec)} --> ${toSrtTimestamp(segment.end_sec)}`,
      String(segment.text || "").trim(),
      "",
    ].join("\n"))
    .join("\n");
}
