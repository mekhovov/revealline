import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignKey, boardIdentity } from '../library.mjs';
import { CLASSES, RULESET, rosterHash } from '../core/registry.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  STEADY_SIGNAL,
  SUPPLY_LINE,
  SAFE_RETURN,
  masteryDefinitionIdentity,
  resolveMasteryDefinition,
} from '../mastery.mjs';
import {
  BUILTIN_MASTERY_REGISTRATIONS,
  MASTERY_CATALOG_LIMITS,
  builtinMasteryRegistration,
  resolveMasteryContext,
  createMasteryCatalog,
} from '../mastery-catalog.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/homeward-skies.json', import.meta.url), 'utf8'),
);
const base = JSON.parse(
  await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
);
const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const definitions = [STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN],
  clone = (value) => structuredClone(value);
const entry = (sourcePackId = 'original', masteries, selectedCampaign = campaign) => ({
  sourcePackId,
  campaign: clone(selectedCampaign),
  ...(masteries === undefined
    ? {}
    : { sourcePackFormat: 'xonix-pack.v2', masteries: clone(masteries) }),
});
const context = (definition = SUPPLY_LINE, selectedCampaign = campaign) =>
  resolveMasteryContext({ campaign: selectedCampaign, definition });

test('all three exact frozen fallback definitions retain their original references and hashes', () => {
  assert.ok(Object.isFrozen(BUILTIN_MASTERY_REGISTRATIONS));
  const expected = [
    ['homeward-01', 'level-v1-5983ec4eaf745012', 'mastery-v1-2e6aae3f42f3d3c2'],
    ['homeward-02', 'level-v1-f1c1d86b070b5419', 'mastery-v1-a3ffbfe068645ff0'],
    ['homeward-03', 'level-v1-03b703a6160004fc', 'mastery-v1-197b5a9a9370f0f2'],
  ];
  for (let i = 0; i < expected.length; i++) {
    const [levelId, levelIdentity, definitionIdentity] = expected[i];
    const value = builtinMasteryRegistration(campaignKey(campaign), levelId);
    assert.equal(value.definition, definitions[i]);
    assert.equal(value.levelIdentity, levelIdentity);
    assert.equal(value.definitionIdentity, definitionIdentity);
    assert.ok(Object.isFrozen(value));
    assert.ok(Object.isFrozen(value.definition.all));
  }
  assert.equal(builtinMasteryRegistration('other', 'homeward-01'), null);
  assert.equal(builtinMasteryRegistration(campaignKey(campaign), 'missing'), null);
});

test('context metadata uses exactly existing campaign, normalized level and roster identities', () => {
  for (const definition of definitions) {
    const before = JSON.stringify(campaign),
      result = context(definition);
    const level = campaign.levels.find((item) => item.id === definition.levelId);
    assert.equal(result.campaignKey, campaignKey(campaign));
    assert.equal(result.levelIdentity, `level-v1-${dataIdentity(normalizedLevel(level))}`);
    assert.equal(result.rosterHash, rosterHash(campaign.classRecipes));
    assert.equal(result.ruleset, RULESET);
    assert.equal(result.levelRevision, level.revision);
    assert.equal(result.definitionIdentity, masteryDefinitionIdentity(definition));
    assert.deepEqual(result.definition, resolveMasteryDefinition(definition));
    assert.equal(
      JSON.stringify(campaign),
      before,
      'Source maps and roster were not normalized in place.',
    );
    assert.ok(Object.isFrozen(result.definition.all));
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        'campaignKey',
        'levelId',
        'levelIdentity',
        'levelRevision',
        'rosterHash',
        'ruleset',
        'definition',
        'definitionIdentity',
      ].sort(),
    );
  }
});

test('classIds filtering preserves source recipe order and exactly matches library campaignKey', () => {
  const source = clone(campaign);
  source.classIds = ['carrier', 'bomber'];
  const filtered = {
    ...source,
    classRecipes: source.classRecipes.filter((recipe) => source.classIds.includes(recipe.id)),
  };
  const result = context(SUPPLY_LINE, source);
  assert.equal(result.campaignKey, campaignKey(filtered));
  assert.equal(result.rosterHash, rosterHash(filtered.classRecipes));
  assert.deepEqual(
    context(SUPPLY_LINE, filtered),
    result,
    'Already filtered callers use the same identity.',
  );
  assert.notEqual(
    result.campaignKey,
    campaignKey(source),
    'Unfiltered extra recipes must not enter the effective board identity.',
  );
  source.classIds.reverse();
  assert.deepEqual(context(SUPPLY_LINE, source), result);
  const board = {
    campaign: filtered,
    level: filtered.levels[1],
    recipe: filtered.classRecipes[0],
    turnPolicy: 'immediate',
    seed: 1,
  };
  const before = boardIdentity(board);
  context(SUPPLY_LINE, source);
  assert.equal(boardIdentity(board), before);
});

test('omitted recipes use exact library/core defaults and the base campaign is accepted as a legacy entry', () => {
  const source = clone(campaign);
  delete source.classRecipes;
  assert.equal(context(STEADY_SIGNAL, source).campaignKey, campaignKey(source));
  assert.equal(context(STEADY_SIGNAL, source).rosterHash, rosterHash(CLASSES));
  const catalog = createMasteryCatalog([entry(null, undefined, base)]);
  assert.deepEqual(catalog.registrations, []);
  assert.equal(catalog.get(campaignKey(base), base.levels[0].id), null);
});

test('references resolve only in the definition owning map and campaign', () => {
  const edits = [
    [
      STEADY_SIGNAL,
      (d) => {
        d.all[1].zoneId = 'west-emitter';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.levelId = 'homeward-01';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[0].padIds[0] = 'north-relay';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[1].regions[0].zoneId = 'west-supply';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[2].hangarId = 'home-hangar';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[2].classId = 'missing';
      },
    ],
    [
      SAFE_RETURN,
      (d) => {
        d.all[1].actorId = 'recovery-relay';
      },
    ],
    [
      SAFE_RETURN,
      (d) => {
        d.campaignId = 'another';
      },
    ],
  ];
  for (const [definition, edit] of edits) {
    const changed = clone(definition);
    edit(changed);
    assert.throws(() => context(changed));
  }
  const foreign = clone(campaign);
  foreign.id = 'another';
  assert.throws(() => context(SAFE_RETURN, foreign), /another campaign/);
});

test('capabilities use the filtered actual roster rather than equipment names or omitted pack recipes', () => {
  for (const [definition, classIds, message] of [
    [STEADY_SIGNAL, ['scout', 'interceptor'], /signal-resistant/],
    [SAFE_RETURN, ['scout', 'fiber'], /impact-pulse/],
    [SUPPLY_LINE, ['carrier'], /distinct switchable/],
    [SUPPLY_LINE, ['scout', 'impact'], /target/],
  ])
    assert.throws(() => context(definition, { ...clone(campaign), classIds }), message);
  const noSupply = clone(campaign);
  noSupply.classRecipes = noSupply.classRecipes.filter((recipe) =>
    ['scout', 'impact'].includes(recipe.id),
  );
  const definition = clone(SUPPLY_LINE);
  definition.all[2].classId = 'scout';
  assert.throws(() => context(definition, noSupply), /supply-consuming/);
  const noSuppression = clone(campaign);
  noSuppression.classRecipes = noSuppression.classRecipes.filter((recipe) =>
    ['scout', 'trapper'].includes(recipe.id),
  );
  definition.all[2].classId = 'trapper';
  assert.throws(() => context(definition, noSuppression), /suppress signal/);
  const hybrid = { ...clone(campaign), classIds: ['trapper', 'impact'] };
  assert.equal(
    context(definition, hybrid).definition.all[2].classId,
    'trapper',
    'Separate supply and suppression recipes are structurally valid.',
  );
});

test('a collision-safe normalized default hangar resolves without being materialized into authored data', () => {
  const source = clone(campaign),
    level = source.levels[1];
  delete level.hangars;
  level.supplies[0].id = 'home-hangar';
  const definition = clone(SUPPLY_LINE);
  definition.all[0].padIds[0] = 'home-hangar';
  definition.all[2].hangarId = 'home-hangar-1';
  const result = context(definition, source);
  assert.equal(result.campaignKey, campaignKey(source));
  assert.equal(Object.hasOwn(level, 'hangars'), false);
  definition.all[2].hangarId = 'home-hangar';
  assert.throws(() => context(definition, source), /reference/);
});

test('a border patrol is not an impact actor even if its ID matches', () => {
  const source = clone(campaign);
  source.levels[2].enemies[0] = {
    id: 'cable-cutter',
    type: 'border-patrol',
    x: 0.5,
    y: 18.5,
    speed: 1,
  };
  assert.throws(() => context(SAFE_RETURN, source), /actor/);
});

test('legacy v1 chooses exact fallback while explicit v2 omission means no goal', () => {
  const legacy = createMasteryCatalog([entry()]),
    explicit = createMasteryCatalog([entry('opt-out', [])]);
  assert.equal(legacy.registrations.length, 3);
  assert.equal(explicit.registrations.length, 0);
  for (const definition of definitions) {
    assert.equal(legacy.get(campaignKey(campaign), definition.levelId).definition, definition);
    assert.equal(explicit.get(campaignKey(campaign), definition.levelId), null);
  }
  const partial = createMasteryCatalog([entry('partial', [SAFE_RETURN])]);
  assert.equal(partial.get(campaignKey(campaign), STEADY_SIGNAL.levelId), null);
  assert.equal(
    partial.get(campaignKey(campaign), SAFE_RETURN.levelId).definition.id,
    SAFE_RETURN.id,
  );
  assert.equal(legacy.get(null, 'homeward-01'), null);
});

test('same textual campaign/map IDs with changed level content do not inherit fallback', () => {
  const source = clone(campaign);
  source.levels[0].metadata.description += ' Revised.';
  const catalog = createMasteryCatalog([entry('changed', undefined, source)]);
  assert.notEqual(campaignKey(source), campaignKey(campaign));
  assert.deepEqual(catalog.registrations, []);
});

test('identical canonical explicit and fallback declarations share a board in either source order', () => {
  const explicit = entry('authored', definitions);
  explicit.masteries[1].all.reverse();
  for (const entries of [
    [entry(), explicit],
    [explicit, entry()],
  ]) {
    const catalog = createMasteryCatalog(entries);
    assert.equal(catalog.registrations.length, 3);
    for (const definition of definitions)
      assert.equal(
        catalog.get(campaignKey(campaign), definition.levelId).definitionIdentity,
        masteryDefinitionIdentity(definition),
      );
  }
});

test('conflicts include definition versus none and changed definitions with both sources named', () => {
  const changed = clone(definitions);
  changed[1].all[1].regions[0].minCells++;
  for (const sources of [
    [entry('original'), entry('disabled', [])],
    [entry('first', definitions), entry('revised', changed)],
  ]) {
    assert.throws(
      () => createMasteryCatalog(sources),
      (error) => {
        assert.match(error.message, /Conflicting mastery/);
        assert.ok(error.message.includes(sources[0].sourcePackId));
        assert.ok(error.message.includes(sources[1].sourcePackId));
        assert.match(error.message, /homeward-0[12]/);
        return true;
      },
    );
  }
});

test('same-id replacement is an explicit prospective set and removed declarations do not survive', () => {
  const original = createMasteryCatalog([entry('replace-me')]);
  const replacement = createMasteryCatalog([entry('replace-me', [])]);
  assert.equal(original.registrations.length, 3);
  assert.equal(replacement.registrations.length, 0);
  assert.throws(
    () => createMasteryCatalog([entry('replace-me'), entry('replace-me', [])]),
    /Conflicting/,
  );
  assert.equal(
    createMasteryCatalog([entry('replace-me')]).registrations.length,
    3,
    'Reinstalling v1 restores only the pinned fallback.',
  );
});

test('data limits and exact source semantics reject malformed entries before any adopted catalog exists', () => {
  const invalid = [null, {}, [null], [entry('bad', definitions)]];
  invalid[3][0].sourcePackFormat = 'xonix-pack.v3';
  const withV1 = entry();
  withV1.masteries = [];
  invalid.push([withV1]);
  const missing = entry();
  missing.sourcePackFormat = 'xonix-pack.v2';
  invalid.push([missing]);
  const nullFormat = entry();
  nullFormat.sourcePackFormat = null;
  invalid.push([nullFormat]);
  const extra = entry();
  extra.visualOverrides = {};
  invalid.push([extra]);
  const duplicate = entry('duplicate', [STEADY_SIGNAL, STEADY_SIGNAL]);
  invalid.push([duplicate]);
  const wrongCampaign = entry();
  wrongCampaign.campaign.extra = true;
  invalid.push([wrongCampaign]);
  const duplicateMap = entry();
  duplicateMap.campaign.levels.push(clone(duplicateMap.campaign.levels[0]));
  invalid.push([duplicateMap]);
  const malformedRoster = entry();
  malformedRoster.campaign.classIds = ['fiber', 'fiber'];
  invalid.push([malformedRoster]);
  for (const candidate of invalid) assert.throws(() => createMasteryCatalog(candidate));
  assert.throws(
    () =>
      createMasteryCatalog(
        Array.from({ length: MASTERY_CATALOG_LIMITS.entries + 1 }, () => entry()),
      ),
    /too many campaign/,
  );
});

test('all descriptor boundaries reject throwing getters without executing them', () => {
  let invoked = 0;
  for (const make of [
    () => {
      const item = entry('authored', definitions);
      Object.defineProperty(item, 'sourcePackFormat', {
        enumerable: true,
        get() {
          invoked++;
          throw Error('getter');
        },
      });
      return item;
    },
    () => {
      const item = entry();
      Object.defineProperty(item.campaign, 'classRecipes', {
        enumerable: true,
        get() {
          invoked++;
          throw Error('getter');
        },
      });
      return item;
    },
    () => {
      const item = entry('authored', definitions);
      Object.defineProperty(item.masteries[0], 'version', {
        enumerable: true,
        get() {
          invoked++;
          throw Error('getter');
        },
      });
      return item;
    },
    () => {
      const item = entry();
      Object.defineProperty(item.campaign.levels[0].spawn, 'x', {
        enumerable: true,
        get() {
          invoked++;
          throw Error('getter');
        },
      });
      return item;
    },
  ])
    assert.throws(() => createMasteryCatalog([make()]));
  assert.equal(invoked, 0);
});

test('catalog ownership survives caller mutation and returned metadata is deeply immutable', () => {
  const candidate = entry('authored', definitions),
    catalog = createMasteryCatalog([candidate]);
  const registration = catalog.get(campaignKey(campaign), 'homeward-02');
  candidate.masteries[1].all[0].padIds.pop();
  candidate.campaign.levels[1].id = 'changed';
  assert.equal(registration.definition.all[0].padIds.length, 2);
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.registrations));
  assert.ok(Object.isFrozen(registration));
  assert.ok(Object.isFrozen(registration.definition.all[1].regions[0]));
  assert.throws(() => {
    registration.definition.name = 'changed';
  }, TypeError);
  assert.equal(catalog.get(campaignKey(campaign), 'homeward-02'), registration);
});

test('normal null-prototype JSON works while sparse arrays, cycles, hidden fields and arbitrary prototypes reject', () => {
  const value = Object.assign(Object.create(null), entry());
  value.campaign = Object.assign(Object.create(null), value.campaign);
  assert.equal(createMasteryCatalog([value]).registrations.length, 3);
  const sparse = [entry(), entry()];
  delete sparse[0];
  assert.throws(() => createMasteryCatalog(sparse));
  const cyclic = entry();
  cyclic.campaign.levels[0].metadata.loop = cyclic;
  assert.throws(() => createMasteryCatalog([cyclic]));
  const hidden = entry();
  Object.defineProperty(hidden, 'hidden', { value: 1 });
  assert.throws(() => createMasteryCatalog([hidden]));
  const exotic = entry();
  Object.setPrototypeOf(exotic.campaign, { inherited: true });
  assert.throws(() => createMasteryCatalog([exotic]));
});

test('the complete old installed-library campaign count is supported without an arbitrary lower cap', () => {
  const values = Array.from({ length: 96 }, (_, i) => entry(`source-${i}`, undefined, base));
  assert.deepEqual(createMasteryCatalog(values).registrations, []);
});
