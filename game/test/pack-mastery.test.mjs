import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PACK_VERSION,
  MASTERY_PACK_VERSION,
  PACK_LIBRARY_VERSION,
  PACK_LIMITS,
  validatePack,
  preparePack,
  emptyPackLibrary,
  installPack,
  removePack,
  exportPackLibrary,
  importPackLibrary,
  resolvePackCampaign,
  scenarioFromPack,
} from '../packs.mjs';
import { validateScenario } from '../content.mjs';
import { normalizedLevel } from '../core/level.mjs';
import {
  STEADY_SIGNAL,
  SUPPLY_LINE,
  SAFE_RETURN,
  resolveMasteryDefinition,
  masteryDefinitionIdentity,
} from '../mastery.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { campaignKey } from '../library.mjs';

const read = (name) =>
  JSON.parse(readFileSync(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
const original = read('homeward-skies');
original.visualOverrides = {};
original.levelVisuals = [];
const clone = (value) => structuredClone(value);
const definitions = [STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN];
const source = (goals = definitions) => ({
  ...clone(original),
  format: MASTERY_PACK_VERSION,
  masteries: clone(goals),
});
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const dimensions = { naturalWidth: 1, naturalHeight: 1 };
const image = (value) => ({ ...value, visualOverrides: { player: { dataUrl: png } } });
const ready = async (candidate, options = {}) =>
  (await preparePack(candidate, { decodeImage: async () => dimensions, ...options })).pack;
const entry = (pack) => resolvePackCampaign(pack, pack.campaigns[0].id);
const contextEntry = (resolved) => ({
  campaign: resolved.campaign,
  sourcePackId: resolved.sourcePackId,
  ...(resolved.sourcePackFormat
    ? { sourcePackFormat: resolved.sourcePackFormat, masteries: resolved.masteries }
    : {}),
});
const catalog = (pack) => createMasteryCatalog([contextEntry(entry(pack))]);

test('old v1 packs retain exact prepared shape and library export bytes, and still reject a mastery field', async () => {
  const candidate = read('night-shift'),
    before = clone(candidate);
  const pack = await ready(candidate);
  assert.equal(PACK_VERSION, 'xonix-pack.v1');
  assert.equal(pack.format, PACK_VERSION);
  assert.deepEqual(pack, before);
  assert.deepEqual(candidate, before);
  assert.equal(Object.hasOwn(pack, 'masteries'), false);
  const resolved = entry(pack);
  assert.equal(Object.hasOwn(resolved, 'masteries'), false);
  assert.equal(Object.hasOwn(resolved, 'sourcePackFormat'), false);
  assert.equal(
    exportPackLibrary(installPack(emptyPackLibrary(), pack)),
    JSON.stringify({ format: PACK_LIBRARY_VERSION, packs: [before] }),
  );
  assert.equal(validatePack({ ...candidate, masteries: [] }).valid, false);
});

test('v2 is explicit, requires an array, and retains existing enclosing budgets', async () => {
  assert.equal(MASTERY_PACK_VERSION, 'xonix-pack.v2');
  assert.equal(PACK_LIBRARY_VERSION, 'xonix-pack-library.v1');
  assert.equal(PACK_LIMITS.maxBytes, 24 * 1024 * 1024);
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1024 * 1024);
  assert.equal(PACK_LIMITS.masteries, 128);
  assert.equal(PACK_LIMITS.masteryBytes, 8192);
  assert.equal(PACK_LIMITS.combinedMasteryBytes, 256 * 1024);
  for (const bad of [undefined, null, {}, true]) {
    const candidate = source();
    if (bad === undefined) delete candidate.masteries;
    else candidate.masteries = bad;
    assert.equal(validatePack(candidate).valid, false);
  }
  for (const format of ['xonix-pack.v3', 'xonix-pack.v2.0', 'xonix-pack'])
    assert.equal(validatePack({ ...source(), format }).valid, false);
  assert.deepEqual((await ready(source([]))).masteries, []);
});

test('all three finite goals resolve beside the unchanged campaign and canonicalize without input mutation', async () => {
  const candidate = source();
  candidate.masteries[1].all.reverse();
  const before = clone(candidate),
    pack = await ready(candidate),
    resolved = entry(pack);
  const old = entry(await ready(original));
  assert.deepEqual(candidate, before);
  assert.deepEqual(resolved.campaign, old.campaign);
  assert.equal(campaignKey(resolved.campaign), 'homeward-skies/1/0d01f5687b3c38ff');
  assert.equal(resolved.sourcePackFormat, MASTERY_PACK_VERSION);
  assert.deepEqual(resolved.masteries, definitions.map(resolveMasteryDefinition));
  assert.equal(Object.hasOwn(resolved.campaign, 'masteries'), false);
  assert.ok(resolved.campaign.levels.every((level) => !Object.hasOwn(level, 'masteries')));
  assert.deepEqual(
    catalog(pack)
      .registrations.map((value) => value.definitionIdentity)
      .sort(),
    definitions.map(masteryDefinitionIdentity).sort(),
  );
  assert.equal(masteryDefinitionIdentity(pack.masteries[0]), 'mastery-v1-2e6aae3f42f3d3c2');
  assert.ok(Object.isFrozen(pack.masteries[1].all[1].regions[0]));
  resolved.masteries[0].name = 'Caller edit';
  assert.equal(pack.masteries[0].name, 'Steady Signal');
});

test('empty v2 declarations explicitly opt out of exact-content v1 fallbacks', async () => {
  const old = await ready(original),
    current = await ready(source([]));
  assert.equal(catalog(old).registrations.length, 3);
  assert.equal(catalog(current).registrations.length, 0);
  assert.deepEqual(entry(current).campaign, entry(old).campaign);
});

test('practice conversion preserves explicit v2 goals and null opt-outs while v1 output remains exact', async () => {
  const authored = await ready(source()),
    optedOut = await ready(source([])),
    old = await ready(original);
  for (const definition of definitions)
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const scenario = scenarioFromPack(authored, 'homeward-skies', definition.levelId, {
        turnPolicy,
      });
      assert.equal(scenario.format, 'xonix-playground.v2');
      assert.deepEqual(scenario.masteryDefinition, resolveMasteryDefinition(definition));
      assert.equal(scenario.settings.turnPolicy, turnPolicy);
      assert.equal(validateScenario(scenario).valid, true);
      const empty = scenarioFromPack(optedOut, 'homeward-skies', definition.levelId);
      assert.equal(empty.format, 'xonix-playground.v2');
      assert.equal(empty.masteryDefinition, null);
      const prior = scenarioFromPack(old, 'homeward-skies', definition.levelId);
      assert.equal(prior.format, 'xonix-playground.v1');
      assert.equal(Object.hasOwn(prior, 'masteryDefinition'), false);
    }
});

test('a mixed old/new pack library roundtrips without upgrading v1 members or dropping definitions', async () => {
  const old = await ready(read('night-shift')),
    modern = await ready(source());
  const blank = emptyPackLibrary(),
    library = installPack(installPack(blank, old), modern);
  const text = exportPackLibrary(library);
  const restored = await importPackLibrary(text, { decodeImage: async () => dimensions });
  assert.equal(blank.packs.length, 0);
  assert.deepEqual(restored, library);
  assert.deepEqual(
    restored.packs.map((pack) => pack.format),
    [PACK_VERSION, MASTERY_PACK_VERSION],
  );
  assert.equal(Object.hasOwn(restored.packs[0], 'masteries'), false);
  assert.deepEqual(restored.packs[1].masteries, definitions.map(resolveMasteryDefinition));
});

test('invalid local references and unavailable capabilities reject before any image decode', async () => {
  const changes = [
    (pack) => {
      pack.masteries[0].campaignId = 'another-campaign';
    },
    (pack) => {
      pack.masteries[0].levelId = 'absent-map';
    },
    (pack) => {
      pack.masteries[0].all[1].zoneId = 'west-emitter';
    },
    (pack) => {
      pack.masteries[1].all[0].padIds[0] = 'missing-pad';
    },
    (pack) => {
      pack.masteries[1].all[1].regions[0].zoneId = 'broad-band';
    },
    (pack) => {
      pack.masteries[1].all[2].hangarId = 'missing-hangar';
    },
    (pack) => {
      pack.masteries[1].all[2].classId = 'missing-class';
    },
    (pack) => {
      pack.masteries[2].all[1].actorId = 'home-beacon';
    },
    (pack) => {
      pack.masteries[2].all[1].actorId =
        pack.campaigns[0].levels[2].enemies.find((enemy) => enemy.type === 'patrol')?.id ??
        'missing-patrol';
    },
    (pack) => {
      pack.campaigns[0].classIds = ['scout'];
    },
    (pack) => {
      pack.masteries = [clone(SUPPLY_LINE)];
      pack.campaigns[0].classIds = ['bomber'];
    },
    (pack) => {
      pack.masteries = [clone(SUPPLY_LINE)];
      pack.campaigns[0].classIds = ['interceptor', 'carrier'];
      pack.classRecipes.find((recipe) => recipe.id === 'carrier').primitive = 'slow-field';
    },
    (pack) => {
      pack.masteries = [clone(SAFE_RETURN)];
      pack.campaigns[0].classIds = ['scout', 'carrier'];
    },
  ];
  for (const change of changes) {
    const candidate = image(source());
    change(candidate);
    const before = clone(candidate);
    let calls = 0;
    await assert.rejects(
      preparePack(candidate, {
        decodeImage: async () => {
          calls++;
          return dimensions;
        },
      }),
      TypeError,
    );
    assert.equal(calls, 0);
    assert.deepEqual(candidate, before);
  }
});

test('a definition cannot borrow another campaign map or dependency equipment', async () => {
  const candidate = image(source([STEADY_SIGNAL]));
  const other = {
    ...clone(candidate.campaigns[0]),
    id: 'other-campaign',
    levels: [candidate.campaigns[0].levels.pop()],
  };
  candidate.campaigns.push(other);
  candidate.masteries[0].levelId = other.levels[0].id;
  candidate.dependencies = [{ id: 'helpful-equipment', version: '1.0.0' }];
  let calls = 0;
  await assert.rejects(
    preparePack(candidate, {
      decodeImage: async () => {
        calls++;
        return dimensions;
      },
    }),
  );
  assert.equal(calls, 0);
});

test('a valid border patrol cannot become an impact goal target', async () => {
  const candidate = source([SAFE_RETURN]);
  candidate.campaigns[0].levels[2].enemies.push({
    id: 'outer-patrol',
    type: 'border-patrol',
    x: 47.5,
    y: 35.5,
    speed: 1,
  });
  const ordinary = clone(candidate);
  ordinary.format = PACK_VERSION;
  delete ordinary.masteries;
  assert.equal(validatePack(ordinary).valid, true);
  candidate.masteries[0].all[1].actorId = 'outer-patrol';
  let calls = 0;
  await assert.rejects(
    preparePack(image(candidate), {
      decodeImage: async () => {
        calls++;
        return dimensions;
      },
    }),
    /actor reference/i,
  );
  assert.equal(calls, 0);
});

test('default hangar references resolve collision-safely without materializing them into original maps', async () => {
  const candidate = source([SUPPLY_LINE]),
    level = candidate.campaigns[0].levels[1];
  delete level.hangars;
  level.supplies[0].id = 'home-hangar';
  candidate.masteries[0].all[0].padIds[0] = 'home-hangar';
  const derived = normalizedLevel(level).hangars[0].id;
  assert.equal(derived, 'home-hangar-1');
  candidate.masteries[0].all[2].hangarId = derived;
  const pack = await ready(candidate);
  assert.equal(Object.hasOwn(pack.campaigns[0].levels[1], 'hangars'), false);
  assert.equal(catalog(pack).registrations[0].definition.all[2].hangarId, derived);
  const stale = clone(candidate);
  stale.masteries[0].all[2].hangarId = 'home-hangar';
  assert.equal(validatePack(stale).valid, false);
});

test('definition IDs and per-map declarations are unique and bounded', () => {
  const repeatedId = source();
  repeatedId.masteries[1].id = repeatedId.masteries[0].id;
  assert.equal(validatePack(repeatedId).valid, false);
  const repeatedMap = source([STEADY_SIGNAL, { ...clone(STEADY_SIGNAL), id: 'another-seal' }]);
  assert.equal(validatePack(repeatedMap).valid, false);
  const excess = source(Array.from({ length: 129 }, () => clone(STEADY_SIGNAL)));
  assert.match(validatePack(excess).errors.join(), /128/);
});

test('definition JSON budgets and forbidden shapes reject without executing accessors', async () => {
  const changes = [
    (pack) => {
      pack.masteries[0].script = 'award()';
    },
    (pack) => {
      pack.masteries[0].version = 'xonix-mastery-definition.v3';
    },
    (pack) => {
      pack.masteries[0].description = 'x'.repeat(8193);
    },
    (pack) => {
      pack.masteries[0].all[1].minCells = NaN;
    },
    (pack) => {
      pack.masteries[0].all = Array(2);
    },
    (pack) => {
      pack.masteries[0].all[1] = Object.create({ inherited: true });
    },
    (pack) => {
      pack.masteries[0].all[1].extra = JSON.parse('{"__proto__":{"polluted":true}}');
    },
    (pack) => {
      pack.masteries[0].all[1].cycle = pack;
    },
  ];
  let reads = 0;
  changes.push((pack) => {
    Object.defineProperty(pack.masteries[0], 'version', {
      enumerable: true,
      get() {
        reads++;
        return 'xonix-mastery-definition.v1';
      },
    });
  });
  changes.push((pack) => {
    Object.defineProperty(pack.masteries[0].all[1], 'minCells', {
      enumerable: true,
      get() {
        reads++;
        return 8;
      },
    });
  });
  for (const change of changes) {
    const candidate = image(source());
    change(candidate);
    let calls = 0;
    await assert.rejects(
      preparePack(candidate, {
        decodeImage: async () => {
          calls++;
          return dimensions;
        },
      }),
    );
    assert.equal(calls, 0);
  }
  assert.equal(reads, 0);
  assert.equal({}.polluted, undefined);
});

test('combined definition bytes are a separate interior budget, even with individually valid documents', async () => {
  const candidate = source([]),
    map = clone(candidate.campaigns[0].levels[0]);
  candidate.campaigns[0].levels = Array.from({ length: 128 }, (_, i) => ({
    ...clone(map),
    id: `map-${i}`,
  }));
  candidate.masteries = candidate.campaigns[0].levels.map((level, i) => ({
    ...clone(STEADY_SIGNAL),
    id: `goal-${i}`,
    levelId: level.id,
    revision: '\u0800'.repeat(80),
    name: '\u0800'.repeat(80),
    description: '\u0800'.repeat(512),
  }));
  assert.ok(
    candidate.masteries.every(
      (value) => JSON.stringify(resolveMasteryDefinition(value)).length < 8192,
    ),
  );
  assert.ok(
    new TextEncoder().encode(JSON.stringify(candidate.masteries)).byteLength >
      PACK_LIMITS.combinedMasteryBytes,
  );
  let calls = 0;
  await assert.rejects(
    preparePack(image(candidate), {
      decodeImage: async () => {
        calls++;
        return dimensions;
      },
    }),
    /combined 256 KiB/,
  );
  assert.equal(calls, 0);
  candidate.masteries = candidate.masteries.slice(0, 80);
  assert.equal(validatePack(candidate).valid, true, validatePack(candidate).errors.join());
});

test('co-installed exact definitions are allowed, including matching v1 builtin and v2 authored goals', async () => {
  const old = await ready(original),
    modern = source();
  modern.id = 'homeward-authored-copy';
  const modernPack = await ready(modern);
  const library = installPack(installPack(emptyPackLibrary(), old), modernPack);
  assert.equal(library.packs.length, 2);
  const imported = await importPackLibrary(exportPackLibrary(library));
  assert.deepEqual(imported, library);
});

test('same-board changed definitions and explicit null conflict before the first decoder during preparation', async () => {
  const old = await ready(original),
    library = installPack(emptyPackLibrary(), old),
    before = exportPackLibrary(library);
  for (const candidate of [source([]), source()]) {
    candidate.id = 'conflicting-goals';
    if (candidate.masteries.length) candidate.masteries[0].name = 'A different goal';
    let calls = 0;
    await assert.rejects(
      preparePack(image(candidate), {
        library,
        decodeImage: async () => {
          calls++;
          return dimensions;
        },
      }),
      /conflict|disagree/i,
    );
    assert.equal(calls, 0);
    assert.equal(exportPackLibrary(library), before);
    const preparedAlone = await ready(candidate);
    assert.throws(() => installPack(library, preparedAlone), /conflict|disagree/i);
  }
});

test('prospective app context catches an exact-base authored goal before content adoption', async () => {
  const base = JSON.parse(
    readFileSync(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  );
  base.classRecipes = clone(original.classRecipes);
  const target = base.levels.find((level) => level.signalZones?.length);
  const definition = {
    ...clone(STEADY_SIGNAL),
    id: 'base-signal-goal',
    campaignId: base.id,
    levelId: target.id,
    all: [
      { type: 'clean-win' },
      { type: 'resistant-cut-cells', zoneId: target.signalZones[0].id, minCells: 1 },
    ],
  };
  const candidate = source([definition]);
  candidate.id = 'base-goal-conflict';
  candidate.campaigns = [clone(base)];
  delete candidate.campaigns[0].classRecipes;
  delete candidate.campaigns[0].briefs;
  const prepared = await ready(candidate),
    resolved = entry(prepared);
  assert.equal(campaignKey(resolved.campaign), campaignKey(base));
  const onlyPacks = installPack(emptyPackLibrary(), prepared);
  assert.equal(
    onlyPacks.packs.length,
    1,
    'Standalone pack validation does not know the host base entry.',
  );
  assert.throws(
    () => createMasteryCatalog([{ campaign: base, sourcePackId: null }, contextEntry(resolved)]),
    /Conflicting mastery.*base campaign.*base-goal-conflict/,
  );
  assert.equal(
    onlyPacks.packs[0],
    prepared,
    'Prospective context validation does not mutate prepared content.',
  );
});

test('an entire imported library validates context and conflicts before decoding any member', async () => {
  const old = image(clone(original)),
    modern = image(source([]));
  modern.id = 'conflicting-goals';
  let calls = 0;
  await assert.rejects(
    importPackLibrary(
      { format: PACK_LIBRARY_VERSION, packs: [old, modern] },
      {
        decodeImage: async () => {
          calls++;
          return dimensions;
        },
      },
    ),
    /conflict|disagree/i,
  );
  assert.equal(calls, 0);
});

test('same-ID replacement removes the old declaration before conflict checks and removal restores fallback only by reinstallation', async () => {
  const old = await ready(original),
    library = installPack(emptyPackLibrary(), old),
    replacement = image(source([]));
  let calls = 0;
  const prepared = await ready(replacement, {
    library,
    decodeImage: async () => {
      calls++;
      return dimensions;
    },
  });
  assert.equal(calls, 1);
  const replaced = installPack(library, prepared);
  assert.equal(replaced.packs.length, 1);
  assert.equal(catalog(replaced.packs[0]).registrations.length, 0);
  assert.equal(catalog(library.packs[0]).registrations.length, 3);
  const removed = removePack(replaced, old.id);
  assert.equal(removed.packs.length, 0);
  assert.equal(catalog(installPack(removed, old).packs[0]).registrations.length, 3);
});

test('prospective dependency and destination validation happen before decoding v2 replacements', async () => {
  const candidate = image(source());
  candidate.dependencies = [{ id: 'missing', version: '1.0.0' }];
  for (const library of [emptyPackLibrary(), { format: PACK_LIBRARY_VERSION, packs: [] }]) {
    let calls = 0;
    await assert.rejects(
      preparePack(candidate, {
        library,
        decodeImage: async () => {
          calls++;
          return dimensions;
        },
      }),
    );
    assert.equal(calls, 0);
  }
});

test('caller mutation and decoder failure cannot change installed definitions or partially adopt a replacement', async () => {
  const old = await ready(original),
    library = installPack(emptyPackLibrary(), old),
    before = exportPackLibrary(library);
  const candidate = image(source());
  let release;
  const pending = preparePack(candidate, {
    library,
    decodeImage: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  candidate.masteries[0].name = 'Changed during decoder';
  candidate.masteries[0].all[1].minCells = 999;
  release(dimensions);
  const { pack } = await pending;
  assert.equal(pack.masteries[0].name, 'Steady Signal');
  assert.equal(pack.masteries[0].all[1].minCells, 8);
  assert.equal(exportPackLibrary(library), before);
  await assert.rejects(
    preparePack(image(source()), {
      library,
      decodeImage: async () => {
        throw new Error('Decode failed');
      },
    }),
    /Decode failed/,
  );
  assert.equal(exportPackLibrary(library), before);
});

test('presentation-only substitutions preserve registration identity while definition edits remain distinct', async () => {
  const old = await ready(source()),
    changed = image(source());
  changed.version = '2.0.0';
  changed.name = 'Different pack caption';
  changed.metadata.author = 'Another author';
  changed.music[0].tempo = 120;
  const modern = await ready(changed);
  assert.deepEqual(catalog(modern).registrations, catalog(old).registrations);
  const updated = source();
  updated.masteries[0].description = 'Different requirement description.';
  assert.notEqual(
    catalog(await ready(updated)).registrations.find((value) => value.levelId === 'homeward-01')
      .definitionIdentity,
    masteryDefinitionIdentity(STEADY_SIGNAL),
  );
});
