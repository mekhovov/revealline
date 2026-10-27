/** Explain an already-selected native destination. The host owns progression,
 * exact catalogue membership and launch; this projection never finds a Next. */
export function captureHomeRecommendation({
  catalog,
  destination,
  cursorId = null,
  recordedClear = false,
  resume = false,
  lastAttempt = null,
} = {}) {
  if (
    resume ||
    !destination ||
    typeof catalog?.find !== 'function' ||
    catalog.find(destination.id) !== destination
  )
    return null;
  const current = cursorId === null ? null : catalog.find(cursorId);
  if (cursorId !== null && !current) return null;
  if (!current) return Object.freeze({ reason: 'first', destination, current: null });
  if (recordedClear) {
    // The existing destination may fall back to the last cleared mission.
    // That is not a new successor and must not be advertised as one.
    if (current === destination) return null;
    return Object.freeze({ reason: 'recorded-next', destination, current });
  }
  if (current !== destination) return null;
  return Object.freeze({
    reason:
      lastAttempt?.status === 'lost' && lastAttempt.mission === current ? 'retry' : 'selected',
    destination,
    current,
  });
}
