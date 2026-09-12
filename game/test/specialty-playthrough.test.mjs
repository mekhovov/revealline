import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadSpecialtyPack,
  replaySpecialtyRoute,
  verifySpecialtyRoutes,
} from '../../scripts/verify-specialty.mjs';
import { preparePack, scenarioFromPack } from '../packs.mjs';
import { validateScenario } from '../content.mjs';
import { verifyReplay } from '../replay.mjs';

const pack = await loadSpecialtyPack();
const proof = JSON.parse(
  await readFile(new URL('../replays/fieldcraft-routes.json', import.meta.url), 'utf8'),
);

test('Fieldcraft verifies every loadout, both turn modes and positive role benefits against action-omission controls', async () => {
  const result = await verifySpecialtyRoutes();
  assert.equal(result.verified, 70);
  assert.equal(result.fallbackClears, 56);
  assert.equal(result.roleClears, 8);
  assert.equal(result.actionOmissionComparisons, 6);
  for (const mode of ['immediate', 'grid-center'])
    for (const level of pack.campaigns[0].levels)
      for (const recipe of pack.classRecipes)
        assert.ok(
          proof.routes.some(
            (route) =>
              route.variant === 'fallback' &&
              route.levelId === level.id &&
              route.classId === recipe.id &&
              route.turnPolicy === mode &&
              route.expected.won,
          ),
        );
});

test('the actual Fieldcraft pack imports with every class selectable and bounded, visible instructions', async () => {
  const { pack: prepared } = await preparePack(pack);
  assert.equal(
    prepared.campaigns[0].classIds,
    undefined,
    'Recommendations are not fake ability gates.',
  );
  for (const level of prepared.campaigns[0].levels) {
    assert.match(level.metadata.description, /^Recommended:/);
    for (const recipe of prepared.classRecipes) {
      const scenario = scenarioFromPack(prepared, 'fieldcraft', level.id, {
        classId: recipe.id,
        turnPolicy: 'grid-center',
      });
      assert.equal(validateScenario(scenario).valid, true);
      assert.equal(scenario.settings.classId, recipe.id);
    }
  }
});

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: pulse and net save an exposed cable that identical input without action loses`, () => {
    for (const [levelId, classId] of [
      ['fieldcraft-03', 'impact'],
      ['fieldcraft-04', 'trapper'],
    ]) {
      const role = proof.routes.find(
        (route) =>
          route.levelId === levelId && route.turnPolicy === policy && route.variant === 'specialty',
      );
      const control = proof.routes.find(
        (route) =>
          route.levelId === levelId &&
          route.turnPolicy === policy &&
          route.variant === 'without-action',
      );
      const actual = replaySpecialtyRoute(pack, role);
      assert.equal(actual.replay.summary.classId, classId);
      assert.equal(actual.replay.summary.won, true);
      assert.equal(actual.replay.summary.lives, 3);
      assert.ok(role.events.some((event) => event.type === 'ability.used'));
      const failure = control.events.find((event) => event.type === 'player.failed');
      assert.equal(failure.cause, 'enemy-trail');
      assert.ok(Math.abs(failure.time - 1.05) < 1e-7);
      assert.ok(control.expected.lives < actual.replay.summary.lives);
      assert.equal(
        verifyReplay(actual.replay).match,
        true,
        'The route is a portable player replay.',
      );
    }
  });
}

test('specialty evidence rejects stale hazards and substituted inputs instead of accepting a merely successful picture reveal', () => {
  const route = proof.routes.find(
    (route) => route.variant === 'specialty' && route.classId === 'trapper',
  );
  const noNet = structuredClone(route);
  for (const segment of noNet.segments) segment.input.action = false;
  assert.throws(() => replaySpecialtyRoute(pack, noNet));
  const changed = structuredClone(pack);
  changed.campaigns[0].levels[3].enemies[0].vx = 0;
  assert.throws(() => replaySpecialtyRoute(changed, route), /map changed/);
});
