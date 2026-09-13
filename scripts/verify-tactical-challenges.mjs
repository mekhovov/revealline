#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildTacticalChallenges,
  CHALLENGE_IDS,
  SOURCE_PINS,
  sha256,
} from '../authoring/library/tactical-challenges/build.mjs';
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
const folder = new URL('authoring/library/tactical-challenges/', root);
const proofFile = new URL('routes.json', folder);
async function readJSON(path, limit) {
  assert.ok((await stat(path)).size <= limit, 'Challenge source byte bound exceeded.');
  const raw = await readFile(path);
  assert.ok(raw.length <= limit, 'Challenge source byte bound exceeded.');
  return JSON.parse(raw.toString('utf8'));
}
const digest = (value) => sha256(JSON.stringify(value));
const policies = ['immediate', 'grid-center'];
const input = (direction = null, action = false, pickup = false) => ({ direction, action, pickup });
const down = (ticks) => ({ ticks, input: input('down') });
// Finite controller instructions, not assignments to simulation state. Their last
// segment stops at the real terminal tick; published proofs contain no tail.
const move = (direction, ticks) => ({ ticks, input: input(direction) });
const plans = [
  {
    index: 0,
    name: 'west-exit-clear',
    prefix: 50,
    outcome: 'won',
    commands: [down(120), move('left', 192), down(500)],
  },
  {
    index: 0,
    name: 'east-exit-clear',
    prefix: 150,
    outcome: 'won',
    commands: [down(120), move('right', 180), down(500)],
  },
  {
    index: 0,
    name: 'blocked-center-failure',
    prefix: 400,
    outcome: 'enemy-trail',
    commands: [down(1800)],
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
    name: 'western-gate-clear',
    prefix: 1278,
    outcome: 'won',
    commands: [
      move('left', 432),
      down(216),
      move('right', 432),
      down(198),
      { ticks: 1, input: input() },
      move('up', 500),
    ],
  },
  {
    index: 2,
    name: 'fiber-scan-clear',
    prefix: 400,
    outcome: 'won',
    commands: [move('right', 288), { ticks: 1, input: input('right', true) }, move('right', 1000)],
  },
  {
    index: 2,
    name: 'fiber-no-scan-clear',
    prefix: 400,
    outcome: 'won',
    commands: [move('right', 288), move('right', 1), move('right', 1000)],
  },
  {
    index: 2,
    name: 'cable-dogleg-failure',
    prefix: 650,
    outcome: 'cable-limit',
    commands: [move('right', 576), down(120), move('right', 500)],
  },
  {
    index: 2,
    name: 'ordinary-band-failure',
    classId: 'scout',
    prefix: 400,
    outcome: 'cut-timeout',
    commands: [move('right', 288), { ticks: 1, input: input('right', true) }, move('right', 1500)],
  },
  {
    index: 2,
    name: 'ordinary-rim-clear',
    classId: 'scout',
    prefix: 900,
    outcome: 'won',
    commands: [move('up', 216), move('right', 540), down(550)],
  },
];
const planKey = (plan, policy) => `${CHALLENGE_IDS[plan.index]}/${policy}/${plan.name}`;

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
    recorder = createRecorder(scenario.level, options, 'tactical-challenges-proof');
  const events = [],
    metrics = {
      signalTicks: 0,
      resistantTicks: 0,
      slowedTicks: 0,
      stunnedEnemyTicks: 0,
      revealedBeforeCaptureTicks: 0,
      maxTrailCells: 0,
      scanFacts: [],
      captures: [],
      pressurePhases: {},
      savedState: null,
    };
  let saved = null;
  function step(command) {
    assert.equal(run.status, 'running', 'No input after a terminal result.');
    assert.ok(run.tick < 4000, 'Challenge route tick budget exceeded.');
    recordInput(recorder, command);
    stepRun(run, command, FIXED_DT);
    if (run.signal.zoneIds.length) metrics.signalTicks++;
    if (run.signal.zoneIds.length && run.signal.resistant) metrics.resistantTicks++;
    if (run.signal.speedFactor < 1) metrics.slowedTicks++;
    if (run.enemies.some((e) => e.stunnedUntil > run.time)) metrics.stunnedEnemyTicks++;
    if (run.objectives.some((o) => o.revealed && !o.captured)) metrics.revealedBeforeCaptureTicks++;
    metrics.maxTrailCells = Math.max(metrics.maxTrailCells, run.trail.length);
    for (const enemy of run.enemies) {
      const phase = enemy.classic?.pressure?.phase;
      if (phase) metrics.pressurePhases[phase] = (metrics.pressurePhases[phase] ?? 0) + 1;
    }
    for (const event of run.events) {
      if (event.type === 'capture.stopped')
        metrics.captures.push({
          tick: run.tick,
          coverage: getSummary(run).coverage,
          player: structuredClone(run.player),
          claimedCount: run.claimedCount,
        });
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
      metrics.savedState = {
        status: run.status,
        player: structuredClone(run.player),
        pressure: run.enemies
          .filter((e) => e.classic?.pressure)
          .map((e) => structuredClone(e.classic.pressure)),
        signal: structuredClone(run.signal),
        stunnedEnemies: run.enemies.filter((e) => e.stunnedUntil > run.time).length,
      };
      const campaign = campaignForScenario(scenario);
      saved = {
        checkpoint: authoritativeCheckpoint(run),
        session: suspendSession({
          run,
          recorder,
          campaignKey: campaignKey(campaign),
          themeId: scenario.theme.id,
          bodyId: scenario.theme.player,
          runId: `challenge-${plan.name}-${turnPolicy}`,
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
    exactKeys(segment, ['ticks', 'input', 'releaseBefore'], 'challenge segment');
    assert.equal(
      segment.releaseBefore,
      false,
      'These routes contain ordinary commands without out-of-band input releases.',
    );
    exactKeys(
      segment.input,
      ['direction', 'action', 'pickup', 'boost', 'switchClass'],
      'challenge input',
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

function checkChallenge(plan, result) {
  const { expected: end, metrics: m, events } = result;
  assert.equal(end.status, plan.outcome === 'won' ? 'won' : 'lost');
  assert.equal(end.failureCause, plan.outcome === 'won' ? null : plan.outcome);
  assert.equal(m.savedState.status, 'running');
  if (end.won) {
    assert.equal(end.livesLost, 0);
    assert.equal(end.objectives.captured, plan.index === 0 ? 0 : 1);
  } else {
    assert.equal(end.livesLost, 1);
    assert.equal(end.coverage, 0);
  }
  const has = (type, field, value) => events.some((e) => e.type === type && e[field] === value);
  if (plan.index === 0) {
    const warning = events.find((e) => e.type === 'pressure.warning');
    const committed = events.find((e) => e.type === 'pressure.committed');
    assert.ok(warning && committed);
    assert.equal(committed.actorTick - warning.actorTick, 60);
    assert.deepEqual(committed.target, warning.target, 'Warning locks this interception target.');
    assert.ok(m.pressurePhases.committed > 0);
    assert.ok(!events.some((e) => ['ability.used', 'pickup.collected'].includes(e.type)));
    for (const segment of result.replay.segments) {
      assert.equal(segment.input.action, false);
      assert.equal(segment.input.pickup, false);
      assert.equal(segment.input.boost, false);
    }
    assert.equal(
      m.savedState.pressure[0].phase,
      {
        'west-exit-clear': 'warning',
        'east-exit-clear': 'committed',
        'blocked-center-failure': 'cooldown',
      }[plan.name],
    );
  }
  if (plan.name === 'supply-field-clear') {
    assert.ok(has('pickup.collected', 'ammo', 1));
    assert.ok(has('ability.used', 'primitive', 'stun-field'));
    assert.ok(m.stunnedEnemyTicks > 0);
    assert.equal(m.savedState.stunnedEnemies, 1);
  }
  if (['empty-failure', 'no-field-failure', 'western-gate-clear'].includes(plan.name))
    assert.equal(m.stunnedEnemyTicks, 0);
  if (plan.name === 'empty-failure') assert.ok(has('ability.rejected', 'reason', 'empty'));
  if (plan.name === 'western-gate-clear') {
    assert.ok(!events.some((e) => ['ability.used', 'pickup.collected'].includes(e.type)));
    assert.equal(m.captures.length, 2);
    assert.ok(m.captures[0].coverage < 0.45);
    assert.equal(m.savedState.player.speed, 0);
    assert.equal(m.savedState.player.cutting, false);
  }
  if (['fiber-scan-clear', 'fiber-no-scan-clear', 'cable-dogleg-failure'].includes(plan.name)) {
    assert.ok(m.resistantTicks > 0);
    assert.equal(m.slowedTicks, 0);
  }
  if (plan.name === 'fiber-scan-clear') {
    assert.equal(m.scanFacts.length, 1);
    const scan = m.scanFacts[0];
    assert.equal(scan.revealed, 1);
    assert.equal(scan.claimedCount, 0);
    assert.equal(scan.captured, 0);
    assert.equal(scan.stunnedEnemies, 0);
    assert.ok(m.revealedBeforeCaptureTicks > 0);
    assert.deepEqual(scan.signal.zoneIds, ['switchback-band']);
    assert.equal(scan.signal.abilityBlocked, false);
    assert.equal(m.savedState.signal.resistant, true);
  }
  if (plan.name === 'fiber-no-scan-clear') {
    assert.equal(m.scanFacts.length, 0);
    assert.equal(m.revealedBeforeCaptureTicks, 0);
  }
  if (plan.name === 'ordinary-band-failure') {
    assert.ok(m.slowedTicks > 0);
    assert.equal(m.resistantTicks, 0);
    assert.ok(has('ability.rejected', 'reason', 'signal-interference'));
  }
  if (plan.name === 'ordinary-rim-clear') {
    assert.equal(m.signalTicks, 0);
    assert.ok(!events.some((e) => ['ability.used', 'pickup.collected'].includes(e.type)));
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

export async function verifyTacticalChallenges({ scenarios, proof = null, record = false } = {}) {
  const authored = await buildTacticalChallenges();
  if (scenarios === undefined)
    scenarios = await Promise.all(
      CHALLENGE_IDS.map(async (id) =>
        readJSON(new URL(`scenarios/${id}.json`, folder), 128 * 1024),
      ),
    );
  scenarios = boundedJSON(scenarios, { maxBytes: 128 * 1024, maxArray: 100, maxNodes: 10000 });
  assert.deepEqual(
    scenarios,
    authored,
    'Exact pinned challenge recipes and registered theme/roster required.',
  );
  const header = {
    format: 'revealline-tactical-challenges-proof.v1',
    sourcePins: SOURCE_PINS,
    scenariosSha256: digest(scenarios),
  };
  if (!record) {
    proof ??= await readJSON(proofFile, 2 * 1024 * 1024);
    proof = boundedJSON(proof, { maxBytes: 2 * 1024 * 1024, maxArray: 10000, maxNodes: 100000 });
    exactKeys(proof, [...Object.keys(header), 'routes'], 'challenge proof');
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
        'Exact ordinary challenge commands required.',
      );
      checkChallenge(plan, result);
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
  const proof = await verifyTacticalChallenges({ record });
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
