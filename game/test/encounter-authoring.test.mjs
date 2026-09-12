import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  prepareDocument,
  entryScenario,
  editScenario,
  withScenarioEncounter,
  withoutScenarioEncounter,
  withScenarioMastery,
  expansionFromScenario,
  interactionPreset,
  paintLevel,
} from '../playground/model.mjs';
import { emptyPackLibrary, exportPackLibrary, validatePack } from '../packs.mjs';
import { validateScenario } from '../content.mjs';
const pack = JSON.parse(
  await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url), 'utf8'),
);
const noImage = async () => {
  throw new Error('No artwork should decode');
};
const prepared = await prepareDocument(pack, {
  packLibrary: emptyPackLibrary(),
  decodeImage: noImage,
});
const initial = prepared.scenario;

test('new encounter pack, library, loose level and practice export share exact validated rules', async () => {
  assert.equal(initial.format, 'xonix-playground.v3');
  assert.equal(initial.masteryDefinition, null);
  const library = await prepareDocument(exportPackLibrary(prepared.packLibrary), {
    packLibrary: emptyPackLibrary(),
    decodeImage: noImage,
  });
  assert.deepEqual(library.scenario, initial);
  const loose = await prepareDocument(initial.level, {
    current: initial,
    packLibrary: emptyPackLibrary(),
    decodeImage: noImage,
  });
  assert.deepEqual(loose.scenario, initial);
  const exported = expansionFromScenario(initial);
  assert.equal(exported.format, 'xonix-pack.v3');
  assert.equal(exported.engine, 'xonix-core.v3');
  assert.deepEqual(exported.masteries, []);
  assert.deepEqual(exported.campaigns[0].levels[0].encounter, initial.level.encounter);
  assert.equal(validatePack(exported).valid, true);
  const again = await prepareDocument(exported, {
    packLibrary: emptyPackLibrary(),
    decodeImage: noImage,
  });
  assert.deepEqual(again.scenario.level.encounter, initial.level.encounter);
});

test('all four presentation choices and both steering policies preserve the encounter', () => {
  for (const theme of pack.themes)
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const selected = entryScenario(prepared.entries[0], undefined, {
        classId: 'fiber',
        turnPolicy,
      });
      const edited = editScenario(selected, {
        theme,
        presentation: { style: 'microtile', showGrid: true },
      });
      assert.deepEqual(edited.level, initial.level);
      assert.equal(edited.settings.turnPolicy, turnPolicy);
      assert.equal(edited.settings.classId, 'fiber');
      assert.deepEqual(edited.masteryDefinition, null);
    }
});

test('bounded timing and reference edits adopt atomically and retain an independent undo value', () => {
  const before = structuredClone(initial);
  const descriptor = {
    ...initial.level.encounter,
    exposed: { ...initial.level.encounter.exposed, openTicks: 600 },
  };
  const next = withScenarioEncounter(initial, descriptor);
  descriptor.exposed.openTicks = 1;
  assert.equal(next.level.encounter.exposed.openTicks, 600);
  for (const invalid of [
    { ...initial.level.encounter, shieldObjectiveId: 'missing' },
    { ...initial.level.encounter, enemyId: 'not-the-sentinel' },
    { ...initial.level.encounter, minReleaseCutCells: 0 },
    { ...initial.level.encounter, transitionTicks: 1.5 },
    {
      ...initial.level.encounter,
      exposed: { ...initial.level.encounter.exposed, openTicks: 7201 },
    },
  ])
    assert.throws(() => withScenarioEncounter(initial, invalid));
  assert.deepEqual(initial, before);
  assert.equal(validateScenario(before).valid, true);
});

test('broken painting cannot silently erase mandatory relay/core or add another field seed', () => {
  const before = structuredClone(initial);
  for (const [brush, x, y] of [
    ['erase', 8, 8],
    ['erase', 34, 18],
    ['enemy', 10, 10],
    ['wall', 34, 18],
  ])
    assert.throws(() => paintLevel(initial.level, brush, x, y));
  assert.deepEqual(initial, before);
  const painted = paintLevel(initial.level, 'supply', 0, 9);
  assert.deepEqual(painted.encounter, initial.level.encounter);
});

test('explicit ordinary conversion removes the staged seed, keeps objectives and can be undone', () => {
  const before = structuredClone(initial);
  const converted = withoutScenarioEncounter(initial);
  assert.equal(converted.format, 'xonix-playground.v2');
  assert.equal(converted.level.version, 'xonix-level.v1');
  assert.equal(Object.hasOwn(converted.level, 'encounter'), false);
  assert.equal(converted.level.enemies.length, 0);
  assert.deepEqual(converted.level.objectives, initial.level.objectives);
  assert.deepEqual(converted.theme, initial.theme);
  assert.equal(validateScenario(converted).valid, true);
  assert.equal(expansionFromScenario(converted).engine, 'xonix-core.v2');
  assert.deepEqual(initial, before);
  assert.equal(validateScenario(before).valid, true);
});

test('encounter envelopes reject mismatched levels and optional goal claims before media decode', async () => {
  const before = structuredClone(initial);
  for (const format of ['xonix-playground.v1', 'xonix-playground.v2'])
    assert.equal(validateScenario({ ...initial, format }).valid, false);
  const ordinary = withoutScenarioEncounter(initial);
  assert.equal(validateScenario({ ...ordinary, format: 'xonix-playground.v3' }).valid, false);
  const missing = structuredClone(initial);
  delete missing.masteryDefinition;
  assert.equal(validateScenario(missing).valid, false);
  assert.throws(() => withScenarioMastery(initial, { name: 'invented goal' }));
  assert.deepEqual(withScenarioMastery(initial, null), initial);
  await assert.rejects(
    prepareDocument(missing, {
      current: initial,
      packLibrary: emptyPackLibrary(),
      decodeImage: noImage,
    }),
    /masteryDefinition/,
  );
  assert.deepEqual(initial, before);
});

test('ordinary interaction presets explicitly replace new encounter rules and remain valid', () => {
  for (const kind of ['fiber', 'bomber', 'impact']) {
    const next = interactionPreset(kind, initial, pack.classRecipes);
    assert.equal(next.format, 'xonix-playground.v2');
    assert.equal(next.level.version, 'xonix-level.v1');
    assert.equal(next.masteryDefinition, null);
    assert.equal(Object.hasOwn(next.level, 'encounter'), false);
    assert.equal(validateScenario(next).valid, true);
    assert.deepEqual(next.theme, initial.theme);
  }
});

test('explicit ordinary level import replaces the encounter envelope without corrupting the previous scenario', async () => {
  const before = structuredClone(initial);
  const ordinary = interactionPreset('fiber', initial, pack.classRecipes);
  const imported = await prepareDocument(ordinary.level, {
    current: initial,
    packLibrary: emptyPackLibrary(),
    decodeImage: noImage,
  });
  assert.equal(imported.scenario.format, 'xonix-playground.v2');
  assert.equal(imported.scenario.masteryDefinition, null);
  assert.deepEqual(imported.scenario.level, ordinary.level);
  assert.deepEqual(initial, before);
});
