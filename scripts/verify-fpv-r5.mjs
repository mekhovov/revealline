#!/usr/bin/env node
/** Exact two-chapter authority and public-input replays; no patched simulation outcomes. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, getSummary, FIXED_DT } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { campaignKey } from '../game/library.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';
import { buildPressureChapters } from '../authoring/library/fpv-arcade-r5/build.mjs';
import { digest } from './verify-campaign.mjs';

const root = new URL('../', import.meta.url),
  proofFile = new URL('game/replays/fpv-arcade-r5-routes.json', root);
const policies = ['immediate', 'grid-center'],
  difficulties = ['standard', 'gentle'];
const load = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const routeKey = (r) => `${r.packId}/${r.difficulty}/${r.levelId}/${r.turnPolicy}`;
const options = (recipes, turnPolicy) => ({
  classId: 'scout',
  classRecipes: recipes,
  turnPolicy,
  seed: 1,
});
const directions = ['up', 'right', 'down', 'left'];
function append(segments, direction) {
  const last = segments.at(-1);
  if (last?.input.direction === direction) last.ticks++;
  else segments.push({ ticks: 1, input: { direction } });
}

function execute(
  level,
  recipes,
  turnPolicy,
  segments,
  { winning = true, stopAtTerminal = false } = {},
) {
  assert.ok(Array.isArray(segments) && segments.length > 0 && segments.length <= 2000);
  const run = createRun(level, options(recipes, turnPolicy)),
    recorder = createRecorder(level, options(recipes, turnPolicy), 'fpv-r5-proof');
  let total = 0,
    releaseNeeded = false,
    savePrefix = null,
    savedPriority = 0;
  const eventCounts = {},
    pressureActors = { warning: new Set(), committed: new Set(), cancelled: new Set() };
  for (const segment of segments) {
    exactKeys(segment, ['ticks', 'input'], 'R5 segment');
    exactKeys(segment.input, ['direction'], 'R5 direction-only command');
    assert.ok(Object.hasOwn(segment.input, 'direction'));
    assert.ok(directions.includes(segment.input.direction) || segment.input.direction === null);
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (total += segment.ticks) <= 21600,
    );
    if (winning) {
      if (releaseNeeded) {
        assert.deepEqual(segment, { ticks: 1, input: { direction: null } });
        releaseNeeded = false;
      } else assert.ok(directions.includes(segment.input.direction));
    }
    for (let i = 0; i < segment.ticks; i++) {
      if (stopAtTerminal && ['won', 'lost'].includes(run.status)) break;
      assert.ok(
        winning ? run.status === 'running' : ['running', 'respawning'].includes(run.status),
      );
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      for (const event of run.events) {
        eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
        for (const kind of Object.keys(pressureActors))
          if (event.type === `pressure.${kind}`) pressureActors[kind].add(event.id);
      }
      if (winning && run.events.some((e) => e.type === 'capture.stopped')) {
        assert.equal(i, segment.ticks - 1, 'Capture consumes the end of this held direction.');
        releaseNeeded = run.status === 'running';
      }
      const phases = run.enemies
        .filter((e) => e.classic?.pressure)
        .map((e) => ({ id: e.id, phase: e.classic.pressure.phase }));
      const priority = phases.some((e) => e.phase === 'committed')
        ? 3
        : phases.some((e) => e.phase === 'warning')
          ? 2
          : 1;
      if (run.player.cutting && run.tick >= 12 && priority > savedPriority) {
        savePrefix = {
          tick: run.tick,
          direction: segment.input.direction,
          checkpoint: authoritativeCheckpoint(run),
          pressurePhases: phases,
        };
        savedPriority = priority;
      }
    }
  }
  if (winning) {
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
    assert.ok(savePrefix, 'Every win includes a real live-cut checkpoint.');
  }
  assert.equal(eventCounts['ability.used'] ?? 0, 0);
  assert.equal(eventCounts['pickup.collected'] ?? 0, 0);
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay),
    checkpoint = authoritativeCheckpoint(run);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), checkpoint);
  return {
    expected: getSummary(run),
    checkpoint,
    savePrefix,
    metrics: {
      ticks: run.tick,
      eventCounts,
      pressureActors: Object.fromEntries(
        Object.entries(pressureActors).map(([k, ids]) => [k, [...ids].sort()]),
      ),
    },
  };
}

/** A fixed ordinary inward departure, then an honest failure/block/capture outcome. */
function ordinaryProbe(level, recipes, turnPolicy) {
  const run = createRun(level, options(recipes, turnPolicy)),
    segments = [];
  const direction =
    level.spawn.y < 1
      ? 'down'
      : level.spawn.y > level.height - 1
        ? 'up'
        : level.spawn.x < 1
          ? 'right'
          : 'left';
  let outcome = 'budget',
    stagnant = 0,
    capturedAt = null,
    stationary = null;
  for (let i = 0; i < 1200; i++) {
    const before = { x: run.player.x, y: run.player.y };
    stepRun(run, { direction }, FIXED_DT);
    append(segments, direction);
    if (run.classic.livesLost > 0) {
      outcome = 'failure';
      break;
    }
    if (run.events.some((e) => e.type === 'capture.stopped')) {
      outcome = 'capture';
      capturedAt = {
        tick: run.tick,
        coverage: run.coverage,
        score: run.score,
        checkpoint: authoritativeCheckpoint(run),
      };
      const at = { ...run.player },
        lost = run.classic.livesLost;
      if (run.status === 'running') {
        for (let idle = 0; idle < 120 && !['won', 'lost'].includes(run.status); idle++) {
          stepRun(run, { direction: null }, FIXED_DT);
          append(segments, null);
        }
        stationary = {
          ticks: run.tick - capturedAt.tick,
          positionUnchanged: run.player.x === at.x && run.player.y === at.y,
          stopped: run.player.speed === 0,
          livesLost: run.classic.livesLost - lost,
        };
        if (!stationary.livesLost)
          assert.equal(stationary.positionUnchanged && stationary.stopped, true);
      }
      break;
    }
    stagnant =
      Math.hypot(run.player.x - before.x, run.player.y - before.y) < 1e-8 ? stagnant + 1 : 0;
    if (stagnant >= 12) {
      outcome = 'blocked';
      break;
    }
  }
  const result = execute(level, recipes, turnPolicy, segments, { winning: false });
  const control = structuredClone(level);
  delete control.classic.enemyPressure;
  control.id += '-pressure-control';
  control.revision = 'control-1';
  const passiveControl = {
    levelSha256: digest(control),
    ...execute(control, recipes, turnPolicy, segments, { winning: false, stopAtTerminal: true }),
  };
  return { direction, outcome, segments, capturedAt, stationary, ...result, passiveControl };
}

function evaluate({ packs, prior, homeward, proof }, write = false) {
  assert.deepEqual(
    packs,
    buildPressureChapters(prior, homeward),
    'R5 chapters match the exact authored layouts and owned picture sources.',
  );
  assert.deepEqual(
    packs.map((p) => p.id),
    ['fpv-arcade-r5', 'fpv-pressure-frontier'],
  );
  const contexts = packs.flatMap((pack) =>
    difficulties.map((difficulty) => ({
      pack,
      difficulty,
      context: createDifficultyContext(
        { ...pack.campaigns[0], classRecipes: pack.classRecipes },
        difficulty,
      ),
    })),
  );
  const identities = contexts.flatMap(({ pack, difficulty, context }) =>
    context.campaign.levels.flatMap((level) =>
      policies.map((turnPolicy) => ({
        packId: pack.id,
        difficulty,
        levelId: level.id,
        turnPolicy,
        campaignKey: context.campaignKey,
        levelSha256: digest(level),
      })),
    ),
  );
  assert.equal(identities.length, 24);
  const header = {
    format: 'revealline-pressure-lines-proof.v1',
    packs: packs.map((p) => ({
      id: p.id,
      version: p.version,
      sha256: digest(p),
      campaignKey: campaignKey({ ...p.campaigns[0], classRecipes: p.classRecipes }),
    })),
    priorPackSha256: digest(prior),
    homewardPackSha256: digest(homeward),
    classId: 'scout',
    seed: 1,
  };
  if (!write) {
    exactKeys(proof, [...Object.keys(header), 'routes', 'ordinaryProbes'], 'R5 proof');
    for (const [field, value] of Object.entries(header))
      assert.deepEqual(proof[field], value, `R5 ${field}`);
  }
  assert.ok(Array.isArray(proof.routes));
  assert.deepEqual(proof.routes.map(routeKey).sort(), identities.map(routeKey).sort());
  if (!write)
    assert.deepEqual(proof.ordinaryProbes.map(routeKey).sort(), identities.map(routeKey).sort());
  const routes = [],
    ordinaryProbes = [];
  for (const identity of identities) {
    const { pack, context } = contexts.find(
        (c) => c.pack.id === identity.packId && c.difficulty === identity.difficulty,
      ),
      level = context.campaign.levels.find((l) => l.id === identity.levelId),
      input = proof.routes.find((r) => routeKey(r) === routeKey(identity));
    if (!write) {
      exactKeys(
        input,
        [...Object.keys(identity), 'segments', 'expected', 'checkpoint', 'savePrefix', 'metrics'],
        'R5 route',
      );
      for (const [field, value] of Object.entries(identity)) assert.deepEqual(input[field], value);
    }
    const route = {
      ...identity,
      segments: input.segments,
      ...execute(level, pack.classRecipes, identity.turnPolicy, input.segments),
    };
    if (!write) assert.deepEqual(input, route);
    routes.push(route);
    const probe = { ...identity, ...ordinaryProbe(level, pack.classRecipes, identity.turnPolicy) };
    if (!write)
      assert.deepEqual(
        proof.ordinaryProbes.find((p) => routeKey(p) === routeKey(identity)),
        probe,
      );
    ordinaryProbes.push(probe);
  }
  return {
    proof: { ...header, routes, ordinaryProbes },
    report: {
      packs: header.packs,
      routes: routes.map(({ segments, checkpoint, savePrefix, expected, ...r }) => ({
        ...r,
        ...expected,
        savePrefixTick: savePrefix.tick,
      })),
      ordinaryProbes: ordinaryProbes.map(
        ({
          packId,
          difficulty,
          levelId,
          turnPolicy,
          outcome,
          expected,
          metrics,
          stationary,
          passiveControl,
        }) => ({
          packId,
          difficulty,
          levelId,
          turnPolicy,
          outcome,
          expected,
          metrics,
          stationary,
          passiveControl: { expected: passiveControl.expected, metrics: passiveControl.metrics },
        }),
      ),
      note: '24 real direction-only wins across two authored chapters. Ordinary probes and pressure-disabled derived controls are separate observations, not human balance or device qualification.',
    },
  };
}

export function verifyFpvR5Proof(candidate) {
  const owned = boundedJSON(candidate, {
    maxBytes: 64 * 1024 * 1024,
    maxNodes: 500000,
    maxDepth: 28,
    maxArray: 24000,
    maxString: 24 * 1024 * 1024,
  });
  exactKeys(owned, ['packs', 'prior', 'homeward', 'proof'], 'R5 verification request');
  return evaluate(owned).report;
}
export async function verifyFpvR5({ writeRoutes = null } = {}) {
  const paths = [
    'game/content/packs/fpv-arcade-r5.json',
    'game/content/packs/fpv-pressure-frontier.json',
    'game/content/packs/fpv-arcade-r4.json',
    'game/content/packs/homeward-skies.json',
  ];
  const inputs = await Promise.all(paths.map(load)),
    candidate = {
      packs: inputs.slice(0, 2),
      prior: inputs[2],
      homeward: inputs[3],
      proof: writeRoutes ? { routes: writeRoutes } : JSON.parse(await readFile(proofFile, 'utf8')),
    };
  const result = writeRoutes ? evaluate(candidate, true) : { report: verifyFpvR5Proof(candidate) };
  for (const [i, value] of inputs.entries())
    assert.equal(digest(await load(paths[i])), digest(value));
  if (writeRoutes)
    await writeFile(proofFile, JSON.stringify(result.proof, null, 2) + '\n', { flag: 'wx' });
  return result.report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--write-from'));
  const writeRoutes = args.length ? JSON.parse(await readFile(args[1], 'utf8')) : null;
  console.log(JSON.stringify(await verifyFpvR5({ writeRoutes }), null, 2));
}
