#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arch, cpus, platform, release } from 'node:os';
import { createOverflightProject, compileOverflightProject } from '../game/overflight/project.mjs';
import { createOverflightRun, startOverflight, stepOverflight } from '../game/overflight/core.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../game/overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  overflightHuntFixtureInput,
} from '../game/overflight/raid-core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const value = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const seconds = Number(value('--seconds', 900));
const fixture = value('--fixture', 'raid-reference');
const world = value('--world', 'freight-depot');
const output = value('--output', null);
assert.ok(Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600);
assert.ok(['reference', 'stress', 'raid-reference'].includes(fixture));
const paths = [
  ...readdirSync(resolve(root, 'game/overflight'))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => `game/overflight/${name}`),
  'game/data-json.mjs',
  'scripts/qualify-overflight-world-lifecycle.mjs',
];
const bindings = () =>
  Object.fromEntries(
    paths.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(root, path)))
        .digest('hex'),
    ]),
  );
const before = bindings();
const raid = fixture === 'raid-reference';
const compiled = raid
  ? compileOverflightHuntProject(createOverflightHuntProject({ rulesVersion: 3, world }))
  : compileOverflightProject(createOverflightProject({ rulesVersion: 3, world }));
const makeRun = () =>
  raid
    ? createOverflightHuntRun(compiled, { fixture })
    : createOverflightRun(compiled, { fixture });
const start = raid ? startOverflightHunt : startOverflight;
const step = raid ? stepOverflightHunt : stepOverflight;
const input = raid
  ? overflightHuntFixtureInput
  : (run) => ({
      x: Math.cos(run.time * 0.4),
      y: Math.sin(run.time * 0.4),
      boost: run.tick % 180 === 0,
    });
const run = makeRun();
const expected = { alive: run.fixtureWorkload.alive, visible: run.fixtureWorkload.visible };
const highWater = {};
const samples = [];
const pools = [
  ['enemies', '_enemyFree'],
  ['pickups', '_pickupFree'],
  ['effects', '_effectFree'],
  ['projectiles', '_projectileFree'],
];
function check(current, unique = false) {
  assert.equal(current.phase, 'playing');
  assert.equal(current.stats.enemiesAlive, expected.alive);
  assert.equal(current.stats.enemiesVisible, expected.visible);
  assert.equal(current.progression.choices, 0);
  for (const [name, free] of pools) {
    const active = current[name].reduce((count, item) => count + Number(item.active), 0);
    assert.equal(active + current[free].length, current[name].length, `${name} conservation`);
    highWater[name] = Math.max(highWater[name] ?? 0, active);
    if (unique)
      assert.equal(new Set(current[free]).size, current[free].length, `${name} unique free slots`);
  }
  if (unique) {
    const active = current.enemies.filter((enemy) => enemy.active);
    assert.equal(new Set(active.map((enemy) => enemy.id)).size, expected.alive);
    assert.ok(active.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)));
  }
}
const started = performance.now();
start(run);
for (let tick = 0; tick < seconds * 60; tick++) {
  step(run, input(run));
  check(run, tick % 60 === 0);
  if ((tick + 1) % 3600 === 0 || tick + 1 === seconds * 60)
    samples.push({
      time: run.time,
      alive: run.stats.enemiesAlive,
      visible: run.stats.enemiesVisible,
      recycledActors: run.fixtureWorkload.recycledActors,
      effects: run.effects.filter((item) => item.active).length,
      projectiles: run.projectiles.filter((item) => item.active).length,
    });
}
const elapsedWallMs = performance.now() - started;
// Retry uses newly created state just as the native host does, with the same
// compiled identity and seed. This checks isolation, not garbage collection.
let referenceRetry;
for (let retry = 0; retry < 10; retry++) {
  const next = makeRun();
  assert.notEqual(next.enemies, run.enemies);
  assert.notEqual(next._enemyFree, run._enemyFree);
  assert.equal(next.compiled.projectIdentity, compiled.projectIdentity);
  start(next);
  for (let tick = 0; tick < 120; tick++) step(next, input(next));
  check(next, true);
  const snapshot = JSON.stringify({
    seed: next.seed,
    rng: next.rng,
    stats: next.stats,
    player: next.player,
    actors: next.enemies.map((enemy) => [enemy.id, enemy.x, enemy.y, enemy.hp]),
  });
  if (retry === 0) referenceRetry = snapshot;
  else assert.equal(snapshot, referenceRetry, 'same-seed retries must reproduce the same state');
}
const after = bindings();
const changed = paths.filter((path) => before[path] !== after[path]);
const result = {
  kind: 'overflight-current-world-simulation-lifecycle',
  evidence:
    'Accelerated deterministic Node simulation only. Not a 15-minute browser/GPU soak, rendered-frame benchmark, real context recovery, audio review or physical-target qualification.',
  createdAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBindings: before,
  sourceBindingsAfter: after,
  changedDuringRun: changed,
  sourceStable: changed.length === 0,
  environment: {
    node: process.version,
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model,
  },
  settings: {
    fixture,
    world,
    seed: run.seed,
    rulesVersion: run.rulesVersion,
    balanceRevision: compiled.balanceRevision,
    difficulty: run.difficulty,
    projectIdentity: compiled.projectIdentity,
    visualIdentity: compiled.visualIdentity,
  },
  passed: true,
  simulatedSeconds: seconds,
  fixedSteps: run.tick,
  elapsedWallMs,
  expected,
  highWater,
  samples,
  retries: {
    count: 10,
    stepsEach: 120,
    deterministic: true,
    scope:
      'fresh run state and pool isolation; renderer disposal is covered separately by a mock contract test',
  },
};
if (output) {
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
}
console.log(
  JSON.stringify(
    { ...result, sourceBindings: undefined, sourceBindingsAfter: undefined, samples: undefined },
    null,
    2,
  ),
);
