export function getLastCompleteMonthRange(referenceDate = new Date()) {
  const reference = new Date(referenceDate);
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 0, 23, 59, 59, 999));
  return { start, end };
}

export function coerceDate(value) {
  if (!value) return null;
  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

export function isDateWithinRange(value, start, end) {
  const date = coerceDate(value);
  if (!date) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}
