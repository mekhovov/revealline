/** Bound live review canvases while preserving catalogue/chapter order. */
export function snakeReviewPage(entries, { chapterId = 'all', page = 0 } = {}) {
  const filtered =
    chapterId === 'all' ? entries : entries.filter((entry) => entry.chapterId === chapterId);
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const current = Math.max(0, Math.min(pages - 1, Number.isFinite(page) ? Math.trunc(page) : 0));
  const start = current * 6;
  return {
    entries: filtered.slice(start, start + 6),
    page: current,
    pages,
    total: filtered.length,
    start,
  };
}
