import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  emptySoundtrackLibrary,
  upgradeSoundtrackLibrary,
  resolveSoundtrackLibrary,
  soundtrackStoredTracks,
  soundtrackOffloadedBonusTrackIds,
  resolveSoundtrackSelection,
  SOUNDTRACK_LIMITS,
} from '../soundtrack.mjs';
import {
  mergeSoundtrackAlbum,
  offloadSoundtrackAlbum,
  restoreSoundtrackAlbum,
} from '../soundtrack-albums.mjs';
import {
  prepareSoundtrackLibrary,
  exportSoundtrackBundle,
  importSoundtrackBundle,
} from '../soundtrack-bundle.mjs';
import { mergeSoundtrackShare, soundtrackPlaylistShare } from '../soundtrack-share.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createSoundtrackSource } from '../soundtrack-source.mjs';
import { albumFixture } from './helpers/soundtrack-albums.mjs';
import { memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

const prepare = (library, assets) =>
  prepareSoundtrackLibrary(library, assets, { probeMedia: structuralProbe });
const importBundle = (blob) => importSoundtrackBundle(blob, { probeMedia: structuralProbe });
async function twoTrackAlbum() {
  const a = await albumFixture('bonus.a'),
    b = await albumFixture('bonus.b');
  const library = {
    ...a.album.library,
    tracks: [a.track, b.track],
    playlists: [{ ...a.album.library.playlists[0], trackIds: [a.track.id, b.track.id] }],
  };
  const prepared = await prepare(library, [...a.prepared.assets, ...b.prepared.assets]);
  const blob = await exportSoundtrackBundle(library, prepared.assets);
  const album = {
    ...a.album,
    library,
    bytes: blob.size,
    sha256: createHash('sha256')
      .update(Buffer.from(await blob.arrayBuffer()))
      .digest('hex'),
  };
  return { a, b, album, prepared, blob };
}

test('trusted offload adopts historical installs and preserves edited metadata, IDs and explicit playlists', async () => {
  const a = await albumFixture();
  const prior = resolveSoundtrackLibrary({
    ...upgradeSoundtrackLibrary(a.album.library),
    tracks: [
      { ...a.track, title: 'My title', rights: { ...a.track.rights, credit: 'My credit note' } },
    ],
    playlists: [
      { ...a.album.library.playlists[0], title: 'My playlist', order: 'shuffle', repeat: 'one' },
    ],
    tags: { [a.track.id]: { genres: ['metal'], role: 'menu', energy: 2, themes: ['fpv'] } },
  });
  assert.equal(Object.hasOwn(prior, 'bonusAlbums'), false);
  const offloaded = offloadSoundtrackAlbum(prior, a.prepared.assets, a.album);
  assert.deepEqual(offloaded.library.bonusAlbums, [
    { id: a.album.id, trackIds: [a.track.id], downloaded: false },
  ]);
  assert.equal(offloaded.assets.length, 0);
  assert.equal(offloaded.removedBytes, a.prepared.assets[0].blob.size);
  assert.equal(offloaded.retainedSharedBytes, 0);
  const { bonusAlbums: _pins, ...retained } = offloaded.library;
  assert.deepEqual(retained, prior);
  await prepare(offloaded.library, []);
  for (const installedOnly of [false, true]) {
    const selection = resolveSoundtrackSelection({
      ...offloaded.library,
      listening: { ...offloaded.library.listening, installedOnly },
    });
    assert.equal(selection.playlist.id, a.album.id);
    assert.deepEqual(selection.playlist.trackIds, []);
    assert.match(selection.notice, /Download again/);
  }
  const automatic = resolveSoundtrackSelection({
    ...offloaded.library,
    selection: { playlistId: null },
    listening: { ...offloaded.library.listening, mode: 'auto' },
  });
  assert(!automatic.playlist.trackIds.includes(a.track.id));
  assert.match(automatic.notice, /Download again/);
  const restored = restoreSoundtrackAlbum(offloaded.library, [], a.prepared, a.album);
  assert.deepEqual(restored.library.tracks, prior.tracks);
  assert.deepEqual(restored.library.tags, prior.tags);
  assert.deepEqual(restored.library.playlists, prior.playlists);
  assert.deepEqual(restored.library.selection, prior.selection);
  assert.equal(restored.library.bonusAlbums[0].downloaded, true);
  assert.deepEqual(
    await restored.assets[0].blob.arrayBuffer(),
    await a.prepared.assets[0].blob.arrayBuffer(),
  );
});

test('bonus pins stay finite and cannot confer network authority or relax ordinary upload ownership', async () => {
  const a = await albumFixture();
  const base = upgradeSoundtrackLibrary(a.album.library);
  const offloaded = offloadSoundtrackAlbum(base, a.prepared.assets, a.album);
  for (const bonusAlbums of [
    [{ ...offloaded.library.bonusAlbums[0], path: 'https://evil.test/album.rlsound' }],
    [{ ...offloaded.library.bonusAlbums[0], trackIds: ['missing.track'] }],
    [offloaded.library.bonusAlbums[0], offloaded.library.bonusAlbums[0]],
  ])
    assert.throws(() => resolveSoundtrackLibrary({ ...base, bonusAlbums }));
  await assert.rejects(prepare(base, []), /every referenced/);
  let requests = 0;
  const source = createSoundtrackSource({
    catalogue: { format: 'revealline-soundtrack-catalogue.v1', edition: 'empty', tracks: [] },
    fetch: async () => {
      requests++;
      throw new Error('Pins cannot fetch');
    },
  });
  await assert.rejects(
    source.readAsset(a.track.asset.sha256, { download: true }),
    /missing locally/,
  );
  assert.equal(requests, 0);
  assert.throws(
    () => restoreSoundtrackAlbum(offloaded.library, [], { ...a.prepared }, a.album),
    /verified import/,
  );
  const changed = resolveSoundtrackLibrary({
    ...base,
    tracks: [{ ...a.track, asset: { ...a.track.asset, sha256: 'a'.repeat(64) } }],
  });
  assert.throws(
    () => offloadSoundtrackAlbum(changed, a.prepared.assets, a.album),
    /conflicting recording/,
  );
  assert.throws(
    () => restoreSoundtrackAlbum(changed, [], a.prepared, a.album),
    /conflicting recording/,
  );
});

test('offload retains exact bytes shared with another downloaded album and a separate personal upload', async () => {
  const a = await albumFixture('bonus.shared.a'),
    b = await albumFixture('bonus.shared.b', 'bonus.shared.a');
  const first = mergeSoundtrackAlbum(
    emptySoundtrackLibrary({ catalogue: true }),
    [],
    a.prepared,
    a.album,
  );
  const second = mergeSoundtrackAlbum(first.library, first.assets, b.prepared, b.album);
  const upload = {
    ...a.track,
    id: 'personal.upload',
    rights: { kind: 'personal', credit: 'Personal file', license: '', source: 'mine.mp3' },
  };
  const withUpload = resolveSoundtrackLibrary({
    ...second.library,
    tracks: [...second.library.tracks, upload],
  });
  const offA = offloadSoundtrackAlbum(withUpload, second.assets, a.album);
  assert.equal(offA.removedBytes, 0);
  assert.equal(offA.retainedSharedBytes, a.prepared.assets[0].blob.size);
  const offBoth = offloadSoundtrackAlbum(offA.library, offA.assets, b.album);
  assert.equal(offBoth.removedBytes, 0);
  assert.equal(offBoth.assets.length, 1);
  assert.deepEqual(soundtrackOffloadedBonusTrackIds(offBoth.library), []);
  assert.deepEqual(
    soundtrackStoredTracks(offBoth.library).map((track) => track.id),
    [upload.id],
  );
  await prepare(offBoth.library, offBoth.assets);
  await assert.rejects(prepare(offBoth.library, []), /every referenced/);
  assert.deepEqual(
    await offBoth.assets[0].blob.arrayBuffer(),
    await a.prepared.assets[0].blob.arrayBuffer(),
  );
  const noUpload = resolveSoundtrackLibrary({
    ...offBoth.library,
    tracks: offBoth.library.tracks.filter((track) => track.id !== upload.id),
  });
  assert.deepEqual(
    new Set(soundtrackOffloadedBonusTrackIds(noUpload)),
    new Set([a.track.id, b.track.id]),
  );
  await prepare(noUpload, []);
});

test('Download again restores only surviving declared IDs without resurrecting deleted tracks or overwriting edits', async () => {
  const a = await twoTrackAlbum();
  const added = mergeSoundtrackAlbum(
    emptySoundtrackLibrary({ catalogue: true }),
    [],
    a.prepared,
    a.album,
  );
  const offloaded = offloadSoundtrackAlbum(added.library, added.assets, a.album);
  const survivor = resolveSoundtrackLibrary({
    ...offloaded.library,
    tracks: [{ ...a.a.track, title: 'Edited survivor' }],
    tags: { [a.a.track.id]: offloaded.library.tags[a.a.track.id] },
    playlists: [
      {
        ...offloaded.library.playlists[0],
        title: 'One surviving song',
        trackIds: [a.a.track.id],
        repeat: 'one',
      },
    ],
    bonusAlbums: [{ ...offloaded.library.bonusAlbums[0], trackIds: [a.a.track.id] }],
  });
  const restored = restoreSoundtrackAlbum(survivor, [], a.prepared, a.album);
  assert.deepEqual(restored.library.tracks, survivor.tracks);
  assert.deepEqual(restored.library.playlists, survivor.playlists);
  assert.equal(restored.assets.length, 1);
  assert.equal(restored.assets[0].sha256, a.a.track.asset.sha256);
  assert.equal(restored.restoredTracks, 1);
  await prepare(restored.library, restored.assets);
});

test('complete backups require every offloaded bonus original and restore all pins downloaded', async () => {
  const a = await albumFixture();
  const offloaded = offloadSoundtrackAlbum(
    upgradeSoundtrackLibrary(a.album.library),
    a.prepared.assets,
    a.album,
  );
  await assert.rejects(exportSoundtrackBundle(offloaded.library, []), /every referenced/);
  const body = await exportSoundtrackBundle(offloaded.library, a.prepared.assets);
  const imported = await importBundle(body);
  assert.equal(imported.library.bonusAlbums[0].downloaded, true);
  assert.deepEqual(
    await imported.assets[0].blob.arrayBuffer(),
    await a.prepared.assets[0].blob.arrayBuffer(),
  );
  assert.equal(offloaded.library.bonusAlbums[0].downloaded, false);
  const manifest = new TextEncoder().encode(
    JSON.stringify({
      format: 'revealline-soundtrack-bundle.v3',
      library: offloaded.library,
      referenceOnlyTrackIds: [],
      assets: [{ sha256: a.track.asset.sha256, bytes: a.prepared.assets[0].blob.size }],
    }),
  );
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode('RLSTB3\r\n'));
  new DataView(header.buffer).setUint32(8, manifest.length, false);
  await assert.rejects(
    importBundle(new Blob([header, manifest, a.prepared.assets[0].blob])),
    /every permitted bonus original/,
  );
  assert.equal((await importBundle(a.blob)).library.format, 'revealline-soundtrack.v1');
});

test('DB5 offload and restoration use atomic generations, shared budget and rollback without changing playlist references', async (t) => {
  const a = await albumFixture(),
    memory = memoryIndexedDB();
  const manager = createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  t.after(() => manager.close());
  const original = upgradeSoundtrackLibrary(a.album.library);
  await manager.commitDomain('audio', await prepare(original, a.prepared.assets), {
    expectedGeneration: 0,
  });
  const offloaded = offloadSoundtrackAlbum(original, a.prepared.assets, a.album);
  const preparedOffload = await prepare(offloaded.library, offloaded.assets);
  memory.failPutAt = 1;
  await assert.rejects(manager.commitDomain('audio', preparedOffload, { expectedGeneration: 1 }));
  memory.failPutAt = null;
  assert.equal(memory.contents().get('audio').size, 1);
  assert.deepEqual((await manager.readDomain('audio')).library, original);
  await manager.commitDomain('audio', preparedOffload, { expectedGeneration: 1 });
  const before = await manager.readDomain('audio');
  assert.equal(before.assets.length, 0);
  assert.equal(memory.contents().get('audio').size, 0);
  assert.deepEqual(before.library.playlists, original.playlists);
  const restoration = restoreSoundtrackAlbum(before.library, [], a.prepared, a.album);
  const preparedRestore = await prepare(restoration.library, restoration.assets);
  await assert.rejects(
    manager.commitDomain('audio', preparedRestore, { expectedGeneration: 1 }),
    /changed/,
  );
  const reservation = await manager.reserve({
    domain: 'story',
    expectedGeneration: 0,
    maxNewBytes: SOUNDTRACK_LIMITS.managedBytes - (await manager.usage()).usedBytes - 1024,
  });
  await assert.rejects(
    manager.commitDomain('audio', preparedRestore, { expectedGeneration: 2 }),
    /256 MiB/,
  );
  assert.deepEqual(await manager.readDomain('audio'), before);
  await manager.release(reservation);
  memory.failPutAt = 2;
  await assert.rejects(manager.commitDomain('audio', preparedRestore, { expectedGeneration: 2 }));
  memory.failPutAt = null;
  assert.deepEqual(await manager.readDomain('audio'), before);
  await manager.commitDomain('audio', preparedRestore, { expectedGeneration: 2 });
  const restored = await manager.readDomain('audio');
  assert.equal(restored.generation, 3);
  assert.deepEqual(restored.library.tracks, original.tracks);
  assert.deepEqual(
    await restored.assets[0].blob.arrayBuffer(),
    await a.prepared.assets[0].blob.arrayBuffer(),
  );
});

test('selected creator shares keep only relevant bonus pins and additive partial restores do not discard siblings', async () => {
  const a = await twoTrackAlbum();
  const added = mergeSoundtrackAlbum(
    emptySoundtrackLibrary({ catalogue: true }),
    [],
    a.prepared,
    a.album,
  );
  const offloaded = offloadSoundtrackAlbum(added.library, added.assets, a.album);
  const selected = { ...added.library.playlists[0], id: 'shared.single', trackIds: [a.a.track.id] };
  const share = soundtrackPlaylistShare(offloaded.library, selected);
  assert.deepEqual(soundtrackOffloadedBonusTrackIds(share), [a.a.track.id]);
  assert.deepEqual(share.bonusAlbums[0].trackIds, [a.a.track.id]);
  const imported = await importBundle(await exportSoundtrackBundle(share, a.a.prepared.assets));
  const merged = mergeSoundtrackShare(offloaded.library, [], imported);
  assert.deepEqual(
    merged.library.playlists.find((playlist) => playlist.id === a.album.id),
    offloaded.library.playlists[0],
  );
  assert.deepEqual(merged.library.selection, offloaded.library.selection);
  assert.deepEqual(soundtrackOffloadedBonusTrackIds(merged.library), [a.b.track.id]);
  assert.equal(merged.assets.length, 1);
  await prepare(merged.library, merged.assets);
  const incomplete = await prepare(share, []);
  assert.throws(
    () => mergeSoundtrackShare(offloaded.library, [], incomplete),
    /every downloaded original/,
  );
});
