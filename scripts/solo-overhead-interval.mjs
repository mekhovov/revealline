import assert from 'node:assert/strict';

// Prospective sensitivity method only. An observed minimum clock step is not
// a proven bound on browser privacy jitter; callers retain that assumption and
// every source, quality, workload, failure and complete-pair admission gate.
export const PROSPECTIVE_OVERHEAD_METHOD = 'paired-p95-endpoint-box-v1';

export function prospectiveOverhead(manifest) {
  if (!Object.hasOwn(manifest, 'analysisMethod')) return false;
  assert.equal(manifest.analysisMethod, PROSPECTIVE_OVERHEAD_METHOD, 'Unknown overhead method');
  return true;
}

// Componentwise order statistics enclose every possible nearest-rank p95,
// including when unequal endpoint errors change the sample ordering. Copies
// are sorted; the original samples and endpoint counts remain untouched.
export function overheadP95Bounds(values, quantum, endpointCounts = null) {
  assert(Array.isArray(values) && values.length > 0 && values.length <= 16384);
  assert(Number.isFinite(quantum) && quantum >= 0);
  assert(endpointCounts === null || endpointCounts.length === values.length);
  const lower = [],
    upper = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i],
      count = endpointCounts === null ? 1 : endpointCounts[i];
    assert(Number.isFinite(value) && value >= 0);
    assert(Number.isSafeInteger(count) && count >= 1 && count <= 655362);
    const error = quantum * count;
    assert(Number.isFinite(error) && Number.isFinite(value + error));
    lower.push(Math.max(0, value - error));
    upper.push(value + error);
  }
  const rank = Math.ceil(values.length * 0.95) - 1;
  lower.sort((a, b) => a - b);
  upper.sort((a, b) => a - b);
  return { lower: lower[rank], upper: upper[rank] };
}

export function overheadLogRatioBounds(on, off) {
  for (const bounds of [on, off])
    assert(
      bounds &&
        Number.isFinite(bounds.lower) &&
        Number.isFinite(bounds.upper) &&
        bounds.lower > 0 &&
        bounds.upper >= bounds.lower,
      'Positive finite p95 bounds required',
    );
  return {
    lower: Math.log(on.lower) - Math.log(off.upper),
    upper: Math.log(on.upper) - Math.log(off.lower),
  };
}

// Rounded-up NIST 97.5th-percentile critical values, identical to the existing
// assessors. Production callers require ten pairs; 3–9 support small exhaustive
// mathematical controls. The hard ten-pair limit bounds this to 1,024 vertices.
const T95 = [null, null, null, 4.304, 3.183, 2.777, 2.572, 2.448, 2.366, 2.307, 2.263];
export function overheadPairedBox(bounds) {
  assert(Array.isArray(bounds) && bounds.length >= 3 && bounds.length <= 10);
  for (const pair of bounds)
    assert(
      pair &&
        Number.isFinite(pair.lower) &&
        Number.isFinite(pair.upper) &&
        pair.lower <= pair.upper,
      'Finite ordered log-ratio bounds required',
    );
  const n = bounds.length,
    critical = T95[n],
    vertices = 2 ** n,
    values = new Float64Array(n);
  let lowerLog = Infinity,
    upperLog = -Infinity;
  // mean + t*SD/sqrt(n) is convex, and its lower counterpart is concave.
  // Therefore the extrema over the entire interval box occur at vertices.
  // This permits correlated timestamp errors; it does not average them away
  // or treat frames as independent experimental replicates.
  for (let mask = 0; mask < vertices; mask++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      values[i] = mask & (1 << i) ? bounds[i].upper : bounds[i].lower;
      total += values[i];
    }
    const mean = total / n;
    let squares = 0;
    for (const value of values) squares += (value - mean) ** 2;
    const margin = critical * Math.sqrt(squares / (n - 1) / n);
    lowerLog = Math.min(lowerLog, mean - margin);
    upperLog = Math.max(upperLog, mean + margin);
  }
  const lower95 = Math.expm1(lowerLog),
    upper95 = Math.expm1(upperLog);
  assert(Number.isFinite(lower95) && Number.isFinite(upper95), 'Unresolvable interval arithmetic');
  return { lower95, upper95, lowerLog, upperLog, pairs: n, vertices, degreesOfFreedom: n - 1 };
}
