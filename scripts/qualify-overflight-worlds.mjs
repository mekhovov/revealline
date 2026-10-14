#!/usr/bin/env node
/** Public-input world comparison; no injected builds, healing or altered spawn rules. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createOverflightProject, compileOverflightProject } from '../game/overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../game/overflight/core.mjs';
import { createOverflightRiyMode } from '../game/overflight/riy-mode.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../game/overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  chooseOverflightHuntUpgrade,
} from '../game/overflight/raid-core.mjs';
import { pilot, selectCard } from '../game/overflight/review-pilot.mjs';
import { createOverflightHuntReviewPilot } from '../game/overflight/raid-review-pilot.mjs';
import { OVERFLIGHT_WORLDS } from '../game/overflight/worlds.mjs';
import { overflightTerrainClear } from '../game/overflight/terrain.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePaths = [
  'game/overflight/core.mjs',
  'game/overflight/riy-core.mjs',
  'game/overflight/raid-core.mjs',
  'game/overflight/worlds.mjs',
  'game/overflight/project.mjs',
  'game/overflight/raid-project.mjs',
  'game/overflight/tactics.mjs',
  'game/overflight/upgrades.mjs',
  'game/overflight/terrain.mjs',
  'game/overflight/review-pilot.mjs',
  'game/overflight/raid-review-pilot.mjs',
];
const bindings = () =>
  sourcePaths.map((path) => ({
    path,
    sha256: createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex'),
  }));
const survivor = {
  createProject: createOverflightProject,
  compileProject: compileOverflightProject,
  createRun: createOverflightRun,
  start: startOverflight,
  step: stepOverflight,
  choose: chooseOverflightUpgrade,
  summary: overflightSummary,
  pilot,
  selectCard,
};

export function qualifyWorld({
  world,
  mode = 'survivor',
  seed = 17031991,
  difficulty = 'standard',
  build = 'fan',
  airframes = 3,
  probe = 'active',
  checkpoint = 180,
  baseline = false,
  route = null,
  focusPolicy = 'automatic',
}) {
  const raid = mode === 'raid',
    riy = mode === 'riy';
  const owner = riy
    ? createOverflightRiyMode(survivor)
    : raid
      ? {
          createProject: createOverflightHuntProject,
          compileProject: compileOverflightHuntProject,
          createRun: createOverflightHuntRun,
          start: startOverflightHunt,
          step: stepOverflightHunt,
          choose: chooseOverflightHuntUpgrade,
        }
      : survivor;
  const set =
    world === 'field-crossing'
      ? raid
        ? 'patrol'
        : 'front'
      : world === 'freight-depot'
        ? 'crossing'
        : 'mixed';
  const compiled = owner.compileProject(
    owner.createProject({ rulesVersion: 3, world, encounterSet: set, seed, difficulty }),
  );
  const run = owner.createRun(compiled, { airframes });
  if (baseline) run.progression.maxChoices = 0;
  const raidPilot = raid
    ? createOverflightHuntReviewPilot({
        route: build === 'sweeper' ? 'packs' : 'objectives',
        build: baseline ? 'pursuer' : build,
      })
    : null;
  let input = {},
    choices = [],
    samples = [],
    finalFirstSeen = null,
    stoppedAt = null,
    blocked = false;
  owner.start(run);
  while (['playing', 'upgrade'].includes(run.phase) && run.time < 480) {
    if (run.phase === 'upgrade') {
      const card = raid ? raidPilot.choose(run) : owner.selectCard(run, build);
      if (!card || !owner.choose(run, card.id)) {
        blocked = true;
        break;
      }
      choices.push({ time: run.time, id: card.id });
      continue;
    }
    if (probe !== 'active' && run.time >= checkpoint) {
      stoppedAt ??= run.time;
      input =
        probe === 'idle'
          ? {}
          : probe === 'wall'
            ? { x: -1, y: 0 }
            : probe === 'tiny'
              ? { x: Math.cos(run.time * 9), y: Math.sin(run.time * 9) }
              : { x: Math.cos(run.time * 0.7), y: Math.sin(run.time * 0.7) };
    } else if (raid || run.tick % 6 === 0)
      input = raid
        ? raidPilot.input(run)
        : owner.pilot(run, route ?? (build === 'echo' ? 'figure-eight' : 'tight'));
    if (riy && focusPolicy !== 'automatic' && input.focus) {
      const target = run.enemies.find((enemy) => enemy.active && enemy.id === run.riy.candidateId);
      input = {
        ...input,
        focus: focusPolicy === 'priority' && ['elite', 'final'].includes(target?.role),
      };
    }
    owner.step(run, input);
    if (run.tick % 60 === 0) {
      const final = run.enemies.find((enemy) => enemy.active && enemy.role === 'final');
      if (final) finalFirstSeen ??= run.time;
      // "Nearby reachable" means a straight three-second baseline-flight route
      // clear of solid terrain. It does not claim the route is free of enemies.
      const nearbySalvage = run.pickups.reduce((sum, pickup) => {
        if (
          !pickup.active ||
          Math.hypot(pickup.x - run.player.x, pickup.y - run.player.y) > run.flight.speed * 3
        )
          return sum;
        return overflightTerrainClear(
          run.terrain,
          run.player.x,
          run.player.y,
          pickup.x,
          pickup.y,
          run.player.radius,
        )
          ? sum + pickup.value
          : sum;
      }, 0);
      samples.push({
        time: run.time,
        x: run.player.x,
        y: run.player.y,
        earned: run.stats.xpEarned,
        collected: run.stats.xpCollected,
        ground: run.stats.xpOnGround,
        nearbyReachable: nearbySalvage,
        alive: run.stats.enemiesAlive,
        visible: run.stats.enemiesVisible,
        damageDealt: run.stats.damageDealt,
        damageTaken: run.stats.damageTaken,
        airframesRemaining: run.airframesRemaining,
        finalHull: final?.hp ?? null,
        finalArmor: final?.armor ?? null,
        finalDistance: final ? Math.hypot(final.x - run.player.x, final.y - run.player.y) : null,
      });
    }
  }
  const gaps = choices.map((choice, index) => choice.time - (choices[index - 1]?.time ?? 0));
  return {
    world,
    mode,
    seed,
    difficulty,
    build,
    airframes,
    probe,
    checkpoint,
    baseline,
    route,
    focusPolicy,
    projectIdentity: compiled.projectIdentity,
    outcome: blocked ? 'draft-blocked' : run.phase,
    time: run.time,
    kills: run.stats.kills,
    damageTaken: run.stats.damageTaken,
    damageCauses: run.stats.damageCauses,
    airframesRemaining: run.airframesRemaining,
    xpEarned: run.stats.xpEarned,
    xpCollected: run.stats.xpCollected,
    xpOnGround: run.stats.xpOnGround,
    damageDealt: run.stats.damageDealt,
    buildState: structuredClone(run.build),
    firstChoice: choices[0]?.time ?? null,
    maxChoiceGap: Math.max(0, ...gaps),
    choices,
    stoppedAt,
    peakVisible: run.stats.peakVisible,
    finalHull: run.enemies.find((enemy) => enemy.active && enemy.role === 'final')?.hp ?? null,
    objectives: run.hunt?.objectivesCompleted ?? null,
    commands: run.riy?.commands ?? null,
    engagements: run.riy?.engagements ?? null,
    finalFirstSeen,
    finalFightSeconds: finalFirstSeen === null ? null : run.time - finalFirstSeen,
    samples,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    matrix = args.includes('--matrix'),
    before = bindings();
  const output = resolve(
    args.find((arg) => !arg.startsWith('--')) ??
      'docs/qualification/overflight/worlds-20261014/gameplay-probes.json',
  );
  const results = [];
  for (const { id: world } of OVERFLIGHT_WORLDS)
    for (const mode of ['survivor', 'riy', 'raid'])
      for (const build of mode === 'raid'
        ? ['pursuer', 'sweeper', 'breaker']
        : ['fan', 'echo', 'systems'])
        for (const probe of matrix && mode !== 'raid'
          ? ['active', 'idle', 'tiny', 'wall', 'orbit']
          : ['active']) {
          const result = qualifyWorld({ world, mode, build, probe });
          results.push(result);
          console.log(
            JSON.stringify({
              world,
              mode,
              build,
              probe,
              outcome: result.outcome,
              time: result.time,
              choices: result.choices.length,
              firstChoice: result.firstChoice,
              maxChoiceGap: result.maxChoiceGap,
            }),
          );
        }
  mkdirSync(dirname(output), { recursive: true });
  const after = bindings();
  writeFileSync(
    output,
    JSON.stringify(
      {
        format: 'OverflightWorldQualificationV1',
        generatedAt: new Date().toISOString(),
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        sourceBindings: before,
        sourceStable: JSON.stringify(before) === JSON.stringify(after),
        evidence: 'Automated public-input policies; not human difficulty or enjoyment evidence.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
