export const OVERFLIGHT_BENCHMARK_TARGETS = Object.freeze({
  reference: Object.freeze({ alive: 1500, visible: 700 }),
  stress: Object.freeze({ alive: 2500, visible: 1200 }),
  cadenceP95Ms: 18,
  cadenceP99Ms: 33.3,
  minimumCadenceHz: 59,
  maximumSlowFraction: 0.01,
});
export const OVERFLIGHT_BENCHMARK_PROTOCOL = Object.freeze({
  warmupSeconds: 30,
  measurementSeconds: 120,
  repetitions: 3,
});

function distribution(values) {
  if (!values.length) return { samples: 0, p50: null, p95: null, p99: null, worst: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (percentile) => sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)];
  return {
    samples: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    worst: sorted.at(-1),
  };
}

/** Raw render cadence and CPU submission are deliberately distinct. Long
 * foreground intervals are retained. Only known lifecycle/modal gaps rebase
 * sampling; an overloaded foreground frame is never trimmed as an outlier. */
export function createOverflightBenchmark({
  capacity = 120000,
  warmupSeconds = 30,
  measurementSeconds = 120,
  repetitions = 3,
  stopAtEnd = false,
} = {}) {
  if (!Number.isInteger(capacity) || capacity < 2) throw new RangeError('Invalid sample capacity.');
  if (
    ![warmupSeconds, measurementSeconds, repetitions].every(Number.isFinite) ||
    warmupSeconds < 0 ||
    measurementSeconds <= 0 ||
    !Number.isInteger(repetitions) ||
    repetitions < 1 ||
    repetitions > 10
  )
    throw new RangeError('Invalid benchmark protocol.');
  const cadence = new Float64Array(capacity),
    submission = new Float64Array(capacity);
  const frameTimes = new Float64Array(capacity),
    submissionTimes = new Float64Array(capacity),
    windows = new Int16Array(capacity).fill(-1);
  const windowCounts = new Uint32Array(repetitions);
  let count = 0,
    cpuCount = 0,
    previous = null,
    enabled = false,
    elapsed = 0;
  let over33 = 0,
    over50 = 0,
    over100 = 0,
    total = 0,
    cpuTotal = 0;
  const exclusions = {},
    highWater = { alive: 0, visible: 0, rendered: 0, effects: 0, pickups: 0 };
  const invalidReasons = new Set();
  const complete = () => elapsed / 1000 >= warmupSeconds + measurementSeconds * repetitions;
  return {
    complete,
    frame(nowMs, active = true) {
      if (!Number.isFinite(nowMs)) return;
      if (stopAtEnd && complete()) return;
      if (!active && enabled && count > 0 && !complete()) invalidReasons.add('interrupted');
      if (enabled && active && previous !== null && nowMs > previous) {
        const delta = nowMs - previous;
        const at = count % capacity;
        cadence[at] = delta;
        frameTimes[at] = nowMs;
        const window = Math.floor((elapsed / 1000 - warmupSeconds) / measurementSeconds);
        windows[at] = window >= 0 && window < repetitions ? window : -1;
        if (windows[at] >= 0) windowCounts[windows[at]]++;
        count++;
        total++;
        elapsed += delta;
        if (delta > 33.3) over33++;
        if (delta > 50) over50++;
        if (delta > 100) over100++;
      }
      previous = nowMs;
      enabled = active;
    },
    exclude(reason) {
      exclusions[reason] = (exclusions[reason] ?? 0) + 1;
      if (count > 0 && !complete()) invalidReasons.add(reason);
      previous = null;
      enabled = false;
    },
    submission(ms, nowMs = 0) {
      if (!Number.isFinite(ms) || ms < 0) return;
      submission[cpuCount % capacity] = ms;
      submissionTimes[cpuCount % capacity] = nowMs;
      cpuCount++;
      cpuTotal += ms;
    },
    observe(counts) {
      for (const key of Object.keys(highWater))
        highWater[key] = Math.max(highWater[key], counts[key] ?? 0);
    },
    snapshot({ raw = false } = {}) {
      const retained = Math.min(count, capacity);
      const reports = Array.from({ length: repetitions }, (_, index) => {
        const samples = [];
        for (let at = 0; at < retained; at++) if (windows[at] === index) samples.push(cadence[at]);
        const measuredMs = samples.reduce((sum, ms) => sum + ms, 0);
        const cadenceMs = distribution(samples);
        const cadenceHz = measuredMs > 0 ? (samples.length * 1000) / measuredMs : null;
        const slowFraction = samples.length
          ? samples.filter((ms) => ms > 33.3).length / samples.length
          : null;
        const complete =
          elapsed / 1000 >= warmupSeconds + measurementSeconds * (index + 1) &&
          samples.length > 0 &&
          samples.length === windowCounts[index];
        return {
          index: index + 1,
          complete,
          measuredSeconds: measuredMs / 1000,
          cadenceMs,
          cadenceHz,
          slowFraction,
          passes: complete
            ? cadenceMs.p95 <= 18 && cadenceMs.p99 <= 33.3 && cadenceHz >= 59 && slowFraction < 0.01
            : null,
        };
      });
      const result = {
        valid: invalidReasons.size === 0 && count <= capacity && cpuCount <= capacity,
        invalidReasons: [
          ...invalidReasons,
          ...(count > capacity || cpuCount > capacity ? ['sample-capacity-exceeded'] : []),
        ],
        cadenceMs: distribution(cadence.subarray(0, Math.min(count, capacity))),
        submissionMs: distribution(submission.subarray(0, Math.min(cpuCount, capacity))),
        cadenceHz: elapsed > 0 ? (total * 1000) / elapsed : null,
        measuredIntervals: total,
        measuredSeconds: elapsed / 1000,
        retainedIntervals: Math.min(count, capacity),
        sampleCapacity: capacity,
        submissionTotalMs: cpuTotal,
        over33Ms: over33,
        over50Ms: over50,
        over100Ms: over100,
        exclusions: { ...exclusions },
        highWater: { ...highWater },
        protocol: {
          arrangement:
            repetitions === 1
              ? 'One fresh trial with its own warm-up. Three separately restarted trials are required for qualification.'
              : 'One warm-up followed by consecutive windows of the same fixture; not separate restarted trials.',
          warmupSeconds,
          measurementSeconds,
          repetitions,
          windows: reports,
          acceptance: reports.every((report) => report.complete)
            ? invalidReasons.size === 0 &&
              count <= capacity &&
              cpuCount <= capacity &&
              reports.every((report) => report.passes)
            : null,
          scope: 'This browser run only; target hardware acceptance requires recorded device runs.',
        },
      };
      if (raw) {
        result.rawIntervals = Array.from({ length: retained }, (_, index) => {
          const at = (count - retained + index) % capacity;
          return {
            endMs: frameTimes[at],
            intervalMs: cadence[at],
            window: windows[at] < 0 ? null : windows[at] + 1,
          };
        });
        result.rawSubmission = Array.from({ length: Math.min(cpuCount, capacity) }, (_, index) => {
          const at = (Math.max(0, cpuCount - capacity) + index) % capacity;
          return { endMs: submissionTimes[at], cpuMs: submission[at] };
        });
      }
      return result;
    },
  };
}

/** Center-visible counts are the fixture contract; padded draw culling may
 * additionally retain silhouettes that straddle the camera edge. */
export function insideOverflightCamera(x, y, camera, margin = 0) {
  return (
    x >= camera.x - camera.width / 2 - margin &&
    x <= camera.x + camera.width / 2 + margin &&
    y >= camera.y - camera.height / 2 - margin &&
    y <= camera.y + camera.height / 2 + margin
  );
}
