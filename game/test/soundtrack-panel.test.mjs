import test from 'node:test';
import assert from 'node:assert/strict';
import { attachSoundtrackPanel } from '../ui/soundtrack-panel.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
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
    this.ownerDocument = doc;
    this.dataset = {};
    this.classList = {
      add: (...names) => {
        this.className = [this.className || '', ...names].join(' ').trim();
      },
    };
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
  set textContent(value) {
    this._text = String(value ?? '');
    this.children = [];
  }
  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join('');
  }
  set disabled(value) {
    this._disabled = Boolean(value);
    if (this._disabled && this.document.activeElement === this) {
      if (this.document.deferDisabledBlur) this.document.disabledBlurs.push(() => this.blur());
      else this.blur();
    }
  }
  get disabled() {
    return this._disabled;
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
    this._text = '';
    this.children = [];
    this.append(...children);
  }
  contains(node) {
    for (let current = node; current; current = current.parentNode)
      if (current === this) return true;
    return false;
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
  dispatchEvent(event) {
    if (!event.target) Object.defineProperty(event, 'target', { value: this });
    for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
      for (const listener of node.listeners?.get(event.type) ?? []) listener(event);
      if (event.cancelBubble) break;
    }
    return !event.defaultPrevented;
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
    if (this.disabled || !this.isConnected) return;
    this.document.activeElement = this;
    this.document.emit('focusin', { target: this });
  }
  blur() {
    if (this.document.activeElement === this) this.document.activeElement = this.document.body;
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
    open = true,
  } = {},
) {
  const doc = {
    nodes: new Map(),
    activeElement: null,
    hidden: false,
    nativeDownloads: [],
    disabledBlurs: [],
  };
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
  if (open) await panel.open();
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

test('shared master immediately governs audition output while retaining local volume and transport', async (t) => {
  const audioMaster = createAudioMaster({ muted: false, volume: 0.5 }),
    initial = await fixture(),
    app = await setup(t, { initial, callbacks: { audioMaster } });
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  const media = app.node('audition');
  media.currentTime = 8;
  app.node('audition-volume').value = '0.4';
  app.node('audition-volume').oninput();
  const intent = { ...app.state },
    calls = app.calls.length;
  assert.equal(media.volume, 0.2);
  audioMaster.setMuted(true);
  assert.equal(media.muted, true);
  audioMaster.setVolume(0.25);
  assert.equal(media.volume, 0.1);
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 8);
  assert.deepEqual(app.state, intent);
  assert.equal(app.calls.length, calls);
  // Model native controls attempting to replace effective values; queued events
  // cannot overwrite the explicit audition fader or shared master policy.
  media.muted = false;
  media.volume = 1;
  media.emit('volumechange');
  assert.equal(media.muted, true);
  assert.equal(media.volume, 0.1);
  app.panel.update();
  assert.equal(app.node('audition-volume').value, '0.4');
  assert.match(app.node('master-status').textContent, /Master sound is muted/);
  audioMaster.setMuted(false);
  assert.equal(media.muted, false);
  assert.equal(media.volume, 0.1);
  assert.equal(media.plays, 1);
  assert.equal((await app.store.read()).generation, 1);
  app.panel.dispose();
  audioMaster.setVolume(1);
  assert.equal(media.muted, true);
  assert.equal(media.volume, 0.1, 'Disposed panel releases its master subscription');
  assert.equal(app.revoked.length, 1);
});

test('master controls remain available during loading and host save failure does not veto session mute', async (t) => {
  let finish;
  const audioMaster = createAudioMaster({ muted: false, volume: 0.7 }),
    changes = [],
    app = await setup(t, {
      open: false,
      store: {
        read: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        commit() {},
      },
      callbacks: {
        audioMaster,
        onMasterMuted(value) {
          changes.push(['muted', value]);
          audioMaster.setMuted(value);
          return { ok: false, warning: 'Session only: storage is unavailable.' };
        },
        onMasterVolume(value) {
          changes.push(['volume', value]);
          audioMaster.setVolume(value);
        },
      },
    });
  const opening = app.panel.open();
  assert.equal(app.node('close').disabled, true);
  assert.equal(app.node('master-mute').disabled, false);
  assert.equal(app.node('master-mute').textContent, 'Mute master sound');
  assert.equal(app.node('master-mute').getAttribute('aria-pressed'), null);
  app.click('master-mute');
  assert.equal(audioMaster.snapshot().muted, true);
  assert.equal(app.node('master-mute').textContent, 'Unmute master sound');
  assert.equal(app.node('master-mute').getAttribute('aria-pressed'), null);
  assert.equal(audioMaster.snapshot().revision, 1, 'Host applies authority exactly once');
  assert.match(app.node('master-status').textContent, /Session only/);
  app.node('master-volume').value = '0.3';
  app.node('master-volume').oninput();
  assert.equal(audioMaster.snapshot().volume, 0.3);
  assert.deepEqual(changes, [
    ['muted', true],
    ['volume', 0.3],
  ]);
  assert.deepEqual(app.calls, []);
  finish({ library: emptySoundtrackLibrary(), assets: [], generation: 0 });
  await opening;
  const calls = app.calls.length;
  app.node('master-mute').focus();
  app.click('master-mute');
  assert.equal(app.doc.activeElement, app.node('master-mute'));
  assert.equal(app.calls.length, calls, 'Master action never invokes a transport');
});

test('late audition and music Play completion cannot invoke the legacy master-enable callback', async (t) => {
  const audioMaster = createAudioMaster({ muted: false, volume: 0.5 }),
    initial = await fixture();
  let enabled = 0,
    finish;
  const app = await setup(t, {
    initial,
    callbacks: {
      audioMaster,
      onAudioEnabled() {
        enabled++;
        audioMaster.setMuted(false);
      },
    },
  });
  app.choose('tracks', initial.track.id);
  app.node('audition').play = () =>
    new Promise((resolve) => {
      finish = () => {
        app.node('audition').paused = false;
        resolve();
      };
    });
  const starting = app.click('audition-track');
  app.click('master-mute');
  assert.equal(audioMaster.snapshot().muted, true);
  assert.equal(app.node('audition').muted, true);
  finish();
  await starting;
  assert.equal(app.node('audition').muted, true);
  assert.equal(enabled, 0);
  await app.click('play');
  assert.equal(audioMaster.snapshot().muted, true);
  assert.equal(enabled, 0);
  assert.equal(app.state.desired, true, 'Play still changes transport intent while muted');
  assert.match(app.node('master-status').textContent, /Master sound is muted/);
});

// Hold the actual first store read while the DOM models native blur when the
// focused Close button becomes disabled. Cached openings must not read again.
async function pendingFirstOpen(t, { deferredBlur = false } = {}) {
  const db = memoryIndexedDB(),
    savedStore = createSoundtrackStore({ indexedDB: db.indexedDB });
  let release,
    reject,
    reads = 0;
  const held = new Promise((resolve, fail) => {
    release = resolve;
    reject = fail;
  });
  const app = await setup(t, {
    open: false,
    store: {
      read: async (options) => {
        reads++;
        await held;
        return savedStore.read(options);
      },
      commit: (...args) => savedStore.commit(...args),
      close: () => savedStore.close(),
    },
  });
  app.doc.deferDisabledBlur = deferredBlur;
  const opening = app.panel.open();
  assert.equal(app.node('close').disabled, true);
  assert.equal(app.node('status').dataset.state, 'busy');
  assert.match(app.node('status').textContent, /Loading saved music/);
  assert.equal(app.node('cancel').hidden, false);
  assert.equal(
    app.doc.activeElement === (deferredBlur ? app.node('close') : app.doc.body),
    true,
    'The DOM boundary controls whether disabling blurs immediately or later.',
  );
  return {
    ...app,
    opening,
    release,
    reject,
    reads: () => reads,
    flushDisabledBlur: () => {
      for (const blur of app.doc.disabledBlurs.splice(0)) blur();
    },
  };
}

test('first Studio read restores displaced Close focus after successful loading', async (t) => {
  const app = await pendingFirstOpen(t);
  assert.equal(app.panel.close(), false, 'The existing pending-operation exit guard remains.');
  app.release();
  await app.opening;
  assert.equal(app.node('close').disabled, false);
  assert.equal(app.doc.activeElement === app.node('close'), true, 'Expected exact focused node');
  assert.match(app.node('status').textContent, /Saved library loaded/);
  assert.equal(app.node('status').dataset.state, 'ready');
  assert.equal((await app.store.read()).generation, 0, 'Opening does not write music.');
});

test('first Studio read restores displaced Close focus after a reported storage failure', async (t) => {
  const app = await pendingFirstOpen(t);
  app.reject(new Error('Storage unavailable for first read'));
  await app.opening;
  assert.match(app.node('status').textContent, /Storage unavailable for first read/);
  assert.equal(app.node('status').dataset.state, 'error');
  assert.equal(app.node('close').disabled, false);
  assert.equal(app.doc.activeElement === app.node('close'), true, 'Expected exact focused node');
  assert.equal(app.panel.close(), true, 'A failed read does not trap the player.');
});

test('first Studio read preserves a deliberate transport focus chosen while loading', async (t) => {
  const app = await pendingFirstOpen(t);
  app.node('previous').focus();
  app.release();
  await app.opening;
  assert.equal(app.doc.activeElement === app.node('previous'), true, 'Expected exact focused node');
});

test('first Studio read relinquishes restoration after a later focus choice even if it blurs', async (t) => {
  const app = await pendingFirstOpen(t);
  app.node('previous').focus();
  app.node('previous').blur();
  app.release();
  await app.opening;
  assert.equal(
    app.doc.activeElement === app.doc.body,
    true,
    'Only the original disabling may trigger restoration.',
  );
});

test('first Studio read does not refocus a dialog closed externally during loading', async (t) => {
  const app = await pendingFirstOpen(t);
  app.node('dialog').close();
  app.release();
  await app.opening;
  assert.equal(app.node('dialog').open, false);
  assert.equal(app.doc.activeElement === app.doc.body, true, 'Expected exact focused node');
});

test('first Studio read does not refocus a disposed panel when its pending read settles', async (t) => {
  const app = await pendingFirstOpen(t);
  app.panel.dispose();
  app.release();
  await app.opening;
  assert.equal(app.node('dialog').isConnected, false);
  assert.equal(app.doc.activeElement === app.doc.body, true, 'Expected exact focused node');
});

test('first Studio read does not pull focus into a hidden document', async (t) => {
  const app = await pendingFirstOpen(t);
  app.doc.hidden = true;
  app.release();
  await app.opening;
  assert.equal(app.doc.activeElement === app.doc.body, true, 'Expected exact focused node');
});

test('cached Studio reopening focuses Close without a second store read', async (t) => {
  const app = await pendingFirstOpen(t);
  app.release();
  await app.opening;
  app.panel.close();
  app.doc.body.focus();
  await app.panel.open();
  assert.equal(app.reads(), 1);
  assert.equal(app.node('close').disabled, false);
  assert.equal(app.doc.activeElement === app.node('close'), true, 'Expected exact focused node');
  assert.equal(app.node('status').textContent, 'Music library ready.');
  assert.equal(app.node('status').dataset.state, 'ready');
});

for (const outcome of ['success', 'failure']) {
  test(`first Studio read restores Close when disabling blurs later during ${outcome}`, async (t) => {
    const app = await pendingFirstOpen(t, { deferredBlur: true });
    app.flushDisabledBlur();
    assert.equal(
      app.doc.activeElement === app.doc.body,
      true,
      'Native blur arrives after open returned its pending Promise.',
    );
    if (outcome === 'failure') app.reject(new Error('Deferred first-read failure'));
    else app.release();
    await app.opening;
    assert.equal(app.node('close').disabled, false);
    assert.equal(
      app.doc.activeElement === app.node('close'),
      true,
      'Restore the original enabled entry target after late blur.',
    );
    assert.match(
      app.node('status').textContent,
      outcome === 'failure' ? /Deferred first-read failure/ : /Saved library loaded/,
    );
  });
}

test('late first-read blur does not override a later deliberate focus choice that also blurs', async (t) => {
  const app = await pendingFirstOpen(t, { deferredBlur: true });
  app.flushDisabledBlur();
  app.node('previous').focus();
  app.node('previous').blur();
  app.release();
  await app.opening;
  assert.equal(
    app.doc.activeElement === app.doc.body,
    true,
    'A user choice relinquishes restoration permanently for this opening.',
  );
});

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

for (const delayedBlur of [false, true]) {
  test(`Undo retains usable focus after discarding a draft (delayed blur: ${delayedBlur})`, async (t) => {
    const app = await setup(t);
    await app.click('clone-playlist');
    const saved = await app.store.read();
    const playback = structuredClone(app.state);
    const calls = app.calls.length;
    app.doc.deferDisabledBlur = delayedBlur;
    app.node('undo').focus();
    await app.click('undo');
    for (const blur of app.doc.disabledBlurs) blur();
    assert.equal(app.doc.activeElement?.id, app.node('reload').id);
    assert.equal(app.doc.activeElement.disabled, false);
    assert.equal(app.node('undo').disabled, true);
    assert.match(app.node('draft-state').textContent, /^Saved/);
    assert.deepEqual(await app.store.read(), saved);
    assert.deepEqual(app.state, playback);
    assert.equal(app.calls.length, calls, 'Undo does not change transport or adopt a library.');
  });
}

for (const boundary of ['other-control', 'hidden', 'unfocused', 'host-refused', 'newer-focus']) {
  test(`Undo cannot reclaim focus across ${boundary}`, async (t) => {
    let app;
    app = await setup(t, {
      callbacks: {
        canRestoreFocus: () => {
          if (boundary === 'newer-focus') app.node('close').focus();
          return boundary !== 'host-refused';
        },
      },
    });
    await app.click('clone-playlist');
    app.node('undo').focus();
    if (boundary === 'other-control') app.node('close').focus();
    if (boundary === 'hidden') app.doc.hidden = true;
    if (boundary === 'unfocused') app.doc.hasFocus = () => false;
    await app.click('undo');
    assert.notEqual(app.doc.activeElement?.id, app.node('reload').id);
    if (boundary === 'other-control' || boundary === 'newer-focus')
      assert.equal(app.doc.activeElement?.id, app.node('close').id);
    assert.match(app.node('draft-state').textContent, /^Saved/);
  });
}

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
  assert.equal(app.node('status').dataset.state, 'cancelled');
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

test('preparation announcements stay separate from the changing music clock', async (t) => {
  const app = await setup(t);
  app.state.preparation = { stage: 'reading', message: 'Reading the selected audio original…' };
  app.panel.update();
  assert.equal(app.node('loading').dataset.state, 'busy');
  assert.equal(app.node('loading').textContent, app.state.preparation.message);
  app.state.positionSeconds += 1;
  app.panel.update();
  assert.equal(app.node('now').getAttribute('aria-live'), 'off');
  assert.equal(app.node('loading').textContent, app.state.preparation.message);
  app.state.preparation = null;
  app.panel.update();
  assert.equal(app.node('loading').hidden, true);
});

test('pending audition visibly prepares and late playback cannot repopulate a closed/reopened panel', async (t) => {
  const initial = await fixture(),
    app = await setup(t, { initial });
  app.choose('tracks', initial.track.id);
  let finish;
  app.node('audition').play = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const playing = app.click('audition-track');
  assert.equal(app.node('audition-status').dataset.state, 'busy');
  assert.match(app.node('audition-status').textContent, /Starting audition/);
  assert.equal(app.panel.close(), true);
  await app.panel.open();
  const current = app.node('status').textContent;
  finish();
  await playing;
  assert.equal(app.node('audition-status').hidden, true);
  assert.equal(app.node('status').textContent, current);
  assert.equal(app.node('audition').hidden, true);
});

for (const ending of ['resolve', 'reject']) {
  test(`pending audition exposes feedback and Finish before playback settles (${ending})`, async (t) => {
    const initial = await fixture();
    let activating = false,
      enabled = 0,
      settle;
    const app = await setup(t, {
      initial,
      callbacks: { onAudioEnabled: () => enabled++ },
    });
    app.choose('tracks', initial.track.id);
    const media = app.node('audition'),
      status = app.node('audition-status'),
      finish = app.node('stop-audition');
    media.play = () => {
      assert.equal(activating, true, 'Play retains the activating event turn.');
      media.paused = false;
      return new Promise((resolve, reject) => {
        settle = () =>
          ending === 'resolve' ? resolve() : reject(new Error('Retired play attempt rejected.'));
      });
    };
    activating = true;
    const playing = app.click('audition-track');
    activating = false;
    assert.equal(status.dataset.state, 'busy');
    assert.match(status.textContent, /Starting audition/);
    assert.equal(
      Boolean(status.closest('[hidden],[inert]')),
      false,
      'Busy feedback has no hidden ancestor.',
    );
    assert.equal(Boolean(finish.closest('[hidden],[inert]')), false);
    assert.equal(finish.disabled, false, 'Finish is enabled while the play promise is unresolved.');
    finish.focus();
    assert.equal(app.doc.activeElement, finish, 'The native Finish button accepts focus.');
    await app.click('stop-audition');
    assert.equal(media.paused, true);
    assert.equal(media.hidden, true);
    assert.equal(media.src, '');
    assert.equal(status.hidden, true);
    assert.equal(finish.disabled, true);
    assert.equal(app.revoked.length, 1);
    assert.equal(app.state.playing, true, 'Finish restores the earlier music intent once.');
    const restored = app.calls.filter(([name]) => name === 'play').length,
      studioStatus = app.node('status').textContent;
    settle();
    await playing;
    assert.equal(app.calls.filter(([name]) => name === 'play').length, restored);
    assert.equal(enabled, 0, 'A retired audition cannot persist audio activation.');
    assert.equal(app.node('status').textContent, studioStatus);
    assert.equal(status.hidden, true);
    assert.equal(media.hidden, true);
    assert.equal(media.paused, true);
    assert.equal(app.revoked.length, 1);
    assert.equal((await app.store.read()).generation, 1);
  });
}

test('file picker cancellation preserves the Music draft and probe; dialog Escape retains its cancellation policy', async (t) => {
  let slow = false,
    entered,
    release,
    probeSignal;
  const probing = new Promise((resolve) => {
    entered = resolve;
  });
  const app = await setup(t, {
    probeMedia: async (blob, options) => {
      if (slow) {
        probeSignal = options.signal;
        entered();
        await new Promise((resolve, reject) => {
          release = resolve;
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        });
      }
      return structuralProbe(blob, options);
    },
  });
  app.node('mp3-files').files = [file('Retained.mp3')];
  await app.click('import-mp3');
  const draft = app.node('draft-state').textContent,
    saved = await app.store.read();
  for (const id of ['mp3-files', 'bundle-file']) {
    const input = app.node(id);
    input.focus();
    input.dispatchEvent(new Event('cancel', { bubbles: true }));
    assert.equal(app.node('dialog').open, true);
    assert.equal(app.doc.activeElement, input);
    assert.equal(app.node('draft-state').textContent, draft);
  }
  slow = true;
  app.node('mp3-files').files = [file('Next.mp3')];
  const importing = app.click('import-mp3');
  await probing;
  const status = app.node('status').textContent;
  app.node('mp3-files').dispatchEvent(new Event('cancel', { bubbles: true }));
  assert.equal(probeSignal.aborted, false);
  assert.equal(app.node('status').textContent, status);
  assert.equal(app.node('status').dataset.state, 'busy');
  const escape = new Event('cancel', { cancelable: true });
  app.node('dialog').dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(probeSignal.aborted, true);
  release();
  await importing;
  assert.equal(app.node('dialog').open, true);
  assert.equal(app.node('draft-state').textContent, draft);
  assert.deepEqual(await app.store.read(), saved);
  slow = false;
  await app.click('save');
  assert.deepEqual(
    (await app.store.read()).library.tracks.map((track) => track.title),
    ['Retained'],
  );
  app.node('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
  assert.equal(app.node('dialog').open, false);
});

for (const settlement of ['resolve', 'reject'])
  for (const ending of ['Finish', 'Close', 'hidden', 'dispose'])
    test(`shared master during pending audition keeps P01 Finish and retired intent (${ending}/${settlement})`, async (t) => {
      const audioMaster = createAudioMaster({ muted: false, volume: 0.5 }),
        initial = await fixture();
      let enabled = 0,
        settlePlay;
      const app = await setup(t, {
        initial,
        callbacks: {
          audioMaster,
          onAudioEnabled: () => {
            enabled++;
            audioMaster.setMuted(false);
          },
        },
      });
      app.choose('tracks', initial.track.id);
      const media = app.node('audition'),
        status = app.node('audition-status'),
        finish = app.node('stop-audition');
      media.play = () => {
        media.paused = false;
        return new Promise((resolve, reject) => {
          settlePlay = () =>
            settlement === 'resolve' ? resolve() : reject(new Error('Retired media refusal'));
        });
      };
      const playing = app.click('audition-track');
      assert.equal(typeof settlePlay, 'function', 'Native Play starts in the activation turn.');
      assert.equal(status.dataset.state, 'busy');
      assert.equal(Boolean(status.closest('[hidden],[inert]')), false);
      assert.equal(Boolean(finish.closest('[hidden],[inert]')), false);
      assert.equal(finish.disabled, false);
      app.node('audition-volume').value = '0.4';
      app.node('audition-volume').oninput();
      const transportCalls = app.calls.length;
      await app.click('master-mute');
      assert.equal(media.muted, true);
      app.node('master-volume').value = '0';
      app.node('master-volume').oninput();
      await app.click('master-mute');
      assert.equal(audioMaster.snapshot().muted, false);
      assert.equal(media.muted, true, 'Zero master still gates a pending native output.');
      app.node('master-volume').value = '0.13';
      app.node('master-volume').onchange();
      assert.equal(media.muted, false);
      assert.equal(media.volume, 0.4 * 0.13);
      assert.equal(media.paused, false);
      assert.equal(app.calls.length, transportCalls, 'Master controls do not change music intent.');
      assert.equal(app.node('audition-volume').value, '0.4');
      const shared = audioMaster.snapshot();
      if (ending === 'Finish') await app.click('stop-audition');
      else if (ending === 'Close') app.panel.close();
      else if (ending === 'hidden') {
        app.doc.hidden = true;
        app.doc.emit('visibilitychange');
      } else app.panel.dispose();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(media.muted, true);
      assert.equal(media.paused, true);
      assert.equal(media.hidden, true);
      assert.equal(media.src, '');
      assert.equal(status.hidden, true);
      assert.equal(app.revoked.length, 1);
      const expectedPlay = ending === 'Finish' || ending === 'Close' ? 1 : 0;
      assert.equal(app.calls.filter(([name]) => name === 'play').length, expectedPlay);
      assert.equal(app.state.desired, ending !== 'dispose');
      const calls = app.calls.length,
        message = app.node('status').textContent;
      settlePlay();
      await playing;
      assert.deepEqual(audioMaster.snapshot(), shared);
      assert.equal(enabled, 0, 'Late success cannot call the legacy master enable hook.');
      assert.equal(app.calls.length, calls, 'Retired completion cannot restore intent twice.');
      assert.equal(app.node('status').textContent, message);
      assert.equal(status.hidden, true);
      assert.equal(media.muted, true);
      assert.equal(media.paused, true);
      assert.equal(app.revoked.length, 1);
      assert.equal((await app.store.read()).generation, 1);
      if (ending !== 'dispose') {
        app.panel.update();
        assert.equal(app.node('audition-volume').value, '0.4');
      }
    });

test('a host adoption hook owns metadata installation before panel notification', async (t) => {
  const events = [];
  const app = await setup(t, {
    callbacks: {
      adoptLibrary: (value) => events.push(['adopt', value.generation]),
      onLibrary: (_, value) => events.push(['notify', value.generation]),
    },
  });
  assert.deepEqual(events, [
    ['adopt', 0],
    ['notify', 0],
  ]);
  assert.equal(app.calls.filter(([kind]) => kind === 'library').length, 0);
  await app.click('clone-playlist');
  await app.click('save');
  assert.deepEqual(events.slice(-2), [
    ['adopt', 1],
    ['notify', 1],
  ]);
  assert.equal(app.calls.filter(([kind]) => kind === 'library').length, 0);
});

test('failed reload adoption retains the existing unsaved draft and player state', async (t) => {
  let fail = false;
  const app = await setup(t, {
    callbacks: {
      adoptLibrary() {
        if (fail) throw new Error('Newer library already accepted');
      },
    },
  });
  await app.click('clone-playlist');
  const before = app.node('playlists').value;
  const calls = app.calls.length;
  fail = true;
  await app.click('reload');
  assert.match(app.node('status').textContent, /Newer library already accepted/);
  assert.match(app.node('draft-state').textContent, /Unsaved draft/);
  assert.equal(app.node('playlists').value, before);
  assert.equal(app.calls.length, calls);
});

test('post-commit adoption failure records the durable save and blocks Save & use follow-on selection', async (t) => {
  let fail = false;
  const app = await setup(t, {
    callbacks: {
      adoptLibrary() {
        if (fail) throw new Error('Cannot adopt current bytes');
      },
    },
  });
  await app.click('clone-playlist');
  app.choose('selection', app.node('playlists').value);
  fail = true;
  const before = app.calls.length;
  await app.click('use-selection');
  assert.equal((await app.store.read()).generation, 1);
  assert.match(app.node('status').textContent, /Library is saved, but the game refresh failed/);
  assert.match(app.node('draft-state').textContent, /^Saved/);
  assert.equal(
    app.calls.slice(before).some(([kind]) => ['library', 'select', 'play'].includes(kind)),
    false,
  );
  fail = false;
  await app.click('reload');
  assert.match(app.node('status').textContent, /Saved library loaded/);
});

test('explicit panel Play/Pause route through the session while audition holds stay temporary', async (t) => {
  const sessionCalls = [];
  const initial = await fixture();
  const app = await setup(t, {
    initial,
    callbacks: {
      musicSession: {
        play() {
          sessionCalls.push('play');
        },
        pause() {
          sessionCalls.push('pause');
        },
      },
    },
  });
  await app.click('pause');
  await app.click('play');
  assert.deepEqual(sessionCalls, ['pause', 'play']);
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  assert.deepEqual(sessionCalls, ['pause', 'play']);
  assert.ok(app.calls.some(([kind]) => kind === 'pause'));
});

test('a disposed panel does not adopt a committed library or call the host afterward', async (t) => {
  let panel,
    adopts = 0;
  const app = await setup(t, {
    callbacks: {
      adoptLibrary() {
        adopts++;
      },
    },
  });
  panel = app.panel;
  await app.click('clone-playlist');
  app.db.afterCommit = () => panel.dispose();
  const before = adopts;
  await app.click('save');
  assert.equal((await app.store.read()).generation, 1);
  assert.equal(adopts, before);
});

test('the supported panel handle exposes its exact modal and lifetime for host input ownership', async (t) => {
  const app = await setup(t);
  assert.ok(
    app.panel.element === app.node('dialog'),
    'The handle returns the exact modal element.',
  );
  assert.equal(app.panel.isOpen(), true);
  await app.panel.close();
  assert.equal(app.panel.isOpen(), false);
  await app.panel.open();
  assert.equal(app.panel.isOpen(), true);
  app.panel.dispose();
  assert.equal(app.panel.isOpen(), false);
});

test('an asynchronous adoption rejection is awaited and cannot report a successful refresh', async (t) => {
  let reject = false;
  const app = await setup(t, {
    callbacks: {
      adoptLibrary: async () => {
        if (reject) throw new Error('Deferred adoption refused');
      },
    },
  });
  await app.click('clone-playlist');
  reject = true;
  await app.click('save');
  assert.equal((await app.store.read()).generation, 1);
  assert.match(
    app.node('status').textContent,
    /Library is saved, but the game refresh failed: Deferred adoption refused/,
  );
});

test('the real Couch owner/session compose with panel save, audition and explicit Pause', async (t) => {
  const { createManagedMediaStore } = await import('../managed-media-store.mjs');
  const { createCouchMusicLibrary } = await import('../couch/couch-music-library.mjs');
  const { createCouchMusicSession } = await import('../couch/couch-music-session.mjs');
  const { createSoundtrackPlayer } = await import('../ui/soundtrack-player.mjs');
  const { audioHarness } = await import('./helpers/soundtrack-audio.mjs');
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true });
  const store = createSoundtrackStore({ managedStore: manager }),
    audio = audioHarness();
  let owner;
  const player = createSoundtrackPlayer({
    soundscape: audio.soundscape,
    audioElement: audio.media,
    URLImpl: audio.URLImpl,
    readAsset: (hash) => owner.readAsset(hash),
    fadeMs: 0,
  });
  owner = createCouchMusicLibrary({ managedStore: manager, player });
  const session = createCouchMusicSession({ player, library: owner, soundscape: audio.soundscape });
  const initial = await fixture();
  const app = await setup(t, {
    initial,
    store,
    callbacks: {
      player,
      musicSession: session,
      adoptLibrary: (value) => owner.adoptVerifiedSnapshot(value),
      onLibrary: () => player.prepare(),
    },
  });
  t.after(() => {
    session.dispose();
    player.dispose();
    owner.close();
    manager.close();
    audio.soundscape.dispose();
  });
  assert.equal(owner.snapshot().generation, 1);
  await app.click('play');
  assert.equal(session.snapshot().transportChoice, 'play');
  assert.equal(player.snapshot().playing, true);
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  assert.equal(session.snapshot().transportChoice, 'play');
  assert.equal(player.snapshot().desired, false);
  await app.click('stop-audition');
  assert.equal(player.snapshot().desired, true);
  await app.click('pause');
  assert.equal(session.snapshot().transportChoice, 'pause');
  app.choose('selection', 'qa.mix');
  await app.click('use-selection');
  assert.equal(owner.snapshot().generation, 2);
  assert.equal(player.snapshot().desired, false);
  assert.equal(await session.start(), false);
  assert.equal(owner.readAsset(initial.track.asset.sha256).size, initial.blob.size);
});

test('closing to a connected opener still notifies the host exactly once', async (t) => {
  let closed = 0;
  const app = await setup(t, {
    open: false,
    callbacks: {
      onClose: () => {
        closed++;
      },
    },
  });
  const opener = app.doc.createElement('button');
  app.doc.body.append(opener);
  opener.focus();
  await app.panel.open();
  assert.equal(app.panel.close(), true);
  assert.ok(app.doc.activeElement === opener, 'Close restores the actual opener.');
  assert.equal(closed, 1);
  const calls = app.calls.length;
  assert.equal(app.panel.close(), false);
  assert.equal(closed, 1);
  assert.equal(app.calls.length, calls);
});

test('repeated Open retains its original opener and does not create another modal visit', async (t) => {
  let opened = 0;
  const app = await setup(t, {
    open: false,
    callbacks: {
      onOpen: () => {
        opened++;
      },
    },
  });
  const opener = app.doc.createElement('button');
  app.doc.body.append(opener);
  opener.focus();
  await app.panel.open();
  await app.panel.open();
  app.panel.close();
  assert.equal(opened, 1);
  assert.ok(
    app.doc.activeElement === opener,
    'Repeated Open must not retain a control inside the dialog.',
  );
});

test('host focus ownership and hidden-page checks prevent stale opener restoration', async (t) => {
  let current = true,
    closed = 0;
  const app = await setup(t, {
    open: false,
    callbacks: {
      canRestoreFocus: () => current,
      onClose: () => {
        closed++;
      },
    },
  });
  const opener = app.doc.createElement('button');
  app.doc.body.append(opener);
  opener.focus();
  await app.panel.open();
  current = false;
  app.panel.close();
  assert.ok(app.doc.activeElement !== opener, 'An obsolete host visit cannot regain focus.');
  current = true;
  opener.focus();
  await app.panel.open();
  app.doc.hidden = true;
  app.panel.close();
  assert.ok(app.doc.activeElement !== opener, 'Hidden pages cannot restore focus.');
  assert.equal(closed, 2);
});

test('explicit terminal close retires auditions without restoring music or opener focus', async (t) => {
  const initial = await fixture();
  let closed = 0;
  const app = await setup(t, {
    initial,
    open: false,
    callbacks: {
      onClose: () => {
        closed++;
      },
    },
  });
  const opener = app.doc.createElement('button');
  app.doc.body.append(opener);
  opener.focus();
  await app.panel.open();
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  const plays = app.calls.filter(([kind]) => kind === 'play').length;
  assert.equal(app.panel.close({ restoreFocus: false, restoreMusic: false }), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.calls.filter(([kind]) => kind === 'play').length, plays);
  assert.ok(app.doc.activeElement !== opener, 'Silent terminal close leaves focus to its owner.');
  assert.equal(closed, 1);
  assert.equal(app.node('audition').paused, true);
});

for (const ending of ['saved', 'reload', 'newer focus', 'hidden']) {
  test(`library task retains a keyboard owner after disabling its action (${ending})`, async (t) => {
    const app = await setup(t);
    await app.click('clone-playlist');
    const opener = app.node(ending === 'reload' ? 'reload' : 'save');
    opener.focus();
    const pending = app.click(ending === 'reload' ? 'reload' : 'save');
    assert.equal(
      app.doc.activeElement,
      app.node('cancel'),
      'A disabled action transfers focus to its cancellable operation.',
    );
    if (ending === 'newer focus') app.node('play').focus();
    if (ending === 'hidden') app.doc.hidden = true;
    await pending;
    if (ending === 'saved')
      assert.equal(
        app.doc.activeElement,
        app.node('close'),
        'Saved action is disabled; Close remains an available keyboard destination.',
      );
    if (ending === 'reload') assert.equal(app.doc.activeElement, opener);
    if (ending === 'newer focus') assert.equal(app.doc.activeElement, app.node('play'));
    if (ending === 'hidden') assert.notEqual(app.doc.activeElement, app.node('close'));
  });
}
