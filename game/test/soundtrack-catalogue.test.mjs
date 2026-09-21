import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOUNDTRACK_FORMAT_V2,
  SOUNDTRACK_FORMAT_V3,
  SOUNDTRACK_LIMITS,
  SOUNDTRACK_GENRES,
  BUILTIN_SOUNDTRACK_TRACKS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
  upgradeSoundtrackLibrary,
  resolveCatalogueTrack,
  resolveSoundtrackCatalogue,
  setCatalogueTracks,
  resolveSoundtrackSelection,
  soundtrackOrder,
  soundtrackTracks,
  soundtrackPlaylists,
  soundtrackStoredTracks,
} from '../soundtrack.mjs';
import {
  prepareSoundtrackLibrary,
  exportSoundtrackBundle,
  importSoundtrackBundle,
} from '../soundtrack-bundle.mjs';
import { createManagedMediaStore, prepareManagedMediaBytes } from '../managed-media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const upload = await fixture('upload'),
  recording = await fixture('catalogue');
const tags = { genres: ['ukrainian'], role: 'gameplay', energy: 4, themes: ['atlas'] };
const catalogueTrack = resolveCatalogueTrack({
  ...recording.track,
  id: 'builtin.catalog.river',
  edition: 'originals-1',
  path: 'game/content/music/river.mp3',
  tags,
});
const asV2 = (value) => {
  const { referenceOnlyTrackIds: _refs, listening, ...library } = value;
  const { recordingMode: _recording, ...oldListening } = listening;
  // Construct an actual historical v2 fixture, whose genre vocabulary had three values.
  return resolveSoundtrackLibrary({
    ...library,
    format: SOUNDTRACK_FORMAT_V2,
    listening: { ...oldListening, genres: ['synth90s', 'metal', 'ukrainian'] },
  });
};
const withCatalogue = () =>
  setCatalogueTracks(upgradeSoundtrackLibrary(upload.library), [catalogueTrack]);
const prepare = (library, assets) =>
  prepareSoundtrackLibrary(library, assets, { probeMedia: structuralProbe });

test('additional styles have distinct queues and mixes preserve explicit former genre choices', () => {
  const recordings = SOUNDTRACK_GENRES.map((genre) => ({
    ...catalogueTrack,
    id: `builtin.catalog.style.${genre}`,
    tags: { genres: [genre], role: 'any', energy: 3, themes: [] },
  }));
  const library = setCatalogueTracks(emptySoundtrackLibrary({ catalogue: true }), recordings);
  for (const track of recordings) {
    const genre = track.tags.genres[0];
    const selected = resolveSoundtrackSelection({
      ...library,
      listening: { ...library.listening, mode: genre },
    });
    assert.deepEqual(selected.playlist.trackIds, [track.id]);
    const builtIn = soundtrackPlaylists(library).find((p) => p.id === `builtin.playlist.${genre}`);
    assert(builtIn.trackIds.includes(track.id));
    assert(!builtIn.trackIds.some((id) => id.startsWith('builtin.catalog.') && id !== track.id));
  }
  const previousChoices = ['synth90s', 'metal', 'ukrainian'];
  const explicit = resolveSoundtrackLibrary({
    ...library,
    listening: { ...library.listening, mode: 'mix', genres: previousChoices },
  });
  assert.deepEqual(explicit.listening.genres, previousChoices);
  assert.deepEqual(
    resolveSoundtrackSelection(explicit).playlist.trackIds,
    recordings.slice(0, 3).map((t) => t.id),
  );
  assert.deepEqual(
    resolveSoundtrackSelection({ ...library, listening: { ...library.listening, mode: 'mix' } })
      .playlist.trackIds,
    recordings.map((t) => t.id),
  );
});

test('historical procedural identities retain their real rock, chiptune and ambient categories', () => {
  const library = emptySoundtrackLibrary({ catalogue: true });
  for (const genre of ['rock', 'chiptune', 'ambient']) {
    const list = soundtrackPlaylists(library).find((p) => p.id === `builtin.playlist.${genre}`);
    assert.deepEqual(
      list.trackIds,
      BUILTIN_SOUNDTRACK_TRACKS.filter((t) => t.recipe.genre === genre).map((t) => t.id),
    );
  }
  assert.deepEqual(
    soundtrackPlaylists(library).find((p) => p.id === 'builtin.playlist.metal').trackIds,
    BUILTIN_SOUNDTRACK_TRACKS.filter((t) => t.recipe.genre === 'metal').map((t) => t.id),
  );
});

test('UA-FPV remains a dedicated selectable collection and participates in Ukrainian and mixed queues', () => {
  const track = { ...catalogueTrack, id: 'builtin.catalog.ua-fpv.verified' };
  const library = setCatalogueTracks(upgradeSoundtrackLibrary(upload.library), [
    catalogueTrack,
    track,
  ]);
  const playlists = soundtrackPlaylists(library);
  const ua = playlists.find((list) => list.id === 'builtin.playlist.ua-fpv');
  assert.deepEqual(ua.trackIds, [track.id]);
  assert.equal(ua.title, 'UA-FPV');
  assert.equal(ua.repeat, 'all');
  assert.equal(ua.order, 'shuffle');
  for (const mode of ['ukrainian', 'mix'])
    assert(
      playlists.find((list) => list.id === `builtin.playlist.${mode}`).trackIds.includes(track.id),
    );
  const selected = resolveSoundtrackSelection(
    { ...library, selection: { playlistId: ua.id } },
    { scene: 'gameplay' },
  );
  assert.deepEqual(selected.playlist.trackIds, [track.id]);
  assert(!soundtrackPlaylists(withCatalogue()).some((list) => list.id === ua.id));
});

test('catalogue library v3 is opt-in and migration owns metadata without changing any legacy IDs or capacity', () => {
  assert.equal(emptySoundtrackLibrary().format, 'revealline-soundtrack.v1');
  const value = structuredClone(upload.library);
  value.tracks = Array.from({ length: 123 }, (_, index) => ({
    ...upload.track,
    id: `upload.${index}`,
  }));
  value.playlists = Array.from({ length: 26 }, (_, index) => ({
    id: `list.${index}`,
    title: 'Old list',
    trackIds: [value.tracks[0].id],
    order: 'ordered',
    repeat: 'all',
  }));
  value.selection.playlistId = value.playlists[0].id;
  const migrated = setCatalogueTracks(value, [catalogueTrack]);
  assert.equal(migrated.format, SOUNDTRACK_FORMAT_V3);
  assert.equal(migrated.tracks.length, 123);
  assert.equal(migrated.playlists.length, 26);
  assert.deepEqual(migrated.selection, value.selection);
  assert.equal(soundtrackTracks(migrated).length, 129);
  assert(soundtrackPlaylists(migrated).some((playlist) => playlist.id === 'builtin.all'));
  assert.equal(value.format, 'revealline-soundtrack.v1');
  assert.throws(
    () =>
      resolveSoundtrackLibrary({
        ...migrated,
        tracks: [...migrated.tracks, { ...upload.track, id: 'over' }],
      }),
    /count/,
  );
});

test('catalogue pins validate identity, role, provenance and confined paths without reading accessors', () => {
  const catalog = {
    format: 'revealline-soundtrack-catalogue.v1',
    edition: 'originals-1',
    tracks: [catalogueTrack],
  };
  assert.equal(resolveSoundtrackCatalogue(catalog).tracks.length, 1);
  for (const patch of [
    { path: '../foreign.mp3' },
    { path: 'https://foreign.test/song.mp3' },
    { rights: { ...catalogueTrack.rights, kind: 'personal' } },
    { tags: { ...tags, genres: ['unverified'] } },
  ])
    assert.throws(() => resolveCatalogueTrack({ ...catalogueTrack, ...patch }));
  let reads = 0;
  assert.throws(() =>
    resolveCatalogueTrack({
      get id() {
        reads++;
        return catalogueTrack.id;
      },
    }),
  );
  assert.equal(reads, 0);
  assert.throws(
    () => setCatalogueTracks(withCatalogue(), [{ ...catalogueTrack, title: 'Replacement' }]),
    /conflicts/,
  );
  assert.throws(
    () => resolveSoundtrackLibrary({ ...withCatalogue(), installedTrackIds: ['missing'] }),
    /installed/,
  );
});

test('scene, genres, fusion, uploaded tags and explicit playlists resolve independently of simulation', () => {
  let value = withCatalogue();
  const menu = { ...catalogueTrack, id: 'builtin.catalog.menu', tags: { ...tags, role: 'menu' } };
  const fusion = {
    ...catalogueTrack,
    id: 'builtin.catalog.fusion',
    tags: { ...tags, genres: ['ukrainian', 'metal'] },
  };
  value = setCatalogueTracks(value, [menu, fusion]);
  value = resolveSoundtrackLibrary({
    ...value,
    tags: { [upload.track.id]: { ...tags, genres: ['metal'], role: 'any' } },
    listening: { ...value.listening, mode: 'ukrainian' },
  });
  assert.deepEqual(resolveSoundtrackSelection(value, { scene: 'menu' }).playlist.trackIds, [
    menu.id,
  ]);
  assert.deepEqual(resolveSoundtrackSelection(value, { scene: 'gameplay' }).playlist.trackIds, [
    catalogueTrack.id,
    fusion.id,
  ]);
  assert.deepEqual(
    resolveSoundtrackSelection({ ...value, listening: { ...value.listening, mode: 'fusion' } })
      .playlist.trackIds,
    [fusion.id],
  );
  assert.deepEqual(
    resolveSoundtrackSelection({ ...value, listening: { ...value.listening, mode: 'metal' } })
      .playlist.trackIds,
    [fusion.id, upload.track.id],
  );
  const explicit = resolveSoundtrackSelection(
    { ...value, selection: { playlistId: 'qa.mix' } },
    { scene: 'menu' },
  );
  assert.deepEqual(explicit.playlist.trackIds, upload.library.playlists[0].trackIds);
  assert.equal(explicit.source, 'explicit');
  value = resolveSoundtrackLibrary({
    ...value,
    listening: { ...value.listening, mode: 'mix', genres: ['ukrainian'] },
  });
  assert(!resolveSoundtrackSelection(value).playlist.trackIds.includes(upload.track.id));
});

test('automatic theme preference chooses among scene-eligible recordings without suppressing available menu music', () => {
  const menu = {
    ...catalogueTrack,
    id: 'builtin.catalog.menu',
    tags: { ...tags, role: 'menu', themes: [] },
  };
  const themedMenu = {
    ...menu,
    id: 'builtin.catalog.themedmenu',
    tags: { ...menu.tags, themes: ['atlas'] },
  };
  const base = setCatalogueTracks(emptySoundtrackLibrary(), [catalogueTrack, menu]);
  const selection = resolveSoundtrackSelection(base, { scene: 'menu', themeId: 'atlas' });
  assert.equal(selection.source, 'catalogue');
  assert.deepEqual(selection.playlist.trackIds, [menu.id]);
  assert.deepEqual(
    resolveSoundtrackSelection(base, { scene: 'gameplay', themeId: 'atlas' }).playlist.trackIds,
    [catalogueTrack.id],
  );
  const preferred = setCatalogueTracks(base, [themedMenu]);
  assert.deepEqual(
    resolveSoundtrackSelection(preferred, { scene: 'menu', themeId: 'atlas' }).playlist.trackIds,
    [themedMenu.id],
  );
});

test('unavailable Ukrainian and fusion styles stay empty; installed-only never discards catalogue pins', () => {
  for (const mode of ['ukrainian', 'fusion']) {
    const value = {
      ...emptySoundtrackLibrary({ catalogue: true }),
      listening: {
        mode,
        genres: ['synth90s', 'metal', 'ukrainian'],
        installedOnly: true,
        recordingMode: false,
      },
    };
    const selected = resolveSoundtrackSelection(value);
    assert.equal(selected.source, 'unavailable');
    assert.deepEqual(soundtrackOrder(selected.playlist), []);
    assert.match(selected.notice, /No /);
  }
  const value = withCatalogue();
  const selected = resolveSoundtrackSelection({
    ...value,
    listening: { ...value.listening, mode: 'ukrainian', installedOnly: true },
  });
  assert.equal(selected.playlist.trackIds.length, 0);
  assert.equal(value.catalogTracks.length, 1);
  assert.equal(soundtrackStoredTracks(value).length, 1);
  assert.deepEqual(
    resolveSoundtrackSelection(
      { ...value, listening: { ...value.listening, mode: 'ukrainian', installedOnly: true } },
      { installedTrackIds: [catalogueTrack.id] },
    ).playlist.trackIds,
    [catalogueTrack.id],
  );
});

test('unavailable My Mix and explicit offline playlists never substitute unrelated families', () => {
  const empty = emptySoundtrackLibrary({ catalogue: true });
  const ukrainianMix = resolveSoundtrackSelection({
    ...empty,
    listening: { ...empty.listening, mode: 'mix', genres: ['ukrainian'] },
  });
  assert.deepEqual(soundtrackOrder(ukrainianMix.playlist), []);
  assert.equal(ukrainianMix.source, 'unavailable');
  const metalMix = resolveSoundtrackSelection({
    ...empty,
    listening: { ...empty.listening, mode: 'mix', genres: ['metal'] },
  });
  assert(metalMix.playlist.trackIds.length > 0);
  assert(
    metalMix.playlist.trackIds.every((id) =>
      ['metal', 'rock'].includes(
        BUILTIN_SOUNDTRACK_TRACKS.find((track) => track.id === id).recipe.genre,
      ),
    ),
  );
  const library = withCatalogue();
  const offline = resolveSoundtrackSelection({
    ...library,
    playlists: [
      {
        id: 'catalogue.only',
        title: 'My Ukrainian album',
        trackIds: [catalogueTrack.id],
        order: 'ordered',
        repeat: 'all',
      },
    ],
    selection: { playlistId: 'catalogue.only' },
    listening: { ...library.listening, installedOnly: true },
  });
  assert.equal(offline.source, 'explicit');
  assert.equal(offline.playlist.id, 'catalogue.only');
  assert.deepEqual(soundtrackOrder(offline.playlist), []);
  assert.match(offline.notice, /Download/);
});

test('v2 generated playlists repeat with shuffle and avoid boundary repetition while old and custom ordering stays intact', () => {
  const another = { ...catalogueTrack, id: 'builtin.catalog.second' };
  const library = setCatalogueTracks(withCatalogue(), [another]);
  const selection = resolveSoundtrackSelection({
    ...library,
    listening: { ...library.listening, mode: 'ukrainian' },
  });
  assert.equal(selection.playlist.order, 'shuffle');
  assert.equal(selection.playlist.repeat, 'all');
  const first = soundtrackOrder(selection.playlist, { random: () => 0 });
  const next = soundtrackOrder(selection.playlist, {
    random: () => 0,
    previousTrackId: first.at(-1),
  });
  assert.notEqual(next[0], first.at(-1));
  assert.deepEqual([...next].sort(), [catalogueTrack.id, another.id].sort());
  for (const playlist of soundtrackPlaylists(library).filter((item) =>
    item.id.startsWith('builtin.playlist.'),
  )) {
    assert.equal(playlist.order, 'shuffle');
    assert.equal(playlist.repeat, 'all');
  }
  assert.equal(
    resolveSoundtrackSelection(emptySoundtrackLibrary({ catalogue: true })).playlist.order,
    'shuffle',
  );
  assert.equal(resolveSoundtrackSelection(emptySoundtrackLibrary()).playlist.order, 'ordered');
  const custom = { ...library.playlists[0], order: 'ordered', repeat: 'one' };
  const explicit = resolveSoundtrackSelection({
    ...library,
    playlists: [custom],
    selection: { playlistId: custom.id },
  });
  assert.equal(explicit.playlist.order, 'ordered');
  assert.equal(explicit.playlist.repeat, 'one');
});

test('streamable catalogue pins do not require installed originals, but upload and installed ownership do', async () => {
  const value = withCatalogue();
  const prepared = await prepare(value, upload.assets);
  assert.equal(prepared.assets.length, 1);
  await assert.rejects(prepare(value, []), /every referenced/);
  await assert.rejects(
    prepare({ ...value, installedTrackIds: [catalogueTrack.id] }, upload.assets),
    /every referenced/,
  );
  await assert.rejects(prepare(value, [...upload.assets, ...recording.assets]), /every referenced/);
  const installed = await prepare({ ...value, installedTrackIds: [catalogueTrack.id] }, [
    ...upload.assets,
    ...recording.assets,
  ]);
  assert.equal(installed.assets.length, 2);
});

test('complete v2 backup installs all pinned originals on restore and still imports unchanged v1', async () => {
  const value = asV2(withCatalogue());
  await assert.rejects(exportSoundtrackBundle(value, upload.assets), /every referenced/);
  const blob = await exportSoundtrackBundle(value, [...upload.assets, ...recording.assets]);
  assert.equal(new TextDecoder().decode(await blob.slice(0, 8).arrayBuffer()), 'RLSTB2\r\n');
  const restored = await importSoundtrackBundle(blob, { probeMedia: structuralProbe });
  assert.equal(restored.library.format, SOUNDTRACK_FORMAT_V2);
  assert.deepEqual(restored.library.installedTrackIds, [catalogueTrack.id]);
  assert.deepEqual(restored.library.playlists, value.playlists);
  assert.equal(value.installedTrackIds.length, 0);
  const byHash = new Map(restored.assets.map((asset) => [asset.sha256, asset.blob]));
  assert.deepEqual(
    await byHash.get(catalogueTrack.asset.sha256).arrayBuffer(),
    await recording.blob.arrayBuffer(),
  );
  assert.deepEqual(
    await blob.arrayBuffer(),
    await (await exportSoundtrackBundle(restored.library, restored.assets)).arrayBuffer(),
  );
  const legacy = await importSoundtrackBundle(
    await exportSoundtrackBundle(upload.library, upload.assets),
    { probeMedia: structuralProbe },
  );
  assert.deepEqual(legacy.library, upload.prepared.library);
});

test('DB5 upgrade preserves v1 row and originals until explicit Save and rejects old-version readers', async () => {
  const memory = memoryIndexedDB();
  const old = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  await old.commitDomain('audio', upload.prepared, { expectedGeneration: 0 });
  const oldRow = memory.contents().get('metadata').get('library');
  const oldBlob = memory.contents().get('audio').get(upload.track.asset.sha256);
  memory.allPuts.length = 0;
  const manager = createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  const read = await manager.readDomain('audio');
  assert.equal(read.library.format, 'revealline-soundtrack.v1');
  assert.equal(memory.contents().get('metadata').get('library'), oldRow);
  assert.equal(memory.contents().get('audio').get(upload.track.asset.sha256), oldBlob);
  assert.deepEqual(memory.allPuts, []);
  await assert.rejects(old.readDomain('audio'), { name: 'VersionError' });
  await manager.commitDomain('audio', await prepare(withCatalogue(), upload.assets), {
    expectedGeneration: 1,
  });
  assert.equal((await manager.readDomain('audio')).library.format, SOUNDTRACK_FORMAT_V3);
  assert.equal((await manager.readDomain('media')).generation, 0);
  assert.equal((await manager.readDomain('story')).generation, 0);
  manager.close();
  old.close();
});

test('v2 commits require explicit DB5 and storage-only catalogue removal keeps mixed playlist references', async () => {
  const memory = memoryIndexedDB();
  const old = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const value = withCatalogue();
  await assert.rejects(
    old.commitDomain('audio', await prepare(value, upload.assets), { expectedGeneration: 0 }),
    /DB5/,
  );
  old.close();
  const manager = createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  const store = createSoundtrackStore({ managedStore: manager });
  const installed = {
    ...value,
    installedTrackIds: [catalogueTrack.id],
    playlists: [
      {
        ...value.playlists[0],
        trackIds: [catalogueTrack.id, upload.track.id, BUILTIN_SOUNDTRACK_TRACKS[0].id],
      },
    ],
  };
  await store.commit(await prepare(installed, [...upload.assets, ...recording.assets]), {
    expectedGeneration: 0,
  });
  const removed = { ...installed, installedTrackIds: [] };
  await store.commit(await prepare(removed, upload.assets), { expectedGeneration: 1 });
  const read = await store.read();
  assert.deepEqual(read.library.playlists, installed.playlists);
  assert.equal(read.library.catalogTracks.length, 1);
  assert(!memory.contents().get('audio').has(catalogueTrack.asset.sha256));
  assert(memory.contents().get('audio').has(upload.track.asset.sha256));
  manager.close();
});

test('DB5 generation and shared staging budget refusals keep catalogue, uploads and other domains intact', async () => {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  await manager.commitDomain('audio', await prepare(withCatalogue(), upload.assets), {
    expectedGeneration: 0,
  });
  const before = await manager.readDomain('audio');
  const installed = await prepare({ ...withCatalogue(), installedTrackIds: [catalogueTrack.id] }, [
    ...upload.assets,
    ...recording.assets,
  ]);
  await assert.rejects(
    manager.commitDomain('audio', installed, { expectedGeneration: 0 }),
    /changed/,
  );
  await assert.rejects(
    manager.commitDomain('audio', installed, {
      expectedGeneration: 1,
      otherManagedBytes: SOUNDTRACK_LIMITS.managedBytes - 100,
    }),
    /staging/,
  );
  assert.deepEqual(await manager.readDomain('audio'), before);
  const emptyMedia = await prepareManagedMediaBytes(
    { format: 'revealline-managed-bytes.v1', items: [] },
    [],
  );
  await manager.commitDomain('media', emptyMedia, { expectedGeneration: 0 });
  assert.equal((await manager.readDomain('audio')).generation, 1);
  assert.equal((await manager.readDomain('media')).generation, 1);
  manager.close();
});

test('catalogue rejects conflicting facts for one recording and v2 backup rejects omitted originals', async () => {
  assert.throws(
    () =>
      resolveSoundtrackCatalogue({
        format: 'revealline-soundtrack-catalogue.v1',
        edition: 'originals-1',
        tracks: [
          catalogueTrack,
          {
            ...catalogueTrack,
            id: 'builtin.catalog.conflict',
            asset: { ...catalogueTrack.asset, bytes: catalogueTrack.asset.bytes + 1 },
          },
        ],
      }),
    /conflicting/,
  );
  const value = withCatalogue();
  const manifest = new TextEncoder().encode(
    JSON.stringify({
      format: 'revealline-soundtrack-bundle.v2',
      library: asV2(value),
      assets: [{ sha256: upload.track.asset.sha256, bytes: upload.blob.size }],
    }),
  );
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('RLSTB2\r\n'));
  new DataView(header.buffer).setUint32(8, manifest.length, false);
  await assert.rejects(
    importSoundtrackBundle(new Blob([header, manifest, upload.blob]), {
      probeMedia: structuralProbe,
    }),
    /every catalogue original/,
  );
});

test('offloading catalogue aliases never reclaims the same original owned by an upload', async () => {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  const alias = { ...catalogueTrack, asset: upload.track.asset };
  let value = setCatalogueTracks(upgradeSoundtrackLibrary(upload.library), [alias]);
  value = { ...value, installedTrackIds: [alias.id] };
  await manager.commitDomain('audio', await prepare(value, upload.assets), {
    expectedGeneration: 0,
  });
  await manager.commitDomain(
    'audio',
    await prepare({ ...value, installedTrackIds: [] }, upload.assets),
    { expectedGeneration: 1 },
  );
  assert.equal(memory.contents().get('audio').size, 1);
  assert.deepEqual(
    await (await manager.readDomain('audio')).assets[0].blob.arrayBuffer(),
    await upload.blob.arrayBuffer(),
  );
  manager.close();
});

test('a native transaction failure rolls back new catalogue originals and metadata together', async () => {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, soundtrackCatalogue: true });
  const value = withCatalogue();
  await manager.commitDomain('audio', await prepare(value, upload.assets), {
    expectedGeneration: 0,
  });
  const before = await manager.readDomain('audio');
  memory.failPutAt = 2;
  await assert.rejects(
    manager.commitDomain(
      'audio',
      await prepare({ ...value, installedTrackIds: [catalogueTrack.id] }, [
        ...upload.assets,
        ...recording.assets,
      ]),
      { expectedGeneration: 1 },
    ),
  );
  memory.failPutAt = null;
  assert.deepEqual(await manager.readDomain('audio'), before);
  assert(!memory.contents().get('audio').has(catalogueTrack.asset.sha256));
  manager.close();
});
