import { albumFixture, albumCatalog, responseFor } from './helpers/soundtrack-albums.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { attachSoundtrackPanel } from '../ui/soundtrack-panel.mjs';
import { ONLINE_SOUNDTRACK_CATALOGUE_URL } from '../online-soundtrack-catalogue.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import {
  SOUNDTRACK_BUNDLED_ASSETS,
  SOUNDTRACK_CATALOGUE,
  SOUNDTRACK_COLLECTIONS,
} from '../content/soundtrack-catalogue.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import {
  emptySoundtrackLibrary,
  SOUNDTRACK_GENRES,
  BUILTIN_SOUNDTRACK_TRACKS,
  resolveCatalogueTrack,
  upgradeSoundtrackLibrary,
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
    playRemotePlaylist: async (tracks, options) => {
      calls.push(['remote', tracks, options]);
      Object.assign(state, {
        playing: true,
        desired: true,
        status: 'playing',
        track: tracks[0],
      });
    },
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
    onlineCatalogueDownload: {
      fetch: async () => {
        throw new Error('Online catalogue is unavailable in this isolated test.');
      },
    },
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

function onlineCatalogueFixture() {
  const definitions = [
    ['1'.repeat(64), 'Night Circuit', 'Signal Artist', 'Synth collection', ['synth', 'electronic']],
    ['2'.repeat(64), 'Iron Pulse', 'Riff Artist', 'Metal collection', ['metal', 'djent']],
    [
      '3'.repeat(64),
      'Dnipro Bells',
      'Ukrainian Artist',
      'Ukrainian collection',
      ['ukrainian', 'metal', 'Shchedryk adaptation'],
    ],
    ['4'.repeat(64), 'Pixel Sprint', 'Chip Artist', 'Arcade collection', ['chiptune', '8-bit']],
    ['5'.repeat(64), 'Road Voltage', 'Rock Artist', 'Road collection', ['rock', 'punk']],
    [
      '6'.repeat(64),
      'Quiet Orbit',
      'Atmosphere Artist',
      'Space collection',
      ['ambient', 'atmospheric'],
    ],
  ];
  const tracks = definitions.map(([sha256, title, artist, collection, tags], index) => ({
    id: `fixture-${index + 1}`,
    title,
    artist,
    durationSeconds: 180 + index,
    tags,
    source: `https://artists.example/${index + 1}`,
    license: 'CC BY 4.0 International',
    licenseURL: 'https://creativecommons.org/licenses/by/4.0/',
    credit: `${title} by ${artist}`,
    fileName: `${title}.mp3`,
    archiveId: `fixture-${index + 1}`,
    collection,
    status: 'published-audition',
    listeningApproval: 'pending',
    gameCatalogueAdmission: false,
    contentId: index === 2 ? true : 'unknown',
    recordingModeEligible: false,
    audio: { path: `objects/${sha256}.mp3`, bytes: 1000 + index, sha256 },
    aliases: [],
  }));
  return {
    format: 'revealline-public-soundtrack-catalogue.v1',
    archive: {
      id: 'revealline-soundtracks-01',
      baseURL: 'https://mekhovov.github.io/revealline-soundtracks-01/',
    },
    sources: [],
    counts: {
      declaredTracks: tracks.length,
      uniqueRecordings: tracks.length,
      duplicateAliases: 0,
      audioBytes: tracks.reduce((sum, track) => sum + track.audio.bytes, 0),
    },
    tracks,
  };
}

function onlineCatalogueResponse(catalogue) {
  const body = new TextEncoder().encode(JSON.stringify(catalogue));
  return {
    status: 200,
    redirected: false,
    url: ONLINE_SOUNDTRACK_CATALOGUE_URL,
    headers: { get: () => String(body.byteLength) },
    body: new Response(body).body,
  };
}

async function settleOnlineCatalogue() {
  await new Promise((resolve) => setImmediate(resolve));
}

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
  assert.deepEqual(app.calls.slice(-2), [['select', id], ['play']]);
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
  await app.click('advanced-backup-toggle');
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
    await app.click('advanced-library-toggle');
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
      await app.click('advanced-library-toggle');
      await app.click('advanced-sound-toggle');
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

test('post-commit listening adoption failure preserves audition and cannot change the stale player', async (t) => {
  let fail = false,
    wakes = 0,
    notifications = 0;
  const initial = await fixture('listening-adoption');
  const app = await setup(t, {
    initial,
    callbacks: {
      catalogue: emptyCatalogue,
      adoptLibrary() {
        if (fail) throw new Error('Cannot adopt current bytes');
      },
      beforeAudio: () => wakes++,
      onPlayback: () => notifications++,
    },
  });
  app.choose('tracks', initial.track.id);
  await app.click('audition-track');
  const media = app.node('audition');
  assert.equal(media.paused, false);
  const before = { calls: app.calls.length, wakes, notifications, revoked: app.revoked.length };
  app.choose('listening-mode', 'metal');
  fail = true;
  await app.click('apply-listening');
  const saved = await app.store.read();
  assert.equal(saved.generation, 2);
  assert.equal(saved.library.listening.mode, 'metal');
  assert.match(app.node('status').textContent, /Library is saved, but the game refresh failed/);
  assert.match(app.node('draft-state').textContent, /^Saved/);
  assert.equal(media.paused, false);
  assert.deepEqual(
    { calls: app.calls.length, wakes, notifications, revoked: app.revoked.length },
    before,
  );
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
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      storyMedia: true,
      soundtrackCatalogue: true,
    });
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
  assert.equal(player.snapshot().desired, true);
  assert.equal(await session.start(), true);
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

test('archive website remains a secondary credits and download link', async (t) => {
  const requests = [];
  const app = await setup(t, {
    callbacks: {
      albumDownload: {
        fetch: async (url) => {
          requests.push(url);
          throw new Error('Preview discovery must not fetch albums or audio.');
        },
      },
      readAsset: async (hash) => {
        requests.push(hash);
        throw new Error('Preview discovery must not read audio.');
      },
    },
  });
  await app.click('advanced-community-toggle');
  const link = app.node('licensed-previews');
  assert.equal(link.tagName, 'A');
  assert.equal(link.getAttribute('href'), 'https://mekhovov.github.io/revealline-soundtracks-01/');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.match(link.textContent, /Open the public archive website/);
  assert.match(app.node('licensed-previews-info').textContent, /searchable public archive above/);
  assert.match(app.node('licensed-previews-info').textContent, /directly inside the game/);
  const before = await app.store.read();
  const calls = [...app.calls],
    state = { ...app.state };
  link.focus();
  const navigation = app.node('dialog').emit('keydown', { key: 'ArrowDown', target: link });
  assert.equal(navigation.defaultPrevented, true);
  assert.equal(app.doc.activeElement, app.node('browse-albums'));
  await app.click('licensed-previews');
  assert.deepEqual(requests, []);
  assert.deepEqual(app.calls, calls);
  assert.deepEqual(app.state, state);
  assert.deepEqual(await app.store.read(), before);
  assert.match(app.node('original-status').textContent, /No online recordings/);
  assert.equal(app.doc.nativeDownloads.at(-1).href, link.getAttribute('href'));
  assert.equal(app.doc.nativeDownloads.at(-1).filename, null);
});

test('public archive searches and plays any published recording through the shared transport', async (t) => {
  const catalogue = onlineCatalogueFixture(),
    requests = [];
  const app = await setup(t, {
    callbacks: {
      catalogue: emptyCatalogue,
      onlineCatalogueDownload: {
        fetch: async (url, options) => {
          requests.push([url, options]);
          return onlineCatalogueResponse(catalogue);
        },
      },
    },
  });
  await settleOnlineCatalogue();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], ONLINE_SOUNDTRACK_CATALOGUE_URL);
  assert.equal(requests[0][1].credentials, 'omit');
  assert.equal(app.node('online-results').children.length, 6);
  assert.match(app.node('online-status').textContent, /6 of 6 published recordings/);

  app.node('online-search').value = 'dnipro';
  app.node('online-search').oninput();
  assert.equal(app.node('online-results').children.length, 1);
  assert.match(app.node('online-results').textContent, /Dnipro Bells/);
  await app.click(`online-play-${'3'.repeat(64)}`);
  const selected = app.calls.findLast(([name]) => name === 'remote');
  assert.equal(selected[1].length, 1);
  assert.equal(selected[1][0].title, 'Dnipro Bells');
  assert.deepEqual(selected[2], {
    order: 'shuffle',
    repeat: 'all',
    startTrackId: `online.${'3'.repeat(64)}`,
    mixWithLibrary: true,
  });
  assert(!app.doc.nativeDownloads.length, 'Playing in the game must not navigate to the archive.');

  app.node('online-search').value = '';
  app.node('online-search').oninput();
  await app.click('online-styles-none');
  app.node('online-style-synth').checked = true;
  app.node('online-style-synth').onchange();
  app.node('online-style-ukrainian').checked = true;
  app.node('online-style-ukrainian').onchange();
  assert.equal(app.node('online-results').children.length, 2);
  app.choose('online-order', 'ordered');
  app.choose('online-repeat', 'off');
  await app.click('online-play-all');
  const mixed = app.calls.findLast(([name]) => name === 'remote');
  assert.equal(mixed[1].length, 2);
  assert.deepEqual(
    mixed[1].map((track) => track.title),
    ['Night Circuit', 'Dnipro Bells'],
  );
  assert.deepEqual(mixed[2], {
    order: 'ordered',
    repeat: 'off',
    startTrackId: null,
    mixWithLibrary: true,
  });
  app.node('online-mix-library').checked = false;
  await app.click('online-play-all');
  assert.equal(app.calls.findLast(([name]) => name === 'remote')[2].mixWithLibrary, false);

  await app.click('online-styles-all');
  assert.equal(app.node('online-results').children.length, 6);

  await app.click('online-styles-none');
  app.node('online-style-chiptune').checked = true;
  app.node('online-style-chiptune').onchange();
  assert.equal(app.node('online-results').children.length, 1);
  assert.match(app.node('online-results').textContent, /Pixel Sprint/);
  app.node('online-style-rock').checked = true;
  app.node('online-style-rock').onchange();
  app.node('online-style-ambient').checked = true;
  app.node('online-style-ambient').onchange();
  assert.equal(app.node('online-results').children.length, 3);
  assert.match(app.node('online-results').textContent, /Road Voltage/);
  assert.match(app.node('online-results').textContent, /Quiet Orbit/);

  app.node('recording-mode').checked = true;
  await app.click('apply-listening');
  assert.equal((await app.store.read()).library.listening.recordingMode, true);
  assert.equal(app.node('online-results').children.length, 0);
  assert.equal(app.node('online-play-all').disabled, true);
  assert.match(app.node('online-status').textContent, /Recording mode excludes 6/);
});

test('public archive failure, refresh and cancellation preserve every music source', async (t) => {
  let attempts = 0;
  const failed = await setup(t, {
    callbacks: {
      onlineCatalogueDownload: {
        fetch: async () =>
          ++attempts === 1
            ? new Response('no', { status: 503 })
            : onlineCatalogueResponse(onlineCatalogueFixture()),
      },
    },
  });
  await settleOnlineCatalogue();
  assert.equal(attempts, 1);
  assert.match(
    failed.node('online-status').textContent,
    /Built-in, installed and uploaded music still works/,
  );
  await failed.click('play');
  assert(failed.calls.some(([name]) => name === 'play'));

  await failed.click('online-reload');
  await settleOnlineCatalogue();
  assert.equal(attempts, 2);
  assert.match(failed.node('online-status').textContent, /6 of 6 published recordings/);
  await failed.click(`online-play-${'1'.repeat(64)}`);
  const recovered = failed.calls.findLast(([name]) => name === 'remote');
  assert.equal(recovered[1][0].title, 'Night Circuit');
  assert.equal(recovered[2].mixWithLibrary, true);

  let aborted = false;
  const pending = await setup(t, {
    callbacks: {
      onlineCatalogueDownload: {
        fetch: (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('Cancelled', 'AbortError'));
            });
          }),
      },
    },
  });
  assert.equal(pending.panel.close(), true);
  await settleOnlineCatalogue();
  assert.equal(aborted, true);
  assert.equal(pending.node('dialog').open, false);
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
  for (const genre of SOUNDTRACK_GENRES)
    app.node(`mix-${genre}`).checked = ['metal', 'ukrainian'].includes(genre);
  app.node('installed-only').checked = true;
  await app.click('apply-listening');
  const saved = await app.store.read();
  assert.deepEqual(saved.library.listening, {
    mode: 'mix',
    genres: ['metal', 'ukrainian'],
    installedOnly: true,
    recordingMode: false,
  });
  assert.deepEqual(app.calls.find(([name]) => name === 'listening')[1], saved.library.listening);
  assert.equal(
    app.calls.some(([name]) => name === 'play'),
    false,
  );
  assert.match(app.node('original-status').textContent, /No online recordings/);
});

test('additional genre choices save a specific style or selected cross-style mix without autoplay', async (t) => {
  const app = await setup(t, { callbacks: { catalogue: emptyCatalogue } });
  app.state.playing = false;
  app.state.desired = false;
  app.node('listening-mode').value = 'chiptune';
  await app.click('apply-listening');
  assert.equal((await app.store.read()).library.listening.mode, 'chiptune');
  app.node('listening-mode').value = 'mix';
  for (const genre of SOUNDTRACK_GENRES)
    app.node(`mix-${genre}`).checked = ['chiptune', 'electronic', 'ambient'].includes(genre);
  await app.click('apply-listening');
  assert.deepEqual((await app.store.read()).library.listening.genres, [
    'chiptune',
    'electronic',
    'ambient',
  ]);
  assert(!app.calls.some(([name]) => name === 'play'));
});

test('player-first controls start a style, playlist or every genre while advanced tools stay collapsed', async (t) => {
  const app = await setup(t, { callbacks: { catalogue: emptyCatalogue } });
  for (const id of [
    'advanced-listening-body',
    'advanced-library-body',
    'advanced-playlists-body',
    'advanced-backup-body',
  ])
    assert.equal(app.node(id).hidden, true);
  await app.click('advanced-listening-toggle');
  assert.equal(app.node('advanced-listening-body').hidden, false);

  app.state.playing = false;
  app.state.desired = false;
  app.choose('quick-style', 'metal');
  await app.click('play-style');
  assert.equal((await app.store.read()).library.listening.mode, 'metal');
  assert.deepEqual(
    app.calls.slice(-2).map(([kind]) => kind),
    ['listening', 'play'],
  );
  assert.match(app.node('quick-status').textContent, /Selected style: Metal/);

  await app.click('play-all');
  const all = await app.store.read();
  assert.equal(all.library.listening.mode, 'mix');
  assert.deepEqual(all.library.listening.genres, SOUNDTRACK_GENRES);
  assert.match(app.node('quick-status').textContent, /Selected style: All styles/);

  app.choose('selection', 'builtin.genre.synthwave');
  await app.click('use-selection');
  assert.equal((await app.store.read()).library.selection.playlistId, 'builtin.genre.synthwave');
  assert.match(app.node('quick-status').textContent, /Selected playlist: Synthwave/);
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

test('a bundled core recording is locally available without an install or removal copy', async (t) => {
  const bundled = SOUNDTRACK_BUNDLED_ASSETS[0];
  const track = SOUNDTRACK_CATALOGUE.tracks.find((entry) => entry.id === bundled.id);
  let reads = 0;
  const app = await setup(t, {
    callbacks: {
      catalogue: { ...SOUNDTRACK_CATALOGUE, tracks: [track] },
      bundled: [bundled],
      readAsset: async () => {
        reads++;
        throw new Error('Core music must not be copied into installed media.');
      },
    },
  });
  const volume = 'album-ukrainian.shchedryk-opening';
  assert.match(app.node(`availability-${volume}`).textContent, /1 of 1 recordings/);
  assert.match(app.node(`availability-${volume}`).textContent, /included with the game/);
  assert.equal(app.node(`download-${volume}`).disabled, true);
  assert.equal(app.node(`offload-${volume}`).disabled, true);
  assert.equal(reads, 0);
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
  assert.match(app.node('audition-status').textContent, /Auditioning/);
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
  app.node('selection').value = 'builtin.playlist.mix';
  await app.click('use-selection');
  await app.click('export-bundle');
  assert.equal(reads, 0);
  assert.match(app.node('status').textContent, /exceeds 256.0 MiB/);
  assert.equal(app.downloads.length, 0);
});

test('v3 restricted music exposes source and recovery notice without exporting its audio', async (t) => {
  const raw = await fixture('licensed-reference');
  const id = 'builtin.catalog.licensed-reference';
  const track = resolveCatalogueTrack({
    ...raw.track,
    id,
    edition: 'rights-1',
    path: 'optional/soundtracks/reference.mp3',
    tags: { genres: ['metal'], role: 'gameplay', energy: 5, themes: [] },
    fileName: 'Original recording.mp3',
    websites: [{ label: 'Artist', url: 'https://example.test/artist' }],
    policy: {
      id,
      sha256: raw.track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'denied',
      redistribute: 'denied',
      modify: 'denied',
      gameplayVideo: 'unknown',
      contentId: 'registered',
    },
  });
  let reads = 0;
  const catalogue = {
    format: 'revealline-soundtrack-catalogue.v2',
    edition: 'rights-1',
    tracks: [track],
  };
  const app = await setup(t, {
    callbacks: {
      catalogue,
      readAsset: async () => {
        reads++;
        throw new Error('Must not request restricted bytes for export');
      },
    },
  });
  app.choose('tracks', id);
  assert.equal(app.node('download-track').disabled, true);
  assert.match(app.node('track-info').textContent, /Original recording.mp3/);
  assert.match(app.node('track-info').textContent, /not permitted/);
  assert.equal(app.node('track-sources').children[0].href, 'https://example.test/artist');
  app.node('recording-mode').checked = true;
  await app.click('apply-listening');
  assert.equal((await app.store.read()).library.listening.recordingMode, true);
  await app.click('export-bundle');
  assert.equal(reads, 0);
  assert.match(app.node('backup-info').textContent, /Requires online restoration for listed music/);
  await app.click('download-prepared');
  const recovered = await importSoundtrackBundle(app.downloads[0].blob, {
    probeMedia: structuralProbe,
    catalogue,
  });
  assert.deepEqual(recovered.assets, []);
  assert.deepEqual(recovered.library.referenceOnlyTrackIds, [id]);
});

for (const offlineCache of ['denied', 'unknown'])
  test(`recovery UI explains offline storage ${offlineCache} without requesting redistributable audio`, async (t) => {
    const raw = await fixture(`storage-reference-${offlineCache}`);
    const id = `builtin.catalog.storage-reference-${offlineCache}`;
    const track = resolveCatalogueTrack({
      ...raw.track,
      id,
      edition: 'rights-1',
      path: `optional/soundtracks/storage-reference-${offlineCache}.mp3`,
      tags: { genres: ['metal'], role: 'gameplay', energy: 5, themes: [] },
      policy: {
        id,
        sha256: raw.track.asset.sha256,
        webPlayback: 'allowed',
        offlineCache,
        redistribute: 'allowed',
        modify: 'allowed',
        gameplayVideo: 'allowed',
        contentId: 'not-registered',
      },
    });
    const catalogue = {
      format: 'revealline-soundtrack-catalogue.v2',
      edition: 'rights-1',
      tracks: [track],
    };
    let reads = 0;
    const app = await setup(t, {
      callbacks: {
        catalogue,
        readAsset: async () => {
          reads++;
          return raw.blob;
        },
      },
    });
    app.choose('tracks', id);
    assert.match(app.node('track-info').textContent, /Offline installation is not permitted/);
    await app.click('apply-listening');
    await app.click('export-bundle');
    assert.equal(reads, 0, 'Recovery preparation must not acquire storage-restricted bytes');
    assert.equal(app.node('download-prepared').disabled, false);
    assert.match(app.node('backup-info').textContent, /offline (?:storage|installation)/i);
    assert.doesNotMatch(app.node('backup-info').textContent, /redistribution is not permitted/i);
    await app.click('download-prepared');
    const recovered = await importSoundtrackBundle(app.downloads[0].blob, {
      probeMedia: structuralProbe,
      catalogue,
    });
    assert.deepEqual(recovered.assets, []);
    assert.deepEqual(recovered.library.referenceOnlyTrackIds, [id]);
    assert.deepEqual(recovered.library.installedTrackIds, []);
  });

test('restored reference-only UA-FPV music can install when offline rights allow it and remains excluded from export', async (t) => {
  const raw = await fixture('ua-offline-reference');
  const id = 'builtin.catalog.ua-fpv.verified';
  const track = resolveCatalogueTrack({
    ...raw.track,
    id,
    edition: 'rights-1',
    path: 'optional/soundtracks/ua-fpv/verified.mp3',
    fileName: 'Original Ukrainian song.mp3',
    tags: { genres: ['ukrainian'], role: 'gameplay', energy: 4, themes: ['fpv'] },
    policy: {
      id,
      sha256: raw.track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute: 'denied',
      modify: 'denied',
      gameplayVideo: 'unknown',
      contentId: 'unknown',
    },
  });
  const catalogue = {
    format: 'revealline-soundtrack-catalogue.v2',
    edition: 'rights-1',
    tracks: [track],
  };
  const library = { ...upgradeSoundtrackLibrary(emptySoundtrackLibrary()), catalogTracks: [track] };
  const bundle = await exportSoundtrackBundle(library, [], { catalogue });
  const restored = await importSoundtrackBundle(bundle, { catalogue, probeMedia: structuralProbe });
  assert.deepEqual(restored.library.referenceOnlyTrackIds, [id]);
  let reads = 0;
  const app = await setup(t, {
    initial: { prepared: restored },
    callbacks: {
      catalogue,
      readAsset: async (hash, options) => {
        assert.equal(hash, track.asset.sha256);
        assert.equal(options.purpose, 'offline');
        reads++;
        return raw.assets[0].blob;
      },
    },
  });
  assert.equal(
    app.doc.nodes.has('soundtrack-download-ukrainian-1'),
    false,
    'UA-FPV has its own download collection',
  );
  await app.click('download-ua-fpv-1');
  assert.equal(reads, 1);
  assert.match(app.node('status').textContent, /Volume downloaded and checked/);
  await app.click('save');
  const saved = await app.store.read();
  assert.deepEqual(saved.library.installedTrackIds, [id]);
  assert.deepEqual(saved.library.referenceOnlyTrackIds, []);
  assert.equal(saved.assets.length, 1);
  assert.equal(saved.assets[0].sha256, track.asset.sha256);
  app.choose('tracks', id);
  assert.equal(app.node('download-track').disabled, true);
  await app.click('export-bundle');
  await app.click('download-prepared');
  const recovery = await importSoundtrackBundle(app.downloads[0].blob, {
    catalogue,
    probeMedia: structuralProbe,
  });
  assert.deepEqual(recovery.assets, []);
  assert.deepEqual(recovery.library.referenceOnlyTrackIds, [id]);
});

test('original MP3 download is explicit and preserves exact bytes', async (t) => {
  const raw = await fixture('download-original');
  const app = await setup(t, { initial: raw });
  app.choose('tracks', raw.track.id);
  await app.click('download-track');
  assert.equal(app.downloads.length, 0);
  assert.equal(app.node('download-prepared').textContent, 'Download prepared MP3');
  await app.click('download-prepared');
  assert.equal(app.downloads.length, 1);
  assert.deepEqual(
    new Uint8Array(await app.downloads[0].blob.arrayBuffer()),
    new Uint8Array(await raw.assets[0].blob.arrayBuffer()),
  );
});

test('cached restricted recordings cannot audition through either UI or direct handler', async (t) => {
  for (const webPlayback of ['denied', 'unknown']) {
    const raw = await fixture(`cached-${webPlayback}`);
    const id = `builtin.catalog.cached-${webPlayback}`;
    const track = resolveCatalogueTrack({
      ...raw.track,
      id,
      edition: 'rights-1',
      path: `optional/soundtracks/cached-${webPlayback}.mp3`,
      tags: { genres: ['metal'], role: 'gameplay', energy: 5, themes: [] },
      policy: {
        id,
        sha256: raw.track.asset.sha256,
        webPlayback,
        offlineCache: 'allowed',
        redistribute: 'allowed',
        modify: 'allowed',
        gameplayVideo: 'allowed',
        contentId: 'not-registered',
      },
    });
    let reads = 0;
    const app = await setup(t, {
      initial: raw,
      callbacks: {
        catalogue: {
          format: 'revealline-soundtrack-catalogue.v2',
          edition: 'rights-1',
          tracks: [track],
        },
        readAsset: async () => {
          reads++;
          return raw.blob;
        },
      },
    });
    // The ordinary upload is byte-identical to the policy-pinned catalogue asset.
    for (const selectedId of [id, raw.track.id]) {
      app.choose('tracks', selectedId);
      assert.equal(app.node('audition-track').disabled, true);
      await app.node('audition-track').onclick();
      assert.match(app.node('status').textContent, /not approved for playback/);
      assert.equal(app.node('audition').plays ?? 0, 0);
      assert.equal(app.urls.size, 0);
      assert.equal(
        app.calls.some(([call]) => call === 'pause'),
        false,
      );
      assert.equal(reads, 0);
    }
  }
});

test('opening a legacy saved library preserves the shipped catalogue in player and host adoption', async (t) => {
  const raw = await fixture('legacy-adoption');
  const track = resolveCatalogueTrack({
    ...raw.track,
    id: 'builtin.catalog.adopted',
    edition: 'originals-1',
    path: 'optional/soundtracks/adopted.mp3',
    tags: { genres: ['synth90s'], role: 'menu', energy: 4, themes: ['retro'] },
  });
  const app = await setup(t, {
    initial: raw,
    callbacks: { catalogue: { ...emptyCatalogue, tracks: [track] } },
  });
  const playerLibrary = app.calls.find(([call]) => call === 'library')[1];
  assert.deepEqual(
    playerLibrary.catalogTracks.map(({ id }) => id),
    [track.id],
  );
  assert.deepEqual(
    app.notices[0][0].catalogTracks.map(({ id }) => id),
    [track.id],
  );
  assert.equal(app.notices[0][1].generation, 1);
  assert.equal(app.notices[0][1].library.format, raw.library.format);
  assert.equal((await app.store.read()).generation, 1);
  assert.equal((await app.store.read()).library.format, raw.library.format);
});

test('published catalogue albums are visible and selectable without downloads or custom slots', async (t) => {
  assert(SOUNDTRACK_COLLECTIONS.length > 0);
  let reads = 0;
  const app = await setup(t, {
    callbacks: {
      catalogue: SOUNDTRACK_CATALOGUE,
      readAsset: async () => {
        reads++;
        throw new Error('Viewing and selecting albums must not install audio.');
      },
    },
  });
  app.state.playing = false;
  app.state.desired = false;
  for (const collection of SOUNDTRACK_COLLECTIONS) {
    assert(app.node('selection').children.some((item) => item.value === collection.id));
    assert.equal(
      app.node(`select-album-${collection.id.slice('builtin.album.'.length)}`).textContent,
      'Save & use album',
    );
  }
  assert.equal(
    app.node('tracks').children.length,
    BUILTIN_SOUNDTRACK_TRACKS.length + SOUNDTRACK_CATALOGUE.tracks.length,
  );
  assert.equal(
    (await app.store.read()).generation,
    0,
    'Opening only adopts catalogue metadata in memory.',
  );
  const album = SOUNDTRACK_COLLECTIONS[0];
  await app.click(`select-album-${album.id.slice('builtin.album.'.length)}`);
  const saved = await app.store.read();
  assert.equal(saved.library.selection.playlistId, album.id);
  assert.equal(saved.library.tracks.length, 0);
  assert.equal(saved.library.playlists.length, 0);
  assert.equal(saved.library.catalogTracks.length, SOUNDTRACK_CATALOGUE.tracks.length);
  assert.deepEqual(saved.library.installedTrackIds, []);
  assert.deepEqual(saved.assets, []);
  assert.equal(reads, 0);
  assert.deepEqual(
    app.calls.filter(([name]) => name === 'select'),
    [['select', album.id]],
  );
  assert(!app.calls.some(([name]) => name === 'play'));
  assert.match(app.node('original-status').textContent, /downloaded and checked individually/);
  assert.match(app.node('licensed-previews-info').textContent, /plays every published recording/);
  await app.click('play');
  assert(
    app.calls.some(([name]) => name === 'play'),
    'Starting music remains a separate explicit gesture.',
  );
});

async function smallHostedAlbums() {
  const first = SOUNDTRACK_COLLECTIONS[0],
    second = SOUNDTRACK_COLLECTIONS[1];
  assert(first?.trackIds.length > 1 && second?.trackIds.length);
  const recordings = await Promise.all(
    [...first.trackIds.slice(0, 2), second.trackIds[0]].map(async (id, i) => {
      const raw = await fixture(`hosted-small-${i}`);
      return {
        raw,
        track: resolveCatalogueTrack({
          ...raw.track,
          id,
          edition: 'test-hosted',
          path: `objects/${raw.track.asset.sha256}.mp3`,
          archiveId: 'test-hosted',
          tags: { genres: ['synth90s'], role: 'any', energy: 3, themes: [] },
          policy: {
            id,
            sha256: raw.track.asset.sha256,
            webPlayback: 'allowed',
            offlineCache: 'allowed',
            redistribute: 'allowed',
            modify: 'allowed',
            gameplayVideo: 'allowed',
            contentId: 'unknown',
          },
        }),
      };
    }),
  );
  return {
    first,
    second,
    recordings,
    catalogue: {
      format: 'revealline-soundtrack-catalogue.v2',
      edition: 'test-hosted',
      tracks: recordings.map((item) => item.track),
    },
  };
}

test('offline album download stages only its recordings and removal preserves its built-in selection', async (t) => {
  const { first, recordings, catalogue } = await smallHostedAlbums();
  const reads = [];
  const app = await setup(t, {
    callbacks: {
      catalogue,
      readAsset: async (hash, options) => {
        assert.equal(options.purpose, 'offline');
        reads.push(hash);
        return recordings.find((item) => item.track.asset.sha256 === hash).raw.blob;
      },
    },
  });
  const suffix = `album-${first.id.slice('builtin.album.'.length)}`;
  await app.click(`select-${suffix}`);
  await app.click(`download-${suffix}`);
  assert.deepEqual(
    reads,
    recordings.slice(0, 2).map((item) => item.track.asset.sha256),
  );
  assert.equal((await app.store.read()).assets.length, 0, 'An explicit save owns persistence.');
  assert.match(app.node(`availability-${suffix}`).textContent, /2 of 2.*in the draft/);
  await app.click('save');
  let saved = await app.store.read();
  assert.equal(saved.assets.length, 2);
  assert.equal(saved.library.tracks.length, 0);
  assert.equal(saved.library.playlists.length, 0);
  assert.equal(saved.library.selection.playlistId, first.id);
  await app.click(`offload-${suffix}`);
  assert.equal((await app.store.read()).assets.length, 2);
  await app.click('save');
  saved = await app.store.read();
  assert.deepEqual(saved.assets, []);
  assert.deepEqual(saved.library.installedTrackIds, []);
  assert.equal(saved.library.catalogTracks.length, 3);
  assert.equal(saved.library.selection.playlistId, first.id);
  assert.equal(app.node(`download-${suffix}`).disabled, false);
  assert.equal(app.node(`offload-${suffix}`).disabled, true);
  assert.match(app.node(`availability-${suffix}`).textContent, /available online/);
});

test('a competing library save prevents album selection from replacing newer data or player intent', async (t) => {
  const { first, catalogue } = await smallHostedAlbums();
  const app = await setup(t, { callbacks: { catalogue } });
  const newer = await fixture('competing-owner');
  await app.store.commit(newer.prepared, { expectedGeneration: 0 });
  await app.click(`select-album-${first.id.slice('builtin.album.'.length)}`);
  assert.deepEqual((await app.store.read()).library, newer.library);
  assert(!app.calls.some(([name]) => name === 'select'));
  assert.match(app.node('status').textContent, /changed|generation|reload/i);
});

test('Recording mode blocks uncertain catalogue auditions and same-hash upload aliases before reading bytes', async (t) => {
  const { recordings, catalogue } = await smallHostedAlbums();
  const initial = recordings[0].raw;
  let reads = 0;
  const app = await setup(t, {
    initial,
    callbacks: {
      catalogue,
      readAsset: async () => {
        reads++;
        return initial.blob;
      },
    },
  });
  app.node('recording-mode').checked = true;
  await app.click('apply-listening');
  for (const id of [recordings[0].track.id, initial.track.id]) {
    app.choose('tracks', id);
    assert.equal(app.node('audition-track').disabled, true);
    assert.match(app.node('track-info').textContent, /Recording mode excludes this audition/);
    await app.node('audition-track').onclick();
    assert.match(app.node('status').textContent, /Recording mode excludes this audition/);
  }
  assert.equal(reads, 0);
  assert.equal(app.urls.size, 0);
  assert.match(app.node('recording-status').textContent, /3 catalogue recordings excluded/);
  app.node('recording-mode').checked = false;
  await app.click('apply-listening');
  app.choose('tracks', recordings[0].track.id);
  assert.equal(app.node('audition-track').disabled, false);
});

test('saved Automatic catalogue discovery backs up without downloading unused online recordings', async (t) => {
  let reads = 0;
  const app = await setup(t, {
    callbacks: {
      catalogue: SOUNDTRACK_CATALOGUE,
      readAsset: async () => {
        reads++;
        throw new Error('Unused online discovery must not request backup audio.');
      },
    },
  });
  await app.click('apply-listening');
  assert.equal(
    (await app.store.read()).library.catalogTracks.length,
    SOUNDTRACK_CATALOGUE.tracks.length,
  );
  await app.click('export-bundle');
  assert.equal(reads, 0);
  assert.equal(app.node('download-prepared').disabled, false);
  assert.match(
    app.node('backup-info').textContent,
    /71 unused online catalogue recordings are not included/,
  );
  await app.click('download-prepared');
  const restored = await importSoundtrackBundle(app.downloads[0].blob, {
    catalogue: SOUNDTRACK_CATALOGUE,
    probeMedia: structuralProbe,
  });
  assert.deepEqual(restored.library.catalogTracks, []);
  assert.deepEqual(restored.library.referenceOnlyTrackIds, []);
  assert.deepEqual(restored.assets, []);
  assert.equal(
    (await app.store.read()).library.catalogTracks.length,
    SOUNDTRACK_CATALOGUE.tracks.length,
    'Read-only preparation preserves the live catalogue.',
  );
});

test('saved built-in album backup contains that album originals and excludes unrelated online discovery', async (t) => {
  const { first, recordings, catalogue } = await smallHostedAlbums();
  const reads = [];
  const app = await setup(t, {
    callbacks: {
      catalogue,
      readAsset: async (hash, options) => {
        assert.equal(options.purpose, 'export');
        reads.push(hash);
        return recordings.find((item) => item.track.asset.sha256 === hash).raw.blob;
      },
    },
  });
  await app.click(`select-album-${first.id.slice('builtin.album.'.length)}`);
  await app.click('export-bundle');
  assert.deepEqual(
    reads.sort(),
    recordings
      .slice(0, 2)
      .map((item) => item.track.asset.sha256)
      .sort(),
  );
  assert.match(app.node('backup-info').textContent, /1 unused online catalogue recording/);
  await app.click('download-prepared');
  const restored = await importSoundtrackBundle(app.downloads[0].blob, {
    catalogue,
    probeMedia: structuralProbe,
  });
  assert.equal(restored.library.selection.playlistId, first.id);
  assert.deepEqual(
    restored.library.catalogTracks.map((track) => track.id),
    first.trackIds.slice(0, 2),
  );
  assert.equal(restored.assets.length, 2);
  for (const recording of recordings.slice(0, 2)) {
    const asset = restored.assets.find((item) => item.sha256 === recording.track.asset.sha256);
    assert.deepEqual(
      new Uint8Array(await asset.blob.arrayBuffer()),
      new Uint8Array(await recording.raw.blob.arrayBuffer()),
    );
  }
  assert.equal(
    (await app.store.read()).assets.length,
    0,
    'Export does not silently install online originals.',
  );
});

test('legacy music libraries retain a visible playlist playback choice without a catalogue', async (t) => {
  const app = await setup(t);
  for (const id of ['selection', 'use-selection']) {
    for (let node = app.node(id); node; node = node.parentNode)
      assert.equal(node.hidden, false, `${id} must not be inside a hidden section`);
  }
  assert.match(app.node('selection').children[0].textContent, /Automatic.*map.*campaign.*theme/);
  app.choose('selection', 'builtin.all');
  await app.click('use-selection');
  assert.equal((await app.store.read()).library.selection.playlistId, 'builtin.all');
});
