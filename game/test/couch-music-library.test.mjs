import assert from 'node:assert/strict';
import test from 'node:test';
import { createCouchMusicLibrary } from '../couch/couch-music-library.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

const audio = await fixture();
const empty = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
  probeMedia: structuralProbe,
});
const saved = (generation = 1) => ({
  generation,
  library: audio.prepared.library,
  assets: audio.prepared.assets,
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function fakeManager(readDomain = async () => saved()) {
  return {
    storyMedia: true,
    readDomain,
    commitDomain: async (_, prepared, { expectedGeneration }) => ({
      generation: expectedGeneration + 1,
      library: prepared.library,
    }),
    closed: 0,
    close() {
      this.closed++;
    },
  };
}
function setup(manager = fakeManager()) {
  let owner;
  const h = audioHarness();
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: (hash) => owner.readAsset(hash),
    fadeMs: 0,
  });
  owner = createCouchMusicLibrary({ managedStore: manager, player });
  return {
    ...h,
    manager,
    owner,
    player,
    close() {
      player.dispose();
      owner.close();
      h.soundscape.dispose();
    },
  };
}

test('library startup adopts bytes and selection without requesting playback', async () => {
  const h = setup();
  try {
    assert.equal(h.owner.snapshot().status, 'idle');
    assert.equal((await h.owner.load()).adopted, true);
    assert.equal(h.owner.snapshot().generation, 1);
    assert.equal(h.owner.snapshot().status, 'ready');
    assert.equal(h.media.plays, 0);
    assert.equal(h.soundscape.context, null);
    assert.equal(h.player.snapshot().desired, false);
    assert.deepEqual(
      new Uint8Array(await h.owner.readAsset(audio.track.asset.sha256).arrayBuffer()),
      new Uint8Array(await audio.blob.arrayBuffer()),
    );
  } finally {
    h.close();
  }
});

test('the new blob map is visible synchronously when playlist metadata is installed', async () => {
  let owner, seen;
  owner = createCouchMusicLibrary({
    managedStore: fakeManager(),
    player: {
      setLibrary(library) {
        seen = owner.readAsset(library.tracks[0].asset.sha256);
      },
    },
  });
  await owner.load();
  assert.equal(seen.size, audio.blob.size);
  owner.close();
});

test('equal generation reload does not reset a deliberate unsaved playlist choice', async () => {
  const h = setup();
  try {
    await h.owner.load();
    await h.player.selectPlaylist('qa.mix');
    const before = h.player.snapshot();
    assert.equal((await h.owner.load()).adopted, false);
    assert.deepEqual(h.player.snapshot(), before);
    assert.equal(h.media.plays, 0);
  } finally {
    h.close();
  }
});

test('an earlier initial read cannot replace a later accepted snapshot', async () => {
  const old = deferred();
  let calls = 0;
  const h = setup(fakeManager(() => (++calls === 1 ? old.promise : Promise.resolve(saved(3)))));
  try {
    const pending = h.owner.load();
    assert.equal(h.owner.snapshot().status, 'loading');
    await h.owner.load();
    old.resolve(saved(1));
    assert.equal((await pending).adopted, false);
    assert.equal(h.owner.snapshot().generation, 3);
    assert.equal(h.owner.snapshot().status, 'ready');
  } finally {
    h.close();
  }
});

test('a lower generation and same-generation conflicting metadata never replace the current library', async () => {
  let next = saved(3);
  const h = setup(fakeManager(async () => next));
  try {
    await h.owner.load();
    next = saved(2);
    assert.equal((await h.owner.load()).adopted, false);
    next = { generation: 3, library: empty.library, assets: [] };
    await assert.rejects(h.owner.load(), /generation.*conflict/i);
    assert.equal(h.owner.snapshot().generation, 3);
    assert.equal(h.owner.readAsset(audio.track.asset.sha256).size, audio.blob.size);
  } finally {
    h.close();
  }
});

for (const kind of [
  'missing',
  'duplicate',
  'extra',
  'wrong-size',
  'fake-blob',
  'invalid-library',
  'invalid-generation',
]) {
  test(`${kind} snapshot preserves the previous bytes and player metadata`, async () => {
    let next = saved();
    const h = setup(fakeManager(async () => next));
    try {
      await h.owner.load();
      const before = h.player.snapshot();
      next = { ...saved(2), assets: [...audio.prepared.assets] };
      if (kind === 'missing') next.assets = [];
      if (kind === 'duplicate') next.assets.push(next.assets[0]);
      if (kind === 'extra') next.assets.push({ sha256: 'a'.repeat(64), blob: audio.blob });
      if (kind === 'wrong-size')
        next.assets = [{ sha256: audio.track.asset.sha256, blob: audio.blob.slice(0, 24) }];
      if (kind === 'fake-blob')
        next.assets = [{ sha256: audio.track.asset.sha256, blob: { size: audio.blob.size } }];
      if (kind === 'invalid-library') next.library = { ...next.library, surprise: true };
      if (kind === 'invalid-generation') next.generation = -1;
      await assert.rejects(h.owner.load());
      assert.equal(h.owner.snapshot().status, 'error');
      assert.equal(h.owner.snapshot().generation, 1);
      assert.deepEqual(h.player.snapshot(), before);
      assert.equal(h.owner.readAsset(audio.track.asset.sha256).size, audio.blob.size);
    } finally {
      h.close();
    }
  });
}

test('metadata refusal restores the previous byte map', async () => {
  let refuse = false;
  const owner = createCouchMusicLibrary({
    managedStore: fakeManager(),
    player: {
      setLibrary() {
        if (refuse) throw new Error('Cannot adopt metadata');
      },
    },
  });
  await owner.load();
  refuse = true;
  await assert.rejects(owner.commit(empty), /Cannot adopt/);
  assert.equal(owner.snapshot().generation, 1);
  assert.equal(owner.readAsset(audio.track.asset.sha256).size, audio.blob.size);
  owner.close();
});

test('save adopts committed metadata and prepared bytes and fences a pending startup read', async () => {
  const old = deferred();
  let calls = 0;
  const h = setup(fakeManager(() => (++calls === 1 ? Promise.resolve(saved()) : old.promise)));
  try {
    await h.owner.load();
    const pending = h.owner.load();
    assert.equal((await h.owner.commit(empty)).adopted, true);
    old.resolve(saved());
    await pending;
    assert.equal(h.owner.snapshot().generation, 2);
    assert.deepEqual(h.owner.snapshot().library, empty.library);
    assert.throws(() => h.owner.readAsset(audio.track.asset.sha256), /unavailable/i);
  } finally {
    h.close();
  }
});

test('only one save may run; reload cannot race it and no conflicting write is retried', async () => {
  const write = deferred();
  let writes = 0;
  const manager = fakeManager();
  manager.commitDomain = () => {
    writes++;
    return write.promise;
  };
  const h = setup(manager);
  try {
    await h.owner.load();
    const pending = h.owner.commit(empty);
    assert.equal(h.owner.snapshot().status, 'saving');
    await assert.rejects(h.owner.commit(empty), /save.*progress/i);
    await assert.rejects(h.owner.load(), /save.*progress/i);
    write.reject(new Error('Audio changed in another tab.'));
    await assert.rejects(pending, /changed/);
    assert.equal(writes, 1);
    assert.equal(h.owner.snapshot().generation, 1);
    assert.equal(h.owner.readAsset(audio.track.asset.sha256).size, audio.blob.size);
  } finally {
    h.close();
  }
});

test('explicit stale generation is refused before a storage write', async () => {
  const manager = fakeManager();
  manager.commitDomain = () => {
    throw new Error('must not write');
  };
  const h = setup(manager);
  try {
    await h.owner.load();
    await assert.rejects(h.owner.commit(empty, { expectedGeneration: 0 }), /changed/i);
  } finally {
    h.close();
  }
});

test('closing fences late reads, aborts their signal, releases bytes and leaves a borrowed manager open', async () => {
  const pending = deferred();
  let signal;
  const manager = fakeManager((_, options) => {
    signal = options.signal;
    return pending.promise;
  });
  const h = setup(manager);
  const loading = h.owner.load();
  h.close();
  pending.resolve(saved());
  await assert.rejects(loading, { name: 'AbortError' });
  assert.equal(signal.aborted, true);
  assert.equal(h.owner.snapshot().status, 'closed');
  assert.equal(manager.closed, 0);
  assert.throws(() => h.owner.readAsset(audio.track.asset.sha256), /closed/i);
  await assert.rejects(h.owner.load(), /closed/i);
});

test('caller cancellation cannot install a late read and a deliberate retry still succeeds', async () => {
  const pending = deferred();
  let calls = 0;
  const h = setup(fakeManager(() => (++calls === 1 ? pending.promise : Promise.resolve(saved()))));
  try {
    const controller = new AbortController();
    const loading = h.owner.load({ signal: controller.signal });
    controller.abort();
    pending.resolve(saved());
    await assert.rejects(loading, { name: 'AbortError' });
    assert.equal(h.owner.snapshot().generation, null);
    await h.owner.load();
    assert.equal(h.owner.snapshot().generation, 1);
  } finally {
    h.close();
  }
});

test('failed storage read is visible and never writes an empty replacement', async () => {
  const manager = fakeManager(async () => {
    throw new Error('Storage denied');
  });
  let writes = 0;
  manager.commitDomain = () => {
    writes++;
  };
  const h = setup(manager);
  try {
    await assert.rejects(h.owner.load(), /Storage denied/);
    assert.equal(h.owner.snapshot().error, 'Storage denied');
    assert.equal(writes, 0);
  } finally {
    h.close();
  }
});

test('an obsolete failed read cannot replace a newer ready state', async () => {
  const old = deferred();
  let calls = 0;
  const h = setup(fakeManager(() => (++calls === 1 ? old.promise : Promise.resolve(saved(2)))));
  try {
    const pending = h.owner.load();
    await h.owner.load();
    old.reject(new Error('Old read failed'));
    await assert.rejects(pending, /Old read/);
    assert.equal(h.owner.snapshot().status, 'ready');
    assert.equal(h.owner.snapshot().error, null);
  } finally {
    h.close();
  }
});

test('owned storage interoperates with Solo v4 and does not close another owner or alter other domains', async () => {
  const memory = memoryIndexedDB();
  const solo = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  await solo.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const before = await solo.readPresentationMetadata();
  memory.allPuts.length = 0;
  const owner = createCouchMusicLibrary({
    indexedDB: memory.indexedDB,
    player: { setLibrary() {} },
  });
  try {
    await owner.load();
    assert.equal(owner.snapshot().generation, 1);
    assert.deepEqual(memory.allPuts, []);
    await owner.commit(empty);
    assert.deepEqual(await solo.readPresentationMetadata(), before);
    assert.equal((await solo.readDomain('audio')).generation, 2);
    owner.close();
    assert.equal((await solo.readDomain('audio')).generation, 2);
    const request = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    assert.equal(db.version, 4);
    db.close();
  } finally {
    owner.close();
    solo.close();
  }
});

test('a borrowed pre-story manager is rejected instead of silently using an older schema', () => {
  assert.throws(
    () =>
      createCouchMusicLibrary({
        managedStore: { ...fakeManager(), storyMedia: false },
        player: { setLibrary() {} },
      }),
    /story|v4/i,
  );
});

test('the real player can prepare and explicitly play an adopted MP3 through shared master authority', async () => {
  const { createAudioMaster } = await import('../ui/audio-master.mjs');
  const master = createAudioMaster({ muted: true, volume: 0.2 });
  const library = {
    ...audio.library,
    playlists: [{ ...audio.library.playlists[0], trackIds: [audio.track.id] }],
    selection: { playlistId: 'qa.mix' },
  };
  const prepared = await prepareSoundtrackLibrary(library, audio.assets, {
    probeMedia: structuralProbe,
  });
  const h = audioHarness();
  let owner;
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: (hash) => owner.readAsset(hash),
    audioMaster: master,
    fadeMs: 0,
  });
  owner = createCouchMusicLibrary({
    managedStore: fakeManager(async () => ({
      generation: 1,
      library: prepared.library,
      assets: prepared.assets,
    })),
    player,
  });
  try {
    await owner.load();
    await player.prepare();
    assert.equal(h.media.plays, 0);
    await player.play();
    assert.equal(player.snapshot().track.id, audio.track.id);
    assert.equal(h.media.plays, 1);
    assert.equal(h.media.muted, true);
    assert.equal(master.snapshot().muted, true);
    const source = h.media.src;
    player.setVolume(0.3);
    assert.equal(master.snapshot().volume, 0.2);
    assert.equal(h.media.src, source);
    player.pause();
    await owner.load();
    assert.equal(player.snapshot().desired, false);
    assert.equal(h.media.plays, 1);
  } finally {
    player.dispose();
    owner.close();
    h.soundscape.dispose();
    master.dispose();
  }
});

test('real store conflict preserves the active library and external writer instead of retrying', async () => {
  const memory = memoryIndexedDB();
  const manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const h = setup(manager);
  try {
    await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
    await h.owner.load();
    await manager.commitDomain('audio', empty, { expectedGeneration: 1 });
    await assert.rejects(h.owner.commit(audio.prepared), /changed/i);
    assert.equal(h.owner.snapshot().generation, 1);
    assert.equal((await manager.readDomain('audio')).generation, 2);
    assert.equal(h.owner.readAsset(audio.track.asset.sha256).size, audio.blob.size);
    await h.owner.load();
    assert.equal(h.owner.snapshot().generation, 2);
    assert.throws(() => h.owner.readAsset(audio.track.asset.sha256), /unavailable/);
  } finally {
    h.close();
    manager.close();
  }
});

test('close during a successful durable commit prevents late player adoption without pretending rollback', async () => {
  const write = deferred();
  const manager = fakeManager();
  manager.commitDomain = () => write.promise;
  let installs = 0;
  const owner = createCouchMusicLibrary({
    managedStore: manager,
    player: {
      setLibrary() {
        installs++;
      },
    },
  });
  await owner.load();
  const saving = owner.commit(empty);
  owner.close();
  write.resolve({ generation: 2, library: empty.library });
  await assert.rejects(saving, { name: 'AbortError' });
  assert.equal(installs, 1);
  assert.equal(owner.snapshot().status, 'closed');
});

test('a stale read cannot clear a newer failed-save recovery state', async () => {
  const old = deferred();
  let calls = 0;
  const manager = fakeManager(() => (++calls === 1 ? Promise.resolve(saved()) : old.promise));
  manager.commitDomain = async () => {
    throw new Error('Quota refused');
  };
  const h = setup(manager);
  try {
    await h.owner.load();
    const pending = h.owner.load();
    await assert.rejects(h.owner.commit(empty), /Quota refused/);
    old.resolve(saved());
    await pending;
    assert.equal(h.owner.snapshot().status, 'error');
    assert.equal(h.owner.snapshot().error, 'Quota refused');
    assert.equal(h.owner.snapshot().generation, 1);
  } finally {
    h.close();
  }
});

test('disposal from a player notification cannot resurrect an adopted library', async () => {
  let owner;
  owner = createCouchMusicLibrary({
    managedStore: fakeManager(),
    player: {
      setLibrary() {
        owner.close();
      },
    },
  });
  await assert.rejects(owner.load(), { name: 'AbortError' });
  assert.equal(owner.snapshot().status, 'closed');
  assert.equal(owner.snapshot().generation, null);
  assert.throws(() => owner.readAsset(audio.track.asset.sha256), /closed/);
});

test('panel snapshot adoption fences an older boot read before replacing bytes and metadata', async () => {
  const pending = deferred();
  const h = setup(fakeManager(() => pending.promise));
  try {
    const loading = h.owner.load();
    assert.equal(h.owner.adoptVerifiedSnapshot(saved(2)).adopted, true);
    pending.resolve(saved());
    await loading;
    assert.equal(h.owner.snapshot().generation, 2);
    assert.equal(h.owner.snapshot().status, 'ready');
    assert.throws(() => h.owner.adoptVerifiedSnapshot(saved(1)), /older|changed/i);
    assert.equal(h.owner.snapshot().status, 'ready');
  } finally {
    h.close();
  }
});

test('panel snapshot cannot cross an in-flight owner save or a closed owner', async () => {
  const write = deferred();
  const manager = fakeManager();
  manager.commitDomain = () => write.promise;
  const h = setup(manager);
  try {
    await h.owner.load();
    const saving = h.owner.commit(empty);
    assert.throws(() => h.owner.adoptVerifiedSnapshot(saved(3)), /save.*progress/i);
    write.resolve({ generation: 2, library: empty.library });
    await saving;
    h.close();
    assert.throws(() => h.owner.adoptVerifiedSnapshot(saved(3)), /closed/i);
  } finally {
    h.close();
  }
});
