#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { platform, release, arch, cpus } from 'node:os';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../game/overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  chooseOverflightHuntUpgrade,
  overflightHuntSummary,
  overflightHuntFixtureInput,
} from '../game/overflight/raid-core.mjs';
import { createOverflightHuntReviewPilot } from '../game/overflight/raid-review-pilot.mjs';

export function qualifyOverflightHunt({
  encounterSet = 'patrol',
  seed = 17031991,
  route = 'objectives',
  build = 'pursuer',
  airframes = 3,
  limit = 600,
  baseline = false,
} = {}) {
  const compiled = compileOverflightHuntProject(
    createOverflightHuntProject({ encounterSet, seed }),
  );
  const run = createOverflightHuntRun(compiled, { airframes });
  // Technical capability audit: withhold reward drafts without changing any
  // movement, enemy, collision, damage, boost or objective behavior.
  if (baseline) run.progression.maxChoices = 0;
  const pilot = createOverflightHuntReviewPilot({ route, build });
  const samples = [],
    choices = [];
  let nextSample = 0;
  const started = performance.now();
  startOverflightHunt(run);
  while (['playing', 'upgrade'].includes(run.phase) && run.time < limit) {
    if (run.phase === 'upgrade') {
      const card = pilot.choose(run);
      if (!card || !chooseOverflightHuntUpgrade(run, card.id))
        throw new Error('Review pilot encountered an illegal draft.');
      choices.push({ time: run.time, id: card.id });
      continue;
    }
    stepOverflightHunt(run, pilot.input(run));
    if (run.time >= nextSample) {
      samples.push({
        time: run.time,
        x: run.player.x,
        y: run.player.y,
        hull: run.player.hull,
        lives: run.airframesRemaining,
        objectives: run.hunt.objectivesCompleted,
        kills: run.stats.kills,
        score: run.hunt.score,
        alive: run.stats.enemiesAlive,
        visible: run.stats.enemiesVisible,
        chain: run.hunt.chain,
        rush: run.hunt.rushRemaining,
      });
      nextSample += 10;
    }
  }
  return {
    encounterSet,
    seed,
    route,
    build,
    airframes,
    limit,
    baseline,
    qualificationPolicy: baseline
      ? 'Technical baseline-kit audit: upgrade drafts disabled; normal contact and objective rules.'
      : 'Ordinary inputs and earned cards.',
    completed: ['won', 'lost'].includes(run.phase),
    elapsedCpuMs: performance.now() - started,
    choices,
    samples,
    summary: overflightHuntSummary(run),
  };
}

export function qualifyOverflightHuntSoak({
  seconds = 900,
  encounterSet = 'patrol',
  seed = 17031991,
} = {}) {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
    throw new RangeError('Raid soak seconds must be an integer between 1 and 3600.');
  const compiled = compileOverflightHuntProject(
    createOverflightHuntProject({ encounterSet, seed }),
  );
  const run = createOverflightHuntRun(compiled, { fixture: 'raid-reference' });
  const expectedAlive = run.fixtureWorkload.alive,
    expectedVisible = run.fixtureWorkload.visible;
  const ranges = { alive: { min: Infinity, max: 0 }, visible: { min: Infinity, max: 0 } };
  const highWater = { effects: 0, projectiles: 0, priorityAttacks: 0, visibleSpecialists: 0 };
  const samples = [];
  const started = performance.now();
  startOverflightHunt(run);
  for (let tick = 0; tick < seconds * 60; tick++) {
    stepOverflightHunt(run, overflightHuntFixtureInput(run));
    assert.equal(run.phase, 'playing');
    assert.equal(run.stats.enemiesAlive, expectedAlive);
    assert.equal(run.stats.enemiesVisible, expectedVisible);
    assert.equal(run.progression.choices, 0);
    assert.equal(run.hunt.objectivesCompleted, 0);
    for (const [name, value] of [
      ['alive', run.stats.enemiesAlive],
      ['visible', run.stats.enemiesVisible],
    ]) {
      ranges[name].min = Math.min(ranges[name].min, value);
      ranges[name].max = Math.max(ranges[name].max, value);
    }
    const activeEffects = run.effects.reduce((sum, item) => sum + Number(item.active), 0);
    const activeProjectiles = run.projectiles.reduce((sum, item) => sum + Number(item.active), 0);
    assert.equal(run._enemyFree.length + run.stats.enemiesAlive, run.enemies.length);
    assert.equal(run._effectFree.length + activeEffects, run.effects.length);
    assert.equal(run._projectileFree.length + activeProjectiles, run.projectiles.length);
    highWater.effects = Math.max(highWater.effects, activeEffects);
    highWater.projectiles = Math.max(highWater.projectiles, activeProjectiles);
    highWater.priorityAttacks = Math.max(highWater.priorityAttacks, run.stats.priorityAttacks);
    assert.ok(run.stats.priorityAttacks <= 2);
    if ((tick + 1) % 60 === 0) {
      const ids = run.enemies.filter((enemy) => enemy.active).map((enemy) => enemy.id);
      assert.equal(new Set(ids).size, expectedAlive);
      assert.equal(new Set(run._enemyFree).size, run._enemyFree.length);
      assert.equal(new Set(run._effectFree).size, run._effectFree.length);
      assert.equal(new Set(run._projectileFree).size, run._projectileFree.length);
      const specialists = run.enemies.filter(
        (enemy) =>
          enemy.active && enemy.specialist && enemy._fixtureDefinition.partition === 'visible',
      ).length;
      highWater.visibleSpecialists = Math.max(highWater.visibleSpecialists, specialists);
      assert.ok(specialists <= 8);
    }
    if ((tick + 1) % 3600 === 0 || tick + 1 === seconds * 60)
      samples.push({
        time: run.time,
        alive: run.stats.enemiesAlive,
        visible: run.stats.enemiesVisible,
        kills: run.stats.kills,
        projectilesFired: run.stats.projectilesFired,
        effects: activeEffects,
        projectiles: activeProjectiles,
        recycledActors: run.fixtureWorkload.recycledActors,
      });
  }
  return {
    kind: 'raid-reference-simulation-soak',
    encounterSet,
    seed,
    seconds,
    fixedSteps: run.tick,
    passed: true,
    expectedAlive,
    expectedVisible,
    populationRanges: ranges,
    highWater,
    elapsedCpuMs: performance.now() - started,
    samples,
    summary: overflightHuntSummary(run),
    evidence:
      'Deterministic Node simulation and pool invariants only. No rendering, audio, browser, graphics context, GPU, physical input, human playtest or target-hardware FPS claims.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const output = value('--output', null);
  const full = args.includes('--matrix');
  const soakRequested = args.includes('--soak-seconds');
  const soakSeconds = Number(value('--soak-seconds', 0));
  const baseline = args.includes('--baseline');
  const setups = full
    ? ['patrol', 'crossing', 'mixed'].flatMap((encounterSet) => [
        { encounterSet, route: 'objectives', build: 'pursuer' },
        ...(baseline ? ['pursuer'] : ['sweeper', 'pursuer', 'breaker']).map((build) => ({
          encounterSet,
          route: 'packs',
          build,
        })),
      ])
    : [
        {
          encounterSet: value('--encounter', 'patrol'),
          route: value('--route', 'objectives'),
          build: value('--build', 'pursuer'),
        },
      ];
  const root = fileURLToPath(new URL('../', import.meta.url));
  const paths = [
    'game/overflight/core.mjs',
    'game/overflight/grid.mjs',
    'game/overflight/upgrades.mjs',
    'game/overflight/defeat-feed.mjs',
    'game/overflight/raid-core.mjs',
    'game/overflight/raid-project.mjs',
    'game/overflight/raid-upgrades.mjs',
    'game/overflight/raid-review-pilot.mjs',
    'scripts/qualify-overflight-raid.mjs',
  ];
  const bindings = paths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex'),
  }));
  const results = soakRequested
    ? [
        qualifyOverflightHuntSoak({
          seconds: soakSeconds,
          encounterSet: value('--encounter', 'patrol'),
        }),
      ]
    : setups.map((setup) =>
        qualifyOverflightHunt({
          ...setup,
          limit: Number(value('--limit', 600)),
          baseline,
        }),
      );
  const report = {
    format: 'overflight-hunt-qualification.v1',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceBindings: bindings,
    reproduction: {
      executable: process.execPath,
      command: ['node', 'scripts/qualify-overflight-raid.mjs', ...args],
      cwd: root,
    },
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? null,
    },
    evidence:
      'Headless ordinary input, earned cards. No browser/GPU performance or human-playtest qualification.',
    results,
  };
  if (output) {
    const destination = resolve(output);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(
    JSON.stringify(
      results.map((row) => ({
        encounterSet: row.encounterSet,
        route: row.route,
        build: row.build,
        ...row.summary,
      })),
      null,
      2,
    ),
  );
}
