#!/usr/bin/env node
/** Fresh legal-input role and fallback proofs for the illustrated Homeward chapter. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../game/replay.mjs';
import { validatePack } from '../game/packs.mjs';
import { authorSpecialtyRoute, replaySpecialtyRoute } from './verify-specialty.mjs';
import { digest } from './verify-campaign.mjs';

const ROOT = new URL('../', import.meta.url),
  recommendations = ['fiber', 'bomber', 'impact'];
const proofURL = new URL('game/replays/homeward-routes.json', ROOT);
export async function loadHomewardPack() {
  const pack = JSON.parse(
    await readFile(new URL('game/content/packs/homeward-skies.json', ROOT), 'utf8'),
  );
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  assert.equal(
    pack.levelVisuals.length,
    3,
    'The chapter must include three actual picture rewards.',
  );
  return pack;
}
function entryFor(pack, index, policy, classId, variant, result) {
  const level = pack.campaigns[0].levels[index];
  return {
    id: `${level.id}/${policy}/${variant}/${classId}`,
    packId: pack.id,
    levelId: level.id,
    levelRevision: level.revision,
    levelSha256: digest(level),
    classesSha256: digest(pack.classRecipes),
    seed: 1,
    turnPolicy: policy,
    classId,
    variant,
    segments: result.replay.segments,
    expected: result.replay.summary,
    checkpoint: result.replay.checkpoint,
    metrics: result.metrics,
    events: result.events,
  };
}
function omitAction(pack, level, role) {
  const options = {
    classId: role.classId,
    classRecipes: pack.classRecipes,
    turnPolicy: role.turnPolicy,
    seed: 1,
  };
  const state = createRun(level, options),
    recorder = createRecorder(level, options, 'homeward-action-comparison'),
    events = [];
  for (const segment of role.segments)
    for (let tick = 0; tick < segment.ticks && !['won', 'lost'].includes(state.status); tick++) {
      const input = { ...segment.input, action: false };
      stepRun(state, input, FIXED_DT);
      recordInput(recorder, input);
      events.push(
        ...state.events
          .filter((event) => event.type !== 'cells.claimed' && event.type !== 'run.completed')
          .map((event) => ({ ...event })),
      );
    }
  const replay = exportReplay(recorder, state);
  assert.equal(verifyReplay(replay).match, true);
  return { replay, events };
}
function assertEvidence(proof) {
  assert.equal(proof.routes.length, 48);
  assert.equal(proof.comparisons.length, 4);
  assert.equal(new Set(proof.routes.map((entry) => entry.id)).size, 48);
  for (const policy of ['immediate', 'grid-center']) {
    const role = (index) =>
      proof.routes.find(
        (entry) =>
          entry.levelId === `homeward-0${index + 1}` &&
          entry.turnPolicy === policy &&
          entry.variant === 'specialty',
      );
    for (let index = 0; index < 3; index++) {
      const r = role(index);
      assert.equal(r.classId, recommendations[index]);
      assert.equal(r.expected.won, true);
      assert.equal(r.expected.lives, 3);
      assert.equal(r.expected.objectives.captured, r.expected.objectives.required);
      assert.ok(r.expected.objectives.required > 0);
    }
    assert.ok(role(0).metrics.resistantExposureTicks > 400);
    assert.equal(role(0).metrics.slowedTicks, 0);
    const ordinary = proof.routes.find(
      (r) =>
        r.levelId === 'homeward-01' &&
        r.turnPolicy === policy &&
        r.variant === 'fallback' &&
        r.classId === 'interceptor',
    );
    assert.ok(ordinary.metrics.slowedTicks > 2000);
    assert.ok(ordinary.expected.time > role(0).expected.time + 15);
    const carrier = role(1),
      impact = role(2);
    assert.equal(carrier.metrics.pickups, 2);
    assert.equal(carrier.metrics.abilityUses, 2);
    assert.equal(carrier.metrics.switches, 1);
    assert.equal(carrier.expected.activeClassId, 'carrier');
    assert.equal(carrier.metrics.suppressedZoneIds.length, 2);
    assert.ok(carrier.metrics.suppressedCrossingTicks > 40);
    assert.equal(impact.metrics.abandonedLiveCuts, 1);
    assert.ok(impact.metrics.stunnedEnemyTicks > 300);
    const comparison = (id) =>
      proof.comparisons.find((c) => c.levelId === id && c.turnPolicy === policy);
    const noFields = comparison('homeward-02'),
      noPulse = comparison('homeward-03');
    assert.equal(noFields.events.filter((event) => event.type === 'ability.used').length, 0);
    assert.ok(noFields.replay.summary.coverage < carrier.expected.coverage);
    assert.equal(
      noPulse.events.find((event) => event.type === 'player.failed')?.cause,
      'enemy-trail',
    );
    assert.equal(noPulse.replay.summary.lives, 2);
  }
  const fallback = proof.routes.filter((r) => r.variant === 'fallback');
  assert.equal(fallback.length, 42);
  for (const route of fallback) {
    assert.equal(route.expected.won, true);
    assert.equal(route.expected.lives, 3);
    assert.equal(route.metrics.abilityUses, 0);
  }
}
export async function generateHomewardProof() {
  const pack = await loadHomewardPack(),
    routes = [],
    comparisons = [],
    before = digest(pack);
  for (let index = 0; index < 3; index++)
    for (const policy of ['immediate', 'grid-center']) {
      const role = entryFor(
        pack,
        index,
        policy,
        recommendations[index],
        'specialty',
        authorSpecialtyRoute(pack, index, policy),
      );
      routes.push(role);
      for (const recipe of pack.classRecipes)
        routes.push(
          entryFor(
            pack,
            index,
            policy,
            recipe.id,
            'fallback',
            authorSpecialtyRoute(pack, index, policy, { classId: recipe.id, variant: 'fallback' }),
          ),
        );
      if (index > 0)
        comparisons.push({
          levelId: role.levelId,
          turnPolicy: policy,
          ...omitAction(pack, pack.campaigns[0].levels[index], role),
        });
    }
  assert.equal(digest(pack), before);
  const proof = {
    format: 'xonix-homeward-proof.v1',
    packId: pack.id,
    packVersion: pack.version,
    packSha256: before,
    method:
      'Six role clears, 42 all-class fallback clears and four matched action-omission traces; legal controller input and independent full replay verification. Layout curriculum adapted from Fieldcraft.',
    routes,
    comparisons,
  };
  assertEvidence(proof);
  return proof;
}
export async function verifyHomewardRoutes() {
  const pack = await loadHomewardPack(),
    proof = JSON.parse(await readFile(proofURL, 'utf8'));
  assert.equal(proof.format, 'xonix-homeward-proof.v1');
  assert.equal(proof.packSha256, digest(pack));
  for (const route of proof.routes) replaySpecialtyRoute(pack, route);
  for (const comparison of proof.comparisons) {
    const level = pack.campaigns[0].levels.find((l) => l.id === comparison.levelId);
    const role = proof.routes.find(
      (r) =>
        r.levelId === comparison.levelId &&
        r.turnPolicy === comparison.turnPolicy &&
        r.variant === 'specialty',
    );
    assert.deepEqual(omitAction(pack, level, role), {
      replay: comparison.replay,
      events: comparison.events,
    });
  }
  assertEvidence(proof);
  return {
    verified: 52,
    roleClears: 6,
    fallbackClears: 42,
    actionOmissionComparisons: 4,
    roles: proof.routes
      .filter((r) => r.variant === 'specialty')
      .map((r) => ({
        levelId: r.levelId,
        turnPolicy: r.turnPolicy,
        classId: r.classId,
        seconds: r.expected.time,
        coverage: r.expected.coverage,
        metrics: r.metrics,
      })),
  };
}
async function record() {
  const proof = await generateHomewardProof();
  await writeFile(proofURL, JSON.stringify(proof, null, 2) + '\n');
  const filename = new URL('game/replays/expansion-routes.json', ROOT),
    expansion = JSON.parse(await readFile(filename, 'utf8'));
  expansion.routes = expansion.routes.filter((r) => r.packId !== 'homeward-skies');
  for (const route of proof.routes.filter(
    (r) => r.variant === 'fallback' && r.classId === 'interceptor',
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
      segments: route.segments.map((s) => ({ ticks: s.ticks, input: s.input })),
      expected: route.expected,
    });
  await writeFile(filename, JSON.stringify(expansion, null, 2) + '\n');
  console.log(JSON.stringify(await verifyHomewardRoutes(), null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.length) console.log(JSON.stringify(await verifyHomewardRoutes(), null, 2));
  else if (args.length === 1 && args[0] === '--record') await record();
  else if (args.length === 5 && args[0] === '--export' && args[3] === '--out') {
    const pack = await loadHomewardPack(),
      proof = JSON.parse(await readFile(proofURL, 'utf8'));
    const route = proof.routes.find(
      (r) => r.levelId === args[1] && r.turnPolicy === args[2] && r.variant === 'specialty',
    );
    assert.ok(route, 'Choose homeward-01..03 and immediate or grid-center.');
    await writeFile(
      path.resolve(args[4]),
      JSON.stringify(replaySpecialtyRoute(pack, route).replay, null, 2) + '\n',
      { flag: 'wx' },
    );
  } else
    throw new Error(
      'Usage: node scripts/verify-homeward.mjs [--record | --export homeward-01 immediate --out replay.json]',
    );
}
