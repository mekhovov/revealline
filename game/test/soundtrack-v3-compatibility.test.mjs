import assert from 'node:assert/strict';
import test from 'node:test';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import {
  createManagedMediaStore as createV2Manager,
  prepareManagedMediaBytes as prepareV2Media,
} from './fixtures/soundtrack-v2/managed-media-store.mjs';
import { prepareStoredStories, emptyStoredStories } from '../story-storage-record.mjs';
import {
  emptySoundtrackLibrary,
  upgradeSoundtrackLibrary,
  resolveSoundtrackLibrary,
  soundtrackPlaylists,
  SOUNDTRACK_GENRES,
} from '../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
const sample = await fixture('future-format');
const prepare = (value, assets = []) =>
  prepareSoundtrackLibrary(value, assets, { probeMedia: structuralProbe });
const oldLibrary = emptySoundtrackLibrary({ catalogue: true, version: 2 });
const still = { format: 'revealline-managed-bytes.v1', items: [] };

test('v2 writers retain legacy genre choices and require v3 before writing expanded styles', () => {
  assert.deepEqual(oldLibrary.listening.genres, ['synth90s', 'metal', 'ukrainian']);
  assert(
    !soundtrackPlaylists(oldLibrary).some(
      (playlist) => playlist.id === 'builtin.playlist.chiptune',
    ),
  );
  assert.deepEqual(emptySoundtrackLibrary({ catalogue: true }).listening.genres, SOUNDTRACK_GENRES);
  assert.equal(
    emptySoundtrackLibrary({ catalogue: true }).listening.mode,
    'synth90s',
    'fresh v3 libraries start with the hosted retro style',
  );
  for (const patch of [{ mode: 'chiptune' }, { genres: ['chiptune'] }]) {
    const value = { ...oldLibrary, listening: { ...oldLibrary.listening, ...patch } };
    assert.throws(() => resolveSoundtrackLibrary(value), /require library v3/);
  }
  const tagged = {
    ...oldLibrary,
    tracks: [sample.track],
    tags: { [sample.track.id]: { genres: ['ambient'], role: 'any', energy: 2, themes: [] } },
  };
  assert.throws(() => resolveSoundtrackLibrary(tagged), /require library v3/);
  assert.equal(
    resolveSoundtrackLibrary({
      ...emptySoundtrackLibrary({ catalogue: true }),
      tracks: tagged.tracks,
      tags: tagged.tags,
    }).tags[sample.track.id].genres[0],
    'ambient',
  );
});

test('frozen DB5/v2 readers reject a v3 row without touching shared metadata or audio', async () => {
  const memory = memoryIndexedDB();
  const current = createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  const old = createV2Manager({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  await current.commitDomain('audio', await prepare(oldLibrary), { expectedGeneration: 0 });
  assert.equal((await old.readDomain('audio')).library.format, oldLibrary.format);
  const modern = await prepare(upgradeSoundtrackLibrary(sample.library), sample.assets);
  await current.commitDomain('audio', modern, { expectedGeneration: 1 });
  const before = await current.readDomain('audio');
  const writes = memory.allPuts.length;
  await assert.rejects(old.readDomain('audio'), /Unknown|Unsupported|not supported/);
  await assert.rejects(old.usage(), /Unknown|Unsupported|not supported/);
  await assert.rejects(
    old.commitDomain('audio', await prepare(oldLibrary), { expectedGeneration: 2 }),
    /Unknown|Unsupported|not supported/,
  );
  assert.equal(memory.allPuts.length, writes);
  assert.deepEqual(await current.readDomain('audio'), before);
  assert.equal(
    memory.contents().get('audio').get(sample.track.asset.sha256).size,
    sample.blob.size,
  );
  old.close();
  current.close();
});

for (const domain of ['audio', 'media', 'story']) {
  test(`an already-open frozen v2 ${domain} writer cannot mutate any domain after concurrent v3 adoption`, async () => {
    const memory = memoryIndexedDB();
    const current = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      soundtrackCatalogue: true,
    });
    await current.commitDomain('audio', await prepare(oldLibrary), { expectedGeneration: 0 });
    let enter, release;
    const entered = new Promise((resolve) => {
      enter = resolve;
    });
    const old = createV2Manager({
      indexedDB: memory.indexedDB,
      soundtrackCatalogue: true,
      estimate: () => {
        enter();
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    const pendingValue =
      domain === 'audio'
        ? sample.prepared
        : domain === 'media'
          ? await prepareV2Media(still, [])
          : await prepareStoredStories(emptyStoredStories(), [], { still });
    const pending = old.commitDomain(domain, pendingValue, {
      expectedGeneration: domain === 'audio' ? 1 : 0,
    });
    await entered;
    const modern = await prepare(upgradeSoundtrackLibrary(sample.library), sample.assets);
    await current.commitDomain('audio', modern, { expectedGeneration: 1 });
    const before = await current.usage();
    const writes = memory.allPuts.length;
    release({ usage: 0, quota: 1e9 });
    await assert.rejects(pending, /Unknown|Unsupported|not supported/);
    assert.equal(memory.allPuts.length, writes);
    assert.deepEqual(await current.usage(), before);
    assert.equal((await current.readDomain('audio')).library.format, 'revealline-soundtrack.v3');
    assert.equal((await current.readDomain('media')).generation, 0);
    assert.equal((await current.readDomain('story')).generation, 0);
    old.close();
    current.close();
  });
}
