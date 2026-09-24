import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inspectPackLibraryMetadata,
  PACK_LIBRARY_VERSION,
  resolvePackCampaign,
} from '../packs.mjs';
import { createMetadataInstalledMissionLibrary } from '../mission-library/metadata-installed-library.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const index = await json('../content/mission-library-index.json');
const recipe = await json('../content/packs/night-shift.json');
const baseEntry = {
  campaign: {
    ...(await json('../content/campaign.json')),
    classRecipes: await json('../content/classes.json'),
  },
};
const inspect = (packs = []) => inspectPackLibraryMetadata({ format: PACK_LIBRARY_VERSION, packs });
const defaults = {
  index,
  baseEntry,
  compatibility: () => ['solo', 'versus'],
  describe: ({ level }) => ({ rules: `${level.rules.lives} authored lives` }),
  availabilityClassic: (row, pack) =>
    row.source === 'external'
      ? { state: 'unavailable', reason: 'Original media not checked.' }
      : pack
        ? { state: 'ready' }
        : { state: 'download', bytes: row.download?.bytes ?? row.sourceFile.bytes },
  availabilityCustom: () => ({ state: 'ready' }),
  prepareClassic: async () => {
    throw new Error('Offline');
  },
  launchClassic: () => true,
  launchCustom: () => true,
};
const classic = (library, id = recipe.campaigns[0].levels[0].id) =>
  library.missions.find((row) => row.collection === 'Classic' && row.runtimeId === id);

test('empty inspected inventory lists all110 retained identities without artwork reads or inferred external readiness', async () => {
  const current = await inspect();
  const { library } = await createMetadataInstalledMissionLibrary({
    ...defaults,
    getInventory: () => current,
  });
  assert.equal(library.missions.length, 188);
  const base = library.missions.find((row) => row.runtimeId === 'signal-12');
  assert.equal(library.availability(base).state, 'ready');
  assert.equal(library.availability(classic(library)).state, 'download');
  const external = index.missions.find((row) => row.source === 'external');
  assert.deepEqual(library.availability(classic(library, external.levelId)), {
    state: 'unavailable',
    reason: 'Original media not checked.',
    retry: false,
  });
  assert.equal(library.progress(base), '');
  assert.equal(library.next, undefined);
});

test('exact installed edition stays Classic; callback gets only inspected metadata and immutable exact target', async () => {
  const current = await inspect([recipe]);
  let launched;
  const { library } = await createMetadataInstalledMissionLibrary({
    ...defaults,
    getInventory: () => current,
    launchClassic: (row, context) => {
      launched = { row, context };
      return true;
    },
  });
  assert.equal(library.missions.length, 188);
  const last = recipe.campaigns[0].levels.at(-1),
    row = classic(library, last.id);
  assert.equal(
    library.launch(row, {
      mode: 'versus',
      pack: 'forged-runtime-owner',
      selection: 'forged',
      metadataPack: 'forged',
      inventory: 'forged',
    }),
    true,
  );
  assert.equal(launched.context.metadataPack, current.packs[0]);
  assert.equal(launched.context.inventory, current);
  assert.equal(launched.context.pack, undefined);
  assert.equal(launched.context.selection.levelId, last.id);
  assert.equal(launched.context.selection.levelIndex, 2);
  assert(Object.isFrozen(launched.context.selection));
  assert.throws(
    () => resolvePackCampaign(launched.context.metadataPack, recipe.campaigns[0].id),
    /prepared/,
  );
});

test('same-ID modified edition remains distinct Custom and old bindings become unavailable on replacement', async () => {
  const edited = structuredClone(recipe);
  edited.themes[0].palette.accent = '#112233';
  let current = await inspect([edited]),
    plays = 0;
  const host = await createMetadataInstalledMissionLibrary({
    ...defaults,
    getInventory: () => current,
    launchCustom: (binding, context) => {
      assert.equal(context.pack, undefined);
      assert.equal(context.metadataPack, undefined);
      assert.equal(context.inventory, current);
      assert.equal(binding.pack, current.packs[0]);
      plays++;
      return true;
    },
  });
  assert.equal(host.library.missions.length, 191);
  assert.match(host.library.availability(classic(host.library)).reason, /different edition/);
  const custom = host.library.missions.find((row) => row.collection === 'Custom');
  host.library.launch(custom, { pack: 'forged-runtime-owner', metadataPack: 'forged' });
  assert.equal(plays, 1);
  current = await inspect();
  assert.equal(host.library.availability(custom).state, 'unavailable');
  assert.throws(() => host.library.launch(custom), /Prepare this mission/);
  await host.refreshInstalled();
  assert.equal(host.library.missions.length, 188);
  assert.throws(() => host.library.launch(custom), /stale/);
  assert.equal(plays, 1);
});

test('Download to Play preserves Classic owner, grants no clear and never autolaunches', async () => {
  let current = await inspect(),
    plays = 0;
  const installed = await inspect([recipe]);
  const host = await createMetadataInstalledMissionLibrary({
    ...defaults,
    getInventory: () => current,
    prepareClassic: async () => {
      current = installed;
    },
    launchClassic: () => {
      plays++;
      return true;
    },
  });
  const row = classic(host.library);
  const originalSources = host.sources();
  assert(Object.isFrozen(originalSources));
  assert.deepEqual(await host.library.prepare(row), { state: 'ready' });
  assert.deepEqual(host.sources(), originalSources);
  assert.equal(classic(host.library), row);
  assert.equal(host.library.progress(row), '');
  assert.equal(plays, 0);
  host.library.launch(row);
  assert.equal(plays, 1);
});

test('failed or cancelled preparation cannot auto-adopt mismatched editions', async () => {
  let current = await inspect();
  const changed = structuredClone(recipe);
  changed.themes[0].palette.accent = '#112233';
  const modified = await inspect([changed]);
  const host = await createMetadataInstalledMissionLibrary({
    ...defaults,
    getInventory: () => current,
    prepareClassic: async () => {
      current = modified;
    },
  });
  const row = classic(host.library);
  await assert.rejects(host.library.prepare(row), /different edition/);
  assert.equal(host.library.availability(row).state, 'unavailable');
  assert.equal(host.library.missions.filter((item) => item.collection === 'Custom').length, 3);
});

test('refresh cannot register a replaced inventory, and failed snapshot classification is retryable', async () => {
  let current = await inspect(),
    replace = false;
  const empty = current,
    edited = structuredClone(recipe);
  edited.id = 'my-upload';
  const custom = await inspect([edited]);
  const host = await createMetadataInstalledMissionLibrary({
    ...defaults,
    getInventory: () => current,
    describe: (binding) => {
      if (replace) current = empty;
      return defaults.describe(binding);
    },
  });
  current = custom;
  replace = true;
  await assert.rejects(host.refreshInstalled(), /changed/);
  assert.equal(host.library.missions.length, 188);
  replace = false;
  current = custom;
  await host.refreshInstalled();
  assert.equal(host.library.missions.length, 191);
});

test('metadata lookalikes and omitted readiness adapters reject before registration', async () => {
  const current = await inspect();
  await assert.rejects(
    createMetadataInstalledMissionLibrary({
      ...defaults,
      getInventory: () => structuredClone(current),
    }),
    /inspected/,
  );
  for (const key of ['availabilityClassic', 'availabilityCustom'])
    await assert.rejects(
      createMetadataInstalledMissionLibrary({
        ...defaults,
        getInventory: () => current,
        [key]: undefined,
      }),
      /explicit/,
    );
});
