import { albumFixture, albumCatalog, responseFor } from './helpers/soundtrack-albums.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { attachSoundtrackPanel } from '../ui/soundtrack-panel.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import {
  emptySoundtrackLibrary,
  BUILTIN_SOUNDTRACK_TRACKS,
  resolveCatalogueTrack,
} from '../soundtrack.mjs';
import {
  prepareSoundtrackLibrary,
  importSoundtrackBundle,
  exportSoundtrackBundle,
} from '../soundtrack-bundle.mjs';
import { soundtrackPlaylistShare } from '../soundtrack-share.mjs';
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
  getAttribute(key) {
    return this.attributes.get(key) ?? null;
  }
  closest() {
    for (let element = this; element; element = element.parentNode)
      if (element.hidden || element.attributes.has('inert')) return element;
    return null;
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
    if (this.disabled) return;
    const event = {
      target: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    const result = this.onclick?.(event);
    if (this.tagName === 'A' && this.getAttribute('href') && !event.defaultPrevented)
      this.document.nativeDownloads.push({
        href: this.getAttribute('href'),
        filename: this.getAttribute('download'),
      });
    return result;
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
  const doc = { nodes: new Map(), activeElement: null, hidden: false, nativeDownloads: [] };
  const eventRoot = new Element(doc, 'document');
  doc.addEventListener = (...args) => eventRoot.addEventListener(...args);
  doc.removeEventListener = (...args) => eventRoot.removeEventListener(...args);
  doc.emit = (...args) => eventRoot.emit(...args);
  doc.body = new Element(doc, 'body');
  doc.head = new Element(doc, 'head');
  doc.createElement = (tag) => new Element(doc, tag);
  const db = memoryIndexedDB(),
    store =
      overrideStore ??
      createSoundtrackStore({
        indexedDB: db.indexedDB,
        soundtrackCatalogue: !!callbacks.catalogue,
      });
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
    selectListening: async (value) => calls.push(['listening', value]),
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
  assert.equal(app.downloads.length, 0, 'Preparation never calls the injected download adapter.');
  await app.click('download-prepared');
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

test('ordinary audition transport controls pause/resume, seek and change only audition volume without rewriting music intent', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  app.choose('tracks', initial.track.id);
  const media = app.node('audition');
  media.duration = 45;
  media.currentTime = 0;
  media.volume = 1;
  await app.click('audition-track');
  assert.equal(app.state.desired, false);
  assert.equal(app.node('toggle-audition').disabled, false);
  await app.click('toggle-audition');
  assert.equal(media.paused, true);
  assert.equal(app.node('toggle-audition').textContent, 'Resume audition');
  await app.click('toggle-audition');
  assert.equal(media.paused, false);
  app.node('audition-seek').value = '12.5';
  await app.node('audition-seek').onchange();
  assert.equal(media.currentTime, 12.5);
  app.node('audition-volume').value = '0.35';
  app.node('audition-volume').oninput();
  assert.equal(media.volume, 0.35);
  assert.equal(app.state.volume, 0.6);
  assert.equal(
    app.calls.some(([kind]) => kind === 'seek' || kind === 'volume'),
    false,
  );
  app.node('audition-seek').focus();
  app.node('audition-seek').value = '20';
  media.currentTime = 13;
  media.emit('timeupdate');
  assert.equal(
    app.node('audition-seek').value,
    '20',
    'Current playback cannot overwrite a focused range draft',
  );
  await app.click('stop-audition');
  assert.equal(app.node('toggle-audition').disabled, true);
  assert.equal(app.node('audition-seek').disabled, true);
  assert.equal(app.state.desired, true);
});

test('preparing a visible native link is read-only and retains exact saved bytes for explicit retry', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial, callbacks: { download: undefined } });
  await app.click('clone-playlist');
  const draftState = app.node('draft-state').textContent;
  const saved = await app.store.read();
  await app.click('export-bundle');
  const link = app.node('download-prepared');
  assert.equal(link.tagName, 'A');
  assert.equal(app.node('backup-ready').hidden, false);
  assert.equal(app.doc.activeElement, link);
  assert.equal(
    app.doc.nativeDownloads.length,
    0,
    'The async preparation does not activate any link.',
  );
  assert.equal(app.node('draft-state').textContent, draftState);
  assert.deepEqual(await app.store.read(), saved);
  const url = link.getAttribute('href'),
    blob = app.urls.get(url);
  assert.ok(blob instanceof Blob);
  const restored = await importSoundtrackBundle(blob, { probeMedia: structuralProbe });
  assert.deepEqual(restored.library, saved.library, 'The unsaved cloned playlist is excluded.');
  assert.deepEqual(
    Buffer.from(await restored.assets[0].blob.arrayBuffer()),
    Buffer.from(await initial.blob.arrayBuffer()),
  );
  assert.match(app.node('backup-info').textContent, /saved generation 1/);
  assert.match(app.node('backup-info').textContent, /does not save a file to disk/);
  app.click('download-prepared');
  app.click('download-prepared');
  assert.deepEqual(app.doc.nativeDownloads, [
    { href: url, filename: 'RevealLine-soundtrack.rlsound' },
    { href: url, filename: 'RevealLine-soundtrack.rlsound' },
  ]);
  assert.equal(app.urls.size, 1, 'Retry reuses one bounded Blob and handle.');
  assert.equal(app.revoked.length, 0, 'The browser may consume its link asynchronously.');
  assert.match(app.node('status').textContent, /Download requested/);
  assert.doesNotMatch(app.node('status').textContent, /successfully saved|download complete/i);
  app.panel.close();
  assert.equal(app.revoked.length, 0, 'Ordinary close keeps a pending download handle alive.');
  app.click('download-prepared');
  assert.equal(app.doc.nativeDownloads.length, 2, 'A closed dialog cannot request a download.');
  await app.panel.open();
  assert.equal(link.getAttribute('href'), url);
  await app.click('export-bundle');
  assert.deepEqual(app.revoked, [url]);
  assert.equal(app.urls.size, 2);
  const replacement = link.getAttribute('href');
  app.panel.dispose();
  assert.deepEqual(app.revoked, [url, replacement]);
  assert.equal(link.getAttribute('href'), null);
  assert.equal(app.node('backup-ready').hidden, true);
});

test('prepared download participates in local keyboard focus and discard never changes saved music', async (t) => {
  const app = await setup(t, { callbacks: { download: undefined } });
  await app.click('export-bundle');
  const link = app.node('download-prepared'),
    url = link.getAttribute('href');
  const saved = await app.store.read();
  app.node('dialog').emit('keydown', { target: link, key: 'ArrowRight' });
  assert.equal(app.doc.activeElement, app.node('discard-backup'));
  app.node('dialog').emit('keydown', { target: app.node('discard-backup'), key: 'ArrowLeft' });
  assert.equal(app.doc.activeElement, link);
  app.click('discard-backup');
  assert.equal(app.doc.activeElement, app.node('export-bundle'));
  assert.equal(link.getAttribute('href'), null);
  assert.deepEqual(app.revoked, [url]);
  assert.deepEqual(await app.store.read(), saved);
  app.click('download-prepared');
  assert.equal(app.doc.nativeDownloads.length, 0);
});

test('adopted draft edits, Undo, import, save and reload invalidate a prepared copy without auto-downloading', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial, callbacks: { download: undefined } });
  const prepare = async () => {
    await app.click('export-bundle');
    const url = app.node('download-prepared').getAttribute('href');
    assert.ok(url);
    return url;
  };
  const invalidated = (url) => {
    assert.equal(app.node('backup-ready').hidden, true);
    assert.equal(app.node('download-prepared').getAttribute('href'), null);
    assert.ok(app.revoked.includes(url));
  };
  let url = await prepare();
  await app.click('clone-playlist');
  invalidated(url);
  url = await prepare();
  await app.click('undo');
  invalidated(url);
  url = await prepare();
  app.node('mp3-files').files = [file('Extra.mp3')];
  await app.click('import-mp3');
  invalidated(url);
  url = await prepare();
  await app.click('save');
  invalidated(url);
  assert.equal((await app.store.read()).generation, 2);
  url = await prepare();
  const bundle = app.urls.get(url);
  app.node('bundle-file').files = [bundle];
  await app.click('import-bundle');
  invalidated(url);
  url = await prepare();
  await app.click('reload');
  invalidated(url);
  assert.equal((await app.store.read()).generation, 2);
  assert.equal(app.doc.nativeDownloads.length, 0);
});

test('cancellation and disposal during real binary preparation cannot expose a late download', async (t) => {
  for (const ending of ['cancel', 'dispose']) {
    const initial = await fixture(),
      app = await setup(t, { initial, callbacks: { download: undefined } });
    const saved = await app.store.read();
    const preparing = app.click('export-bundle');
    assert.equal(app.node('cancel').hidden, false);
    if (ending === 'cancel') app.click('cancel');
    else app.panel.dispose();
    assert.equal(await preparing, false);
    assert.equal(app.urls.size, 0);
    assert.equal(app.doc.nativeDownloads.length, 0);
    assert.equal(app.node('backup-ready').hidden, true);
    assert.deepEqual(await app.store.read(), saved);
    if (ending === 'cancel') assert.match(app.node('status').textContent, /Operation cancelled/);
  }
});

test('native adapter receives prepared bytes synchronously on explicit activation and can retry a refusal', async (t) => {
  let activation = false,
    reject = true;
  const requests = [];
  const app = await setup(t, {
    initial: await fixture(),
    callbacks: {
      URLImpl: {
        createObjectURL() {
          throw Error('No browser URL required by a native adapter');
        },
      },
      download(blob, filename, { signal }) {
        assert.equal(activation, true, 'No await or export runs ahead of the adapter call.');
        assert.equal(signal.aborted, false);
        requests.push({ blob, filename });
        if (reject) throw Error('Host declined this download');
      },
    },
  });
  await app.click('export-bundle');
  assert.equal(requests.length, 0);
  assert.equal(app.node('download-prepared').tagName, 'BUTTON');
  activation = true;
  const refused = app.click('download-prepared');
  activation = false;
  await refused;
  assert.match(app.node('status').textContent, /Host declined/);
  assert.equal(app.node('backup-ready').hidden, false);
  reject = false;
  activation = true;
  const retry = app.click('download-prepared');
  activation = false;
  await retry;
  assert.equal(requests.length, 2);
  assert.equal(requests[0].blob, requests[1].blob);
  assert.equal(requests[1].filename, 'RevealLine-soundtrack.rlsound');
  assert.match(app.node('status').textContent, /request handed to the host/);
  assert.equal((await app.store.read()).generation, 1);
});

test('optional album additions preserve applied and unapplied drafts, playlist choice and playing transport', async (t) => {
  const a = await albumFixture('qa.first'),
    b = await albumFixture('qa.second');
  let requests = 0;
  const fetch = async (url) => {
    requests++;
    return responseFor(
      url.endsWith('.json')
        ? JSON.stringify(albumCatalog(a.album, b.album))
        : url.includes(a.album.id)
          ? a.blob
          : b.blob,
      url,
    );
  };
  const app = await setup(t, {
    callbacks: { albumDownload: { baseURL: 'https://example.test/build/', fetch } },
  });
  assert.equal(requests, 0, 'opening Studio does not fetch metadata or audio');
  app.node('mp3-files').files = [file('Personal.mp3')];
  await app.click('import-mp3');
  app.node('track-title').value = 'Applied personal title';
  await app.click('apply-track');
  app.node('track-title').value = 'Typed but not applied';
  app.node('selection').value = 'builtin.fpv';
  await app.click('browse-albums');
  assert.equal(requests, 1);
  assert.equal(app.node('track-title').value, 'Typed but not applied');
  await app.click('album-add-qa.first');
  assert.equal(app.node('track-title').value, 'Typed but not applied');
  assert.equal(app.node('selection').value, 'builtin.fpv');
  assert.equal((await app.store.read()).generation, 0, 'Add is only a draft');
  await app.click('album-add-qa.second');
  await app.click('save');
  const current = await app.store.read();
  assert.equal(current.library.tracks.length, 3);
  assert.equal(current.library.tracks[0].title, 'Applied personal title');
  assert.equal(
    current.library.selection.playlistId,
    null,
    'unapplied selection was not silently saved',
  );
  assert.deepEqual(
    current.library.playlists.map((p) => p.id),
    ['qa.first', 'qa.second'],
  );
  assert.equal(
    app.calls.some(([name]) => ['play', 'pause', 'select'].includes(name)),
    false,
  );
  assert.equal(app.state.track.id, 'builtin.fpv');
});

test('cancelled album download preserves an earlier draft and typed editor fields', async (t) => {
  const a = await albumFixture();
  let cancelCount = 0,
    requested;
  const started = new Promise((resolve) => {
    requested = resolve;
  });
  const fetch = async (url) => {
    if (url.endsWith('.json')) return responseFor(JSON.stringify(albumCatalog(a.album)), url);
    requested();
    return responseFor(
      new ReadableStream({
        cancel() {
          cancelCount++;
        },
      }),
      url,
    );
  };
  const app = await setup(t, {
    callbacks: { albumDownload: { baseURL: 'https://example.test/build/', fetch } },
  });
  app.node('mp3-files').files = [file()];
  await app.click('import-mp3');
  app.node('track-title').value = 'Retain typed title';
  await app.click('browse-albums');
  const promise = app.click('album-add-qa.album');
  await started;
  await app.click('cancel');
  await promise;
  assert.equal(cancelCount, 1);
  assert.equal(app.node('track-title').value, 'Retain typed title');
  assert.match(app.node('status').textContent, /cancelled/);
  await app.click('save');
  assert.equal((await app.store.read()).library.tracks.length, 1);
});

test('album completion restores owned disabled-control focus and respects deliberate navigation', async (t) => {
  const a = await albumFixture();
  let respond, entered;
  const fetch = async (url) => {
    if (url.endsWith('.json')) return responseFor(JSON.stringify(albumCatalog(a.album)), url);
    entered?.();
    return new Promise((resolve) => {
      respond = () => resolve(responseFor(a.blob, url));
    });
  };
  const app = await setup(t, {
    callbacks: { albumDownload: { baseURL: 'https://example.test/build/', fetch } },
  });
  await app.click('browse-albums');
  const opener = app.node('album-add-qa.album');
  opener.focus();
  const firstStart = new Promise((resolve) => {
    entered = resolve;
  });
  const first = opener.click();
  await firstStart;
  app.doc.activeElement = app.doc.body;
  respond();
  await first;
  assert.equal(app.doc.activeElement.id, app.node('save').id);
  opener.focus();
  const secondStart = new Promise((resolve) => {
    entered = resolve;
  });
  const second = opener.click();
  await secondStart;
  app.node('play').focus();
  app.doc.emit('focusin', { target: app.node('play') });
  respond();
  await second;
  assert.equal(app.doc.activeElement.id, app.node('play').id);
});

test('bonus album offload, undo and explicit download retain edited metadata, playlists and selection', async (t) => {
  const album = await albumFixture('qa.offline');
  let albumRequests = 0,
    assetRequests = 0;
  const app = await setup(t, {
    initial: album,
    callbacks: {
      catalogue: emptyCatalogue,
      readAsset: async () => {
        assetRequests++;
        throw new Error('Offloaded bonus albums require an explicit album download');
      },
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) => {
          if (url.endsWith('.json'))
            return responseFor(JSON.stringify(albumCatalog(album.album)), url);
          albumRequests++;
          return responseFor(album.blob, url);
        },
      },
    },
  });
  app.choose('tracks', album.track.id);
  app.node('track-title').value = 'My retained title';
  app.node('rights-credit').value = 'My retained credit';
  app.node('track-genre').value = 'metal';
  await app.click('apply-track');
  app.choose('playlists', album.album.id);
  app.choose('scope', 'theme');
  await app.click('assign');
  await app.click('save');
  const before = await app.store.read();
  await app.click('browse-albums');
  assert.equal(app.node('album-add-qa.offline').textContent, 'Download again');
  app.node('track-title').value = 'Typed but unapplied';
  await app.click('album-offload-qa.offline');
  assert.equal(app.node('track-title').value, 'Typed but unapplied');
  assert.equal((await app.store.read()).assets.length, 1, 'removal remains a draft');
  assert.match(app.node('album-status-qa.offline').textContent, /removed in the draft/);
  await app.click('undo');
  assert.match(app.node('album-status-qa.offline').textContent, /available offline/);
  assert.equal(app.node('album-offload-qa.offline').disabled, false);
  await app.click('album-offload-qa.offline');
  await app.click('save');
  const offloaded = await app.store.read();
  assert.equal(offloaded.assets.length, 0);
  assert.equal(offloaded.library.bonusAlbums[0].downloaded, false);
  for (const key of ['tracks', 'tags', 'playlists', 'assignments', 'selection', 'listening'])
    assert.deepEqual(offloaded.library[key], before.library[key], key);
  assert.match(app.node('track-info').textContent, /Download again/);
  await app.click('audition-track');
  assert.match(app.node('status').textContent, /Download again/);
  await app.click('export-bundle');
  assert.match(app.node('status').textContent, /Download again.*Community soundtracks/);
  assert.equal(app.node('backup-ready').hidden, true);
  app.choose('playlists', album.album.id);
  await app.click('export-share');
  assert.match(app.node('status').textContent, /Download again.*Community soundtracks/);
  assert.equal(assetRequests, 0);
  assert.equal(albumRequests, 0, 'offload and preview never trigger an album download');
  await app.click('album-add-qa.offline');
  assert.equal(albumRequests, 1);
  assert.equal((await app.store.read()).assets.length, 0, 're-download is a draft until Save');
  await app.click('save');
  const restored = await app.store.read();
  assert.equal(restored.library.bonusAlbums[0].downloaded, true);
  assert.equal(restored.assets.length, 1);
  assert.equal(restored.assets[0].sha256, album.track.asset.sha256);
  for (const key of ['tracks', 'tags', 'playlists', 'assignments', 'selection', 'listening'])
    assert.deepEqual(restored.library[key], before.library[key], key);
  assert.equal(
    app.calls.some(([name]) => ['play', 'pause', 'select'].includes(name)),
    false,
  );
  assert.equal(app.state.playing, true);
});

test('bonus offload retains exact audio bytes still required by a separate personal upload', async (t) => {
  const personal = await fixture('shared-recording'),
    album = await albumFixture('qa.shared', 'shared-recording');
  const app = await setup(t, {
    initial: personal,
    callbacks: {
      catalogue: emptyCatalogue,
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) =>
          responseFor(
            url.endsWith('.json') ? JSON.stringify(albumCatalog(album.album)) : album.blob,
            url,
          ),
      },
    },
  });
  await app.click('browse-albums');
  await app.click('album-add-qa.shared');
  await app.click('save');
  await app.click('album-offload-qa.shared');
  assert.match(app.node('status').textContent, /shared with other installed tracks is retained/);
  await app.click('save');
  const saved = await app.store.read();
  assert.equal(saved.library.tracks.length, 2);
  assert.equal(saved.library.bonusAlbums[0].downloaded, false);
  assert.equal(saved.assets.length, 1);
  assert.equal(saved.assets[0].sha256, personal.track.asset.sha256);
  assert.deepEqual(
    Buffer.from(await saved.assets[0].blob.arrayBuffer()),
    Buffer.from(await personal.blob.arrayBuffer()),
  );
  assert.match(app.node('album-status-qa.shared').textContent, /Shared audio.*still available/);
  assert.equal(
    app.node('album-offload-qa.shared').disabled,
    true,
    'protected duplicate bytes cannot be removed again',
  );
});

test('partially restored creator shares expose remaining offline audio and can be offloaded again', async (t) => {
  const a = await albumFixture('qa.partial'),
    b = await albumFixture('qa.sibling');
  const library = {
    ...a.album.library,
    tracks: [a.track, b.track],
    playlists: [{ ...a.album.library.playlists[0], trackIds: [a.track.id, b.track.id] }],
  };
  const prepared = await prepareSoundtrackLibrary(
    library,
    [...a.prepared.assets, ...b.prepared.assets],
    { probeMedia: structuralProbe },
  );
  const blob = await exportSoundtrackBundle(library, prepared.assets);
  const album = {
    ...a.album,
    library,
    bytes: blob.size,
    sha256: createHash('sha256')
      .update(Buffer.from(await blob.arrayBuffer()))
      .digest('hex'),
  };
  const app = await setup(t, {
    initial: { prepared },
    callbacks: {
      catalogue: emptyCatalogue,
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) => responseFor(JSON.stringify(albumCatalog(album)), url),
      },
    },
  });
  await app.click('browse-albums');
  await app.click('album-offload-qa.partial');
  await app.click('save');
  const offloaded = await app.store.read();
  const share = soundtrackPlaylistShare(offloaded.library, {
    ...library.playlists[0],
    id: 'qa.partial-share',
    trackIds: [a.track.id],
  });
  const shareBlob = await exportSoundtrackBundle(share, a.prepared.assets);
  app.node('bundle-file').files = [new File([shareBlob], 'partial.rlsound')];
  await app.click('add-share');
  assert.match(
    app.node('album-status-qa.partial').textContent,
    /1 of 2 recordings available offline in the draft/,
  );
  assert.equal(app.node('album-offload-qa.partial').disabled, false);
  await app.click('save');
  const partial = await app.store.read();
  assert.equal(partial.assets.length, 1);
  assert.equal(partial.assets[0].sha256, a.track.asset.sha256);
  assert.deepEqual(partial.library.bonusAlbums[0].trackIds, [b.track.id]);
  assert.equal(app.node('album-offload-qa.partial').disabled, false);
  await app.click('album-offload-qa.partial');
  await app.click('save');
  const removed = await app.store.read();
  assert.equal(removed.assets.length, 0);
  assert.deepEqual(removed.library.tracks, partial.library.tracks);
  assert.deepEqual(removed.library.playlists, partial.library.playlists);
  assert.deepEqual(removed.library.bonusAlbums[0], {
    id: album.id,
    trackIds: [a.track.id, b.track.id],
    downloaded: false,
  });
  assert.equal(app.node('album-offload-qa.partial').disabled, true);
});

test('cancelled bonus re-download retains the offloaded save and unapplied editor values', async (t) => {
  const album = await albumFixture('qa.cancel-offline');
  let requested,
    cancelled = 0;
  const started = new Promise((resolve) => {
    requested = resolve;
  });
  const app = await setup(t, {
    initial: album,
    callbacks: {
      catalogue: emptyCatalogue,
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) => {
          if (url.endsWith('.json'))
            return responseFor(JSON.stringify(albumCatalog(album.album)), url);
          requested();
          return responseFor(
            new ReadableStream({
              cancel() {
                cancelled++;
              },
            }),
            url,
          );
        },
      },
    },
  });
  await app.click('browse-albums');
  await app.click('album-offload-qa.cancel-offline');
  await app.click('save');
  const before = await app.store.read();
  app.choose('tracks', album.track.id);
  app.node('track-title').value = 'Keep this typed title';
  const download = app.click('album-add-qa.cancel-offline');
  await started;
  await app.click('cancel');
  await download;
  assert.equal(cancelled, 1);
  assert.match(app.node('status').textContent, /cancelled/);
  assert.equal(app.node('track-title').value, 'Keep this typed title');
  assert.deepEqual(await app.store.read(), before);
  assert.equal(app.node('save').disabled, true);
});

test('bonus offload save respects a newer writer and leaves saved bytes intact', async (t) => {
  const album = await albumFixture('qa.offload-cas');
  const app = await setup(t, {
    initial: album,
    callbacks: {
      catalogue: emptyCatalogue,
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) => responseFor(JSON.stringify(albumCatalog(album.album)), url),
      },
    },
  });
  await app.click('browse-albums');
  await app.click('album-offload-qa.offload-cas');
  await app.store.commit(album.prepared, { expectedGeneration: 1 });
  await app.click('save');
  assert.match(app.node('status').textContent, /changed|generation/i);
  const saved = await app.store.read();
  assert.equal(saved.generation, 2);
  assert.equal(saved.assets.length, 1);
  assert.match(app.node('draft-state').textContent, /Unsaved draft/);
  await app.click('reload');
  assert.match(app.node('album-status-qa.offload-cas').textContent, /available offline/);
});

test('removing a bonus track from a draft also removes its obsolete album pin', async (t) => {
  const album = await albumFixture('qa.remove-bonus');
  const app = await setup(t, {
    callbacks: {
      catalogue: emptyCatalogue,
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) =>
          responseFor(
            url.endsWith('.json') ? JSON.stringify(albumCatalog(album.album)) : album.blob,
            url,
          ),
      },
    },
  });
  await app.click('browse-albums');
  await app.click('album-add-qa.remove-bonus');
  await app.click('save');
  app.choose('playlists', album.album.id);
  await app.click('delete-playlist');
  app.choose('tracks', album.track.id);
  await app.click('delete-track');
  await app.click('save');
  const saved = await app.store.read();
  assert.deepEqual(saved.library.tracks, []);
  assert.deepEqual(saved.library.bonusAlbums, []);
  assert.deepEqual(saved.assets, []);
  assert.equal(app.node('album-add-qa.remove-bonus').textContent, 'Add to draft');
});

const emptyCatalogue = {
  format: 'revealline-soundtrack-catalogue.v1',
  edition: 'originals-1',
  tracks: [],
};

test('genre controls persist the actual checkbox selection without resuming intentional music pause', async (t) => {
  const app = await setup(t, { callbacks: { catalogue: emptyCatalogue } });
  app.state.playing = false;
  app.state.desired = false;
  app.node('listening-mode').value = 'mix';
  app.node('mix-synth90s').checked = false;
  app.node('mix-metal').checked = true;
  app.node('mix-ukrainian').checked = true;
  app.node('installed-only').checked = true;
  await app.click('apply-listening');
  const saved = await app.store.read();
  assert.deepEqual(saved.library.listening, {
    mode: 'mix',
    genres: ['metal', 'ukrainian'],
    installedOnly: true,
  });
  assert.deepEqual(app.calls.find(([name]) => name === 'listening')[1], saved.library.listening);
  assert.equal(
    app.calls.some(([name]) => name === 'play'),
    false,
  );
  assert.match(app.node('original-status').textContent, /in production/);
});

test('catalogue volume download and removal preserve playlists and original upload bytes', async (t) => {
  const initial = await fixture('uploaded'),
    song = await fixture('published');
  const track = resolveCatalogueTrack({
    ...song.track,
    id: 'builtin.catalog.test',
    edition: 'originals-1',
    path: 'optional/soundtracks/test.mp3',
    tags: { genres: ['ukrainian'], role: 'gameplay', energy: 4, themes: ['ukraine'] },
  });
  let downloads = 0;
  const app = await setup(t, {
    initial,
    callbacks: {
      catalogue: { ...emptyCatalogue, tracks: [track] },
      readAsset: async (hash, options) => {
        assert.equal(hash, track.asset.sha256);
        assert.equal(options.download, true);
        downloads++;
        return song.assets[0].blob;
      },
    },
  });
  await app.click('download-ukrainian-1');
  assert.equal(downloads, 1);
  assert.equal((await app.store.read()).assets.length, 1, 'download stays draft until save');
  await app.click('save');
  let saved = await app.store.read();
  assert.deepEqual(saved.library.installedTrackIds, [track.id]);
  assert.equal(saved.assets.length, 2);
  app.choose('tracks', track.id);
  await app.click('create-playlist');
  await app.click('save');
  const id = app.node('playlists').value;
  await app.click('offload-ukrainian-1');
  await app.click('save');
  saved = await app.store.read();
  assert.deepEqual(saved.library.installedTrackIds, []);
  assert.deepEqual(saved.library.playlists.find((item) => item.id === id).trackIds, [track.id]);
  assert.equal(saved.assets.length, 1);
  assert.equal(saved.assets[0].sha256, initial.track.asset.sha256);
});

test('creator tags and selected-playlist export preserve original bytes and additive import retains choices', async (t) => {
  const initial = await fixture('creator');
  const app = await setup(t, { initial, callbacks: { catalogue: emptyCatalogue } });
  app.choose('tracks', initial.track.id);
  app.node('track-genre').value = 'metal';
  app.node('track-fusion').value = 'ukrainian';
  app.node('track-role').value = 'intense';
  app.node('track-energy').value = '5';
  app.node('track-themes').value = 'fpv, ukraine';
  await app.click('apply-track');
  await app.click('save');
  const saved = await app.store.read();
  assert.deepEqual(saved.library.tags[initial.track.id], {
    genres: ['metal', 'ukrainian'],
    role: 'intense',
    energy: 5,
    themes: ['fpv', 'ukraine'],
  });
  app.choose('playlists', initial.library.playlists[0].id);
  await app.click('export-share');
  assert.match(app.node('status').textContent, /Album prepared/);
  await app.click('download-prepared');
  assert.equal(app.downloads.length, 1);
  const exported = await importSoundtrackBundle(app.downloads[0].blob, {
    probeMedia: structuralProbe,
  });
  assert.equal(exported.assets[0].sha256, initial.track.asset.sha256);
  app.node('bundle-file').files = [app.downloads[0].blob];
  await app.click('add-share');
  await app.click('save');
  const restored = await app.store.read();
  assert.equal(restored.library.tracks.length, 1);
  assert.deepEqual(restored.library.selection, saved.library.selection);
});

test('unclassified uploads retain scene, energy and world tags after saving and reloading', async (t) => {
  const initial = await fixture('unclassified');
  const app = await setup(t, { initial, callbacks: { catalogue: emptyCatalogue } });
  app.choose('tracks', initial.track.id);
  app.node('track-genre').value = '';
  app.node('track-fusion').value = '';
  app.node('track-role').value = 'menu';
  app.node('track-energy').value = '2';
  app.node('track-themes').value = 'retro';
  await app.click('apply-track');
  await app.click('save');
  assert.deepEqual((await app.store.read()).library.tags[initial.track.id], {
    genres: [],
    role: 'menu',
    energy: 2,
    themes: ['retro'],
  });
  await app.click('reload');
  app.choose('tracks', initial.track.id);
  assert.equal(app.node('track-genre').value, '');
  assert.equal(app.node('track-role').value, 'menu');
  assert.equal(app.node('track-energy').value, '2');
  assert.equal(app.node('track-themes').value, 'retro');
});

test('album browsing retains unapplied music tags and genre checkbox edits', async (t) => {
  const a = await albumFixture();
  const initial = await fixture('pending-tags');
  const app = await setup(t, {
    initial,
    callbacks: {
      catalogue: emptyCatalogue,
      albumDownload: {
        baseURL: 'https://example.test/build/',
        fetch: async (url) => responseFor(JSON.stringify(albumCatalog(a.album)), url),
      },
    },
  });
  app.choose('tracks', initial.track.id);
  app.node('track-genre').value = 'ukrainian';
  app.node('track-fusion').value = 'metal';
  app.node('track-role').value = 'menu';
  app.node('track-energy').value = '2';
  app.node('track-themes').value = 'ukraine';
  app.node('listening-mode').value = 'mix';
  app.node('mix-metal').checked = false;
  app.node('installed-only').checked = true;
  await app.click('browse-albums');
  assert.equal(app.node('track-genre').value, 'ukrainian');
  assert.equal(app.node('track-fusion').value, 'metal');
  assert.equal(app.node('track-role').value, 'menu');
  assert.equal(app.node('track-energy').value, '2');
  assert.equal(app.node('track-themes').value, 'ukraine');
  assert.equal(app.node('listening-mode').value, 'mix');
  assert.equal(app.node('mix-metal').checked, false);
  assert.equal(app.node('installed-only').checked, true);
});

test('uninstalled trusted catalogue tracks show online availability and can be auditioned', async (t) => {
  const song = await fixture('online-audition');
  const track = resolveCatalogueTrack({
    ...song.track,
    id: 'builtin.catalog.online-audition',
    edition: 'originals-1',
    path: 'optional/soundtracks/online-audition.mp3',
    tags: { genres: ['synth90s'], role: 'menu', energy: 2, themes: ['retro'] },
  });
  let reads = 0;
  const app = await setup(t, {
    callbacks: {
      catalogue: { ...emptyCatalogue, tracks: [track] },
      readAsset: async (hash, { signal }) => {
        assert.equal(hash, track.asset.sha256);
        assert.equal(signal.aborted, false);
        reads++;
        return song.assets[0].blob;
      },
    },
  });
  app.choose('tracks', track.id);
  assert.match(app.node('track-info').textContent, /available online/);
  assert.equal(app.node('audition-track').disabled, false);
  await app.click('audition-track');
  assert.equal(reads, 1);
  assert.match(app.node('status').textContent, /Auditioning/);
  await app.click('stop-audition');
});

test('oversized complete catalogue backup is refused before any original download', async (t) => {
  const song = await fixture('large-catalogue');
  const tracks = Array.from({ length: 9 }, (_, index) =>
    resolveCatalogueTrack({
      ...song.track,
      id: `builtin.catalog.large-${index}`,
      edition: 'originals-1',
      path: `optional/soundtracks/large-${index}.mp3`,
      asset: {
        ...song.track.asset,
        sha256: String(index + 1).padStart(64, '0'),
        bytes: 32 * 1024 * 1024,
      },
      tags: { genres: ['synth90s'], role: 'gameplay', energy: 3, themes: ['retro'] },
    }),
  );
  let reads = 0;
  const app = await setup(t, {
    callbacks: {
      catalogue: { ...emptyCatalogue, tracks },
      readAsset: async () => {
        reads++;
        throw new Error('Unexpected original download');
      },
    },
  });
  await app.click('apply-listening');
  await app.click('export-bundle');
  assert.equal(reads, 0);
  assert.match(app.node('status').textContent, /exceeds 256.0 MiB/);
  assert.equal(app.downloads.length, 0);
});
