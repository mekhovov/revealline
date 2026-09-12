import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateScenario, scenarioMasteryCampaign } from '../content.mjs';
import { prepareScenario } from '../imports.mjs';
import { STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN, masteryDefinitionIdentity } from '../mastery.mjs';
import { resolveMasteryContext } from '../mastery-catalog.mjs';
import { preparePack, emptyPackLibrary, resolvePackCampaign } from '../packs.mjs';
import {
  entryScenario,
  expansionFromScenario,
  prepareDocument,
  withScenarioMastery,
  editScenario,
  entryMastery,
  interactionPreset,
} from '../playground/model.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = read('../content/packs/homeward-skies.json');
const copy = (value) => structuredClone(value);
const goals = [STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN];
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const scenario = (definition = SUPPLY_LINE) => ({
  format: 'xonix-playground.v2',
  masteryDefinition: copy(definition),
  level: copy(source.campaigns[0].levels.find((level) => level.id === definition.levelId)),
  theme: copy(source.themes[0]),
  classRecipes: copy(source.classRecipes),
  settings: { classId: 'bomber', turnPolicy: 'immediate', seed: 1 },
  visualOverrides: {},
});
const authoredPack = () => ({
  ...copy(source),
  visualOverrides: {},
  levelVisuals: [],
  format: 'xonix-pack.v2',
  masteries: copy(goals),
});

for (const goal of goals)
  test(`${goal.id}: explicit scenario retains its definition and resolves a separate practice context`, async () => {
    const value = scenario(goal),
      before = copy(value);
    assert.equal(validateScenario(value).valid, true);
    const prepared = await prepareScenario(value);
    assert.deepEqual(prepared.scenario.masteryDefinition, before.masteryDefinition);
    const registration = resolveMasteryContext({
      campaign: scenarioMasteryCampaign(prepared.scenario),
      definition: prepared.scenario.masteryDefinition,
    });
    assert.equal(registration.definitionIdentity, masteryDefinitionIdentity(goal));
    assert.notEqual(registration.campaignKey, 'homeward-skies/1/0d01f5687b3c38ff');
    prepared.scenario.masteryDefinition.name = 'Edited copy';
    assert.deepEqual(value, before);
  });

test('v1 remains strict and v2 requires an explicit definition or null', async () => {
  const value = scenario();
  value.format = 'xonix-playground.v1';
  assert.equal(validateScenario(value).valid, false);
  delete value.masteryDefinition;
  assert.equal(validateScenario(value).valid, true);
  assert.equal((await prepareScenario(value)).scenario.format, 'xonix-playground.v1');
  value.format = 'xonix-playground.v2';
  assert.equal(validateScenario(value).valid, false);
  value.masteryDefinition = null;
  assert.equal(validateScenario(value).valid, true);
  assert.equal((await prepareScenario(value)).scenario.masteryDefinition, null);
});

test('wrong references, unsupported rules and unavailable equipment fail before decoding', async () => {
  const changes = [
    (v) => {
      v.masteryDefinition.levelId = 'wrong-map';
    },
    (v) => {
      v.masteryDefinition.all[0].padIds[0] = 'missing-pad';
    },
    (v) => {
      v.masteryDefinition.all[1].regions[0].zoneId = 'missing-zone';
    },
    (v) => {
      v.masteryDefinition.all[2].hangarId = 'missing-hangar';
    },
    (v) => {
      v.masteryDefinition.all.push({ type: 'execute-script' });
    },
    (v) => {
      v.classRecipes = v.classRecipes.filter((recipe) => recipe.id === 'bomber');
    },
  ];
  for (const change of changes) {
    const value = scenario();
    value.visualOverrides.background = { dataUrl: png };
    change(value);
    let calls = 0;
    await assert.rejects(
      prepareScenario(value, {
        decodeImage: async () => {
          calls++;
          return { naturalWidth: 1, naturalHeight: 1 };
        },
      }),
    );
    assert.equal(calls, 0);
  }
});

test('getters never execute and in-flight goal/image ownership is stable', async () => {
  const hostile = scenario();
  let reads = 0;
  Object.defineProperty(hostile.masteryDefinition, 'name', {
    enumerable: true,
    get() {
      reads++;
      return 'Read';
    },
  });
  assert.equal(validateScenario(hostile).valid, false);
  assert.equal(reads, 0);
  const value = scenario(),
    before = copy(value.masteryDefinition);
  value.visualOverrides.background = { dataUrl: png };
  let finish;
  const pending = prepareScenario(value, {
    decodeImage: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  value.masteryDefinition.all[0].padIds[0] = 'changed-after-validation';
  finish({ naturalWidth: 1, naturalHeight: 1 });
  assert.deepEqual((await pending).scenario.masteryDefinition, before);
});

test('presentation changes retain the goal; deleting a referenced object rejects a loose-map edit', async () => {
  const value = scenario();
  value.theme.palette.accent = '#aabbcc';
  value.visualOverrides.background = { dataUrl: png, fit: 'contain' };
  value.presentation = { style: 'microtile', showGrid: true };
  assert.equal(validateScenario(value).valid, true);
  const level = copy(value.level);
  level.supplies = [];
  let calls = 0;
  await assert.rejects(
    prepareDocument(level, {
      current: value,
      packLibrary: emptyPackLibrary(),
      decodeImage: async () => {
        calls++;
      },
    }),
  );
  assert.equal(calls, 0);
  assert.equal(value.level.supplies.length, 2);
});

test('explicit goals and explicit absence survive pack selection and a retargeted one-map export', async () => {
  const pack = (await preparePack(authoredPack())).pack;
  const entry = resolvePackCampaign(pack, source.campaigns[0].id);
  for (const goal of goals) {
    const current = entryScenario(entry, goal.levelId);
    assert.equal(current.format, 'xonix-playground.v2');
    assert.equal(current.masteryDefinition.id, goal.id);
    const exported = expansionFromScenario(current);
    assert.equal(exported.format, 'xonix-pack.v2');
    assert.equal(exported.masteries[0].campaignId, current.level.id);
    assert.equal(current.masteryDefinition.campaignId, 'homeward-skies');
    const restored = await prepareDocument(exported, { packLibrary: emptyPackLibrary() });
    assert.equal(restored.scenario.masteryDefinition.campaignId, current.level.id);
  }
  const blank = authoredPack();
  blank.masteries = [];
  const prepared = await prepareDocument(blank, { packLibrary: emptyPackLibrary() });
  assert.equal(prepared.scenario.masteryDefinition, null);
  assert.deepEqual(expansionFromScenario(prepared.scenario).masteries, []);
});

test('copying a source goal creates an independent editable preview and explicit absence never falls back', async () => {
  const original = copy(source);
  original.visualOverrides = {};
  original.levelVisuals = [];
  const pack = (await preparePack(original)).pack;
  const entry = resolvePackCampaign(pack, source.campaigns[0].id);
  const legacy = entryScenario(entry, SUPPLY_LINE.levelId);
  assert.equal(legacy.format, 'xonix-playground.v1');
  const definition = entryMastery(entry, SUPPLY_LINE.levelId);
  assert.equal(definition, SUPPLY_LINE);
  const current = withScenarioMastery(legacy, definition);
  current.masteryDefinition.name = 'My supply goal';
  assert.equal(definition.name, SUPPLY_LINE.name);
  assert.equal(Object.hasOwn(legacy, 'masteryDefinition'), false);
  const noGoal = withScenarioMastery(current, null);
  assert.equal(noGoal.format, 'xonix-playground.v2');
  assert.equal(noGoal.masteryDefinition, null);
  const v2 = authoredPack();
  v2.masteries = [];
  const explicit = resolvePackCampaign((await preparePack(v2)).pack, v2.campaigns[0].id);
  assert.equal(entryMastery(explicit, SUPPLY_LINE.levelId), null);
});

test('editor changes validate a complete goal context before adoption, while preset maps explicitly start without one', () => {
  const current = scenario(),
    before = copy(current);
  const invalid = copy(current.level);
  invalid.hangars = [];
  assert.throws(() => editScenario(current, { level: invalid }));
  assert.deepEqual(current, before);
  const changed = editScenario(current, {
    level: { ...current.level, rules: { ...current.level.rules, lives: 5 } },
  });
  assert.equal(changed.level.rules.lives, 5);
  assert.deepEqual(changed.masteryDefinition, before.masteryDefinition);
  const preset = interactionPreset('fiber', current, current.classRecipes);
  assert.equal(preset.format, 'xonix-playground.v2');
  assert.equal(preset.masteryDefinition, null);
  assert.equal(validateScenario(preset).valid, true);
  assert.deepEqual(current, before);
});
