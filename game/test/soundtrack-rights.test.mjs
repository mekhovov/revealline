import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import {
  SOUNDTRACK_FORMAT_V2,
  SOUNDTRACK_FORMAT_V3,
  SOUNDTRACK_LIMITS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
  resolveSoundtrackCatalogue,
  resolveCatalogueTrack,
  setCatalogueTracks,
  soundtrackRecoveryPlan,
  soundtrackRights,
  resolveSoundtrackSelection,
  soundtrackStoredTracks,
} from '../soundtrack.mjs';
import {
  prepareSoundtrackLibrary,
  exportSoundtrackBundle,
  importSoundtrackBundle,
} from '../soundtrack-bundle.mjs';
import { soundtrackPlaylistShare, mergeSoundtrackShare } from '../soundtrack-share.mjs';
import { createSoundtrackSource } from '../soundtrack-source.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { responseFor } from './helpers/soundtrack-albums.mjs';
import { prepareMP3Import } from '../mp3.mjs';

const free = await fixture('free-v3'),
  restricted = await fixture('restricted-v3');
function track(raw, id, patch = {}) {
  return resolveCatalogueTrack({
    ...raw.track,
    id,
    edition: 'rights-1',
    path: `optional/soundtracks/${id}.mp3`,
    tags: { genres: ['synth90s'], role: 'any', energy: 3, themes: ['retro'] },
    policy: {
      id,
      sha256: raw.track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute: 'allowed',
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'not-registered',
      ...patch,
    },
    fileName: `${id}.mp3`,
    websites: [{ label: 'Creator', url: 'https://example.test/creator' }],
  });
}
const permissive = track(free, 'builtin.catalog.free'),
  limited = track(restricted, 'builtin.catalog.limited', { redistribute: 'denied' });
const catalog = (...tracks) =>
  resolveSoundtrackCatalogue({
    format: 'revealline-soundtrack-catalogue.v2',
    edition: 'rights-1',
    tracks,
  });
const catalogue = catalog(permissive, limited);
const library = () => {
  const result = setCatalogueTracks(emptySoundtrackLibrary(), catalogue.tracks);
  return resolveSoundtrackLibrary({
    ...result,
    playlists: [
      {
        id: 'mine',
        title: 'My mix',
        trackIds: [limited.id, permissive.id, limited.id],
        order: 'ordered',
        repeat: 'one',
      },
    ],
    selection: { playlistId: 'mine' },
  });
};
const prepare = (value, assets, options = {}) =>
  prepareSoundtrackLibrary(value, assets, { probeMedia: structuralProbe, catalogue, ...options });
const importBundle = (blob, options = {}) =>
  importSoundtrackBundle(blob, { probeMedia: structuralProbe, catalogue, ...options });
async function decode(blob) {
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const size = new DataView(header.buffer).getUint32(8, false);
  return {
    header,
    manifest: JSON.parse(await blob.slice(12, 12 + size).text()),
    body: blob.slice(12 + size),
  };
}
async function changedBundle(blob, edit) {
  const { header, manifest, body } = await decode(blob);
  edit(manifest);
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  new DataView(header.buffer).setUint32(8, json.length, false);
  return new Blob([header, json, body]);
}

test('catalogue v2 binds all policy fields to exact identity/hash and rejects unsafe metadata', () => {
  for (const patch of [
    { id: 'different' },
    { sha256: '0'.repeat(64) },
    { redistribute: true },
    { contentId: 'safe' },
  ])
    assert.throws(() =>
      resolveCatalogueTrack({ ...limited, policy: { ...limited.policy, ...patch } }),
    );
  assert.throws(() =>
    resolveCatalogueTrack({ ...limited, websites: [{ label: 'Bad', url: 'javascript:alert(1)' }] }),
  );
  assert.throws(() => resolveCatalogueTrack({ ...limited, fileName: '../bad.mp3' }));
  assert.throws(() => catalog({ ...limited, policy: undefined }));
  const old = {
    ...emptySoundtrackLibrary({ catalogue: true, version: 2 }),
    catalogTracks: [limited],
  };
  assert.throws(() => resolveSoundtrackLibrary(old), /require library v3/);
});

test('pins cannot grant permissions; trusted hash restrictions follow renamed personal uploads', () => {
  assert.equal(soundtrackRights(permissive).redistribute, 'unknown');
  assert.equal(soundtrackRights(permissive, { catalogue }).redistribute, 'allowed');
  const forged = { ...limited, policy: { ...limited.policy, redistribute: 'allowed' } };
  assert.equal(soundtrackRights(forged, { catalogue }).redistribute, 'denied');
  const renamed = {
    ...restricted.track,
    id: 'upload.renamed',
    rights: { ...restricted.track.rights, kind: 'original' },
  };
  assert.equal(soundtrackRights(renamed, { catalogue }).redistribute, 'denied');
  let reads = 0;
  assert.throws(() =>
    soundtrackRights(
      {
        get asset() {
          reads++;
          return limited.asset;
        },
      },
      { catalogue },
    ),
  );
  assert.equal(reads, 0);
});

test('v3 mixed recovery includes all permitted originals and explicit restricted references with exact playlist order', async () => {
  const original = library();
  const plan = soundtrackRecoveryPlan(original, { catalogue });
  assert.deepEqual(plan.referenceOnlyTrackIds, [limited.id]);
  assert.deepEqual(
    plan.requiredTracks.map((item) => item.id),
    [permissive.id],
  );
  assert.match(plan.notice, /without audio/);
  await assert.rejects(exportSoundtrackBundle(original, [], { catalogue }), /every referenced/);
  const body = await exportSoundtrackBundle(original, [...free.assets, ...restricted.assets], {
    catalogue,
  });
  assert.equal(await body.slice(0, 8).text(), 'RLSTB3\r\n');
  const { manifest } = await decode(body);
  assert.deepEqual(manifest.referenceOnlyTrackIds, [limited.id]);
  assert.deepEqual(
    manifest.assets.map((asset) => asset.sha256),
    [free.track.asset.sha256],
  );
  const imported = await importBundle(body);
  assert.equal(imported.library.format, SOUNDTRACK_FORMAT_V3);
  assert.deepEqual(imported.library.playlists, original.playlists);
  assert.deepEqual(imported.library.selection, original.selection);
  assert.deepEqual(imported.library.referenceOnlyTrackIds, [limited.id]);
  assert.deepEqual(imported.library.installedTrackIds, [permissive.id]);
  assert.deepEqual(await imported.assets[0].blob.arrayBuffer(), await free.blob.arrayBuffer());
  assert.deepEqual(original.referenceOnlyTrackIds, []);
  assert.deepEqual(
    await (
      await exportSoundtrackBundle(imported.library, imported.assets, { catalogue })
    ).arrayBuffer(),
    await body.arrayBuffer(),
  );
  for (const edit of [
    (value) => {
      value.referenceOnlyTrackIds = [];
    },
    (value) => {
      value.library.installedTrackIds.push(limited.id);
    },
    (value) => {
      value.assets = [];
    },
  ])
    await assert.rejects(importBundle(await changedBundle(body, edit)));
});

for (const offlineCache of ['denied', 'unknown'])
  test(`recovery preserves references when redistribution is allowed but offline storage is ${offlineCache}`, async () => {
    const streamOnly = track(restricted, `builtin.catalog.storage-${offlineCache}`, {
      offlineCache,
      redistribute: 'allowed',
    });
    const trusted = catalog(streamOnly);
    const original = resolveSoundtrackLibrary({
      ...setCatalogueTracks(emptySoundtrackLibrary(), [streamOnly]),
      playlists: [
        {
          id: 'storage.mix',
          title: 'Streamed recordings',
          trackIds: [streamOnly.id, streamOnly.id],
          order: 'ordered',
          repeat: 'all',
        },
      ],
      selection: { playlistId: 'storage.mix' },
    });
    const plan = soundtrackRecoveryPlan(original, { catalogue: trusted });
    assert.deepEqual(plan.requiredTracks, []);
    assert.deepEqual(plan.referenceOnlyTrackIds, [streamOnly.id]);
    assert.match(plan.notice, /offline|storage/i);
    assert.doesNotMatch(plan.notice, /redistribution is not permitted/i);

    // Even bytes left by an older installation must not enter an unrestorable backup.
    const bundle = await exportSoundtrackBundle(original, restricted.assets, {
      catalogue: trusted,
    });
    const { manifest, body } = await decode(bundle);
    assert.deepEqual(manifest.assets, []);
    assert.equal(body.size, 0);
    assert.deepEqual(manifest.referenceOnlyTrackIds, [streamOnly.id]);
    assert.deepEqual(manifest.library.referenceOnlyTrackIds, [streamOnly.id]);
    assert.deepEqual(manifest.library.installedTrackIds, []);
    assert.deepEqual(
      await (await exportSoundtrackBundle(original, [], { catalogue: trusted })).arrayBuffer(),
      await bundle.arrayBuffer(),
      'Reference recovery never requires a download or retained original',
    );
    const imported = await importBundle(bundle, { catalogue: trusted });
    assert.deepEqual(imported.assets, []);
    assert.deepEqual(imported.library.playlists, original.playlists);
    assert.deepEqual(imported.library.selection, original.selection);
    assert.deepEqual(imported.library.referenceOnlyTrackIds, [streamOnly.id]);
    const prepared = await prepare(imported.library, [], { catalogue: trusted });
    assert.deepEqual(prepared.library, imported.library);
    assert.deepEqual(prepared.assets, []);
    assert.deepEqual(
      await (
        await exportSoundtrackBundle(prepared.library, prepared.assets, { catalogue: trusted })
      ).arrayBuffer(),
      await bundle.arrayBuffer(),
    );
    assert.deepEqual(original.referenceOnlyTrackIds, []);
  });

test('restricted upload aliases cannot leak the same bytes through recovery or selected shares', async () => {
  const base = library();
  const alias = {
    ...restricted.track,
    id: 'renamed',
    rights: { ...restricted.track.rights, kind: 'licensed', license: 'Pretended permission' },
  };
  const value = resolveSoundtrackLibrary({
    ...base,
    tracks: [alias],
    playlists: [{ ...base.playlists[0], trackIds: [alias.id, limited.id, permissive.id] }],
  });
  const share = soundtrackPlaylistShare(value, value.playlists[0], { catalogue });
  const plan = soundtrackRecoveryPlan(share, { catalogue });
  assert.deepEqual(new Set(plan.referenceOnlyTrackIds), new Set([alias.id, limited.id]));
  const body = await exportSoundtrackBundle(share, [...free.assets, ...restricted.assets], {
    catalogue,
  });
  const imported = await importBundle(body);
  assert.equal(imported.assets.length, 1);
  const merged = mergeSoundtrackShare(emptySoundtrackLibrary({ catalogue: true }), [], imported);
  assert.deepEqual(merged.library.playlists, share.playlists);
  assert.deepEqual(new Set(merged.library.referenceOnlyTrackIds), new Set([alias.id, limited.id]));
  await prepare(merged.library, merged.assets);
});

test('source denies restricted export and unknown offline permission before reading bytes or making network requests', async () => {
  let localReads = 0,
    requests = 0;
  const streamOnly = track(restricted, limited.id, {
    redistribute: 'denied',
    offlineCache: 'unknown',
  });
  const trusted = catalog(streamOnly);
  const source = createSoundtrackSource({
    catalogue: trusted,
    baseURL: 'https://game.test/v3/',
    readLocal: () => {
      localReads++;
      return null;
    },
    fetch: async (url) => {
      requests++;
      return responseFor(restricted.blob, url);
    },
  });
  await assert.rejects(
    source.readAsset(limited.asset.sha256, { purpose: 'export' }),
    /not approved/,
  );
  await assert.rejects(
    source.readAsset(limited.asset.sha256, { purpose: 'offline' }),
    /not approved/,
  );
  assert.equal(localReads, 0);
  assert.equal(requests, 0);
  await source.readAsset(limited.asset.sha256);
  assert.equal(requests, 1);
  const value = setCatalogueTracks(emptySoundtrackLibrary(), [streamOnly]);
  await assert.rejects(
    prepare({ ...value, installedTrackIds: [streamOnly.id] }, restricted.assets, {
      catalogue: trusted,
    }),
    /offline/,
  );
  await prepare(value, [], { catalogue: trusted });
});

test('Recording mode requires verified gameplay-video rights and unregistered Content ID; ordinary listening remains independent', () => {
  const unsafe = track(restricted, limited.id, {
    gameplayVideo: 'unknown',
    contentId: 'registered',
  });
  const trusted = catalog(permissive, unsafe);
  let value = setCatalogueTracks(emptySoundtrackLibrary(), trusted.tracks);
  value = { ...value, listening: { ...value.listening, recordingMode: true, mode: 'synth90s' } };
  assert.deepEqual(
    resolveSoundtrackSelection(value, {}, { catalogue: trusted }).playlist.trackIds,
    [permissive.id],
  );
  assert(!resolveSoundtrackSelection(value).playlist.trackIds.includes(permissive.id));
  value = { ...value, listening: { ...value.listening, recordingMode: false } };
  assert.deepEqual(
    resolveSoundtrackSelection(value, {}, { catalogue: trusted }).playlist.trackIds,
    [permissive.id, unsafe.id],
  );
});

test('automatic selection applies explicit energy preference after scene and theme; authored playlist order survives', () => {
  const calm = { ...permissive, tags: { ...permissive.tags, role: 'menu', energy: 1 } };
  const intense = { ...limited, tags: { ...limited.tags, role: 'gameplay', energy: 5 } };
  const value = setCatalogueTracks(emptySoundtrackLibrary(), [calm, intense]);
  const trusted = catalog(calm, intense);
  assert.deepEqual(
    resolveSoundtrackSelection(
      value,
      { scene: 'menu', themeId: 'retro', energy: 5 },
      { catalogue: trusted },
    ).playlist.trackIds,
    [calm.id],
  );
  const any = { ...intense, tags: { ...intense.tags, role: 'any' } };
  const both = setCatalogueTracks(emptySoundtrackLibrary(), [calm, any]);
  assert.deepEqual(
    resolveSoundtrackSelection(
      both,
      { scene: 'menu', energy: 4 },
      { catalogue: catalog(calm, any) },
    ).playlist.trackIds,
    [any.id],
  );
  assert.throws(
    () => resolveSoundtrackSelection(value, { energy: 6 }, { catalogue: trusted }),
    /energy/,
  );
});

test('DB5 keeps v3 references atomic and rejects downgrade or stale writers', async () => {
  const memory = memoryIndexedDB();
  const store = createManagedMediaStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  const full = await prepare({ ...library(), installedTrackIds: [permissive.id, limited.id] }, [
    ...free.assets,
    ...restricted.assets,
  ]);
  await store.commitDomain('audio', full, { expectedGeneration: 0 });
  const recovered = await importBundle(
    await exportSoundtrackBundle(full.library, full.assets, { catalogue }),
  );
  memory.failPutAt = 1;
  await assert.rejects(store.commitDomain('audio', recovered, { expectedGeneration: 1 }));
  memory.failPutAt = null;
  assert.equal((await store.readDomain('audio')).assets.length, 2);
  await store.commitDomain('audio', recovered, { expectedGeneration: 1 });
  const saved = await store.readDomain('audio');
  assert.deepEqual(saved.library.referenceOnlyTrackIds, [limited.id]);
  assert.equal(saved.assets.length, 1);
  const old = await prepare(emptySoundtrackLibrary({ catalogue: true, version: 2 }), []);
  assert.equal(old.library.format, SOUNDTRACK_FORMAT_V2);
  await assert.rejects(store.commitDomain('audio', old, { expectedGeneration: 2 }), /downgraded/);
  await assert.rejects(store.commitDomain('audio', full, { expectedGeneration: 1 }), /changed/);
  assert.deepEqual(await store.readDomain('audio'), saved);
  store.close();
});

test('full 256 catalogue + 123 uploads + 26 playlists stays within bounded metadata and 512-asset envelope', async () => {
  const tracks = Array.from({ length: 256 }, (_, index) => {
    const id = `builtin.catalog.track-${index}`;
    return resolveCatalogueTrack({
      ...permissive,
      id,
      policy: { ...permissive.policy, id },
      title: `A memorable composition ${index}`,
      fileName: `original-composition-${index}.mp3`,
    });
  });
  let value = setCatalogueTracks(emptySoundtrackLibrary(), tracks);
  value = resolveSoundtrackLibrary({
    ...value,
    installedTrackIds: tracks.map((track) => track.id),
    tracks: Array.from({ length: 123 }, (_, index) => ({ ...free.track, id: `upload.${index}` })),
    playlists: Array.from({ length: 26 }, (_, index) => ({
      id: `list.${index}`,
      title: `Mixed collection ${index}`,
      trackIds: [tracks[index].id, `upload.${index}`],
      order: 'shuffle',
      repeat: 'all',
    })),
  });
  assert.equal(value.catalogTracks.length + value.tracks.length, 379);
  assert(new TextEncoder().encode(JSON.stringify(value)).length <= SOUNDTRACK_LIMITS.metadataBytes);
  assert.equal(SOUNDTRACK_LIMITS.assets, 512);
  const trusted = catalog(...tracks);
  const body = await exportSoundtrackBundle(value, free.assets, { catalogue: trusted });
  const recovered = await importBundle(body, { catalogue: trusted });
  assert.equal(recovered.library.catalogTracks.length, 256);
  assert.equal(recovered.library.tracks.length, 123);
  assert.equal(soundtrackStoredTracks(recovered.library).length, 379);
  assert.throws(
    () =>
      setCatalogueTracks(value, [
        {
          ...permissive,
          id: 'builtin.catalog.too-many',
          policy: { ...permissive.policy, id: 'builtin.catalog.too-many' },
        },
      ]),
    /count|budget/,
  );
});

test('v3 preserves an uploaded original filename through title edits and bundle/share recovery', async () => {
  const { track: imported } = await prepareMP3Import(
    free.blob,
    {
      id: 'upload.filename',
      title: 'Initial display title',
      artist: free.track.artist,
      rights: free.track.rights,
      fileName: 'Мелодія 1994.mp3',
    },
    { probeMedia: structuralProbe },
  );
  const renamed = { ...imported, title: 'My edited title' };
  for (const version of [undefined, 2]) {
    const old = emptySoundtrackLibrary(version ? { catalogue: true, version } : {});
    assert.throws(
      () => resolveSoundtrackLibrary({ ...old, tracks: [renamed] }),
      /require library v3/,
    );
  }
  const value = resolveSoundtrackLibrary({
    ...emptySoundtrackLibrary({ catalogue: true }),
    tracks: [renamed],
    playlists: [
      {
        id: 'file.mix',
        title: 'Filename mix',
        trackIds: [renamed.id],
        order: 'ordered',
        repeat: 'all',
      },
    ],
  });
  const share = soundtrackPlaylistShare(value, value.playlists[0], { catalogue });
  const restored = await importBundle(
    await exportSoundtrackBundle(share, free.assets, { catalogue }),
  );
  assert.equal(restored.library.tracks[0].fileName, 'Мелодія 1994.mp3');
  assert.equal(restored.library.tracks[0].title, 'My edited title');
  for (const fileName of ['../bad.mp3', 'folder/bad.mp3', 'bad\\file.mp3', 'bad\nfile.mp3']) {
    await assert.rejects(
      prepareMP3Import(
        free.blob,
        {
          id: 'upload.bad',
          title: 'Bad',
          artist: free.track.artist,
          rights: free.track.rights,
          fileName,
        },
        { probeMedia: structuralProbe },
      ),
      /filename/,
    );
  }
});
