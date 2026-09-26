// Development review data only; no game state, player input or persistent storage.
export function reviewTarget(value, base) {
  if (typeof value !== 'string' || value.length > 2048)
    throw new TypeError('Choose a bounded company player URL.');
  const url = new URL(value, base);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.origin !== new URL(base).origin ||
    url.username ||
    url.password ||
    !url.pathname.endsWith('/game/company.html')
  )
    throw new TypeError('Choose a company player on this review server.');
  return url.href;
}

export function frameSummary(samples) {
  const sorted = samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return {
    frames: sorted.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1),
    over33ms: sorted.filter((n) => n > 33.34).length,
  };
}

export function resourceSummary(entries) {
  return {
    resourceTimingEntries: entries.length,
    resourceTimingMayBeIncomplete: true,
    transferBytes: entries.reduce(
      (n, r) => n + (Number.isFinite(r.transferSize) && r.transferSize >= 0 ? r.transferSize : 0),
      0,
    ),
    decodedBytes: entries.reduce(
      (n, r) =>
        n + (Number.isFinite(r.decodedBodySize) && r.decodedBodySize >= 0 ? r.decodedBodySize : 0),
      0,
    ),
    zeroTransferEntries: entries.filter((r) => r.transferSize === 0).length,
  };
}
