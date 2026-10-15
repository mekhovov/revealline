/** Authoring-only attribution, never an acceptance rule or a profiler/GC diagnosis. */
export const ENDURANCE_PHASES = Object.freeze([
  'observer-checks',
  'snapshot-before-step',
  'pilot-command',
  'flight-step',
  'snapshot-for-draw',
  'renderer-draw',
  'sample-collection',
  'live-display',
  'prepare-renderer-submit',
]);
const SPANS = 128,
  FRAMES = 16,
  SCRIPTS = 8,
  OVERLAPS = 12,
  SCAN_SCRIPTS = 64;
const finite = (value) => Number.isFinite(value) && value >= 0;
const optionalTime = (value, startedAt) =>
  finite(value) && value >= startedAt ? value - startedAt : null;
const optionalDuration = (value) => (finite(value) ? value : null);
const TYPES = new Set([
  'user-callback',
  'event-listener',
  'resolve-promise',
  'reject-promise',
  'classic-script',
  'module-script',
]);
function invoker(script) {
  const raw = typeof script.invoker === 'string' ? script.invoker : '';
  for (const name of [
    'requestAnimationFrame',
    'setTimeout',
    'setInterval',
    'queueMicrotask',
    'PerformanceObserver',
  ])
    if (raw.includes(name)) return name;
  if (script.invokerType === 'resolve-promise' || script.invokerType === 'reject-promise')
    return 'promise-handler';
  return script.invokerType === 'event-listener' ? 'event-listener' : 'other';
}
function ownedSource(script, pageURL) {
  try {
    const url = new URL(script.sourceURL);
    if (
      url.origin !== pageURL.origin ||
      url.username ||
      url.password ||
      !/^\/(?:game\/|optional-practice\/civilian-fpv\/|authoring\/fpv-worlds\/regions\/)/.test(
        url.pathname,
      ) ||
      !/\.(?:mjs|js)$/.test(url.pathname) ||
      url.pathname.length > 180
    )
      return null;
    const name = script.sourceFunctionName;
    return {
      path: url.pathname, // Never retain origin, credentials, query, hash or a foreign pathname.
      functionName: typeof name === 'string' && /^[\w.$ <>:-]{0,80}$/.test(name) ? name : null,
      characterPosition:
        Number.isSafeInteger(script.sourceCharPosition) &&
        script.sourceCharPosition >= 0 &&
        script.sourceCharPosition <= 20 * 1024 * 1024
          ? script.sourceCharPosition
          : null,
    };
  } catch {
    return null;
  }
}

export function createEnduranceAttribution({
  startedAt,
  now = () => performance.now(),
  pageURL = globalThis.location?.href,
  PerformanceObserver: Observer = globalThis.PerformanceObserver,
}) {
  if (!finite(startedAt)) throw new TypeError('Invalid attribution start');
  const page = new URL(pageURL),
    rows = [],
    ids = new Float64Array(SPANS),
    starts = new Float64Array(SPANS),
    ends = new Float64Array(SPANS),
    frameIds = new Float64Array(SPANS),
    codes = new Uint8Array(SPANS),
    counts = new Float64Array(ENDURANCE_PHASES.length),
    totals = new Float64Array(ENDURANCE_PHASES.length),
    maxima = new Float64Array(ENDURANCE_PHASES.length);
  let serial = 0,
    frame = 0,
    stopped = false,
    observer = null,
    capability = 'unsupported',
    entries = 0,
    droppedFrames = 0,
    droppedScripts = 0,
    unscannedScripts = 0,
    malformed = 0,
    readFailures = 0;
  const callbackCost = { count: 0, totalMs: 0, maxMs: 0 };
  const receive = (input) => {
    const began = now();
    try {
      for (const entry of input) {
        if (
          entry.entryType !== 'long-animation-frame' ||
          !finite(entry.startTime) ||
          entry.startTime < startedAt ||
          !finite(entry.duration) ||
          entry.duration < 50
        ) {
          malformed++;
          continue;
        }
        const supplied = Array.isArray(entry.scripts) ? entry.scripts : [],
          scripts = [];
        unscannedScripts += Math.max(0, supplied.length - SCAN_SCRIPTS);
        for (let index = 0; index < Math.min(supplied.length, SCAN_SCRIPTS); index++) {
          const script = supplied[index];
          if (
            !finite(script.startTime) ||
            script.startTime < startedAt ||
            !finite(script.duration)
          ) {
            malformed++;
            continue;
          }
          scripts.push({
            elapsedMs: script.startTime - startedAt,
            durationMs: script.duration,
            executionStartMs: optionalTime(script.executionStart, startedAt),
            forcedStyleAndLayoutMs: optionalDuration(script.forcedStyleAndLayoutDuration),
            pauseMs: optionalDuration(script.pauseDuration),
            invoker: invoker(script),
            invokerType: TYPES.has(script.invokerType) ? script.invokerType : 'unknown',
            source: ownedSource(script, page),
          });
        }
        scripts.sort((a, b) => b.durationMs - a.durationMs);
        droppedScripts += Math.max(0, scripts.length - SCRIPTS);
        entries++;
        if (rows.length === FRAMES) {
          rows.shift();
          droppedFrames++;
        }
        rows.push({
          elapsedMs: entry.startTime - startedAt,
          durationMs: entry.duration,
          blockingMs: optionalDuration(entry.blockingDuration),
          renderStartMs: optionalTime(entry.renderStart, startedAt),
          styleAndLayoutStartMs: optionalTime(entry.styleAndLayoutStart, startedAt),
          reportedScriptCount: supplied.length,
          scripts: scripts.slice(0, SCRIPTS),
        });
      }
    } catch {
      readFailures++;
    } finally {
      const duration = now() - began;
      if (finite(duration)) {
        callbackCost.count++;
        callbackCost.totalMs += duration;
        callbackCost.maxMs = Math.max(callbackCost.maxMs, duration);
      }
    }
  };
  try {
    if (Observer?.supportedEntryTypes?.includes('long-animation-frame')) {
      observer = new Observer((list) => {
        if (stopped) return;
        try {
          receive(list.getEntries());
        } catch {
          readFailures++;
        }
      });
      observer.observe({ type: 'long-animation-frame', buffered: false });
      capability = 'observed';
    }
  } catch {
    try {
      observer?.disconnect();
    } catch {
      readFailures++;
    }
    observer = null;
    capability = 'unavailable';
  }
  return Object.freeze({
    frame() {
      if (!stopped) frame++;
    },
    begin(phase) {
      if (stopped) return null;
      const code = ENDURANCE_PHASES.indexOf(phase),
        at = now();
      if (code < 0 || !finite(at) || at < startedAt) return null;
      const token = ++serial,
        slot = (token - 1) % SPANS;
      ids[slot] = token;
      starts[slot] = at;
      ends[slot] = -1;
      codes[slot] = code;
      frameIds[slot] = frame;
      return token;
    },
    end(token) {
      if (stopped || !Number.isSafeInteger(token) || token < 1) return false;
      const slot = (token - 1) % SPANS,
        at = now();
      if (ids[slot] !== token || ends[slot] >= 0 || !finite(at) || at < starts[slot]) return false;
      ends[slot] = at;
      const code = codes[slot],
        duration = at - starts[slot];
      counts[code]++;
      totals[code] += duration;
      maxima[code] = Math.max(maxima[code], duration);
      return true;
    },
    stop() {
      if (stopped) return;
      if (observer) {
        try {
          receive(observer.takeRecords());
        } catch {
          readFailures++;
        }
        try {
          observer.disconnect();
        } catch {
          readFailures++;
        }
      }
      stopped = true;
    },
    snapshot() {
      const spans = [];
      for (let token = Math.max(1, serial - SPANS + 1); token <= serial; token++) {
        const slot = (token - 1) % SPANS;
        if (ids[slot] !== token) continue;
        spans.push({
          id: token,
          frame: frameIds[slot],
          phase: ENDURANCE_PHASES[codes[slot]],
          elapsedMs: starts[slot] - startedAt,
          durationMs: ends[slot] < 0 ? null : ends[slot] - starts[slot],
          completed: ends[slot] >= 0,
        });
      }
      return {
        scope:
          'Bounded synchronous authoring phase spans and supported long-animation-frame caller attribution. Overlap, maxima and script entry points do not identify a slow descendant, garbage collection, browser scheduling or GPU completion. No acceptance changes.',
        capability,
        entries,
        callbackCPU: { ...callbackCost },
        phases: ENDURANCE_PHASES.map((phase, code) => ({
          phase,
          count: counts[code],
          totalMs: totals[code],
          maxMs: maxima[code],
        })),
        lastSpans: spans,
        lastLongAnimationFrames: rows.map((row) => {
          const matching = spans
            .filter(
              (span) =>
                span.elapsedMs <= row.elapsedMs + row.durationMs &&
                (span.durationMs === null || span.elapsedMs + span.durationMs >= row.elapsedMs),
            )
            .map((span) => ({
              id: span.id,
              phase: span.phase,
              overlapMs:
                span.durationMs === null
                  ? null
                  : Math.max(
                      0,
                      Math.min(span.elapsedMs + span.durationMs, row.elapsedMs + row.durationMs) -
                        Math.max(span.elapsedMs, row.elapsedMs),
                    ),
            }));
          matching.sort((a, b) => (b.overlapMs ?? Infinity) - (a.overlapMs ?? Infinity));
          return {
            ...structuredClone(row),
            overlappingSpanCount: matching.length,
            overlappingSpans: matching.slice(0, OVERLAPS),
          };
        }),
        bounds: {
          spans: SPANS,
          longAnimationFrames: FRAMES,
          scriptsPerFrame: SCRIPTS,
          scriptsScannedPerFrame: SCAN_SCRIPTS,
          overlapExamplesPerFrame: OVERLAPS,
        },
        dropped: {
          spans: Math.max(0, serial - SPANS),
          longAnimationFrames: droppedFrames,
          scripts: droppedScripts,
          unscannedScripts,
        },
        malformed,
        readFailures,
        stopped,
        limitations: [
          'No sampled JS call stacks, allocation or GC events; use a native browser performance trace to attribute a descendant or GC.',
          'LoAF observes same-origin main-thread entry points only; worker/extension/cross-origin work may be absent.',
          'The terminal frame may not have reached the observer queue at stop; takeRecords drains only entries already available.',
          'Nested or asynchronous work may share a frame. Phase durations are synchronous wall spans, not exclusive CPU.',
          'No raw invoker strings, foreign origins/paths, query/hash credentials or window references retained.',
        ],
      };
    },
  });
}
