import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildTacticalTeaching,
  DEMO_IDS,
} from '../../authoring/library/tactical-teaching/build.mjs';
import { verifyTacticalTeaching } from '../../scripts/verify-tactical-teaching.mjs';
import { prepareScenario } from '../imports.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES, loadoutHash } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { CLASSIC_VERSIONS, versionsForLevel } from '../core/versions.mjs';
import { missionBriefing } from '../mission-brief.mjs';

const folder = new URL('../../authoring/library/tactical-teaching/', import.meta.url);
const scenarios = await Promise.all(
  DEMO_IDS.map(async (id) =>
    JSON.parse(await readFile(new URL(`scenarios/${id}.json`, folder), 'utf8')),
  ),
);
const proof = JSON.parse(await readFile(new URL('routes.json', folder), 'utf8'));
const find = (name, policy = 'immediate') =>
  proof.routes.find((r) => r.id.endsWith(`/${policy}/${name}`));

test('three importable teaching boards use exact original identities and registered manual equipment', async () => {
  assert.deepEqual(scenarios, await buildTacticalTeaching());
  assert.equal(new Set(scenarios.map((s) => s.level.id)).size, 3);
  for (const scenario of scenarios) {
    const prepared = await prepareScenario(scenario, {
      decodeImage: () => assert.fail('No new image dependency'),
    });
    assert.deepEqual(prepared.scenario, scenario);
    assert.deepEqual(versionsForLevel(scenario.level), CLASSIC_VERSIONS);
    assert.equal(scenario.format, 'xonix-playground.v5');
    assert.deepEqual(scenario.visualOverrides, {});
    assert.equal(scenario.masteryDefinition, null);
    assert.deepEqual(scenario.classRecipes.map(loadoutHash), CLASSES.map(loadoutHash));
    assert.ok(!Object.hasOwn(scenario.level.classic, 'arcadeActions'));
    assert.equal(arcadeActionCapabilities(scenario.level).manualAbility, true);
    assert.match(scenario.level.metadata.description, /45%.*relay/);
    const brief = missionBriefing(scenario.level, {
      classes: scenario.classRecipes,
      objectiveLabel: 'Relay',
    });
    assert.match(brief.facts, /Recommended:/);
    assert.match(brief.facts, /45%.*1 required relay/);
    assert.equal(brief.fullBrief, scenario.level.metadata.description);
  }
});

test('all 20 legal traces verify exact replay and real saved-prefix continuations in both modes', async () => {
  const before = JSON.stringify({ scenarios, proof });
  const checked = await verifyTacticalTeaching({ scenarios, proof });
  assert.equal(checked.routes.length, 20);
  assert.equal(checked.routes.filter((r) => r.expected.won).length, 10);
  assert.equal(checked.routes.filter((r) => !r.expected.won).length, 10);
  for (const route of checked.routes) {
    assert.ok(route.savedPrefix.tick < route.expected.tick);
    assert.equal(route.checkpoint.algorithm, CLASSIC_VERSIONS.checkpointAlgorithm);
  }
  assert.equal(JSON.stringify({ scenarios, proof }), before);
});

test('Scout reveals information without changing capture or enemy speed; scan is not a win gate', () => {
  const scenario = scenarios[0];
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const options = { ...scenario.settings, turnPolicy, classRecipes: scenario.classRecipes };
    const scanned = createRun(scenario.level, options),
      ordinary = createRun(scenario.level, options);
    stepRun(scanned, { action: true }, FIXED_DT);
    stepRun(ordinary, {}, FIXED_DT);
    assert.equal(scanned.objectives[0].revealed, true);
    assert.equal(ordinary.objectives[0].revealed, false);
    assert.equal(scanned.objectives[0].captured, false);
    assert.equal(scanned.claimedCount, 0);
    assert.deepEqual(scanned.player, ordinary.player);
    assert.deepEqual(scanned.enemies, ordinary.enemies);
    const win = find('scan-clear', turnPolicy),
      noScan = find('no-scan-clear', turnPolicy);
    for (const key of ['tick', 'time', 'lives', 'score', 'coverage', 'objectives'])
      assert.deepEqual(win.expected[key], noScan.expected[key]);
    assert.ok(win.metrics.revealedBeforeCaptureTicks > 0);
    assert.equal(noScan.metrics.revealedBeforeCaptureTicks, 0);
    assert.equal(find('reverse-failure', turnPolicy).expected.failureCause, 'self-contact');
  }
});

test('supply and field prevent a real cable loss while an ordinary longer detour still clears', () => {
  assert.equal(
    scenarios[1].level.objectives[0].hidden,
    false,
    'The carrier has no scan; its teaching target is visible.',
  );
  for (const policy of ['immediate', 'grid-center']) {
    const win = find('supply-field-clear', policy),
      empty = find('empty-failure', policy),
      omitted = find('no-field-failure', policy),
      detour = find('ordinary-detour-clear', policy);
    assert.equal(win.metrics.stunnedEnemyTicks, 300);
    assert.ok(win.events.some((e) => e.type === 'pickup.collected' && e.ammo === 1));
    assert.ok(win.events.some((e) => e.type === 'ability.used' && e.ammo === 0));
    for (const failed of [empty, omitted]) {
      assert.equal(failed.expected.failureCause, 'enemy-trail');
      assert.equal(failed.expected.tick, 195);
      assert.equal(failed.metrics.stunnedEnemyTicks, 0);
    }
    assert.ok(empty.events.some((e) => e.type === 'ability.rejected' && e.reason === 'empty'));
    assert.equal(detour.expected.won, true);
    assert.ok(detour.expected.time > win.expected.time);
    assert.ok(!detour.events.some((e) => ['ability.used', 'pickup.collected'].includes(e.type)));
  }
});

test('Fiber has signal resistance but still loses an overlong cable; ordinary interference is real', () => {
  for (const policy of ['immediate', 'grid-center']) {
    const win = find('fiber-clear', policy),
      cable = find('cable-failure', policy),
      ordinary = find('ordinary-signal-failure', policy);
    assert.equal(win.metrics.resistantTicks, 144);
    assert.equal(win.metrics.slowedTicks, 0);
    assert.equal(win.metrics.scanFacts[0].signal.abilityBlocked, false);
    assert.equal(win.metrics.scanFacts[0].signal.boostBlocked, false);
    assert.equal(cable.expected.failureCause, 'cable-limit');
    assert.ok(cable.metrics.resistantTicks > 0);
    assert.equal(ordinary.expected.failureCause, 'cut-timeout');
    assert.ok(ordinary.metrics.slowedTicks > 0);
    assert.ok(
      ordinary.events.some(
        (e) => e.type === 'ability.rejected' && e.reason === 'signal-interference',
      ),
    );
  }
});

test('proof rejects changed source recipes, missing/duplicate routes and substituted identities', async () => {
  const changed = structuredClone(scenarios);
  changed[1].level.enemies[0].vx = -1;
  await assert.rejects(
    verifyTacticalTeaching({ scenarios: changed, proof }),
    /Exact pinned teaching/,
  );
  const missing = structuredClone(proof);
  missing.routes.pop();
  await assert.rejects(verifyTacticalTeaching({ scenarios, proof: missing }));
  const duplicate = structuredClone(proof);
  duplicate.routes[1] = duplicate.routes[0];
  await assert.rejects(verifyTacticalTeaching({ scenarios, proof: duplicate }));
  const foreign = structuredClone(proof);
  foreign.routes[0].campaignKey = 'foreign/1/unknown';
  await assert.rejects(verifyTacticalTeaching({ scenarios, proof: foreign }));
});

test('proof refuses edited commands, fabricated verdicts and altered saved continuation evidence', async () => {
  const command = structuredClone(proof);
  command.routes[0].segments[0].input.action = false;
  await assert.rejects(verifyTacticalTeaching({ scenarios, proof: command }));
  const verdict = structuredClone(proof);
  verdict.routes[0].expected.score++;
  await assert.rejects(verifyTacticalTeaching({ scenarios, proof: verdict }));
  const saved = structuredClone(proof);
  saved.routes[0].savedPrefix.sessionSha256 = '0'.repeat(64);
  await assert.rejects(verifyTacticalTeaching({ scenarios, proof: saved }));
});
