import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const manifest = JSON.parse(readFileSync(new URL('./native-full-content-summary.json', import.meta.url)));
const entries = manifest.runs.filter((entry) => entry.file.startsWith('native/late-riy-'));
const range = (samples, key) => samples.length ? [Math.min(...samples.map((sample) => sample[key])), Math.max(...samples.map((sample) => sample[key]))] : null;
const runs = entries.map((entry) => {
  const raw = gunzipSync(readFileSync(new URL(entry.file, import.meta.url)));
  assert.equal(createHash('sha256').update(raw).digest('hex'), entry.sha256Raw);
  const data = JSON.parse(raw);
  const window = data.renderer.protocol.windows[0];
  const start = data.renderer.protocol.scheduledStart;
  assert.deepEqual(window, entry.window);
  assert.equal(data.measureAt, 180);
  const samples = data.resourceSamples.filter((sample) => start.measurementGameplaySeconds != null && sample.time >= start.measurementGameplaySeconds && sample.time <= data.summary.time);
  const result = !data.trialValid ? 'invalid' : !window.complete ? 'incomplete' : window.passes ? 'pass' : 'fail';
  return {
    sourceRevision: entry.sourceRevision, file: entry.file, sha256Raw: entry.sha256Raw,
    trial: entry.trial, capturedAt: data.capturedAt, result, valid: data.trialValid, invalidReasons: data.invalidReasons,
    measureAt: data.measureAt, scheduledStart: start, endGameplaySeconds: data.summary.time,
    seed: data.seed, projectIdentity: data.projectIdentity, reducedEffects: data.renderer.reducedEffects,
    window, sampledWorkload: { count: samples.length, gameplayRange: range(samples, 'time'), alive: range(samples, 'alive'), visible: range(samples, 'visible'), rendered: range(samples, 'rendered'), effects: range(samples, 'effects'), pickups: range(samples, 'pickups'), quads: range(samples, 'quads'), atlasBytes: range(samples, 'atlasBytes'), allocatedSprites: range(samples, 'allocatedSprites'), canvasCount: range(samples, 'canvasCount'), remainsStored: samples.length ? [Math.min(...samples.map((sample) => sample.remains.stored)), Math.max(...samples.map((sample) => sample.remains.stored))] : null },
    goals: data.summary.goals, upgrades: data.summary.upgrades, airframesRemaining: data.summary.airframesRemaining,
    clock: data.clock, contextLosses: data.renderer.contextLosses, contextRestores: data.renderer.contextRestores,
    rawOverflow: data.rawOverflow, clipCaptureUsed: data.clipCaptureUsed,
  };
});
const output = { format: 'OverflightEarnedLateNativeSummaryV1', populationScope: 'Ranges from periodic resource samples inside the measured gameplay interval; not exact peaks or sustained counts.', runs };
writeFileSync(new URL('./NATIVE-LATE-SUMMARY.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(runs.map(({ trial, result, reducedEffects, window, sampledWorkload }) => ({ trial, result, reducedEffects, window, sampledWorkload })), null, 2));
