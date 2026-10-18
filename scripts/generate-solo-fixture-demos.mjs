#!/usr/bin/env node
/** Re-record existing legal authoring routes against the exact current Journey
 * entry. Fixture outcomes/checkpoints are never trusted as playback evidence. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { soloJourneyDemoInventory } from './audit-solo-demo-scope.mjs';
import { qualifySoloPerformance } from './qualify-solo-demos.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { demoReplayMatchesEntry } from '../game/demo-catalog.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('authoring/solo-demo-generated/', root);
const fixtures = new URL('game/test/fixtures/', root);
const names = (await readdir(fixtures)).filter(
  (name) => name.includes('route') && name.endsWith('.json') && !name.includes('team'),
);
const directions = new Set([null, 'up', 'down', 'left', 'right']);
const traces = [];
function segments(source) {
  if (!Array.isArray(source) || !source.length) return null;
  const result = source.map((segment) =>
    Array.isArray(segment)
      ? { input: { direction: segment[0] }, ticks: segment[1] }
      : segment && typeof segment === 'object'
        ? { input: segment.input ?? { direction: segment.direction }, ticks: segment.ticks }
        : null,
  );
  return result.every(
    (segment) =>
      segment &&
      directions.has(segment.input.direction) &&
      Number.isInteger(segment.ticks) &&
      segment.ticks > 0 &&
      segment.ticks < 20000,
  )
    ? result
    : null;
}
function collect(value, inherited, file) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    if (typeof value[0] === 'string' && segments(value.at(-1))) {
      traces.push({ ...inherited, id: value[0], segments: segments(value.at(-1)), file });
      return;
    }
    for (const row of value) collect(row, inherited, file);
    return;
  }
  const metadata = { ...inherited };
  for (const key of ['difficulty', 'turnPolicy', 'seed', 'classId'])
    if (Object.hasOwn(value, key)) metadata[key] = value[key];
  const id = value.missionId ?? value.mission ?? value.levelId ?? value.id;
  if (typeof id === 'string') metadata.id = id;
  const trace = segments(value.segments);
  if (trace && metadata.id) traces.push({ ...metadata, segments: trace, file });
  for (const [key, child] of Object.entries(value))
    if (['sets', 'rows', 'routes', 'optional', 'samples'].includes(key))
      collect(child, metadata, file);
}
for (const file of names)
  collect(JSON.parse(await readFile(new URL(file, fixtures), 'utf8')), {}, file);

const inventory = await soloJourneyDemoInventory();
const only = process.argv
  .find((arg) => arg.startsWith('--level='))
  ?.slice(8)
  .split(',');
const report = { format: 'SoloJourneyFixtureAuthoringV1', required: inventory.length, entries: [] };
await mkdir(output, { recursive: true });
await mkdir(new URL('.cache/', root), { recursive: true });
for (const target of inventory.filter((entry) => !only || only.includes(entry.levelId))) {
  const path = new URL(`${target.id}.json`, output);
  const row = { id: target.id, levelId: target.levelId, routeId: target.routeId, qualified: false };
  try {
    const prior = JSON.parse(await readFile(path, 'utf8'));
    if (!demoReplayMatchesEntry(prior.replay, target.entry))
      throw new Error('Stale authored proof.');
    const metrics = qualifySoloPerformance(prior.replay);
    row.qualified = true;
    row.outcome = metrics.outcome;
    row.existing = true;
  } catch {}
  if (!row.qualified) {
    const candidates = traces.filter(
      (trace) =>
        trace.id === target.levelId &&
        (!trace.difficulty || trace.difficulty === 'standard') &&
        (!trace.turnPolicy || trace.turnPolicy === 'immediate'),
    );
    // Prefer traces recorded through the ordinary tuned host, then short routes.
    candidates.sort(
      (a, b) =>
        Number(b.file.includes('tuned-host')) - Number(a.file.includes('tuned-host')) ||
        a.segments.reduce((sum, step) => sum + step.ticks, 0) -
          b.segments.reduce((sum, step) => sum + step.ticks, 0),
    );
    row.candidates = candidates.length;
    for (const candidate of candidates) {
      try {
        const level = applyGameplayTuning(target.level, resolveGameplayTuning('standard'));
        const options = {
          seed: candidate.seed ?? 1,
          classId: candidate.classId ?? 'scout',
          turnPolicy: 'immediate',
          classRecipes: target.entry.classRecipes,
        };
        const run = createRun(level, options);
        const recorder = createRecorder(level, options, 'revealline-journey-demo.v1');
        trace: for (const segment of candidate.segments)
          for (let tick = 0; tick < segment.ticks; tick++) {
            if (['won', 'lost'].includes(run.status)) break trace;
            recordInput(recorder, segment.input);
            stepRun(run, segment.input, FIXED_DT);
          }
        // A fixture from another revision is only a candidate input trace.
        // Require a real complete clear before keeping its newly recorded proof.
        if (run.status !== 'won') continue;
        const replay = exportReplay(recorder, run);
        if (!demoReplayMatchesEntry(replay, target.entry))
          throw new Error('Recording differs from exact authored entry.');
        const metrics = qualifySoloPerformance(replay);
        await writeFile(
          path,
          `${JSON.stringify({ id: target.id, levelId: target.levelId, replay, metrics })}\n`,
        );
        Object.assign(row, {
          qualified: true,
          outcome: metrics.outcome,
          captures: metrics.captures,
          ticks: metrics.ticks,
          fixture: candidate.file,
        });
        break;
      } catch (error) {
        row.lastError = error.message;
      }
    }
  }
  report.entries.push(row);
  console.log(JSON.stringify(row));
  await writeFile(
    new URL('.cache/solo-journey-fixture-authoring.json', root),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
console.log(
  JSON.stringify({
    verified: report.entries.filter((entry) => entry.qualified).length,
    required: report.entries.length,
  }),
);
