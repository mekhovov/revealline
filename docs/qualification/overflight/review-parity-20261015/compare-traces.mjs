/** Offline artifact comparison only; never controls a browser or simulation. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const [nativePath, headlessPath, output] = process.argv.slice(2);
assert.ok(
  nativePath && headlessPath && output && !existsSync(output),
  'Pass two saved artifacts and a fresh output.',
);
const read = (path) =>
  JSON.parse(path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path, 'utf8'));
const native = read(nativePath),
  headless = read(headlessPath);
assert.equal(
  native.projectIdentity,
  headless.projectIdentity,
  'Compare the same compiled project.',
);
assert.equal(native.seed, headless.seed);
assert.equal(native.review?.route ?? native.route, headless.review?.route ?? headless.route);
const left = native.reviewTrace.samples,
  right = new Map(headless.reviewTrace.samples.map((sample) => [sample.tick, sample]));
const equal = (a, b, tolerance) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tolerance;
  if (typeof a !== typeof b || a === null || b === null) return a === b;
  if (Array.isArray(a))
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => equal(value, b[index], tolerance))
    );
  if (typeof a === 'object')
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((key) => Object.hasOwn(b, key) && equal(a[key], b[key], tolerance))
    );
  return a === b;
};
const first = (tolerance, field = null) => {
  for (const sample of left) {
    const other = right.get(sample.tick);
    assert.ok(other, `Missing headless tick ${sample.tick}`);
    if (!equal(field ? sample[field] : sample, field ? other[field] : other, tolerance))
      return {
        tick: sample.tick,
        time: sample.tick / 60,
        fields: Object.keys(sample).filter((key) => !equal(sample[key], other[key], tolerance)),
        native: sample,
        headless: other,
      };
  }
  return null;
};
const report = {
  format: 'OverflightReviewTraceComparisonV1',
  nativePath,
  headlessPath,
  projectIdentity: native.projectIdentity,
  seed: native.seed,
  samplesCompared: left.length,
  throughTick: left.at(-1)?.tick,
  tolerance: 1e-8,
  firstExact: first(0),
  firstMeaningful: first(1e-8),
  firstInput: first(1e-12, 'input'),
  limitation:
    'Absolute tolerance ignores tiny arithmetic differences, not RNG/choice/counter changes. enemyDigest is a quantized diagnostic fingerprint, not proof of exact actor equivalence.',
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    samplesCompared: report.samplesCompared,
    throughTick: report.throughTick,
    firstExact: report.firstExact?.time,
    firstMeaningful: report.firstMeaningful?.time,
    firstInput: report.firstInput?.time,
  }),
);
