#!/usr/bin/env node
/** Both difficulties, every encounter set, and baseline/build-route reachability. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifyOverflight } from './qualify-overflight.mjs';
import { qualifyOverflightHunt } from './qualify-overflight-raid.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const seed = 17031991;
const sourcePaths = [
  'game/data-json.mjs',
  'game/overflight/core.mjs',
  'game/overflight/raid-core.mjs',
  'game/overflight/project.mjs',
  'game/overflight/raid-project.mjs',
  'game/overflight/upgrades.mjs',
  'game/overflight/raid-upgrades.mjs',
  'game/overflight/grid.mjs',
  'game/overflight/tactics.mjs',
  'game/overflight/combat-profile.mjs',
  'game/overflight/review-pilot.mjs',
  'game/overflight/raid-review-pilot.mjs',
  'scripts/qualify-overflight.mjs',
  'scripts/qualify-overflight-raid.mjs',
  'scripts/qualify-overflight-variety.mjs',
];
const bindings = () =>
  sourcePaths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex'),
  }));
const sourceBindings = bindings();
const results = [];
function record(row) {
  results.push(row);
  console.log(
    row.mode,
    row.difficulty,
    row.encounterSet,
    row.build ?? row.direction,
    row.route ?? '',
    row.outcome,
    row.time,
  );
}
for (const difficulty of ['standard', 'veteran']) {
  for (const encounterSet of ['patrol', 'crossing', 'mixed']) {
    for (const build of ['sweeper', 'pursuer', 'breaker', 'baseline']) {
      const result = qualifyOverflightHunt({
        seed,
        difficulty,
        encounterSet,
        build: build === 'baseline' ? 'pursuer' : build,
        route: build === 'sweeper' ? 'packs' : 'objectives',
        baseline: build === 'baseline',
        airframes: 3,
      });
      record({
        mode: 'raid',
        difficulty,
        encounterSet,
        build,
        outcome: result.summary.outcome,
        time: result.summary.time,
        objectives: result.summary.hunt.objectivesCompleted,
        lives: result.summary.airframesRemaining,
        result,
      });
    }
  }
}
for (const difficulty of ['standard', 'veteran']) {
  for (const encounterSet of ['front', 'crossing', 'mixed']) {
    for (const direction of ['fan-shield', 'echo-scanner', 'systems']) {
      // Preserve failures. Alternate movement establishes reachability without
      // weakening the difficulty just to make a single automated route win.
      for (const route of ['tight', 'orbit']) {
        const result = qualifyOverflight({
          seed,
          difficulty,
          encounterSet,
          direction,
          route,
          airframes: 3,
        });
        record({
          mode: 'survivor',
          difficulty,
          encounterSet,
          direction,
          route,
          outcome: result.outcome,
          time: result.simulatedSeconds,
          lives: result.airframesRemaining,
          result,
        });
        if (result.outcome === 'won') break;
      }
    }
  }
}
const after = bindings();
const changedDuringRun = sourceBindings
  .filter((entry, index) => entry.sha256 !== after[index].sha256)
  .map((entry) => entry.path);
assert.deepEqual(changedDuringRun, [], 'Source changed during qualification; rerun the matrix.');
const report = {
  format: 'OverflightVarietyQualificationV1',
  generatedAt: new Date().toISOString(),
  scope:
    'Deterministic simulation route reachability only; not human enjoyment, first-player pacing, physical gamepad or GPU qualification.',
  seed,
  sourceBindings,
  changedDuringRun,
  results,
};
const output = resolve(
  root,
  process.argv[2] ?? 'qualification/overflight-variety-20261005/route-matrix.json',
);
mkdirSync(dirname(output), { recursive: true });
// Preserve the prior complete report if writing the replacement fails.
writeFileSync(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
renameSync(`${output}.tmp`, output);
console.log(`SOURCE-BOUND ${results.length} results saved to ${output}; source unchanged.`);
