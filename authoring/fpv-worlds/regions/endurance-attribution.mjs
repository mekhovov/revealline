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
  const captureOverlaps = (start, duration, capturedAt) => {
    const first = Math.max(1, serial - SPANS + 1),
      overwritten = Math.max(0, serial - SPANS),
      oldest = serial ? starts[(first - 1) % SPANS] - startedAt : null,
      examples = [];
    let matching = 0,
      incomplete = 0;
    for (let token = first; token <= serial; token++) {
      const slot = (token - 1) % SPANS;
      if (
        ids[slot] !== token ||
        starts[slot] > start + duration ||
        (ends[slot] >= 0 && ends[slot] < start)
      )
        continue;
      matching++;
      const completed = ends[slot] >= 0,
        overlapMs = completed
          ? Math.max(0, Math.min(ends[slot], start + duration) - Math.max(starts[slot], start))
          : null;
      if (!completed) incomplete++;
      let index = 0;
      while (
        index < examples.length &&
        (overlapMs ?? Infinity) <= (examples[index].overlapMs ?? Infinity)
      )
        index++;
      if (index < OVERLAPS) {
        examples.splice(index, 0, {
          id: token,
          phase: ENDURANCE_PHASES[codes[slot]],
          completed,
          overlapMs,
        });
        if (examples.length > OVERLAPS) examples.pop();
      }
    }
    return {
      overlappingSpanCount: matching,
      incompleteOverlappingSpanCount: incomplete,
      overlapExamplesDropped: Math.max(0, matching - examples.length),
      // Discarded earlier marks may include an overlapping long/open span even
      // when the frame starts inside the retained window. Do not claim exhaustive counts.
      overlapCountIsLowerBound: overwritten > 0,
      overlappingSpans: examples,
      overlapCapture: {
        capturedAtElapsedMs: optionalTime(capturedAt, startedAt),
        retainedSpanCount: Math.min(serial, SPANS),
        overwrittenSpanCount: overwritten,
        oldestRetainedElapsedMs: oldest,
        framePredatesRetainedSpanWindow:
          overwritten > 0 && oldest !== null && start - startedAt < oldest,
      },
    };
  };
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
          ...captureOverlaps(entry.startTime, entry.duration, began),
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
        lastLongAnimationFrames: rows.map((row) => structuredClone(row)),
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
          'Overlap associations retain the phase window at observer receipt; discarded history makes counts lower bounds and unfinished overlaps remain unknown. Later snapshots do not reconstruct or complete earlier evidence.',
          'No raw invoker strings, foreign origins/paths, query/hash credentials or window references retained.',
        ],
      };
    },
  });
}
