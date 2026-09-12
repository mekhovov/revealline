#!/usr/bin/env node
/** Reproducible bounded viability evidence. Only createRun/stepRun change a run. */
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createRun, stepRun, FIXED_DT, RULESET } from '../../../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../../game/replay.mjs';
import { loadInputs, digest } from '../../../scripts/verify-campaign.mjs';
import { expansionSources } from '../../../scripts/verify-packs.mjs';

const root = new URL('../../../', import.meta.url);
const output = new URL('./balance-matrix.json', import.meta.url);
const MAX_TICKS = 20000;
const seeds = [1];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJSON = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

async function sourceInventory() {
  const core = (await readdir(new URL('game/core/', root)))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => `game/core/${name}`);
  const packIndex = await readJSON('game/content/packs/index.json');
  const paths = [
    ...core,
    'game/replay.mjs',
    'game/content/campaign.json',
    'game/content/classes.json',
    'game/content/packs/index.json',
    ...packIndex.packs.map((entry) => `game/content/packs/${entry.path}`),
    'game/replays/campaign-routes.json',
    'game/replays/expansion-routes.json',
    'scripts/verify-campaign.mjs',
    'scripts/verify-packs.mjs',
    'docs/verification/round-11/run-balance-survey.mjs',
  ].sort();
  return Promise.all(
    paths.map(async (path) => ({ path, sha256: sha(await readFile(new URL(path, root))) })),
  );
}

function simulate(source, route, classId, turnPolicy, seed, strategy) {
  const options = { classId, turnPolicy, seed, classRecipes: source.classes };
  const state = createRun(source.level, options);
  const recorder = createRecorder(source.level, options, 'round-11-balance-survey');
  const metrics = {
    eventCounts: {},
    rejectionCounts: {},
    maximumObservedLiveTrailCells: 0,
    longestCompletedCutSeconds: 0,
    completedCuts: 0,
    signalExposureTicks: 0,
    slowedTicks: 0,
    bossActiveTicks: 0,
    lifeLosses: 0,
    abilityUses: 0,
    suppliesCollected: 0,
  };
  let cutStart = null;
  for (const segment of route.segments) {
    assert.ok(Number.isInteger(segment.ticks) && segment.ticks > 0);
    const input = strategy === 'action-free' ? { ...segment.input, action: false } : segment.input;
    for (let tick = 0; tick < segment.ticks; tick++) {
      if (state.status === 'won' || state.status === 'lost') break;
      assert.ok(state.tick < MAX_TICKS, 'Attempt exceeded its explicit tick budget.');
      const before = { lives: state.lives };
      stepRun(state, input, FIXED_DT);
      recordInput(recorder, input);
      metrics.lifeLosses += before.lives - state.lives;
      metrics.maximumObservedLiveTrailCells = Math.max(
        metrics.maximumObservedLiveTrailCells,
        state.trail.length,
      );
      if (state.signal.zoneIds.length) metrics.signalExposureTicks++;
      if (state.signal.speedFactor < 1) metrics.slowedTicks++;
      if (state.enemies.some((enemy) => enemy.bossPhase === 'active')) metrics.bossActiveTicks++;
      for (const event of state.events) {
        metrics.eventCounts[event.type] = (metrics.eventCounts[event.type] ?? 0) + 1;
        if (event.type === 'ability.rejected')
          metrics.rejectionCounts[event.reason] = (metrics.rejectionCounts[event.reason] ?? 0) + 1;
        if (event.type === 'ability.used') metrics.abilityUses++;
        if (event.type === 'pickup.collected') metrics.suppliesCollected++;
        if (event.type === 'cut.started') cutStart = event.time;
        if (event.type === 'cut.closed') {
          assert.notEqual(cutStart, null);
          metrics.completedCuts++;
          metrics.longestCompletedCutSeconds = Math.max(
            metrics.longestCompletedCutSeconds,
            event.time - cutStart,
          );
          cutStart = null;
        }
        if (['craft.redeployed', 'player.failed', 'shield.absorbed'].includes(event.type))
          cutStart = null;
      }
    }
  }
  const replay = exportReplay(recorder, state);
  const verified = verifyReplay(replay);
  assert.ok(verified.match, JSON.stringify(verified.diagnostics));
  const summary = replay.summary;
  if (summary.won) {
    assert.ok(summary.coverage + 1e-9 >= source.level.goal.coverage);
    assert.ok(state.objectives.every((objective) => !objective.required || objective.captured));
  }
  return {
    strategy,
    result: summary.won
      ? 'verified-clear'
      : summary.status === 'lost'
        ? 'route-lost'
        : 'route-exhausted',
    inputSha256: digest(replay.segments),
    inputs: replay.segments,
    replayVerified: verified.match,
    checkpoint: replay.checkpoint,
    summary,
    metrics,
    challengeMargins: {
      missionSeconds:
        state.rules.timeLimitSeconds > 0 ? state.rules.timeLimitSeconds - summary.time : null,
      completedCutSeconds:
        state.rules.cutTimeLimitSeconds > 0
          ? state.rules.cutTimeLimitSeconds - metrics.longestCompletedCutSeconds
          : null,
      observedTrailCells:
        state.rules.maxTrailCells > 0
          ? state.rules.maxTrailCells - metrics.maximumObservedLiveTrailCells
          : null,
    },
  };
}

export async function survey() {
  const { campaign, classes } = await loadInputs();
  const baseProof = await readJSON('game/replays/campaign-routes.json');
  const expansionProof = await readJSON('game/replays/expansion-routes.json');
  const packs = await expansionSources();
  const sources = [
    ...campaign.levels.map((level) => ({
      packId: null,
      campaignId: campaign.id,
      level,
      classes,
      routes: baseProof.routes,
    })),
    ...packs.flatMap((pack) =>
      pack.campaigns.flatMap((campaign) =>
        campaign.levels.map((level) => ({
          packId: pack.id,
          campaignId: campaign.id,
          level,
          classes: pack.classRecipes,
          routes: expansionProof.routes.filter((route) => route.packId === pack.id),
        })),
      ),
    ),
  ];
  const beforeSources = digest(sources),
    inputSequences = {},
    cases = [];
  for (const source of sources)
    for (const turnPolicy of ['immediate', 'grid-center'])
      for (const recipe of source.classes)
        for (const seed of seeds) {
          const route = source.routes.find(
            (route) => route.levelId === source.level.id && route.turnPolicy === turnPolicy,
          );
          assert.ok(route, 'No reviewed authored proof for this map and turn mode.');
          assert.equal(
            route.levelSha256,
            digest(source.level),
            'Review stale authored proof before surveying.',
          );
          assert.equal(
            route.classesSha256,
            digest(source.classes),
            'Review stale class proof before surveying.',
          );
          const attempts = ['authored-actions', 'action-free'].map((strategy) => {
            const attempt = simulate(source, route, recipe.id, turnPolicy, seed, strategy);
            inputSequences[attempt.inputSha256] = attempt.inputs;
            delete attempt.inputs;
            return attempt;
          });
          cases.push({
            packId: source.packId,
            campaignId: source.campaignId,
            levelId: source.level.id,
            levelName: source.level.name,
            levelRevision: source.level.revision,
            levelSha256: digest(source.level),
            classesSha256: digest(source.classes),
            classId: recipe.id,
            classRevision: recipe.revision,
            turnPolicy,
            seed,
            result: attempts.some((attempt) => attempt.summary.won)
              ? 'verified-clear'
              : 'not-found-within-budget',
            attempts,
          });
        }
  assert.equal(
    digest(sources),
    beforeSources,
    'Simulation must not edit source content or proofs.',
  );
  const attempts = cases.flatMap((entry) => entry.attempts);
  return {
    format: 'xonix-balance-survey.v1',
    ruleset: RULESET,
    command: 'node docs/verification/round-11/run-balance-survey.mjs',
    verifyCommand: 'node docs/verification/round-11/run-balance-survey.mjs --check',
    scope: {
      seedPolicy:
        'Seed 1 only. Authored geometry and actor velocities are explicit; the core stores seed as identity without randomizing these maps.',
      baseMaps: campaign.levels.length,
      expansionMaps: sources.length - campaign.levels.length,
      classesPerMap: [...new Set(sources.map((source) => source.classes.length))],
      turnPolicies: ['immediate', 'grid-center'],
      seeds,
      maxAttemptsPerCase: 2,
      maxInputTicksPerAttempt: MAX_TICKS,
      routeMethod:
        'Replay the existing legal-input greedy straight-cut proof with the actual selected class, then replay the same directions and durations with action false. Fresh createRun for every attempt; no run field edits. Every attempt is independently reconstructed through verifyReplay.',
      evidenceBoundary:
        'A clear proves only this input sequence completes this content. An exhausted route is not proof of an unwinnable map. This survey does not measure human difficulty, retention, device performance, or ability mastery.',
    },
    totals: {
      cases: cases.length,
      verifiedCases: cases.filter((entry) => entry.result === 'verified-clear').length,
      notFoundWithinBudget: cases.filter((entry) => entry.result !== 'verified-clear').length,
      attempts: attempts.length,
      authoredActionClears: cases.filter((entry) => entry.attempts[0].summary.won).length,
      actionFreeClears: cases.filter((entry) => entry.attempts[1].summary.won).length,
      attemptedInputTicks: attempts.reduce((sum, attempt) => sum + attempt.summary.tick, 0),
      reconstructedInputTicks: attempts.reduce((sum, attempt) => sum + attempt.summary.tick, 0),
    },
    sources: await sourceInventory(),
    inputSequences,
    cases,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check'))
    throw new Error('Usage: node docs/verification/round-11/run-balance-survey.mjs [--check]');
  const report = await survey();
  if (args[0] === '--check') {
    assert.deepEqual(report, JSON.parse(await readFile(output, 'utf8')));
    console.log(JSON.stringify({ verified: true, ...report.totals }));
  } else {
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ path: fileURLToPath(output), ...report.totals }));
  }
}
