export function parsePagination(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function parseSort(query, fallback = { createdAt: -1 }) {
  const sortBy = query.sortBy;
  if (!sortBy) return fallback;

  const direction = String(query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  return { [sortBy]: direction };
}

export function buildSearchFilter(search, fields) {
  if (!search || !fields?.length) return null;
  return {
    $or: fields.map((field) => ({
      [field]: { $regex: search, $options: "i" },
    })),
  };
}

export function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => toArray(item));
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function addDateRange(filter, field, query) {
  const range = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = new Date(query.to);
  if (Object.keys(range).length > 0) {
    filter[field] = range;
  }
}
