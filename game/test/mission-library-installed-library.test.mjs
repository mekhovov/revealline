import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, emptyPackLibrary, installPack } from '../packs.mjs';
import { createInstalledMissionLibrary } from '../mission-library/installed-library.mjs';

const json = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const index = await json('../content/mission-library-index.json');
const recipe = await json('../content/packs/night-shift.json');
const baseEntry = {
  campaign: {
    ...(await json('../content/campaign.json')),
    classRecipes: await json('../content/classes.json'),
  },
};
const pack = (mutate = () => {}) => {
  const source = structuredClone(recipe);
  mutate(source);
  return preparePack(source).then(({ pack }) => pack);
};
const ownedLibrary = (value) => installPack(emptyPackLibrary(), value);
const defaults = {
  index,
  baseEntry,
  compatibility: () => ['solo', 'versus'],
  describe: ({ level }) => ({ rules: `${level.rules.lives} authored lives` }),
  prepareClassic: async () => {
    throw new Error('Offline');
  },
  launchClassic: () => true,
  launchCustom: () => true,
};
const classic = (library, id = recipe.campaigns[0].levels[0].id) =>
  library.missions.find((row) => row.collection === 'Classic' && row.runtimeId === id);
const custom = (library) => library.missions.find((row) => row.collection === 'Custom');

test('empty installed library lists every Classic without fetching, and base is exact-key ready', async () => {
  const current = emptyPackLibrary();
  const { library } = await createInstalledMissionLibrary({ ...defaults, getPacks: () => current });
  assert.equal(library.missions.length, 110);
  const base = library.missions.find((row) => row.runtimeId === 'signal-12');
  assert.equal(library.availability(base).state, 'ready');
  assert.equal(library.progress(base, 'solo'), '');
  const row = classic(library),
    raw = index.missions.find((entry) => entry.packId === recipe.id);
  assert.deepEqual(library.availability(row), { state: 'download', bytes: raw.sourceFile.bytes });
  const optional = index.missions.find((entry) => entry.source === 'optional');
  const optionalRow = library.missions.find((entry) => entry.runtimeId === optional.levelId);
  assert.deepEqual(library.availability(optionalRow), {
    state: 'download',
    bytes: optional.download.bytes,
  });
});

test('host installer capability veto explains missing chapters without blocking exact installed editions', async () => {
  let current = emptyPackLibrary();
  const host = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    unavailableClassic: (row, mode) =>
      row.source === 'bundled' && mode === 'versus'
        ? 'This host does not yet support that installer.'
        : null,
  });
  const row = classic(host.library);
  assert.equal(host.library.availability(row, 'versus').state, 'unavailable');
  assert.match(host.library.availability(row, 'versus').reason, /installer/);
  assert.equal(host.library.availability(row, 'solo').state, 'download');
  current = ownedLibrary(await pack());
  await host.refreshInstalled();
  assert.equal(host.library.availability(row, 'versus').state, 'ready');
});

test('exact official pack is Classic only, and late launch passes immutable scalar selection and original owner', async () => {
  const installed = await pack(),
    current = ownedLibrary(installed);
  let launched;
  const { library } = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    launchClassic: (row, context) => {
      launched = { row, context };
      return true;
    },
  });
  assert.equal(custom(library), undefined);
  const last = recipe.campaigns[0].levels.at(-1),
    row = classic(library, last.id);
  assert.equal(library.availability(row, 'solo').state, 'ready');
  await library.launch(row, {
    mode: 'solo',
    pack: 'forged',
    selection: 'forged',
    libraryMissionId: 'forged',
  });
  assert.equal(launched.context.pack, installed);
  assert.equal(launched.context.libraryMissionId, row.id);
  assert.equal(launched.context.selection.levelId, last.id);
  assert.equal(launched.context.selection.levelRevision, last.revision);
  assert.equal(launched.context.selection.levelIndex, 2);
  assert.equal(launched.context.selection.campaignId, recipe.campaigns[0].id);
  assert.ok(Object.isFrozen(launched.context.selection));
  assert.ok(Object.isFrozen(launched.row));
});

test('modified same-ID presentation remains Custom while official Classic shows an explicit unavailable reason', async () => {
  const modified = await pack((value) => {
    value.themes[0].palette.accent = '#112233';
  });
  const current = ownedLibrary(modified);
  let launched;
  const { library } = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    launchCustom: (binding, context) => {
      launched = { binding, context };
      return true;
    },
  });
  assert.match(library.availability(classic(library)).reason, /different edition/);
  assert.equal(library.missions.filter((row) => row.collection === 'Custom').length, 3);
  const row = custom(library);
  assert.equal(await library.launch(row), true);
  assert.equal(launched.binding.pack, modified);
  assert.equal(launched.binding.level, launched.binding.entry.campaign.levels[0]);
  assert.equal(launched.context.libraryMissionId, row.id);
});

test('Download becomes Play with stable Classic row authority, no clear and no automatic launch', async () => {
  const installed = await pack();
  let current = emptyPackLibrary(),
    launches = 0;
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    prepareClassic: async () => {
      current = ownedLibrary(installed);
    },
    launchClassic: () => {
      launches++;
      return true;
    },
  });
  const row = classic(factory.library);
  const prepared = await factory.library.prepare(row);
  assert.deepEqual(prepared, { state: 'ready' });
  assert.equal(classic(factory.library), row);
  assert.equal(factory.library.progress(row, 'solo'), '');
  assert.equal(launches, 0);
  await factory.library.launch(row);
  assert.equal(launches, 1);
});

test('refresh rejects a snapshot replaced during asynchronous classification without adopting stale Custom rows', async () => {
  let current = emptyPackLibrary(),
    replaceDuringDescription = false;
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    describe: (binding) => {
      if (replaceDuringDescription) current = emptyPackLibrary();
      return defaults.describe(binding);
    },
  });
  const original = classic(factory.library);
  current = ownedLibrary(
    await pack((value) => {
      value.id = 'my-upload';
    }),
  );
  replaceDuringDescription = true;
  await assert.rejects(factory.refreshInstalled(), /Installed content changed/);
  assert.equal(custom(factory.library), undefined);
  assert.equal(classic(factory.library), original);
});

test('launch rechecks installed owner after awaiting identity; a replacement cannot receive stale launch', async () => {
  let current = ownedLibrary(await pack()),
    launched = false;
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    launchClassic: () => {
      launched = true;
    },
  });
  const pending = factory.library.launch(classic(factory.library));
  current = emptyPackLibrary();
  await assert.rejects(pending, /Installed content changed/);
  assert.equal(launched, false);
});

test('external managed-media readiness remains host-owned for both absent and exact installed packs', async () => {
  const installed = await pack();
  let current = emptyPackLibrary(),
    mediaReady = false;
  const raw = index.missions.find((row) => row.packId === recipe.id);
  const externalIndex = {
    format: index.format,
    missions: [
      {
        ...raw,
        source: 'external',
        download: {
          id: raw.packId,
          bytes: raw.sourceFile.bytes + 500,
          packPath: raw.sourceFile.path,
          mediaPath: 'optional/test/media.rlmedia',
        },
      },
    ],
  };
  const calls = [];
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    index: externalIndex,
    getPacks: () => current,
    availabilityExternal: (row, owner, selectedMode) => {
      calls.push({ row, owner, selectedMode });
      return owner && mediaReady
        ? { state: 'ready' }
        : {
            state: 'unavailable',
            reason: owner ? 'Restore original pictures' : 'Unavailable in this source preview',
          };
    },
  });
  const row = factory.library.missions[0];
  assert.match(factory.library.availability(row).reason, /source preview/);
  assert.equal(calls.at(-1).owner, null);
  current = ownedLibrary(installed);
  await factory.refreshInstalled();
  assert.match(factory.library.availability(row).reason, /original pictures/);
  assert.equal(calls.at(-1).owner, installed);
  mediaReady = true;
  assert.equal(factory.library.availability(row, 'versus').state, 'ready');
  assert.equal(calls.at(-1).selectedMode, 'versus');
  const unqualified = await createInstalledMissionLibrary({
    ...defaults,
    index: externalIndex,
    getPacks: () => current,
  });
  assert.equal(
    unqualified.library.availability(unqualified.library.missions[0]).state,
    'unavailable',
  );
});

test('unchanged refresh retains Custom rows, removal invalidates their original authority', async () => {
  let current = ownedLibrary(
    await pack((value) => {
      value.id = 'my-upload';
    }),
  );
  let described = 0;
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    describe: (binding) => {
      described++;
      return defaults.describe(binding);
    },
  });
  const row = custom(factory.library),
    oldClassic = classic(factory.library);
  await factory.refreshInstalled();
  assert.equal(custom(factory.library), row);
  assert.equal(described, 3);
  current = emptyPackLibrary();
  assert.equal(factory.library.availability(row).state, 'unavailable');
  await factory.refreshInstalled();
  assert.equal(custom(factory.library), undefined);
  assert.equal(classic(factory.library), oldClassic);
  assert.throws(() => factory.library.launch(row), /stale/);
});

test('base mismatch never falls back to another mission; exact Base launch has no pack', async () => {
  const current = emptyPackLibrary(),
    wrong = structuredClone(baseEntry);
  wrong.campaign.levels[0].rules.lives++;
  const invalid = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    baseEntry: wrong,
  });
  const bad = invalid.library.missions.find((row) => row.runtimeId === 'signal-01');
  assert.equal(invalid.library.availability(bad).state, 'unavailable');
  let selected;
  const valid = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    launchClassic: (_, context) => {
      selected = context;
      return true;
    },
  });
  await valid.library.launch(valid.library.missions.find((row) => row.runtimeId === 'signal-12'));
  assert.equal(selected.pack, null);
  assert.equal(selected.selection.levelId, 'signal-12');
});

test('failed preparation remains retryable, cancellation cannot run refresh or launch', async () => {
  const installed = await pack();
  let current = emptyPackLibrary(),
    attempts = 0,
    finish;
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    prepareClassic: async () => {
      attempts++;
      if (attempts === 1) throw new Error('Offline');
      if (attempts === 2) {
        current = ownedLibrary(installed);
        return;
      }
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const row = classic(factory.library);
  await assert.rejects(factory.library.prepare(row), /Offline/);
  assert.equal(factory.library.availability(row).retry, true);
  assert.deepEqual(await factory.library.prepare(row), { state: 'ready' });
  current = emptyPackLibrary();
  await factory.refreshInstalled();
  const controller = new AbortController();
  const pending = factory.library.prepare(row, { signal: controller.signal });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  assert.deepEqual(await pending, { state: 'cancelled' });
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(factory.library.availability(row).state, 'download');
});

test('unprepared pack lookalikes are rejected rather than trusted as Custom', async () => {
  await assert.rejects(
    createInstalledMissionLibrary({
      ...defaults,
      getPacks: () => ({ packs: [structuredClone(recipe)] }),
    }),
    /prepared/,
  );
});

test('Journey remains first with its original runtime references while installed owners refresh', async () => {
  let current = emptyPackLibrary();
  const mission = {
    id: 'journey-mission',
    name: 'New mission',
    campaignKey: 'new-campaign',
    campaignTitle: 'New campaign',
    levelIndex: 0,
    modes: ['solo'],
  };
  const factory = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    journeySources: [
      {
        id: 'journey:edition',
        editionId: 'edition',
        edition: 'Journey',
        collection: 'Journey',
        entries: [mission],
        describe: (row) => row,
        availability: () => ({ state: 'ready' }),
        launch: (row) => row,
      },
    ],
  });
  const journey = factory.library.missions[0],
    before = classic(factory.library);
  assert.equal(journey.collection, 'Journey');
  current = ownedLibrary(
    await pack((value) => {
      value.id = 'my-upload';
    }),
  );
  await factory.refreshInstalled();
  assert.equal(factory.library.missions[0], journey);
  assert.equal(classic(factory.library), before);
  assert.equal(factory.library.launch(journey), mission);
  assert.equal(factory.library.missions.at(-1).collection, 'Custom');
});
