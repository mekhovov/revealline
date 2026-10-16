// Import an actual UI-downloaded native measurement; never fabricate samples.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const [path, sourceRevision, name, operation, layout, trial] = process.argv.slice(2);
assert.match(sourceRevision ?? '', /^[a-f0-9]{40}$/);
assert.match(name ?? '', /^[a-z0-9-]+$/);
assert.ok(operation && layout && ['1', '2', '3'].includes(trial));
const raw = readFileSync(path);
const data = JSON.parse(raw);
assert.ok(['OverflightMeasurementsV1', 'OverflightHuntMeasurementsV1'].includes(data.format));
assert.equal(data.benchmarkTrial, trial);
assert.equal(data.clipCaptureUsed, false);
const target = new URL(`./native/${name}.json.gz`, import.meta.url);
assert.ok(!existsSync(target), 'Preserve existing recordings.');
writeFileSync(target, gzipSync(raw, { mtime: 0 }));
const manifest = new URL('./native-full-content-summary.json', import.meta.url);
const result = JSON.parse(readFileSync(manifest));
const entry = {
  format: data.format,
  fixture: data.fixture,
  measureAt: data.measureAt ?? null,
  scheduledStart: data.renderer?.protocol?.scheduledStart ?? null,
  reducedEffects: data.renderer?.reducedEffects ?? null,
  sourceRevision,
  file: `native/${name}.json.gz`,
  sha256Raw: createHash('sha256').update(raw).digest('hex'),
  capturedAt: data.capturedAt,
  operation,
  layout,
  trial: Number(trial),
  valid: data.trialValid,
  invalidReasons: data.invalidReasons,
  window: data.renderer.protocol.windows[0],
  viewport: data.viewport,
  summary: data.summary,
  resourceHighWater: data.renderer.highWater,
};
result.runs.push(entry);
writeFileSync(manifest, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ file: entry.file, valid: entry.valid, window: entry.window }));
