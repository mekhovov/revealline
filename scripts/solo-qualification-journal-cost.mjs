// Opt-in tooling only. No application imports, additional callbacks or active I/O.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const JOURNAL_COST_LIMITS = Object.freeze({ windows: 16384, hooks: 65536 });

export function qualificationJournalCostOptions(flags, scenario, bytes) {
  const selected = flags.filter((flag) => flag.startsWith('--journal-cost-probe'));
  if (!selected.length) return null;
  assert.deepEqual(selected, ['--journal-cost-probe']);
  assert(flags.includes('--work-probe'), 'Journal cost requires the same work probe in both arms');
  assert(!flags.some((flag) => /^--(?:memory-profile|audio-proof|cpu-profile)/.test(flag)));
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
  );
  assert.deepEqual(scenario, JSON.parse(bytes));
  assert.equal(scenario.id, 'original-art-opening-first30-border-v3');
  assert.equal(scenario.timeoutMs, 240000);
  return JOURNAL_COST_LIMITS;
}

// Serialized intact into the top document. All active writes use fixed numeric
// storage. Intersections, arrays, descriptive metadata and encoding are pause-only.
export function createBrowserJournalCostProbe(options = {}, environment = globalThis) {
  const windowLimit = options.windows ?? 16384,
    hookLimit = options.hooks ?? 65536;
  if (
    !Number.isInteger(windowLimit) ||
    windowLimit < 1 ||
    windowLimit > 16384 ||
    !Number.isInteger(hookLimit) ||
    hookLimit < 1 ||
    hookLimit > 65536
  )
    throw Error('Journal cost capacity');
  const windows = new Float64Array(windowLimit * 4),
    hooks = new Float64Array(hookLimit * 5);
  const startedAt = environment.performance.now(),
    timeOrigin = environment.performance.timeOrigin;
  let phase = 0,
    usedWindows = 0,
    usedHooks = 0,
    errors =
      !Number.isFinite(startedAt) || startedAt < 0 || !Number.isFinite(timeOrigin) || timeOrigin < 0
        ? 1
        : 0,
    sealed = false;
  let workStart = null,
    workPhase = 0,
    hookStart = null,
    hookPhase = 0,
    hookKind = 0;
  let lastClock = startedAt,
    lastWorkEnd = -Infinity,
    lastHookEnd = -Infinity;
  let activeFull = 0,
    activeReduced = 0,
    activeMinimal = 0,
    activeUnknown = 0;
  const clock = (at) => {
    if (!Number.isFinite(at) || at < lastClock) errors |= 1;
    else lastClock = at;
    if (at - startedAt > 240000) errors |= 2;
    return at;
  };
  const validPhase = (value) => Number.isInteger(value) && value >= 0 && value < 7;
  const state = () => ({
    format: 'SoloJournalCostProbeV1',
    windows: usedWindows,
    hooks: usedHooks,
    windowCapacity: windowLimit,
    hookCapacity: hookLimit,
    bufferBytes: windows.byteLength + hooks.byteLength,
    errors,
    sealed,
    workOpen: workStart !== null,
    hookOpen: hookStart !== null,
    phase,
  });
  return {
    phase(value) {
      if (!validPhase(value)) errors |= 4;
      else phase = value;
    },
    begin(kind) {
      const at = clock(environment.performance.now());
      if (sealed) {
        errors |= 8;
        return;
      }
      if (hookStart !== null) {
        errors |= 16;
        return;
      }
      if (!Number.isInteger(kind) || kind < 0 || kind > 7) errors |= 4;
      hookStart = at;
      hookPhase = phase;
      hookKind = kind;
    },
    end() {
      const at = clock(environment.performance.now());
      if (sealed) {
        errors |= 8;
        return;
      }
      if (hookStart === null) {
        errors |= 16;
        return;
      }
      if (hookStart < lastHookEnd || at < hookStart) errors |= 1;
      if (usedHooks >= hookLimit) errors |= 32;
      else {
        const offset = usedHooks++ * 5;
        hooks[offset] = hookKind;
        hooks[offset + 1] = hookStart;
        hooks[offset + 2] = at;
        hooks[offset + 3] = hookPhase;
        hooks[offset + 4] = phase;
      }
      lastHookEnd = at;
      hookStart = null;
    },
    beginWork(at) {
      clock(at);
      if (sealed) {
        errors |= 8;
        return;
      }
      if (workStart !== null) {
        errors |= 16;
        return;
      }
      workStart = at;
      workPhase = phase;
    },
    endWork(at, tier) {
      clock(at);
      if (sealed) {
        errors |= 8;
        return;
      }
      if (workStart === null) {
        errors |= 16;
        return;
      }
      if (workStart < lastWorkEnd || at < workStart) errors |= 1;
      if (workPhase === 2 && phase === 2) {
        if (tier === 'full') activeFull++;
        else if (tier === 'reduced') activeReduced++;
        else if (tier === 'minimal') activeMinimal++;
        else activeUnknown++;
      }
      if (usedWindows >= windowLimit) errors |= 32;
      else {
        const offset = usedWindows++ * 4;
        windows[offset] = workStart;
        windows[offset + 1] = at;
        windows[offset + 2] = workPhase;
        windows[offset + 3] = phase;
      }
      lastWorkEnd = at;
      workStart = null;
    },
    state,
    export() {
      if (sealed) throw Error('Journal cost may export once');
      clock(environment.performance.now());
      if (phase === 2) throw Error('Journal cost export requires a non-running boundary');
      if (environment.performance.timeOrigin !== timeOrigin) errors |= 64;
      if (workStart !== null || hookStart !== null) errors |= 16;
      sealed = true;
      const rows = new Float64Array(usedWindows * 8),
        phaseWindows = Array.from({ length: 7 }, () => []),
        endpointCounts = new Uint32Array(usedWindows).fill(2),
        tailEndpointCounts = new Uint32Array(7);
      const kindTotals = new Float64Array(8 * 2),
        outsideByPhase = new Float64Array(7),
        initialByPhase = new Float64Array(7),
        tailByPhase = new Float64Array(7);
      let appMs = 0,
        insideMs = 0,
        outsideMs = 0,
        hookMs = 0,
        maximumHookMs = 0,
        maximumUnassignedTailMs = 0,
        mixedWindows = 0,
        mixedHooks = 0;
      let zeroDurationHooks = 0;
      for (let i = 0; i < usedWindows; i++) {
        const source = i * 4,
          target = i * 8;
        rows[target] = windows[source];
        rows[target + 1] = windows[source + 1];
        rows[target + 2] = windows[source + 2];
        rows[target + 3] = windows[source + 3];
        rows[target + 4] = windows[source + 1] - windows[source];
        appMs += rows[target + 4];
        if (windows[source + 2] !== windows[source + 3]) mixedWindows++;
        else phaseWindows[windows[source + 2]]?.push(i);
      }
      const outside = (start, end, before, after) => {
        const duration = end - start;
        if (!(duration > 0)) return;
        outsideMs += duration;
        // A phase-crossing hook is retained as mixed/other, never attributed to
        // whichever phase would improve a percentile.
        const p = before === after && validPhase(before) ? before : 6;
        outsideByPhase[p] += duration;
        const indexes = phaseWindows[p];
        let low = 0,
          high = indexes.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (rows[indexes[middle] * 8 + 1] < end) low = middle + 1;
          else high = middle;
        }
        if (!indexes.length || start < rows[indexes[0] * 8]) initialByPhase[p] += duration;
        if (low === indexes.length) {
          tailByPhase[p] += duration;
          tailEndpointCounts[p] += 2;
          maximumUnassignedTailMs = Math.max(maximumUnassignedTailMs, duration);
        } else {
          rows[indexes[low] * 8 + 6] += duration;
          endpointCounts[indexes[low]] += 2;
        }
      };
      let cursor = 0;
      for (let i = 0; i < usedHooks; i++) {
        const offset = i * 5,
          start = hooks[offset + 1],
          end = hooks[offset + 2];
        const before = hooks[offset + 3],
          after = hooks[offset + 4],
          duration = end - start;
        hookMs += duration;
        maximumHookMs = Math.max(maximumHookMs, duration);
        kindTotals[hooks[offset] * 2]++;
        kindTotals[hooks[offset] * 2 + 1] += duration;
        if (duration === 0) {
          // A quantized-zero callback is not evidence of zero true cost. Retain
          // both endpoints in the sensitivity allowance even without a segment.
          zeroDurationHooks++;
          const p = before === after && validPhase(before) ? before : 6,
            indexes = phaseWindows[p];
          let low = 0,
            high = indexes.length;
          while (low < high) {
            const middle = (low + high) >>> 1;
            if (rows[indexes[middle] * 8 + 1] < end) low = middle + 1;
            else high = middle;
          }
          if (low === indexes.length) tailEndpointCounts[p] += 2;
          else endpointCounts[indexes[low]] += 2;
        }
        if (before !== after) mixedHooks++;
        while (cursor < usedWindows && windows[cursor * 4 + 1] <= start) cursor++;
        let remaining = start,
          index = cursor;
        while (index < usedWindows && windows[index * 4] < end) {
          const a = windows[index * 4],
            b = windows[index * 4 + 1];
          outside(remaining, Math.min(a, end), before, after);
          const overlap = Math.max(0, Math.min(b, end) - Math.max(remaining, a));
          rows[index * 8 + 5] += overlap;
          insideMs += overlap;
          remaining = Math.max(remaining, Math.min(b, end));
          index++;
        }
        outside(remaining, end, before, after);
      }
      let activeWindows = 0;
      for (let i = 0; i < usedWindows; i++) {
        const offset = i * 8;
        rows[offset + 7] = rows[offset + 4] + rows[offset + 6];
        if (rows[offset + 2] === 2 && rows[offset + 3] === 2 && rows[offset + 4] > 0)
          activeWindows++;
      }
      return {
        ...state(),
        status: errors || !activeWindows ? 'incomplete' : 'complete',
        timeOrigin,
        startedAt,
        endedAt: lastClock,
        activeWindows,
        mixedWindows,
        mixedHooks,
        zeroDurationHooks,
        appMs,
        hookMs,
        insideMs,
        outsideMs,
        combinedMs: appMs + outsideMs,
        maximumHookMs,
        maximumUnassignedTailMs,
        envelopeRequiresTailAssessment: true,
        activeQuality: {
          full: activeFull,
          reduced: activeReduced,
          minimal: activeMinimal,
          unobserved: activeUnknown,
          scope:
            'Last submitted paint tier from one captured scene owner at each existing active POST_RENDER; no runtime methods called.',
        },
        quantizationEndpointCounts: Array.from(endpointCounts),
        unassignedTailEndpointCounts: Array.from(tailEndpointCounts),
        rowColumns: [
          'start',
          'end',
          'phaseBefore',
          'phaseAfter',
          'appMs',
          'insideHookMs',
          'assignedOutsideHookMs',
          'appAndAssignedOutsideMs',
        ],
        rows: Array.from(rows),
        hookKinds: [
          'first',
          'frame',
          'phase',
          'beginWork',
          'endWork',
          'nativeDelivery',
          'visibilityFocus',
          'subscribe',
        ],
        kindTotals: Array.from(kindTotals),
        outsideByPhase: Array.from(outsideByPhase),
        initialByPhase: Array.from(initialByPhase),
        unassignedTailByPhase: Array.from(tailByPhase),
        coverage: {
          symmetricBoundaries: ['first', 'frame', 'phase', 'beginWork', 'endWork', 'subscribe'],
          journalOnlyCallbacks: ['nativeDelivery', 'visibilityFocus'],
          unmeasured: [
            'journal-construction',
            'observer-registration-and-browser-delivery',
            'paused-takeRecords-drain',
            'encoding-export-and-I/O',
            'timer-and-ledger-instructions-outside-endpoints',
            'GPU-and-total-browser-CPU',
          ],
        },
        scope:
          'Synchronous invoked journal-hook envelopes at normal performance.now precision. ' +
          'Application spans already include overlapping hook time; it is not added again. ' +
          'Outside costs attach to the next same-phase work window; all unassigned final tails ' +
          'remain explicit. Initial is an overlapping descriptive subset, not an extra charge. ' +
          'Shared first/frame/phase/work/subscribe boundaries use the same meter in both arms. ' +
          'Native delivery and visibility/focus callbacks are metered only in the journal arm; ' +
          'the off arm adds no placebo observer or listeners. Setup, browser observer delivery, ' +
          'paused takeRecords draining, export and timer/ledger instructions outside the endpoints ' +
          'are unmeasured. This is not total browser CPU or an overhead verdict.',
      };
    },
  };
}

export function journalCostInitScript() {
  return `window.soloQualificationJournalCost = (${createBrowserJournalCostProbe.toString()})();`;
}
