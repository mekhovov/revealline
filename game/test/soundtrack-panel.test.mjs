import test from 'node:test';
import assert from 'node:assert/strict';
import { attachSoundtrackPanel } from '../ui/soundtrack-panel.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { emptySoundtrackLibrary, BUILTIN_SOUNDTRACK_TRACKS } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary, importSoundtrackBundle } from '../soundtrack-bundle.mjs';
import {
  fixture,
  memoryIndexedDB,
  structuralProbe,
  silenceBytes,
} from './helpers/soundtrack-fixtures.mjs';

// The real panel handlers, validation, MP3 byte inspection, binary transfer and
// atomic store execute. Only DOM/media playback and finite IDB scheduling are adapted.
class Element {
  constructor(doc, tag) {
    this.document = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.parentNode = null;
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.value = '';
    this.textContent = '';
    this.isConnected = true;
    this.files = [];
    this.paused = true;
  }
  set id(value) {
    this._id = value;
    this.document.nodes.set(value, this);
  }
  get id() {
    return this._id;
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
    if (key === 'hidden') this.hidden = true;
  }
  removeAttribute(key) {
    this.attributes.delete(key);
    if (key === 'src') this.src = '';
  }
  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  get lastElementChild() {
    return this.children.at(-1);
  }
  remove() {
    this.isConnected = false;
    if (this.parentNode)
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
  }
  querySelectorAll(selector) {
    const tags = selector.toUpperCase().split(',');
    return this.children.flatMap((child) => [
      ...(tags.includes(child.tagName) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }
  emit(type, data = {}) {
    const event = {
      target: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...data,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  focus() {
    this.document.activeElement = this;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.emit('close');
  }
  click() {
    if (!this.disabled) return this.onclick?.();
  }
  load() {}
  async play() {
    if (this.playError) throw this.playError;
    this.paused = false;
    this.plays = (this.plays || 0) + 1;
  }
  pause() {
    this.paused = true;
  }
}
async function setup(
  t,
  {
    initial,
    probeMedia = structuralProbe,
    onLibrary,
    otherManagedBytes,
    store: overrideStore,
    callbacks = {},
  } = {},
) {
  const doc = { nodes: new Map(), activeElement: null, hidden: false };
  const eventRoot = new Element(doc, 'document');
  doc.addEventListener = (...args) => eventRoot.addEventListener(...args);
  doc.removeEventListener = (...args) => eventRoot.removeEventListener(...args);
  doc.emit = (...args) => eventRoot.emit(...args);
  doc.body = new Element(doc, 'body');
  doc.head = new Element(doc, 'head');
  doc.createElement = (tag) => new Element(doc, tag);
  const db = memoryIndexedDB(),
    store = overrideStore ?? createSoundtrackStore({ indexedDB: db.indexedDB });
  if (initial) await store.commit(initial.prepared, { expectedGeneration: 0 });
  const calls = [],
    notices = [],
    downloads = [],
    urls = new Map(),
    revoked = [];
  const state = {
    status: 'playing',
    playing: true,
    desired: true,
    track: { id: 'builtin.fpv', title: 'Flight', kind: 'synth' },
    positionSeconds: 12,
    durationSeconds: 90,
    volume: 0.6,
  };
  const player = {
    snapshot: () => ({ ...state }),
    setLibrary: (library) => calls.push(['library', library]),
    setIntent: (desired) => {
      calls.push(['intent', desired]);
      state.desired = desired;
    },
    selectPlaylist: async (id) => calls.push(['select', id]),
    pause: () => {
      calls.push(['pause']);
      Object.assign(state, { playing: false, desired: false, status: 'paused' });
    },
    play: async () => {
      calls.push(['play']);
      Object.assign(state, { playing: true, desired: true, status: 'playing' });
    },
    previous: async () => calls.push(['previous']),
    next: async () => calls.push(['next']),
    seek: (time) => {
      calls.push(['seek', time]);
      state.positionSeconds = time;
    },
    setVolume: (volume) => {
      calls.push(['volume', volume]);
      state.volume = volume;
    },
  };
  let serial = 0;
  const panel = attachSoundtrackPanel({
    document: doc,
    store,
    player,
    probeMedia,
    makeId: (kind) => `${kind}.test-${++serial}`,
    otherManagedBytes,
    onLibrary: onLibrary ?? ((library, info) => notices.push([library, info])),
    getContext: () => ({
      themeId: 'fpv-front',
      campaignKey: 'edition@3/campaign@1',
      mapKey: 'edition@3/campaign@1/map-a',
    }),
    URLImpl: {
      createObjectURL(blob) {
        const id = `blob:test-${urls.size}`;
        urls.set(id, blob);
        return id;
      },
      revokeObjectURL: (id) => revoked.push(id),
    },
    download: (blob, filename) => downloads.push({ blob, filename }),
    ...callbacks,
  });
  const node = (id) => {
    const result = doc.nodes.get(`soundtrack-${id}`);
    assert.ok(result, id);
    return result;
  };
  const click = (id) => node(id).click();
  const choose = (id, value) => {
    node(id).value = value;
    node(id).onchange?.();
  };
  t.after(() => {
    panel.dispose();
    store.close?.();
  });
  await panel.open();
  return {
    panel,
    doc,
    node,
    click,
    choose,
    db,
    store,
    player,
    state,
    calls,
    notices,
    downloads,
    urls,
    revoked,
  };
}
const file = (name = 'Neon sky.mp3', value = silenceBytes) =>
  new File([value], name, { type: 'audio/mpeg' });

test('real MP3 batch import is a draft; one atomic save stores originals and metadata without restarting transport', async (t) => {
  const app = await setup(t);
  app.node('mp3-files').files = [file(), file('Steel.mp3')];
  await app.click('import-mp3');
  assert.match(app.node('status').textContent, /2 MP3 files verified/);
  assert.equal((await app.store.read()).generation, 0);
  app.node('track-title').value = 'Steel at dusk';
  app.node('track-artist').value = 'Local artist';
  app.node('rights-kind').value = 'licensed';
  app.node('rights-credit').value = 'Local artist';
  app.node('rights-license').value = 'Artist permission';
  await app.click('apply-track');
  await app.click('save');
  const saved = await app.store.read();
  assert.equal(saved.generation, 1);
  assert.equal(saved.library.tracks.length, 2);
  assert.equal(saved.library.tracks[1].title, 'Steel at dusk');
  assert.equal(saved.library.tracks[1].rights.license, 'Artist permission');
  assert.equal(saved.assets.length, 1, 'same original is stored once');
  assert.deepEqual(Buffer.from(await saved.assets[0].blob.arrayBuffer()), silenceBytes);
  assert.equal(
    app.calls.some(([name]) => ['play', 'pause', 'select'].includes(name)),
    false,
  );
});

test('a failing second file discards the whole batch while preserving an earlier unsaved draft', async (t) => {
  const app = await setup(t);
  app.node('mp3-files').files = [file('First.mp3')];
  await app.click('import-mp3');
  app.node('mp3-files').files = [file('Second.mp3'), file('Bad.mp3', 'not MPEG audio')];
  await app.click('import-mp3');
  assert.doesNotMatch(app.node('status').textContent, /verified and added/);
  await app.click('save');
  const saved = await app.store.read();
  assert.deepEqual(
    saved.library.tracks.map((track) => track.title),
    ['First'],
  );
});

test('clone built-in playlist, mix MP3, move entries, configure shuffle and exact map assignment', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  await app.click('clone-playlist');
  const id = app.node('playlists').value;
  app.node('playlist-title').value = 'Custom synth + MP3';
  app.node('order').value = 'shuffle';
  app.node('repeat').value = 'off';
  await app.click('apply-playlist');
  app.choose('add-track', initial.track.id);
  await app.click('add-entry');
  app.choose('entries', String(BUILTIN_SOUNDTRACK_TRACKS.length));
  await app.click('entry-up');
  app.choose('scope', 'map');
  await app.click('assign');
  app.choose('selection', id);
  await app.click('use-selection');
  const saved = await app.store.read(),
    playlist = saved.library.playlists.find((item) => item.id === id);
  assert.equal(playlist.order, 'shuffle');
  assert.equal(playlist.repeat, 'off');
  assert.equal(playlist.trackIds.at(-2), initial.track.id);
  assert.deepEqual(saved.library.assignments, [
    { scope: 'map', key: 'edition@3/campaign@1/map-a', playlistId: id },
  ]);
  assert.equal(saved.library.selection.playlistId, id);
  assert.deepEqual(app.calls.at(-1), ['select', id]);
  await app.click('delete-playlist');
  assert.match(app.node('status').textContent, /remove assignments before deleting/);
});

test('removal checks playlist references and refuses deleting a playlist last entry', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  app.choose('tracks', initial.track.id);
  await app.click('delete-track');
  assert.match(app.node('status').textContent, /Remove this track from its playlists first/);
  app.choose('playlists', 'qa.mix');
  app.choose('entries', '1');
  await app.click('remove-entry');
  await app.click('remove-entry');
  assert.match(app.node('status').textContent, /needs at least one track/);
  await app.click('delete-track');
  await app.click('save');
  const saved = await app.store.read();
  assert.equal(saved.library.tracks.length, 0);
  assert.equal(saved.assets.length, 0);
});

test('binary download and replacement draft preserve exact original audio; Undo cancels replacement', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  await app.click('export-bundle');
  assert.equal(app.downloads[0].filename, 'RevealLine-soundtrack.rlsound');
  const bundle = app.downloads[0].blob;
  const checked = await importSoundtrackBundle(bundle, { probeMedia: structuralProbe });
  assert.deepEqual(
    Buffer.from(await checked.assets[0].blob.arrayBuffer()),
    Buffer.from(await initial.blob.arrayBuffer()),
  );
  const empty = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
    probeMedia: structuralProbe,
  });
  await app.store.commit(empty, { expectedGeneration: 1 });
  await app.click('reload');
  app.node('bundle-file').files = [bundle];
  await app.click('import-bundle');
  assert.equal((await app.store.read()).library.tracks.length, 0);
  await app.click('undo');
  assert.match(app.node('draft-state').textContent, /0 custom tracks/);
  app.node('bundle-file').files = [bundle];
  await app.click('import-bundle');
  await app.click('save');
  const restored = await app.store.read();
  assert.equal(restored.library.tracks[0].id, initial.track.id);
  assert.deepEqual(
    Buffer.from(await restored.assets[0].blob.arrayBuffer()),
    Buffer.from(await initial.blob.arrayBuffer()),
  );
});

test('concurrent writer conflict preserves a draft and never silently overwrites newer saved state', async (t) => {
  const app = await setup(t);
  await app.click('clone-playlist');
  const empty = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
    probeMedia: structuralProbe,
  });
  await app.store.commit(empty, { expectedGeneration: 0 });
  await app.click('save');
  assert.match(app.node('status').textContent, /changed in another operation/);
  assert.match(app.node('draft-state').textContent, /Unsaved draft/);
  assert.equal((await app.store.read()).library.playlists.length, 0);
  await app.click('reload');
  assert.match(
    app.node('draft-state').textContent,
    /Saved · generation 1 · 0 custom tracks · 0 custom playlists/,
  );
});

test('cancellation during the browser probe leaves saved bytes and draft untouched', async (t) => {
  let entered;
  const enteredProbe = new Promise((resolve) => {
    entered = resolve;
  });
  const probeMedia = (blob, { signal }) =>
    new Promise((resolve, reject) => {
      entered();
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Probe cancelled', 'AbortError')),
        { once: true },
      );
    });
  const app = await setup(t, { probeMedia });
  app.node('mp3-files').files = [file()];
  const importing = app.click('import-mp3');
  await enteredProbe;
  assert.equal(app.node('close').disabled, true);
  app.node('dialog').emit('cancel');
  await importing;
  assert.match(app.node('status').textContent, /Operation cancelled/);
  assert.equal((await app.store.read()).generation, 0);
  assert.match(app.node('draft-state').textContent, /0 custom tracks/);
  assert.equal(app.node('dialog').open, true);
  assert.equal(app.panel.close(), true);
});

test('MP3 audition pauses only music and restores previous intent; manual music playback ends the audition', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  assert.equal(app.node('audition').paused, false);
  assert.equal(app.state.playing, false);
  await app.click('stop-audition');
  assert.equal(app.state.playing, true);
  assert.equal(app.revoked.length, 1);
  await app.click('pause');
  await app.click('audition-track');
  await app.click('stop-audition');
  assert.equal(app.state.playing, false);
  await app.click('audition-track');
  await app.click('play');
  assert.equal(app.node('audition').paused, true);
  assert.equal(app.node('audition').hidden, true);
  assert.equal(app.state.playing, true);
  app.node('audition').playError = new DOMException('Gesture needed', 'NotAllowedError');
  await app.click('audition-track');
  assert.match(app.node('status').textContent, /Gesture needed/);
  assert.equal(app.state.playing, true);
  assert.equal(app.revoked.length, app.urls.size);
});

test('transport seeking and music volume use the public player API, while unavailable storage can retry', async (t) => {
  const app = await setup(t);
  app.node('seek').value = '24.5';
  await app.node('seek').onchange();
  app.node('volume').value = '.3';
  await app.node('volume').oninput();
  assert.ok(app.calls.some(([name, value]) => name === 'seek' && value === 24.5));
  assert.ok(app.calls.some(([name, value]) => name === 'volume' && value === 0.3));
  const unavailable = await setup(t, {
    store: {
      read: async () => {
        throw new Error('This browser does not provide soundtrack storage.');
      },
      commit: async () => assert.fail(),
    },
  });
  assert.match(unavailable.node('status').textContent, /does not provide soundtrack storage/);
  assert.equal(unavailable.node('save').disabled, true);
  assert.equal(unavailable.node('reload').disabled, false);
  await unavailable.click('play');
  assert.equal(unavailable.state.playing, true);
});

test('cancel arriving after the native commit reports the completed save, never a false rollback', async (t) => {
  const app = await setup(t);
  app.node('mp3-files').files = [file()];
  await app.click('import-mp3');
  app.db.afterCommit = () => {
    void app.click('cancel');
  };
  await app.click('save');
  assert.equal((await app.store.read()).generation, 1);
  assert.match(app.node('status').textContent, /saved atomically/);
  assert.doesNotMatch(app.node('status').textContent, /cancelled/);
  assert.equal(app.node('save').disabled, true);
});

test('shared managed-media budget failure retains the old library and a recoverable unsaved draft', async (t) => {
  const app = await setup(t, { otherManagedBytes: () => 256 * 1024 * 1024 });
  app.node('mp3-files').files = [file()];
  await app.click('import-mp3');
  await app.click('save');
  assert.equal((await app.store.read()).generation, 0);
  assert.match(app.node('status').textContent, /managed budget/);
  assert.match(app.node('draft-state').textContent, /Unsaved draft/);
  await app.click('undo');
  assert.match(app.node('draft-state').textContent, /0 custom tracks/);
});

test('a post-commit host refresh failure stays visible and does not falsely report an unsaved library', async (t) => {
  let fail = false;
  const app = await setup(t, {
    onLibrary: () => {
      if (fail) throw new Error('Host refresh unavailable');
    },
  });
  await app.click('clone-playlist');
  fail = true;
  app.choose('selection', app.node('playlists').value);
  await app.click('use-selection');
  assert.equal((await app.store.read()).generation, 1);
  assert.match(app.node('status').textContent, /Library is saved, but the game refresh failed/);
  assert.match(app.node('draft-state').textContent, /^Saved/);
});

test('user transport, volume and successful audition notify host persistence; periodic updates do not', async (t) => {
  const notifications = [],
    initial = await fixture();
  const app = await setup(t, {
    initial,
    callbacks: {
      onVolume: (value) => notifications.push(['volume', value]),
      onPlayback: (state) => notifications.push(['playback', state]),
      onAudioEnabled: () => notifications.push(['enabled']),
    },
  });
  app.panel.update();
  app.panel.update();
  assert.equal(notifications.length, 0);
  app.node('volume').value = '.2';
  await app.node('volume').oninput();
  assert.deepEqual(notifications, [['volume', 0.2]]);
  await app.click('pause');
  assert.deepEqual(notifications.at(-1), ['playback', { playing: false, desired: false }]);
  await app.click('play');
  assert.deepEqual(notifications.at(-1), ['enabled']);
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  assert.deepEqual(notifications.at(-1), ['enabled']);
  await app.click('stop-audition');
  const before = notifications.length;
  app.panel.update();
  assert.equal(notifications.length, before);
});

test('hiding during audition restores remembered intent without starting hidden-page audio', async (t) => {
  const app = await setup(t, { initial: await fixture() });
  app.choose('tracks', 'qa.silence');
  await app.click('audition-track');
  assert.equal(app.state.desired, false);
  const playCalls = app.calls.filter(([name]) => name === 'play').length;
  app.doc.hidden = true;
  app.doc.emit('visibilitychange');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.node('audition').paused, true);
  assert.equal(app.node('audition').hidden, true);
  assert.equal(app.state.desired, true);
  assert.equal(app.state.playing, false);
  assert.equal(app.calls.filter(([name]) => name === 'play').length, playCalls);
});

test('beforeAudio is an explicit activation hook, never called from ordinary studio rendering', async (t) => {
  let activations = 0;
  const app = await setup(t, {
    initial: await fixture(),
    callbacks: {
      beforeAudio: async () => {
        activations++;
      },
    },
  });
  app.panel.update();
  assert.equal(activations, 0);
  await app.click('pause');
  assert.equal(activations, 0);
  await app.click('play');
  assert.equal(activations, 1);
  app.choose('tracks', 'qa.silence');
  await app.click('audition-track');
  assert.equal(activations, 2);
  await app.click('stop-audition');
  app.choose('selection', 'qa.mix');
  await app.click('use-selection');
  assert.equal(activations, 3);
});

test('New playlist uses the visibly selected library track rather than the separate append-track picker', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  app.choose('tracks', initial.track.id);
  assert.equal(app.node('add-track').value, BUILTIN_SOUNDTRACK_TRACKS[0].id);
  await app.click('create-playlist');
  const playlistId = app.node('playlists').value;
  await app.click('save');
  const saved = await app.store.read();
  assert.deepEqual(
    saved.library.playlists.find((playlist) => playlist.id === playlistId).trackIds,
    [initial.track.id],
  );
});
