import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  inspectPackLibraryMetadata,
  preparePack,
  resolvePackCampaign,
  PACK_LIBRARY_VERSION,
} from '../packs.mjs';
import { customLibrarySources } from '../mission-library/custom-source.mjs';
import { metadataCustomLibrarySources } from '../mission-library/metadata-custom-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createRun } from '../core/index.mjs';
import { createDuel } from '../multiplayer.mjs';

const recipe = JSON.parse(
  await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
);
const inspected = (packs = [structuredClone(recipe)]) =>
  inspectPackLibraryMetadata({ format: PACK_LIBRARY_VERSION, packs });
const adapters = {
  isCurrent: () => true,
  compatibility: ({ entry, level }) => {
    const options = { classRecipes: entry.classRecipes, classId: entry.classRecipes[0].id };
    createRun(level, options);
    createDuel(level, options);
    return ['solo', 'versus'];
  },
  describe: ({ level }) => ({
    rules: `${level.goal.coverage * 100}% · ${level.rules.lives} lives`,
    tags: [],
  }),
  availability: () => ({ state: 'ready' }),
  launch: (binding) => binding,
};

test('inspected Custom display identities exactly match genuinely prepared owners in authored order', async () => {
  const source = structuredClone(recipe);
  const second = structuredClone(source.campaigns[0]);
  second.id = 'another-route';
  second.levels.forEach((level) => {
    level.id += '-another';
  });
  source.campaigns.push(second);
  const metadata = await inspected([source]);
  const { pack } = await preparePack(source);
  const actual = createMissionLibrary(
    await customLibrarySources(
      [
        {
          pack,
          entries: pack.campaigns.map((campaign) => resolvePackCampaign(pack, campaign.id)),
        },
      ],
      adapters,
    ),
  );
  const library = createMissionLibrary(await metadataCustomLibrarySources(metadata, adapters));
  assert.deepEqual(library.missions, actual.missions);
  const selected = library.launch(library.missions.at(-1), { mode: 'versus' });
  assert.equal(selected.pack, metadata.packs[0]);
  assert.equal(selected.entry, metadata.packs[0].entries[1]);
  assert.equal(selected.level, selected.entry.campaign.levels.at(-1));
  assert.equal(selected.selection.editionId, library.missions.at(-1).editionId);
  assert.throws(
    () => resolvePackCampaign(selected.pack, selected.selection.campaignId),
    /prepared/,
  );
  assert.equal(library.next, undefined);
});

test('metadata source needs inspection provenance and explicit currentness/readiness adapters', async () => {
  const metadata = await inspected();
  for (const value of [structuredClone(metadata), Object.freeze({ ...metadata }), null])
    await assert.rejects(metadataCustomLibrarySources(value, adapters), /inspected inventory/);
  for (const key of ['isCurrent', 'availability', 'launch', 'compatibility', 'describe'])
    await assert.rejects(
      metadataCustomLibrarySources(metadata, { ...adapters, [key]: undefined }),
      /explicit owner/,
    );
  await assert.rejects(
    metadataCustomLibrarySources(metadata, { ...adapters, isCurrent: () => false }),
    /changed/,
  );
  await assert.rejects(
    metadataCustomLibrarySources(metadata, { ...adapters, isOfficial: () => 'yes' }),
    /boolean/,
  );
});

test('metadata browsing never requests artwork or constructs image decoders', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('No browsing downloads');
  });
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      constructor() {
        throw new Error('No browsing decode');
      }
    },
  });
  t.after(() =>
    previous ? Object.defineProperty(globalThis, 'Image', previous) : delete globalThis.Image,
  );
  const metadata = await inspected();
  let plays = 0;
  const library = createMissionLibrary(
    await metadataCustomLibrarySources(metadata, {
      ...adapters,
      availability: () => ({
        state: 'unavailable',
        reason: 'Original picture requires preparation.',
      }),
      launch: () => {
        plays++;
      },
    }),
  );
  assert.equal(library.missions.length, 3);
  assert.equal(library.availability(library.missions[0], 'solo').state, 'unavailable');
  assert.equal(plays, 0);
  assert.equal(JSON.stringify(metadata).includes('data:image'), false);
});

test('official exclusion is explicit; modes and same-name pack ownership remain distinct', async () => {
  const another = structuredClone(recipe);
  another.id = 'another-pack';
  const metadata = await inspected([recipe, another]);
  const sources = await metadataCustomLibrarySources(metadata, {
    ...adapters,
    compatibility: ({ levelIndex }) => (levelIndex === 1 ? [] : ['versus']),
  });
  const library = createMissionLibrary(sources);
  assert.equal(library.missions.length, 4);
  assert.equal(new Set(library.missions.map((mission) => mission.id)).size, 4);
  assert(library.missions.every((mission) => mission.modes.join() === 'versus'));
  assert.throws(() => library.launch(library.missions[0], { mode: 'solo' }), /support/);
  const selected = await metadataCustomLibrarySources(metadata, {
    ...adapters,
    isOfficial: (pack) => pack.id === recipe.id,
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, JSON.stringify(['custom', another.id]));
  for (const modes of [['solo', 'solo'], ['mystery'], 'solo'])
    await assert.rejects(
      metadataCustomLibrarySources(metadata, { ...adapters, compatibility: () => modes }),
      /compatibility/,
    );
});

test('replaced inventory invalidates old bindings and late official verification', async () => {
  const metadata = await inspected();
  let current = true,
    plays = 0,
    progressReads = 0;
  const sources = await metadataCustomLibrarySources(metadata, {
    ...adapters,
    isCurrent: () => current,
    progress: () => {
      progressReads++;
      return 'Not cleared';
    },
    launch: () => {
      plays++;
    },
  });
  const library = createMissionLibrary(sources),
    row = library.missions[0];
  assert.equal(library.progress(row, 'solo'), 'Not cleared');
  current = false;
  assert.equal(library.availability(row, 'solo').state, 'unavailable');
  assert.equal(library.progress(row, 'solo'), '');
  assert.equal(progressReads, 1);
  assert.throws(() => sources[0].launch(sources[0].entries[0], {}), /changed/);
  assert.equal(plays, 0);
  current = true;
  let release;
  const pending = metadataCustomLibrarySources(metadata, {
    ...adapters,
    isCurrent: () => current,
    isOfficial: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  current = false;
  release(false);
  await assert.rejects(pending, /changed/);
});

test('preparation rejects changed inventory after await; forged bindings never reach host adapters', async () => {
  const metadata = await inspected();
  let current = true,
    release;
  const [source] = await metadataCustomLibrarySources(metadata, {
    ...adapters,
    isCurrent: () => current,
    prepare: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const binding = source.entries[0];
  assert.throws(() => source.launch({ ...binding }, {}), /Unknown/);
  assert.throws(() => source.availability({ ...binding }, 'solo'), /Unknown/);
  const pending = source.prepare(binding, {});
  current = false;
  release(true);
  await assert.rejects(pending, /changed/);
});
