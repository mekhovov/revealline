import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareCombatAuthoring } from '../content-design/combat-authoring.mjs';

function fixture(catalog) {
  const source = createStarterProject('guide-pressure-integration');
  source.actorCatalogId = catalog;
  source.difficultyCatalogId = 'journey-difficulty-v2';
  source.missions[0].actors[0].role = 'trail-pursuer';
  source.missions.push({
    ...structuredClone(source.missions[0]),
    id: 'sibling-pressure',
    actors: [{ ...source.missions[0].actors[0], role: 'heading-interceptor' }],
  });
  source.campaigns.push({
    ...structuredClone(source.campaigns[0]),
    id: 'sibling-campaign',
    missionIds: ['sibling-pressure'],
  });
  source.packs.push({
    ...structuredClone(source.packs[0]),
    id: 'sibling-pack',
    campaignIds: ['sibling-campaign'],
  });
  return source;
}

for (const catalog of ['journey-actors-v7', 'journey-actors-v8', 'journey-actors-v9'])
  test(`Guide preparation retains ${catalog} pressure, unrelated missions and compiler ownership`, () => {
    const source = fixture(catalog),
      before = structuredClone(source),
      prepared = prepareCombatAuthoring(source, 'nearby-shore'),
      old = compileContentProject(source),
      next = compileContentProject(prepared);
    assert.equal(
      prepared.actorCatalogId,
      catalog === 'journey-actors-v7' ? 'journey-actors-v8' : catalog,
    );
    assert.deepEqual(source, before);
    assert.deepEqual(prepared.maps, before.maps);
    assert.deepEqual(prepared.missions[1], before.missions[1]);
    assert.deepEqual(prepared.campaigns[1], before.campaigns[1]);
    assert.deepEqual(prepared.packs[1], before.packs[1]);
    assert.deepEqual(prepared.missions[0].combat, { version: 'mission-combat.v1', enabled: false });
    assert.equal(
      compileContentProject(next.source),
      next,
      'Owned immutable source keeps its cache.',
    );
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of ['solo', 'versus']) {
        const options = { difficulty, mode },
          original = resolveMission(old, 'nearby-shore', options),
          updated = resolveMission(next, 'nearby-shore', options);
        assert.deepEqual(updated.level.classic.enemyPressure, original.level.classic.enemyPressure);
        assert.deepEqual(updated.level.enemies, original.level.enemies);
        assert.deepEqual(
          resolveMission(next, 'sibling-pressure', options),
          resolveMission(old, 'sibling-pressure', options),
        );
      }
    for (const actorCatalogId of ['journey-actors-v7', 'journey-actors-v99'])
      assert.throws(() => compileContentProject({ ...prepared, actorCatalogId }));
    const mutable = structuredClone(prepared);
    compileContentProject(mutable);
    mutable.missions[0].combat.enabled = 'not-a-boolean';
    assert.throws(
      () => compileContentProject(mutable),
      'Mutable imports cannot reuse cached validation.',
    );
  });
