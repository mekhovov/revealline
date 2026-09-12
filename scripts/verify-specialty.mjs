#!/usr/bin/env node
/** Authored controller-input routes and matched action-omission checks for Fieldcraft. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../game/replay.mjs';
import { validatePack } from '../game/packs.mjs';
import { digest } from './verify-campaign.mjs';

const root = new URL('../', import.meta.url);
const proofURL = new URL('game/replays/fieldcraft-routes.json', root);
const MAX_TICKS = 20000;
const recommendations = ['fiber', 'bomber', 'impact', 'trapper'];
export async function loadSpecialtyPack() {
  const pack = JSON.parse(
    await readFile(new URL('game/content/packs/fieldcraft.json', root), 'utf8'),
  );
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  return pack;
}

function controller(pack, level, classId, turnPolicy) {
  const options = { classId, classRecipes: pack.classRecipes, turnPolicy, seed: 1 };
  const state = createRun(level, options);
  const recorder = createRecorder(level, options, 'fieldcraft-role-proof');
  const events = [];
  const suppressed = new Set();
  const metrics = {
    completedCuts: 0,
    abilityUses: 0,
    pickups: 0,
    switches: 0,
    signalExposureTicks: 0,
    resistantExposureTicks: 0,
    slowedTicks: 0,
    suppressedCrossingTicks: 0,
    stunnedEnemyTicks: 0,
    slowedEnemyTicks: 0,
    abandonedLiveCuts: 0,
    fieldsPlacedDuringCut: 0,
    lifeLosses: 0,
    maximumObservedTrailCells: 0,
  };
  function input(command) {
    if (['won', 'lost'].includes(state.status)) return;
    assert.ok(state.tick < MAX_TICKS, 'Authored route exceeded the fixed tick budget.');
    const before = { cutting: state.player.cutting, lives: state.lives };
    stepRun(state, command, FIXED_DT);
    recordInput(recorder, command);
    metrics.lifeLosses += before.lives - state.lives;
    metrics.maximumObservedTrailCells = Math.max(
      metrics.maximumObservedTrailCells,
      state.trail.length,
    );
    if (state.signal.zoneIds.length) metrics.signalExposureTicks++;
    if (state.signal.zoneIds.length && state.signal.resistant) metrics.resistantExposureTicks++;
    if (state.signal.speedFactor < 1) metrics.slowedTicks++;
    if (state.enemies.some((enemy) => enemy.stunnedUntil > state.time)) metrics.stunnedEnemyTicks++;
    if (state.enemies.some((enemy) => enemy.slowUntil > state.time)) metrics.slowedEnemyTicks++;
    for (const zone of state.signalZones)
      if (zone.suppressedUntil > state.time) {
        suppressed.add(zone.id);
        if (
          state.player.x >= zone.x &&
          state.player.x < zone.x + zone.w &&
          state.player.y >= zone.y &&
          state.player.y < zone.y + zone.h
        )
          metrics.suppressedCrossingTicks++;
      }
    for (const event of state.events) {
      if (event.type !== 'cells.claimed' && event.type !== 'run.completed')
        events.push({ ...event });
      if (event.type === 'cut.closed') metrics.completedCuts++;
      if (event.type === 'ability.used') {
        metrics.abilityUses++;
        if (before.cutting && ['stun-field', 'slow-field'].includes(event.primitive))
          metrics.fieldsPlacedDuringCut++;
      }
      if (event.type === 'pickup.collected') metrics.pickups++;
      if (event.type === 'class.switched') metrics.switches++;
      if (event.type === 'craft.redeployed' && before.cutting) metrics.abandonedLiveCuts++;
    }
  }
  function wait(seconds) {
    for (let tick = 0; tick < Math.round(seconds / FIXED_DT); tick++) input({});
  }
  function move(axis, target) {
    if (state.status === 'won') return;
    const sign = Math.sign(target - state.player[axis]);
    if (!sign) return;
    const direction = axis === 'x' ? (sign > 0 ? 'right' : 'left') : sign > 0 ? 'down' : 'up';
    // This is a controller stopping rule, never a position snap. Signal transitions
    // can leave a fractional remainder; grid turns still wait for the core's center.
    for (
      let guard = 0;
      guard < MAX_TICKS &&
      state.status === 'running' &&
      (target - state.player[axis]) * sign > 0.06;
      guard++
    )
      input({ direction, boost: true });
    assert.ok(
      state.status === 'won' ||
        (state.status === 'running' && (target - state.player[axis]) * sign <= 0.06),
      `${level.id}/${classId}/${turnPolicy}: waypoint ${axis}=${target} failed (${state.failureCause ?? state.status}).`,
    );
  }
  function finish() {
    const replay = exportReplay(recorder, state);
    assert.equal(
      verifyReplay(replay).match,
      true,
      'Portable reconstruction must match every authoritative section.',
    );
    return {
      state,
      replay,
      events,
      metrics: { ...metrics, suppressedZoneIds: [...suppressed].sort() },
    };
  }
  return {
    state,
    input,
    wait,
    x: (target) => move('x', target),
    y: (target) => move('y', target),
    finish,
  };
}

/** Deliberately different routes exercise roles; fallback routes remain ordinary captures. */
export function authorSpecialtyRoute(
  pack,
  index,
  turnPolicy,
  { classId = recommendations[index], variant = 'specialty' } = {},
) {
  const level = pack.campaigns[0].levels[index];
  const c = controller(pack, level, classId, turnPolicy);
  const useRole = variant === 'specialty';
  if (index === 0) {
    c.y(35.5);
    c.y(25.5);
    c.x(0.5);
    c.x(24.5);
    c.y(10.5);
    c.x(47.5);
  } else if (index === 1) {
    if (useRole) c.input({ pickup: true });
    c.x(1.5);
    if (useRole) c.input({ action: true });
    c.x(47.5);
    c.y(35.5);
    c.x(30.5);
    if (useRole) {
      c.input({ switchClass: 'carrier' });
      c.input({ pickup: true });
      c.input({ action: true });
    }
    c.y(18.5);
    c.x(35.5);
    c.y(0.5);
  } else if (index === 2) {
    if (useRole) {
      c.y(6.5);
      c.input({ action: true });
      c.wait(1.75);
    }
    c.x(0.5);
    c.y(10.5);
    c.x(47.5);
  } else if (index === 3) {
    if (useRole) {
      c.input({ pickup: true });
      c.y(3.5);
      c.input({ action: true });
      c.y(35.5);
      c.y(22.5);
      c.x(47.5);
    } else {
      c.x(41.5);
      c.y(35.5);
      c.x(24.5);
      c.y(0.5);
      c.y(5.5);
      c.x(0.5);
    }
  } else throw new Error('Unknown specialty map.');
  return c.finish();
}

function entryFor(pack, index, turnPolicy, classId, variant, result) {
  const level = pack.campaigns[0].levels[index];
  return {
    id: `${level.id}/${turnPolicy}/${variant}/${classId}`,
    packId: pack.id,
    levelId: level.id,
    levelRevision: level.revision,
    levelSha256: digest(level),
    classesSha256: digest(pack.classRecipes),
    seed: 1,
    turnPolicy,
    classId,
    variant,
    segments: result.replay.segments,
    expected: result.replay.summary,
    checkpoint: result.replay.checkpoint,
    metrics: result.metrics,
    events: result.events,
  };
}

export function replaySpecialtyRoute(pack, route) {
  const level = pack.campaigns[0].levels.find((level) => level.id === route.levelId);
  assert.ok(
    level && route.packId === pack.id && route.seed === 1,
    'Unknown specialty proof identity.',
  );
  assert.equal(
    route.levelSha256,
    digest(level),
    'Specialty map changed; review and regenerate its routes.',
  );
  assert.equal(route.classesSha256, digest(pack.classRecipes), 'Specialty class recipes changed.');
  const c = controller(pack, level, route.classId, route.turnPolicy);
  for (const segment of route.segments) {
    assert.ok(Number.isInteger(segment.ticks) && segment.ticks > 0 && segment.ticks <= MAX_TICKS);
    for (let tick = 0; tick < segment.ticks; tick++) {
      assert.ok(
        !['won', 'lost'].includes(c.state.status),
        'Input follows a terminal specialty result.',
      );
      c.input(segment.input);
    }
  }
  const result = c.finish();
  assert.deepEqual(result.replay.summary, route.expected);
  assert.deepEqual(result.replay.checkpoint, route.checkpoint);
  assert.deepEqual(result.metrics, route.metrics);
  assert.deepEqual(result.events, route.events);
  return result;
}

function assertRoleEvidence(routes) {
  const find = (index, policy, variant, classId) =>
    routes.find(
      (route) =>
        route.levelId === `fieldcraft-0${index + 1}` &&
        route.turnPolicy === policy &&
        route.variant === variant &&
        route.classId === classId,
    );
  for (const policy of ['immediate', 'grid-center']) {
    for (let index = 0; index < 4; index++) {
      const role = find(index, policy, 'specialty', recommendations[index]);
      assert.ok(
        role?.expected.won && role.expected.lives === 3,
        'Each specialty route must complete without life loss.',
      );
      assert.ok(
        role.expected.objectives.captured === role.expected.objectives.required,
        'Restore the actual required relays.',
      );
      assert.ok(role.metrics.completedCuts >= (index === 2 ? 1 : index === 3 ? 2 : 3));
    }
    const fiber = find(0, policy, 'specialty', 'fiber'),
      ordinary = find(0, policy, 'fallback', 'interceptor');
    assert.ok(fiber.metrics.resistantExposureTicks > 400 && fiber.metrics.slowedTicks === 0);
    assert.ok(
      ordinary.metrics.slowedTicks > 2000 && ordinary.expected.time > fiber.expected.time + 15,
    );
    const carrier = find(1, policy, 'specialty', 'bomber'),
      noFields = find(1, policy, 'without-action', 'bomber');
    assert.equal(carrier.metrics.pickups, 2);
    assert.equal(carrier.metrics.abilityUses, 2);
    assert.equal(carrier.metrics.fieldsPlacedDuringCut, 1);
    assert.equal(carrier.metrics.switches, 1);
    assert.equal(carrier.expected.activeClassId, 'carrier');
    assert.deepEqual(carrier.metrics.suppressedZoneIds, ['south-emitter', 'west-emitter']);
    assert.ok(carrier.metrics.suppressedCrossingTicks > 40);
    assert.equal(noFields.metrics.abilityUses, 0);
    assert.ok(
      noFields.metrics.slowedTicks > 100 && noFields.expected.coverage < carrier.expected.coverage,
    );
    const impact = find(2, policy, 'specialty', 'impact'),
      noPulse = find(2, policy, 'without-action', 'impact');
    assert.equal(impact.metrics.abandonedLiveCuts, 1);
    assert.ok(
      impact.metrics.stunnedEnemyTicks > 300 && impact.metrics.suppressedZoneIds.length > 0,
    );
    assert.equal(noPulse.expected.lives, 2);
    assert.equal(
      noPulse.events.find((event) => event.type === 'player.failed')?.cause,
      'enemy-trail',
    );
    const net = find(3, policy, 'specialty', 'trapper'),
      noNet = find(3, policy, 'without-action', 'trapper');
    assert.equal(net.metrics.pickups, 1);
    assert.equal(net.metrics.fieldsPlacedDuringCut, 1);
    assert.ok(net.metrics.slowedEnemyTicks > 300);
    assert.equal(noNet.metrics.slowedEnemyTicks, 0);
    assert.equal(
      noNet.events.find((event) => event.type === 'player.failed')?.cause,
      'enemy-trail',
    );
  }
}

export async function generateSpecialtyProof() {
  const pack = await loadSpecialtyPack(),
    routes = [];
  const before = digest(pack);
  for (let index = 0; index < 4; index++)
    for (const policy of ['immediate', 'grid-center']) {
      const classId = recommendations[index];
      const role = authorSpecialtyRoute(pack, index, policy);
      routes.push(entryFor(pack, index, policy, classId, 'specialty', role));
      for (const recipe of pack.classRecipes) {
        const fallback = authorSpecialtyRoute(pack, index, policy, {
          classId: recipe.id,
          variant: 'fallback',
        });
        assert.ok(fallback.replay.summary.won && fallback.replay.summary.lives === 3);
        assert.equal(fallback.metrics.abilityUses, 0);
        routes.push(entryFor(pack, index, policy, recipe.id, 'fallback', fallback));
      }
      if (index > 0) {
        const c = controller(pack, pack.campaigns[0].levels[index], classId, policy);
        for (const segment of role.replay.segments)
          for (
            let tick = 0;
            tick < segment.ticks && !['won', 'lost'].includes(c.state.status);
            tick++
          )
            c.input({ ...segment.input, action: false });
        routes.push(entryFor(pack, index, policy, classId, 'without-action', c.finish()));
      }
    }
  assert.equal(digest(pack), before);
  assertRoleEvidence(routes);
  return {
    format: 'xonix-specialty-proof.v1',
    packId: pack.id,
    packVersion: pack.version,
    packSha256: digest(pack),
    method:
      'Legal controller input only. Eight role clears, 56 ordinary fallback clears and six matched input traces with action omitted. All attempts reconstruct through the portable replay validator; no run field is edited.',
    routes,
  };
}

export async function verifySpecialtyRoutes() {
  const pack = await loadSpecialtyPack(),
    proof = JSON.parse(await readFile(proofURL, 'utf8'));
  assert.equal(proof.format, 'xonix-specialty-proof.v1');
  assert.equal(proof.packSha256, digest(pack));
  assert.equal(proof.routes.length, 70);
  assert.equal(new Set(proof.routes.map((route) => route.id)).size, 70);
  for (const route of proof.routes) replaySpecialtyRoute(pack, route);
  assertRoleEvidence(proof.routes);
  assert.equal(
    proof.routes.filter(
      (route) => route.variant === 'fallback' && route.expected.won && route.expected.lives === 3,
    ).length,
    56,
  );
  return {
    verified: proof.routes.length,
    roleClears: 8,
    fallbackClears: 56,
    actionOmissionComparisons: 6,
    results: proof.routes
      .filter((route) => route.variant === 'specialty')
      .map((route) => ({
        levelId: route.levelId,
        turnPolicy: route.turnPolicy,
        classId: route.classId,
        time: route.expected.time,
        metrics: route.metrics,
      })),
  };
}

async function recordProof() {
  const proof = await generateSpecialtyProof();
  await writeFile(proofURL, JSON.stringify(proof, null, 2) + '\n');
  const expansionURL = new URL('game/replays/expansion-routes.json', root);
  const expansion = JSON.parse(await readFile(expansionURL, 'utf8'));
  expansion.routes = expansion.routes.filter((route) => route.packId !== 'fieldcraft');
  for (const route of proof.routes.filter(
    (route) => route.variant === 'fallback' && route.classId === 'interceptor',
  ))
    expansion.routes.push({
      packId: route.packId,
      levelId: route.levelId,
      levelRevision: route.levelRevision,
      levelSha256: route.levelSha256,
      classesSha256: route.classesSha256,
      seed: route.seed,
      turnPolicy: route.turnPolicy,
      classId: route.classId,
      segments: route.segments.map((segment) => ({ ticks: segment.ticks, input: segment.input })),
      expected: route.expected,
    });
  expansion.method =
    'Original expansion routes use the bounded cut solver; Fieldcraft adds eight authored ordinary capture routes. Specialty interactions are verified separately in fieldcraft-routes.json.';
  await writeFile(expansionURL, JSON.stringify(expansion, null, 2) + '\n');
  console.log(JSON.stringify(await verifySpecialtyRoutes()));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 0) console.log(JSON.stringify(await verifySpecialtyRoutes()));
  else if (args.length === 1 && args[0] === '--record') await recordProof();
  else if (args.length === 5 && args[0] === '--export' && args[3] === '--out') {
    const pack = await loadSpecialtyPack(),
      proof = JSON.parse(await readFile(proofURL, 'utf8'));
    const route = proof.routes.find(
      (route) =>
        route.levelId === args[1] && route.turnPolicy === args[2] && route.variant === 'specialty',
    );
    assert.ok(route, 'Choose fieldcraft-01..04 and immediate or grid-center.');
    const { replay } = replaySpecialtyRoute(pack, route);
    await writeFile(resolve(args[4]), JSON.stringify(replay, null, 2) + '\n', { flag: 'wx' });
    console.log(
      JSON.stringify({ path: resolve(args[4]), ticks: replay.ticks, won: replay.summary.won }),
    );
  } else
    throw new Error(
      'Use no arguments to verify, --record to refresh reviewed fixtures, or --export LEVEL POLICY --out NEW_FILE.json.',
    );
}
