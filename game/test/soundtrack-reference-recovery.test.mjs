import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import {
  emptySoundtrackLibrary,
  resolveCatalogueTrack,
  resolveSoundtrackCatalogue,
  resolveSoundtrackLibrary,
  setCatalogueTracks,
  soundtrackRecoveryPlan,
  resolveSoundtrackSelection,
} from '../soundtrack.mjs';
import {
  exportSoundtrackBundle,
  importSoundtrackBundle,
  prepareSoundtrackLibrary,
} from '../soundtrack-bundle.mjs';
import { mergeSoundtrackShare, soundtrackPlaylistShare } from '../soundtrack-share.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createSoundtrackSource } from '../soundtrack-source.mjs';
import { responseFor } from './helpers/soundtrack-albums.mjs';

const free = await fixture('recovery-free'),
  limited = await fixture('recovery-limited');
const entry = (raw, name, redistribute) => {
  const id = `builtin.catalog.recovery-${name}`;
  return resolveCatalogueTrack({
    ...raw.track,
    id,
    edition: 'recovery-review',
    path: `optional/recovery-${name}.mp3`,
    tags: { genres: ['ukrainian'], role: 'any', energy: 3, themes: [] },
    policy: {
      id,
      sha256: raw.track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute,
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'not-registered',
    },
  });
};
const allowed = entry(free, 'free', 'allowed'),
  restricted = entry(limited, 'limited', 'denied'),
  catalogue = resolveSoundtrackCatalogue({
    format: 'revealline-soundtrack-catalogue.v2',
    edition: 'recovery-review',
    tracks: [allowed, restricted],
  }),
  options = { catalogue, probeMedia: structuralProbe };

async function withoutOriginal(blob, id) {
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer()),
    size = new DataView(header.buffer).getUint32(8, false),
    manifest = JSON.parse(await blob.slice(12, 12 + size).text());
  manifest.library.installedTrackIds = [];
  manifest.library.referenceOnlyTrackIds = [id];
  manifest.referenceOnlyTrackIds = [id];
  manifest.assets = [];
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  new DataView(header.buffer).setUint32(8, json.length, false);
  return new Blob([header, json]);
}

for (const alias of [false, true])
  test(`import and offline preparation reject a falsely omitted permitted ${alias ? 'upload alias' : 'catalogue original'}`, async () => {
    const id = alias ? 'upload.free-alias' : allowed.id,
      library = alias
        ? resolveSoundtrackLibrary({
            ...emptySoundtrackLibrary({ catalogue: true }),
            tracks: [{ ...free.track, id }],
          })
        : setCatalogueTracks(emptySoundtrackLibrary(), [allowed]),
      omitted = await withoutOriginal(
        await exportSoundtrackBundle(library, free.assets, { catalogue }),
        id,
      );
    await assert.rejects(importSoundtrackBundle(omitted, options), /every permitted original/);
    await assert.rejects(
      prepareSoundtrackLibrary(
        { ...library, installedTrackIds: [], referenceOnlyTrackIds: [id] },
        [],
        options,
      ),
      /every permitted original/,
    );
  });

test('a reference imported without authority cannot bypass trusted validation through share merge or replace stored originals', async () => {
  const base = setCatalogueTracks(emptySoundtrackLibrary(), [allowed]),
    full = await prepareSoundtrackLibrary(
      { ...base, installedTrackIds: [allowed.id] },
      free.assets,
      options,
    ),
    omitted = await withoutOriginal(
      await exportSoundtrackBundle(base, free.assets, { catalogue }),
      allowed.id,
    ),
    unknown = await importSoundtrackBundle(omitted, { probeMedia: structuralProbe }),
    merged = mergeSoundtrackShare(emptySoundtrackLibrary(), [], unknown),
    memory = memoryIndexedDB(),
    store = createManagedMediaStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  try {
    await store.commitDomain('audio', full, { expectedGeneration: 0 });
    const before = await store.readDomain('audio');
    await assert.rejects(
      prepareSoundtrackLibrary(merged.library, merged.assets, options),
      /every permitted original/,
    );
    await assert.rejects(importSoundtrackBundle(omitted, options), /every permitted original/);
    assert.deepEqual(await store.readDomain('audio'), before);
    assert.deepEqual(
      (await store.readDomain('audio')).assets.map((asset) => asset.sha256),
      [free.track.asset.sha256],
    );
  } finally {
    store.close();
  }
});

test('unknown restricted upload references survive export/import without acquiring byte or network authority', async () => {
  const alias = { ...limited.track, id: 'upload.restricted-alias' },
    library = resolveSoundtrackLibrary({
      ...emptySoundtrackLibrary({ catalogue: true }),
      tracks: [alias],
      playlists: [
        {
          id: 'my.mix',
          title: 'Preserved alias',
          trackIds: [alias.id, alias.id],
          order: 'ordered',
          repeat: 'all',
        },
      ],
      selection: { playlistId: 'my.mix' },
    }),
    first = await exportSoundtrackBundle(library, limited.assets, { catalogue }),
    unknown = await importSoundtrackBundle(first, { probeMedia: structuralProbe }),
    plan = soundtrackRecoveryPlan(unknown.library);
  assert.deepEqual(plan.referenceOnlyTrackIds, [alias.id]);
  assert.deepEqual(plan.requiredTracks, []);
  const second = await exportSoundtrackBundle(unknown.library, []);
  assert.deepEqual(await second.arrayBuffer(), await first.arrayBuffer());
  assert.deepEqual(resolveSoundtrackSelection(unknown.library).playlist.trackIds, []);
  assert.deepEqual(
    resolveSoundtrackSelection(unknown.library, {}, { catalogue }).playlist.trackIds,
    [alias.id, alias.id],
  );
  let requests = 0;
  const empty = resolveSoundtrackCatalogue({ ...catalogue, tracks: [] }),
    untrusted = createSoundtrackSource({
      catalogue: empty,
      fetch: () => {
        requests++;
        throw Error('Unexpected request');
      },
    });
  await assert.rejects(untrusted.readAsset(alias.asset.sha256), /missing locally/);
  assert.equal(requests, 0);
  const trusted = createSoundtrackSource({
    catalogue,
    baseURL: 'https://game.test/edition/',
    fetch: async (url) => {
      requests++;
      assert.equal(url, 'https://game.test/edition/optional/recovery-limited.mp3');
      return responseFor(limited.blob, url);
    },
  });
  assert.deepEqual(
    await (await trusted.readAsset(alias.asset.sha256)).arrayBuffer(),
    await limited.blob.arrayBuffer(),
  );
  assert.equal(requests, 1);
});

test('trusted matching hash authority can require bytes for a previously unknown reference', async () => {
  const library = resolveSoundtrackLibrary({
    ...emptySoundtrackLibrary({ catalogue: true }),
    tracks: [{ ...free.track, id: 'upload.once-unknown' }],
    referenceOnlyTrackIds: ['upload.once-unknown'],
  });
  assert.deepEqual(soundtrackRecoveryPlan(library).requiredTracks, []);
  assert.deepEqual(
    soundtrackRecoveryPlan(library, { catalogue }).requiredTracks.map((track) => track.id),
    ['upload.once-unknown'],
  );
  await assert.rejects(
    exportSoundtrackBundle(library, [], { catalogue }),
    /every referenced asset/,
  );
  const restored = await importSoundtrackBundle(
    await exportSoundtrackBundle(library, free.assets, { catalogue }),
    options,
  );
  assert.deepEqual(restored.library.referenceOnlyTrackIds, []);
  assert.equal(restored.assets.length, 1);
});

for (const offlineCache of ['denied', 'unknown'])
  test(`additive shares retain catalogue and renamed-upload references when offline storage is ${offlineCache}`, async () => {
    const source = entry(limited, `storage-${offlineCache}`, 'allowed');
    const streamOnly = resolveCatalogueTrack({
      ...source,
      policy: { ...source.policy, offlineCache },
    });
    const trusted = resolveSoundtrackCatalogue({ ...catalogue, tracks: [allowed, streamOnly] });
    const alias = {
      ...limited.track,
      id: `upload.storage-${offlineCache}`,
      rights: { ...limited.track.rights, kind: 'original' },
    };
    const original = resolveSoundtrackLibrary({
      ...setCatalogueTracks(emptySoundtrackLibrary(), [streamOnly]),
      tracks: [alias],
      playlists: [
        {
          id: 'shared.streams',
          title: 'References with repeats',
          trackIds: [streamOnly.id, alias.id, streamOnly.id],
          order: 'ordered',
          repeat: 'all',
        },
      ],
    });
    const share = soundtrackPlaylistShare(original, original.playlists[0], {
      catalogue: trusted,
    });
    const bundle = await exportSoundtrackBundle(share, limited.assets, { catalogue: trusted });
    const header = new Uint8Array(await bundle.slice(0, 12).arrayBuffer());
    const size = new DataView(header.buffer).getUint32(8, false);
    const manifest = JSON.parse(await bundle.slice(12, 12 + size).text());
    assert.deepEqual(manifest.assets, []);
    assert.equal(bundle.size, 12 + size, 'No audio payload follows the reference-only manifest');
    const references = new Set([streamOnly.id, alias.id]);
    assert.deepEqual(new Set(manifest.referenceOnlyTrackIds), references);
    const imported = await importSoundtrackBundle(bundle, {
      catalogue: trusted,
      probeMedia: structuralProbe,
    });
    const current = resolveSoundtrackLibrary({
      ...setCatalogueTracks(emptySoundtrackLibrary(), [allowed]),
      installedTrackIds: [allowed.id],
      playlists: [
        {
          id: 'existing.choice',
          title: 'Keep my current playlist',
          trackIds: [allowed.id],
          order: 'shuffle',
          repeat: 'all',
        },
      ],
      selection: { playlistId: 'existing.choice' },
    });
    const merged = mergeSoundtrackShare(current, free.assets, imported);
    assert.deepEqual(merged.library.selection, current.selection);
    assert.deepEqual(merged.library.playlists, [...current.playlists, ...share.playlists]);
    assert.deepEqual(new Set(merged.library.referenceOnlyTrackIds), references);
    assert.deepEqual(merged.library.installedTrackIds, [allowed.id]);
    assert.deepEqual(
      merged.assets.map((asset) => asset.sha256),
      [allowed.asset.sha256],
    );
    const prepared = await prepareSoundtrackLibrary(merged.library, merged.assets, {
      catalogue: trusted,
      probeMedia: structuralProbe,
    });
    assert.deepEqual(await prepared.assets[0].blob.arrayBuffer(), await free.blob.arrayBuffer());
    const restored = await importSoundtrackBundle(
      await exportSoundtrackBundle(prepared.library, prepared.assets, { catalogue: trusted }),
      { catalogue: trusted, probeMedia: structuralProbe },
    );
    assert.deepEqual(restored.library, prepared.library);
    assert.deepEqual(
      restored.assets.map((asset) => asset.sha256),
      [allowed.asset.sha256],
    );
  });

test('Installed only excludes restored aliases without bytes and recognizes the same original owned under another ID', () => {
  const alias = { ...limited.track, id: 'upload.offline-alias' },
    empty = emptySoundtrackLibrary({ catalogue: true }),
    library = resolveSoundtrackLibrary({
      ...empty,
      tracks: [alias],
      tags: { [alias.id]: restricted.tags },
      referenceOnlyTrackIds: [alias.id],
      listening: { ...empty.listening, installedOnly: true, mode: 'ukrainian' },
      playlists: [
        {
          id: 'offline.alias',
          title: 'Offline alias',
          trackIds: [alias.id],
          order: 'ordered',
          repeat: 'all',
        },
      ],
    });
  assert.deepEqual(resolveSoundtrackSelection(library, {}, { catalogue }).playlist.trackIds, []);
  assert.deepEqual(
    resolveSoundtrackSelection(
      { ...library, selection: { playlistId: 'offline.alias' } },
      {},
      { catalogue },
    ).playlist.trackIds,
    [],
  );
  const downloaded = resolveSoundtrackLibrary({
    ...library,
    tracks: [...library.tracks, { ...limited.track, id: 'upload.downloaded-original' }],
  });
  assert.deepEqual(
    resolveSoundtrackSelection(
      { ...downloaded, selection: { playlistId: 'offline.alias' } },
      {},
      { catalogue },
    ).playlist.trackIds,
    [alias.id],
  );
  const pinned = setCatalogueTracks(library, [restricted]);
  assert.deepEqual(resolveSoundtrackSelection(pinned, {}, { catalogue }).playlist.trackIds, []);
  assert.deepEqual(
    resolveSoundtrackSelection(
      { ...pinned, selection: { playlistId: 'offline.alias' } },
      { installedTrackIds: [restricted.id] },
      { catalogue },
    ).playlist.trackIds,
    [alias.id],
  );
});
