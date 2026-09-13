#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildTacticalTeaching,
  DEMO_IDS,
  SOURCE_PINS,
  sha256,
} from '../authoring/library/tactical-teaching/build.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { suspendSession, restoreSession } from '../game/sessions.mjs';
import { campaignKey } from '../game/library.mjs';
import { boundedJSON, exactKeys } from '../game/data-json.mjs';

const root = new URL('../', import.meta.url);
const folder = new URL('authoring/library/tactical-teaching/', root);
const proofFile = new URL('routes.json', folder);
const digest = (value) => sha256(JSON.stringify(value));
const policies = ['immediate', 'grid-center'];
const input = (direction = null, action = false, pickup = false) => ({ direction, action, pickup });
const down = (ticks) => ({ ticks, input: input('down') });
// Finite controller instructions, not assignments to simulation state. Their last
// segment stops at the real terminal tick; published proofs contain no tail.
const plans = [
  {
    index: 0,
    name: 'scan-clear',
    prefix: 100,
    outcome: 'won',
    commands: [{ ticks: 1, input: input(null, true) }, down(500)],
  },
  {
    index: 0,
    name: 'no-scan-clear',
    prefix: 100,
    outcome: 'won',
    commands: [{ ticks: 1, input: input() }, down(500)],
  },
  {
    index: 0,
    name: 'reverse-failure',
    prefix: 40,
    outcome: 'self-contact',
    commands: [
      { ticks: 1, input: input(null, true) },
      down(60),
      { ticks: 100, input: input('up') },
    ],
  },
  {
    index: 1,
    name: 'supply-field-clear',
    prefix: 100,
    outcome: 'won',
    commands: [
      { ticks: 1, input: input(null, false, true) },
      down(60),
      { ticks: 1, input: input('down', true) },
      down(600),
    ],
  },
  {
    index: 1,
    name: 'empty-failure',
    prefix: 100,
    outcome: 'enemy-trail',
    commands: [
      { ticks: 1, input: input() },
      down(60),
      { ticks: 1, input: input('down', true) },
      down(600),
    ],
  },
  {
    index: 1,
    name: 'no-field-failure',
    prefix: 100,
    outcome: 'enemy-trail',
    commands: [{ ticks: 1, input: input(null, false, true) }, down(60), down(1), down(600)],
  },
  {
    index: 1,
    name: 'ordinary-detour-clear',
    prefix: 900,
    outcome: 'won',
    commands: [
      { ticks: 432, input: input('left') },
      down(216),
      { ticks: 852, input: input('right') },
    ],
  },
  {
    index: 2,
    name: 'fiber-clear',
    prefix: 145,
    outcome: 'won',
    commands: [down(120), { ticks: 1, input: input('down', true) }, down(1000)],
  },
  {
    index: 2,
    name: 'cable-failure',
    prefix: 145,
    outcome: 'cable-limit',
    commands: [down(216), { ticks: 600, input: input('right') }],
  },
  {
    index: 2,
    name: 'ordinary-signal-failure',
    classId: 'scout',
    prefix: 145,
    outcome: 'cut-timeout',
    commands: [down(120), { ticks: 1, input: input('down', true) }, down(1000)],
  },
];
const planKey = (plan, policy) => `${DEMO_IDS[plan.index]}/${policy}/${plan.name}`;

export function campaignForScenario(scenario) {
  return {
    version: 'xonix-campaign.v1',
    id: `${scenario.level.id}-practice`,
    revision: '1',
    name: scenario.level.name,
    levels: [scenario.level],
    classRecipes: scenario.classRecipes,
  };
}

function controller(scenario, plan, turnPolicy) {
  const options = {
    ...scenario.settings,
    turnPolicy,
    classId: plan.classId ?? scenario.settings.classId,
    classRecipes: scenario.classRecipes,
  };
  const run = createRun(scenario.level, options),
    recorder = createRecorder(scenario.level, options, 'tactical-teaching-proof');
  const events = [],
    metrics = {
      signalTicks: 0,
      resistantTicks: 0,
      slowedTicks: 0,
      stunnedEnemyTicks: 0,
      revealedBeforeCaptureTicks: 0,
      maxTrailCells: 0,
      scanFacts: [],
    };
  let saved = null;
  function step(command) {
    assert.equal(run.status, 'running', 'No input after a terminal result.');
    assert.ok(run.tick < 4000, 'Teaching route tick budget exceeded.');
    recordInput(recorder, command);
    stepRun(run, command, FIXED_DT);
    if (run.signal.zoneIds.length) metrics.signalTicks++;
    if (run.signal.zoneIds.length && run.signal.resistant) metrics.resistantTicks++;
    if (run.signal.speedFactor < 1) metrics.slowedTicks++;
    if (run.enemies.some((e) => e.stunnedUntil > run.time)) metrics.stunnedEnemyTicks++;
    if (run.objectives.some((o) => o.revealed && !o.captured)) metrics.revealedBeforeCaptureTicks++;
    metrics.maxTrailCells = Math.max(metrics.maxTrailCells, run.trail.length);
    for (const event of run.events) {
      if (event.type !== 'cells.claimed' && event.type !== 'run.completed')
        events.push(structuredClone(event));
      if (event.type === 'ability.used' && event.primitive === 'scan')
        metrics.scanFacts.push({
          tick: run.tick,
          claimedCount: run.claimedCount,
          captured: run.objectives.filter((o) => o.captured).length,
          revealed: run.objectives.filter((o) => o.revealed).length,
          signal: structuredClone(run.signal),
          stunnedEnemies: run.enemies.filter((e) => e.stunnedUntil > run.time).length,
        });
    }
    if (run.tick === plan.prefix) {
      const campaign = campaignForScenario(scenario);
      saved = {
        checkpoint: authoritativeCheckpoint(run),
        session: suspendSession({
          run,
          recorder,
          campaignKey: campaignKey(campaign),
          themeId: scenario.theme.id,
          bodyId: scenario.theme.player,
          runId: `teaching-${plan.name}-${turnPolicy}`,
          savedAt: '2026-09-13T00:00:00.000Z',
          continuation: { direction: command.direction },
        }),
      };
    }
  }
  function finish() {
    assert.ok(saved, 'Each actual route crosses its declared unfinished saved prefix.');
    const replay = exportReplay(recorder, run),
      checked = verifyReplay(replay);
    assert.equal(checked.match, true);
    assert.deepEqual(authoritativeCheckpoint(checked.state), authoritativeCheckpoint(run));
    return {
      replay,
      expected: getSummary(run),
      checkpoint: authoritativeCheckpoint(run),
      metrics,
      events,
      saved,
    };
  }
  return { run, step, finish };
}

function authorRoute(scenario, plan, policy) {
  const c = controller(scenario, plan, policy);
  for (const segment of plan.commands)
    for (let i = 0; i < segment.ticks && c.run.status === 'running'; i++) c.step(segment.input);
  return c.finish();
}

function simulate(scenario, plan, policy, segments) {
  assert.ok(Array.isArray(segments) && segments.length > 0 && segments.length <= 30);
  const c = controller(scenario, plan, policy);
  let total = 0;
  for (const segment of segments) {
    exactKeys(segment, ['ticks', 'input', 'releaseBefore'], 'teaching segment');
    assert.equal(
      segment.releaseBefore,
      false,
      'These routes contain ordinary commands without out-of-band input releases.',
    );
    exactKeys(
      segment.input,
      ['direction', 'action', 'pickup', 'boost', 'switchClass'],
      'teaching input',
    );
    assert.ok(
      Number.isInteger(segment.ticks) && segment.ticks > 0 && (total += segment.ticks) <= 4000,
    );
    assert.ok([null, 'up', 'right', 'down', 'left'].includes(segment.input.direction));
    assert.equal(typeof segment.input.action, 'boolean');
    assert.equal(typeof segment.input.pickup, 'boolean');
    assert.equal(segment.input.boost, false);
    assert.equal(segment.input.switchClass, null);
    for (let i = 0; i < segment.ticks; i++) c.step(segment.input);
  }
  return c.finish();
}

function checkTeaching(plan, result) {
  const { expected: end, metrics: m, events } = result;
  assert.equal(end.status, plan.outcome === 'won' ? 'won' : 'lost');
  assert.equal(end.failureCause, plan.outcome === 'won' ? null : plan.outcome);
  if (end.won) {
    assert.equal(end.objectives.captured, 1);
    assert.equal(end.livesLost, 0);
  } else {
    assert.equal(end.livesLost, 1);
    assert.equal(end.coverage, 0);
  }
  const has = (type, field, value) => events.some((e) => e.type === type && e[field] === value);
  if (['scan-clear', 'fiber-clear'].includes(plan.name)) {
    assert.equal(m.scanFacts.length, 1);
    assert.equal(m.scanFacts[0].revealed, 1);
    assert.equal(m.scanFacts[0].claimedCount, 0);
    assert.equal(m.scanFacts[0].captured, 0);
    assert.equal(m.scanFacts[0].stunnedEnemies, 0);
    assert.ok(m.revealedBeforeCaptureTicks > 0);
  }
  if (plan.name === 'no-scan-clear') {
    assert.equal(m.scanFacts.length, 0);
    assert.equal(m.revealedBeforeCaptureTicks, 0);
  }
  if (plan.name === 'supply-field-clear') {
    assert.ok(has('pickup.collected', 'ammo', 1));
    assert.ok(has('ability.used', 'primitive', 'stun-field'));
    assert.ok(m.stunnedEnemyTicks > 0);
    assert.ok(result.saved.session.replay.summary.tick > 62);
  }
  if (['empty-failure', 'no-field-failure', 'ordinary-detour-clear'].includes(plan.name))
    assert.equal(m.stunnedEnemyTicks, 0);
  if (plan.name === 'empty-failure') assert.ok(has('ability.rejected', 'reason', 'empty'));
  if (plan.name === 'ordinary-detour-clear') {
    assert.ok(!events.some((e) => ['ability.used', 'pickup.collected'].includes(e.type)));
  }
  if (['fiber-clear', 'cable-failure'].includes(plan.name)) {
    assert.ok(m.resistantTicks > 0);
    assert.equal(m.slowedTicks, 0);
  }
  if (plan.name === 'fiber-clear') {
    assert.deepEqual(m.scanFacts[0].signal.zoneIds, ['quiet-band']);
    assert.equal(m.scanFacts[0].signal.abilityBlocked, false);
  }
  if (plan.name === 'ordinary-signal-failure') {
    assert.ok(m.slowedTicks > 0);
    assert.equal(m.resistantTicks, 0);
    assert.ok(has('ability.rejected', 'reason', 'signal-interference'));
  }
}

async function checkContinuation(scenario, result) {
  const raw = JSON.stringify(result.saved.session),
    campaign = campaignForScenario(scenario);
  const restored = await restoreSession(JSON.parse(raw), {
    campaign,
    campaignKey: campaignKey(campaign),
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), result.saved.checkpoint);
  let at = 0;
  for (const segment of result.replay.segments)
    for (let i = 0; i < segment.ticks; i++) {
      if (++at <= result.saved.session.replay.ticks) continue;
      assert.equal(restored.run.status, 'running');
      recordInput(restored.recorder, segment.input);
      stepRun(restored.run, segment.input, FIXED_DT);
    }
  assert.deepEqual(authoritativeCheckpoint(restored.run), result.checkpoint);
  const resumed = exportReplay(restored.recorder, restored.run);
  assert.deepEqual(resumed, result.replay);
  assert.equal(verifyReplay(resumed).match, true);
  assert.equal(JSON.stringify(result.saved.session), raw);
}

export async function verifyTacticalTeaching({ scenarios, proof = null, record = false } = {}) {
  const authored = await buildTacticalTeaching();
  if (scenarios === undefined)
    scenarios = await Promise.all(
      DEMO_IDS.map(async (id) =>
        JSON.parse(await readFile(new URL(`scenarios/${id}.json`, folder), 'utf8')),
      ),
    );
  scenarios = boundedJSON(scenarios, { maxBytes: 128 * 1024, maxArray: 100, maxNodes: 10000 });
  assert.deepEqual(
    scenarios,
    authored,
    'Exact pinned teaching recipes and registered theme/roster required.',
  );
  const header = {
    format: 'revealline-tactical-teaching-proof.v1',
    sourcePins: SOURCE_PINS,
    scenariosSha256: digest(scenarios),
  };
  if (!record) {
    proof ??= JSON.parse(await readFile(proofFile, 'utf8'));
    proof = boundedJSON(proof, { maxBytes: 2 * 1024 * 1024, maxArray: 10000, maxNodes: 100000 });
    exactKeys(proof, [...Object.keys(header), 'routes'], 'teaching proof');
    for (const [key, value] of Object.entries(header)) assert.deepEqual(proof[key], value);
    assert.deepEqual(
      proof.routes.map((r) => r.id).sort(),
      plans.flatMap((p) => policies.map((policy) => planKey(p, policy))).sort(),
    );
  }
  const routes = [];
  for (const plan of plans)
    for (const policy of policies) {
      const scenario = scenarios[plan.index],
        id = planKey(plan, policy),
        generated = authorRoute(scenario, plan, policy);
      const result = record
        ? generated
        : simulate(scenario, plan, policy, proof.routes.find((r) => r.id === id).segments);
      // Omission comparisons use the same authored direction/timing prefix. A
      // terminal failure ends it naturally, never by rewriting its outcome.
      assert.deepEqual(
        result.replay.segments,
        generated.replay.segments,
        'Exact ordinary teaching commands required.',
      );
      checkTeaching(plan, result);
      await checkContinuation(scenario, result);
      const entry = {
        id,
        scenarioSha256: digest(scenario),
        campaignKey: campaignKey(campaignForScenario(scenario)),
        classId: result.expected.classId,
        seed: 1,
        turnPolicy: policy,
        segments: result.replay.segments,
        expected: result.expected,
        checkpoint: result.checkpoint,
        metrics: result.metrics,
        events: result.events,
        savedPrefix: {
          tick: plan.prefix,
          checkpoint: result.saved.checkpoint,
          sessionSha256: digest(result.saved.session),
        },
      };
      if (!record)
        assert.deepEqual(
          proof.routes.find((r) => r.id === id),
          entry,
        );
      routes.push(entry);
    }
  return { ...header, routes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    record = args.length === 1 && args[0] === '--record';
  assert.ok(
    record || args.length === 0,
    'Use no arguments to verify, or --record once for new proof output.',
  );
  const proof = await verifyTacticalTeaching({ record });
  if (record) await writeFile(proofFile, `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(
    `${JSON.stringify({
      pass: true,
      routes: proof.routes.length,
      wins: proof.routes.filter((r) => r.expected.won).length,
      failures: proof.routes.filter((r) => !r.expected.won).length,
      ticks: proof.routes.reduce((n, r) => n + r.expected.tick, 0),
      savedContinuations: proof.routes.length,
    })}\n`,
  );
}
