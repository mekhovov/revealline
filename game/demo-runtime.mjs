const ENGINES = new Set(['chromium', 'firefox', 'webkit']);

/** A loading-order hint only. Every selected body still needs full verification. */
export function demoRuntimeEngineHint(userAgent = globalThis.navigator?.userAgent ?? '') {
  if (/\b(?:iPad|iPhone|iPod)\b/.test(userAgent) && /AppleWebKit\//.test(userAgent))
    return 'webkit';
  if (/Firefox\//.test(userAgent)) return 'firefox';
  if (/(?:Chrome|Chromium)\//.test(userAgent)) return 'chromium';
  if (/AppleWebKit\//.test(userAgent)) return 'webkit';
  return null;
}

/** Stable partition only: a wrong hint cannot remove a verified fallback,
 * introduce another candidate, or change the caller's strict admission rules. */
export function preferDemoRuntimeCandidates(candidates, engineHint, engineOf) {
  const ordered = [...candidates];
  if (!ENGINES.has(engineHint)) return ordered;
  return ordered.sort(
    (left, right) => Number(engineOf(right) === engineHint) - Number(engineOf(left) === engineHint),
  );
}
