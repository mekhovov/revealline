import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, emptyPackLibrary, installPack } from '../packs.mjs';
import { createInstalledMissionLibrary } from '../mission-library/installed-library.mjs';
import { inspectImageDataUrl } from '../content.mjs';

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
  return preparePack(source, {
    decodeImage: async (dataUrl) => {
      const image = inspectImageDataUrl(dataUrl);
      assert.equal(image.valid, true);
      return { naturalWidth: image.width, naturalHeight: image.height };
    },
  }).then(({ pack }) => pack);
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
  assert.equal(library.missions.length, 296);
  const base = library.missions.find((row) => row.runtimeId === 'signal-12');
  assert.equal(library.availability(base).state, 'ready');
  assert.equal(library.progress(base, 'solo'), '');
  const row = classic(library),
    raw = index.missions.find((entry) => entry.packId === recipe.id);
  assert.ok(
    raw.sourceFile.bytes > 64 * 1024,
    'current artwork-bearing chapter exceeds the mandatory-cache allowance',
  );
  assert.deepEqual(library.availability(row), {
    state: 'download',
    bytes: raw.sourceFile.bytes,
  });
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
  const current = { packs: [structuredClone(recipe)] };
  await assert.rejects(
    createInstalledMissionLibrary({
      ...defaults,
      getPacks: () => current,
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

test('installed initial browse guard is forwarded and rejects a late project completion', async () => {
  const current = emptyPackLibrary(),
    retired = new Error('Retired initial browse');
  let active = true,
    release,
    forwarded;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    assertCurrent() {
      if (!active) throw retired;
    },
    getProjectSources({ assertCurrent } = {}) {
      forwarded = assertCurrent;
      return gate;
    },
  });
  active = false;
  release([]);
  await assert.rejects(pending, (error) => error === retired);
  assert.equal(typeof forwarded, 'function');
  assert.throws(forwarded, (error) => error === retired);
});

test('installed refresh retires partial Custom work and a fresh visit constructs and reuses it', async () => {
  let current = emptyPackLibrary(),
    active = true,
    retireOnDescription = false,
    described = 0;
  const retired = new Error('Retired Custom refresh');
  const host = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    assertCurrent() {
      if (!active) throw retired;
    },
    describe(binding) {
      described++;
      if (retireOnDescription) active = false;
      return defaults.describe(binding);
    },
  });
  const original = classic(host.library);
  current = ownedLibrary(
    await pack((value) => {
      value.id = 'guarded-custom';
    }),
  );
  retireOnDescription = true;
  await assert.rejects(
    host.refreshInstalled({
      assertCurrent() {
        if (!active) throw retired;
      },
    }),
    (error) => error === retired,
  );
  assert.equal(described, 1);
  assert.equal(custom(host.library), undefined);
  assert.equal(classic(host.library), original);
  retireOnDescription = false;
  await host.refreshInstalled(); // A fresh default visit must not reuse the initial guard.
  assert.equal(described, 4);
  const row = custom(host.library);
  assert.equal(await host.library.launch(row), true);
  await host.refreshInstalled();
  assert.equal(custom(host.library), row);
  assert.equal(described, 4);
});

test('installed refresh cannot publish a superseded held project result', async () => {
  const current = emptyPackLibrary();
  let hold = false,
    release,
    oldGuard;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const host = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    getProjectSources({ assertCurrent } = {}) {
      if (!hold) return [];
      oldGuard = assertCurrent;
      return gate;
    },
  });
  hold = true;
  const old = host.refreshInstalled();
  hold = false;
  await host.refreshInstalled();
  release([]);
  await assert.rejects(old, /superseded/);
  if (oldGuard) assert.throws(oldGuard, /superseded/);
  assert.equal(custom(host.library), undefined);
});

test('Classic preparation cancellation cannot publish a late installed refresh', async () => {
  let current = emptyPackLibrary(),
    hold = false,
    release,
    entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const atBoundary = new Promise((resolve) => {
    entered = resolve;
  });
  const customPack = await pack((value) => {
    value.id = 'cancelled-download';
  });
  const host = await createInstalledMissionLibrary({
    ...defaults,
    getPacks: () => current,
    getProjectSources() {
      if (!hold) return [];
      entered();
      return gate;
    },
    prepareClassic: async () => {
      current = ownedLibrary(customPack);
      hold = true;
    },
  });
  const controller = new AbortController();
  const pending = host.library.prepare(classic(host.library), { signal: controller.signal });
  await atBoundary;
  controller.abort();
  assert.deepEqual(await pending, { state: 'cancelled' });
  release([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(custom(host.library), undefined);
  hold = false;
  await host.refreshInstalled();
  assert.ok(custom(host.library));
});

test('installed publication stops between notifying mutations and a fresh visit repairs coherently', async () => {
  let current = emptyPackLibrary(),
    active = true,
    armed = false,
    notifications = 0;
  const retired = new Error('Retired by registry subscriber');
  const host = await createInstalledMissionLibrary({ ...defaults, getPacks: () => current });
  const first = await pack((value) => {
    value.id = 'first-owned';
  });
  const second = await pack((value) => {
    value.id = 'second-owned';
  });
  current = installPack(ownedLibrary(first), second);
  const unsubscribe = host.library.subscribe(() => {
    if (armed) {
      notifications++;
      active = false;
    }
  });
  const assertCurrent = () => {
    if (!active) throw retired;
  };
  try {
    armed = true;
    await assert.rejects(host.refreshInstalled({ assertCurrent }), (error) => error === retired);
    assert.equal(notifications, 1, 'the next registration must not run after retirement');
    const published = host.library.missions.filter((row) => row.collection === 'Custom');
    assert.equal(published.length, 3);
    assert.ok(published.every((row) => row.ownerId === JSON.stringify(['custom', first.id])));
    assert.equal(host.library.availability(published[0]).state, 'ready');
    armed = false;
    await host.refreshInstalled();
    const both = host.library.missions.filter((row) => row.collection === 'Custom');
    assert.equal(both.length, 6);
    assert.equal(both[0], published[0], 'the registry and its owner map stay coherent');

    current = emptyPackLibrary();
    active = true;
    notifications = 0;
    armed = true;
    await assert.rejects(host.refreshInstalled({ assertCurrent }), (error) => error === retired);
    assert.equal(notifications, 1, 'the next removal must not run after retirement');
    const remaining = host.library.missions.filter((row) => row.collection === 'Custom');
    assert.equal(remaining.length, 3);
    assert.ok(remaining.every((row) => row.ownerId === JSON.stringify(['custom', second.id])));
    assert.equal(host.library.availability(remaining[0]).state, 'unavailable');
    assert.throws(() => host.library.availability(published[0]), /stale/);
    armed = false;
    await host.refreshInstalled();
    assert.equal(custom(host.library), undefined);
  } finally {
    unsubscribe();
    host.library.dispose();
  }
});
