#!/usr/bin/env node
/** R2 proofs preserve actual release/fresh-command boundaries; no run state is patched. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, FIXED_DT, getSummary } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { validatePack, PACK_LIMITS } from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';
import { digest } from './verify-campaign.mjs';
import { findRoute } from '../authoring/library/fpv-arcade-r2/search.mjs';
const root = new URL('../', import.meta.url);
const proofURL = new URL('game/replays/fpv-arcade-r2-routes.json', root);
const load = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const directions = ['up', 'right', 'down', 'left'];
const policies = ['immediate', 'grid-center'];
const difficulties = ['standard', 'gentle'];
const routeId = (r) => `${r.difficulty}/${r.levelId}/${r.turnPolicy}`;
const optionsFor = (pack, turnPolicy) => ({
  classId: 'scout',
  classRecipes: pack.classRecipes,
  seed: 1,
  turnPolicy,
});
const result = (run) => ({ summary: getSummary(run), checkpoint: authoritativeCheckpoint(run) });

function proveRoute(level, pack, route) {
  assert.ok(
    Array.isArray(route.segments) && route.segments.length > 0 && route.segments.length <= 1000,
  );
  const options = optionsFor(pack, route.turnPolicy),
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'fpv-r2-proof');
  let needsRelease = false,
    total = 0,
    neutralTicks = 0,
    directionCommands = 0,
    cuttingTicks = 0,
    maxTrailCells = 0;
  const events = {};
  for (const segment of route.segments) {
    exactKeys(segment, ['ticks', 'input'], 'R2 segment');
    exactKeys(segment.input, ['direction', 'boost'], 'R2 input');
    assert.equal(typeof segment.input.boost, 'boolean');
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (total += segment.ticks) <= 18000,
    );
    if (needsRelease) {
      assert.deepEqual(
        segment,
        { ticks: 1, input: { direction: null, boost: false } },
        'Every nonterminal capture requires one released tick before a fresh direction.',
      );
      neutralTicks++;
      needsRelease = false;
    } else {
      assert.ok(
        directions.includes(segment.input.direction),
        'No artificial waiting or extra action commands.',
      );
      directionCommands++;
    }
    for (let i = 0; i < segment.ticks; i++) {
      assert.equal(run.status, 'running', 'No commands after recovery or completion.');
      recordInput(recorder, segment.input);
      stepRun(run, segment.input, FIXED_DT);
      if (run.player.cutting) cuttingTicks++;
      maxTrailCells = Math.max(maxTrailCells, run.trail.length);
      for (const event of run.events) events[event.type] = (events[event.type] ?? 0) + 1;
      if (run.events.some((event) => event.type === 'capture.stopped')) {
        assert.equal(i, segment.ticks - 1, 'A held command cannot cross a capture-stop boundary.');
        needsRelease = run.status === 'running';
      }
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.classic.livesLost, 0, 'A heart cannot hide a lost life.');
  assert.ok(run.coverage >= level.goal.coverage);
  const replay = exportReplay(recorder, run);
  assert.equal(replay.version, 'xonix-replay.v6');
  assert.equal(verifyReplay(replay).match, true);
  const required =
    level.id === 'orchard-window'
      ? ['contour.routeChanged']
      : level.id === 'split-courtyard'
        ? ['rover.activated', 'cells.eroded', 'powerup.collected']
        : ['boss.warning', 'rover.activated', 'contour.routeChanged'];
  for (const type of required) assert.ok(events[type] > 0, `Winning route must exercise ${type}.`);
  return {
    expected: replay.summary,
    checkpoint: replay.checkpoint,
    metrics: { directionCommands, neutralTicks, cuttingTicks, maxTrailCells, events },
  };
}

function opening(level, pack, turnPolicy) {
  const run = createRun(level, optionsFor(pack, turnPolicy));
  const direction = level.id === 'split-courtyard' ? 'right' : 'down';
  for (let i = 0; i < 1800 && run.status === 'running'; i++) {
    stepRun(run, { direction, boost: true }, FIXED_DT);
    if (run.events.some((event) => event.type === 'cut.closed')) break;
  }
  return result(run);
}
function oldCommands(level, pack, turnPolicy, segments) {
  const run = createRun(level, optionsFor(pack, turnPolicy));
  assert.ok(Array.isArray(segments) && segments.length > 0 && segments.length <= 1000);
  let budget = 0;
  for (const segment of segments) {
    exactKeys(segment, ['ticks', 'input'], 'Original control segment');
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (budget += segment.ticks) <= 18000,
    );
    recordInput({ ticks: 0, releaseAfter: false, segments: [] }, segment.input);
  }
  let release = false;
  outer: for (const segment of segments)
    for (let i = 0; i < segment.ticks; i++) {
      if (run.status !== 'running') break outer;
      if (release) {
        stepRun(run, { direction: null, boost: false }, FIXED_DT);
        release = false;
        if (run.status !== 'running') break outer;
      }
      stepRun(run, segment.input, FIXED_DT);
      release = run.events.some((event) => event.type === 'capture.stopped');
    }
  return result(run);
}

function evaluateR2({ pack, prior, originalProof, proof: supplied }, write = false) {
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  assert.equal(pack.id, 'fpv-arcade-r2');
  assert.equal(pack.format, 'xonix-pack.v5');
  assert.equal(pack.campaigns.length, 1);
  assert.equal(pack.campaigns[0].id, 'fpv-first-light-r2');
  assert.deepEqual(
    pack.campaigns[0].levels.map((level) => level.id),
    ['orchard-window', 'split-courtyard', 'night-signal'],
  );
  const priorCheck = validatePack(prior);
  assert.equal(priorCheck.valid, true, priorCheck.errors.join('; '));
  assert.equal(prior.id, 'fpv-arcade');
  assert.equal(prior.format, 'xonix-pack.v4');
  assert.equal(prior.campaigns.length, 1);
  assert.equal(prior.campaigns[0].id, 'fpv-first-light');
  assert.equal(originalProof.format, 'revealline-first-light-proof.v1');
  assert.equal(originalProof.packSha256, digest(prior));
  assert.ok(Array.isArray(originalProof.routes) && originalProof.routes.length === 6);
  const base = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  assert.notEqual(
    campaignKey(base),
    campaignKey({ ...prior.campaigns[0], classRecipes: prior.classRecipes }),
  );
  assert.deepEqual(
    pack.levelVisuals,
    prior.levelVisuals,
    'Revision rewards reuse exactly the original three images.',
  );
  for (const level of base.levels) assert.equal(level.rules.stopOnCapture, true);
  const expectedHeader = {
    format: 'revealline-fpv-r2-proof.v1',
    packId: pack.id,
    packVersion: pack.version,
    packSha256: digest(pack),
    baseCampaignKey: campaignKey(base),
    classesSha256: digest(pack.classRecipes),
    originalPackSha256: digest(prior),
    originalProofSha256: digest(originalProof),
    classId: 'scout',
    seed: 1,
    controlModel: 'capture-stop-release-tick.v1',
  };
  const proof = write
    ? { ...expectedHeader, routes: [], controls: [] }
    : boundedJSON(supplied, {
        maxBytes: 2 * 1024 * 1024,
        maxNodes: 100000,
        maxArray: 10000,
        maxDepth: 18,
      });
  exactKeys(proof, [...Object.keys(expectedHeader), 'routes', 'controls'], 'R2 proof');
  for (const [key, value] of Object.entries(expectedHeader))
    assert.equal(proof[key], value, `Mismatched ${key}`);
  assert.ok(Array.isArray(proof.routes) && Array.isArray(proof.controls));
  const expectedIds = difficulties
    .flatMap((difficulty) =>
      base.levels.flatMap((level) =>
        policies.map((turnPolicy) => `${difficulty}/${level.id}/${turnPolicy}`),
      ),
    )
    .sort();
  if (!write) assert.deepEqual(proof.routes.map(routeId).sort(), expectedIds);
  const results = [];
  for (const difficulty of difficulties) {
    const context = createDifficultyContext(base, difficulty);
    for (const level of context.campaign.levels) {
      let found;
      for (const turnPolicy of policies) {
        let route;
        if (write) {
          found ??= findRoute(level, pack.classRecipes, 'immediate', {
            maxMilliseconds: 45000,
            maxCuts: 18,
          });
          assert.equal(found.won, true, `${difficulty}/${level.id}: ${found.reason}`);
          route = {
            difficulty,
            levelId: level.id,
            turnPolicy,
            campaignKey: context.campaignKey,
            levelSha256: digest(level),
            segments: found.segments,
          };
        } else {
          route = proof.routes.find(
            (r) =>
              r.difficulty === difficulty && r.levelId === level.id && r.turnPolicy === turnPolicy,
          );
          exactKeys(
            route,
            [
              'difficulty',
              'levelId',
              'turnPolicy',
              'campaignKey',
              'levelSha256',
              'segments',
              'expected',
              'checkpoint',
              'metrics',
            ],
            'R2 route',
          );
        }
        assert.equal(route.campaignKey, context.campaignKey);
        assert.equal(route.levelSha256, digest(level));
        const actual = proveRoute(level, pack, route);
        if (write) {
          Object.assign(route, actual);
          proof.routes.push(route);
        } else
          for (const key of ['expected', 'checkpoint', 'metrics'])
            assert.deepEqual(route[key], actual[key]);
        results.push({
          difficulty,
          levelId: level.id,
          turnPolicy,
          ...actual.expected,
          metrics: actual.metrics,
        });
      }
    }
  }
  const controls = [];
  for (const level of base.levels)
    for (const turnPolicy of policies) {
      const oldLevel = prior.campaigns[0].levels.find((l) => l.id === level.id);
      const oldRoute = originalProof.routes.find(
        (r) => r.levelId === level.id && r.turnPolicy === turnPolicy,
      );
      assert.equal(oldRoute.levelSha256, digest(oldLevel));
      assert.equal(oldRoute.classesSha256, digest(prior.classRecipes));
      const baseline = oldCommands(oldLevel, prior, turnPolicy, oldRoute.segments);
      assert.deepEqual(
        baseline.summary,
        oldRoute.expected,
        'The unchanged original route still wins its original level.',
      );
      assert.deepEqual(baseline.checkpoint, oldRoute.checkpoint);
      const straight = opening(level, pack, turnPolicy);
      const replayed = oldCommands(level, pack, turnPolicy, oldRoute.segments);
      assert.equal(straight.summary.won, false, 'A direct opening cannot complete R2.');
      assert.equal(replayed.summary.won, false, 'The original timed route cannot complete R2.');
      controls.push({ levelId: level.id, turnPolicy, straight, originalRouteOnRevision: replayed });
    }
  if (write) proof.controls = controls;
  else assert.deepEqual(proof.controls, controls);
  assert.deepEqual(proof.routes.map(routeId).sort(), expectedIds);
  const report = {
    packId: pack.id,
    baseCampaignKey: expectedHeader.baseCampaignKey,
    routes: results,
    controls,
    note: 'Twelve legal Scout wins with Boost and no ability, including exactly one neutral tick after each nonterminal capture. Control probes establish changed outcomes, not adaptive AI, human enjoyment or device comfort. The three original reward images are reused.',
  };
  return { report, proof };
}
/** Synchronous owned-data boundary used by the production aggregate; performs all twelve routes. */
export function verifyFpvR2Proof(source) {
  const owned = boundedJSON(source, {
    maxBytes: PACK_LIMITS.libraryBytes + 4 * 1024 * 1024,
    maxNodes: 360000,
    maxDepth: 20,
    maxArray: 20000,
    maxString: PACK_LIMITS.maxBytes,
  });
  exactKeys(owned, ['pack', 'prior', 'originalProof', 'proof'], 'R2 verification request');
  return evaluateR2(owned).report;
}
export async function verifyFpvR2({ write = false, proof: supplied } = {}) {
  assert.equal(typeof write, 'boolean');
  assert.ok(!write || supplied === undefined);
  const pack = await load('game/content/packs/fpv-arcade-r2.json');
  const prior = await load('game/content/packs/fpv-arcade.json');
  const originalProof = await load('game/replays/first-light-routes.json');
  const proof =
    supplied === undefined && !write ? JSON.parse(await readFile(proofURL, 'utf8')) : supplied;
  const value = { pack, prior, originalProof, proof };
  const evaluated = write ? evaluateR2(value, true) : { report: verifyFpvR2Proof(value), proof };
  assert.equal(digest(await load('game/content/packs/fpv-arcade-r2.json')), digest(pack));
  assert.equal(digest(await load('game/content/packs/fpv-arcade.json')), digest(prior));
  assert.equal(digest(await load('game/replays/first-light-routes.json')), digest(originalProof));
  if (write)
    await writeFile(proofURL, JSON.stringify(evaluated.proof, null, 2) + '\n', { flag: 'wx' });
  return evaluated.report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--write'));
  console.log(JSON.stringify(await verifyFpvR2({ write: args.includes('--write') }), null, 2));
}
