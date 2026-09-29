import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { attachCreatorPlayerNavigation } from '../creator/player-navigation.mjs';
import { generateCreatorProject } from '../creator/templates.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { approveCreatorBundle, prepareCreatorBundle } from '../creator/bundle.mjs';
import {
  createCreatorStore,
  installPreparedCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import { creatorAttemptKey } from '../creator/runtime.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const html = await readFile(new URL('../creator/player.html', import.meta.url), 'utf8');
const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
let sequence = 0;

function pageBoundary() {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  mountCouch(doc, html);
  const $ = (id) => doc.getElementById(id),
    frames = new Map();
  let now = 1000,
    serial = 0,
    reads = 0,
    pad = null,
    onFrame = null;
  let locationURL = new URL('http://localhost/game/creator/player.html');
  Object.assign(win, {
    location: {
      get href() {
        return locationURL.href;
      },
      set href(value) {
        locationURL = new URL(value, locationURL);
      },
      get search() {
        return locationURL.search;
      },
      set search(value) {
        locationURL.search = value;
      },
      get origin() {
        return locationURL.origin;
      },
      get hash() {
        return locationURL.hash;
      },
    },
    navigator: {
      getGamepads: () => {
        reads++;
        return pad ? [pad] : [];
      },
    },
    performance: { now: () => now },
    File,
    DataTransfer: class {
      files = [];
      items = { add: (file) => this.files.push(file) };
    },
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  // This finite DOM supplies stable geometry; browser layout is checked separately.
  [...doc.querySelectorAll('button,a,select,input,summary')].forEach((node, index) => {
    node._rect = { x: 0, y: index * 60, width: 200, height: 44 };
  });
  for (const input of doc.querySelectorAll('input[type="file"]'))
    input.accept = input.getAttribute('accept');
  const frame = (ms = 16) => {
    now += ms;
    if (pad) pad.timestamp = now;
    if (onFrame) onFrame(now);
    else {
      const pending = [...frames];
      frames.clear();
      pending.forEach(([, callback]) => callback(now));
    }
  };
  const button = (index, pressed) => {
    pad.buttons[index] = { pressed, value: pressed ? 1 : 0 };
    frame();
  };
  const tap = (index) => {
    button(index, true);
    button(index, false);
  };
  const key = (value, pressed = true) =>
    doc.activeElement.emit(pressed ? 'keydown' : 'keyup', {
      key: value,
      code:
        {
          Escape: 'Escape',
          Enter: 'Enter',
          ArrowUp: 'ArrowUp',
          ArrowDown: 'ArrowDown',
          ArrowLeft: 'ArrowLeft',
          ArrowRight: 'ArrowRight',
        }[value] || value,
      repeat: false,
    });
  return {
    doc,
    win,
    $,
    frames,
    frame,
    button,
    tap,
    key,
    reads: () => reads,
    startFrames(callback) {
      onFrame = callback;
    },
    connect() {
      pad = {
        id: 'Creator menu virtual pad',
        index: 0,
        mapping: 'standard',
        connected: true,
        timestamp: now,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      frame();
    },
    disconnect() {
      pad = null;
      frame();
    },
  };
}

test('custom menu owns controls and recovery dialogs, then yields all pad reads and arrows to flight', () => {
  const page = pageBoundary(),
    { doc, win, $, tap, frame } = page;
  let scope = 'creator-menu',
    starts = 0,
    imports = 0;
  $('start').disabled = false;
  $('import-attempt').disabled = false;
  $('import-attempt').onchange = () => imports++;
  $('start').onclick = () => {
    starts++;
    scope = 'flight';
  };
  const host = attachCreatorPlayerNavigation({
    document: doc,
    window: win,
    getScope: () => scope,
    getDefaultFocus: () => $('start'),
  });
  page.startFrames((now) => host.update(now));
  page.connect();
  assert.equal(doc.activeElement, $('start'));
  page.button(0, true);
  assert.equal(starts, 0, 'Confirm waits for release');
  page.button(0, false);
  assert.equal(starts, 1);
  const reads = page.reads();
  frame();
  frame();
  assert.equal(page.reads(), reads, 'the gameplay adapter is the sole flight sampler');
  assert.equal(page.key('ArrowDown').defaultPrevented, false);
  scope = 'creator-menu';
  host.refresh({ focus: true });
  page.button(0, true);
  frame();
  page.button(0, false);
  assert.equal(starts, 1, 'held/first input after handoff requires neutral');
  const summary = doc.querySelector('summary');
  summary.focus();
  tap(0);
  assert.equal(summary.parentElement.open, true);
  tap(13);
  assert.equal(doc.activeElement, $('import-attempt'));
  tap(0);
  const dialog = doc.getElementById('creator-player-sources');
  assert.equal(dialog.open, true);
  assert.equal(doc.activeElement, dialog.querySelector('button'));
  frame(); // Observe neutral in the new modal scope before its first action.
  tap(1);
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, $('import-attempt'));
  assert.equal(imports, 0, 'Back never imports or touches the host save');
  frame();
  tap(1);
  assert.equal(summary.parentElement.open, false);
  assert.equal(doc.activeElement, summary);
  const beforeHidden = page.reads();
  doc.hidden = true;
  frame();
  assert.equal(page.reads(), beforeHidden);
  doc.hidden = false;
  doc.focused = false;
  frame();
  assert.equal(page.reads(), beforeHidden);
  host.destroy();
  assert.equal(doc.getElementById('creator-player-sources'), null);
  frame();
  assert.equal(page.reads(), beforeHidden);
});

class Locks {
  held = new Set();
  async request(name, _options, work) {
    if (this.held.has(name)) return work(null);
    this.held.add(name);
    try {
      return await work({ name });
    } finally {
      this.held.delete(name);
    }
  }
}

async function installedFixture() {
  const databases = new Map();
  const indexedDB = {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
  const generated = generateCreatorProject({ id: 'player-menu', name: 'Menu route', seed: 8 });
  const project = structuredClone(generated.project);
  const blob = new Blob([pngBytes()], { type: 'image/png' });
  const sha256 = await creatorSHA256(await blob.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'Player menu fixture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  const pack = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: [generated.provenance],
      credits: {
        creator: 'Host fixture',
        picture: 'Original fixture',
        license: 'Fixture permission',
      },
    },
    [{ sha256, blob }],
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  const store = createCreatorStore({ indexedDB }),
    approval = approveCreatorBundle(pack);
  await installPreparedCreatorBundle(
    store,
    pack,
    approval,
    await reviewCreatorInstallation(store, pack, approval),
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
  store.close();
  const values = new Map(),
    writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      writes.push([key, value]);
    },
    removeItem: (key) => values.delete(key),
  };
  const route = pack.manifest.evidence.find(
    (row) => row.difficulty === 'standard' && row.turnPolicy === 'immediate',
  );
  return { pack, route, indexedDB, storage, writes };
}

async function playerHost(t, fixture, { invalidEdition = false } = {}) {
  const page = pageBoundary(),
    { doc, win, $ } = page;
  win.location.search = `?edition=${invalidEdition ? 'missing' : fixture.pack.editionId}`;
  win.navigator.locks = new Locks();
  let run = null;
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {});
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
  t.mock.method(BoardPainter.prototype, 'draw', (_context, current) => {
    run = current;
  });
  const globals = {
    document: doc,
    window: win,
    navigator: win.navigator,
    location: win.location,
    indexedDB: fixture.indexedDB,
    localStorage: fixture.storage,
    performance: win.performance,
    Image: PNGImage,
    matchMedia: () => ({ matches: false }),
    fetch: async (path) =>
      new Response(await readFile(new URL(path, new URL('../creator/', import.meta.url)))),
    requestAnimationFrame: win.requestAnimationFrame,
    cancelAnimationFrame: win.cancelAnimationFrame,
  };
  const original = new Map();
  for (const [name, value] of Object.entries(globals)) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  Object.assign(win, { fetch: globals.fetch });
  t.after(() => {
    win.emit('pagehide');
    assert.equal(page.frames.size, 0, 'one existing RAF is stopped at teardown');
    for (const [name, value] of original)
      if (value) Object.defineProperty(globalThis, name, value);
      else delete globalThis[name];
  });
  await import(`../creator/player.mjs?controller=${++sequence}`);
  assert.equal(page.frames.size, 1, 'menu and game share one scheduled frame');
  if (!invalidEdition) assert.equal($('start').disabled, false, $('status').textContent);
  return { ...page, run: () => run };
}

const settle = async (condition) => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert(condition(), 'the actual player operation completes');
};

test('installed custom player starts, pauses, saves and resumes through one controller menu owner', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture);
  const { $, doc } = page;
  page.connect();
  assert.equal(doc.activeElement, $('start'));
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  assert.equal(doc.activeElement, $('arena'));
  assert(page.run());
  page.frame();
  const before = page.run().tick;
  page.frame();
  assert(page.run().tick > before, 'flight continues through its original runtime input');
  page.tap(9);
  assert.equal(doc.activeElement, $('pause'));
  const checkpoint = authoritativeCheckpoint(page.run());
  const pausedTick = page.run().tick;
  const saved = fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId));
  assert(saved, 'pause retains an unfinished attempt through the original save handler');
  const writes = fixture.writes.length;
  page.frame();
  page.frame();
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  page.tap(13);
  assert.equal(doc.activeElement, $('retry'));
  page.tap(1);
  assert.equal(doc.activeElement, $('pause'));
  assert.equal(fixture.writes.length, writes, 'menu traversal and Back do not save or restart');
  assert.equal(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)), saved);
  page.tap(0);
  page.frame();
  assert.equal(doc.activeElement, $('arena'));
  assert(page.run().tick > pausedTick);
});

test('installation errors retain a keyboard/controller exit menu without a running simulation', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture, { invalidEdition: true });
  assert.equal(page.$('status').classList.contains('error'), true);
  page.connect();
  assert.equal(page.doc.activeElement, page.doc.querySelector('header a'));
  page.tap(13);
  assert.equal(page.doc.activeElement, page.doc.querySelectorAll('header a')[1]);
  page.key('Escape');
  assert.equal(page.doc.activeElement, page.doc.querySelector('header a'));
  assert.equal(page.run(), null);
});

test('a legally completed custom mission exposes result actions and keeps earned progress on menu traversal', async (t) => {
  const fixture = await installedFixture(),
    page = await playerHost(t, fixture);
  const { $, doc } = page;
  $('difficulty').value = 'standard';
  page.connect();
  page.tap(0);
  await settle(() => !$('pause').disabled);
  page.frame();
  let held = null;
  const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  for (const segment of fixture.route.replay.segments) {
    if (segment.releaseBefore && held) {
      page.key(keyFor[held], false);
      held = null;
    }
    const direction = segment.input.direction;
    if (direction !== held) {
      if (held) page.key(keyFor[held], false);
      if (direction) page.key(keyFor[direction]);
      held = direction;
    }
    for (let tick = 0; tick < segment.ticks; tick++) page.frame(1000 / 120);
  }
  if (held) page.key(keyFor[held], false);
  assert.equal(page.run().status, 'won', 'only the verified route earns completion');
  await settle(() => !$('next').hidden && !$('next').disabled);
  page.frame();
  page.tap(1);
  assert.equal(doc.activeElement, $('next'));
  assert.equal($('earned').hidden, false);
  assert.equal($('export-progress').disabled, false);
  assert.equal($('export-attempt').disabled, true);
  const checkpoint = authoritativeCheckpoint(page.run()),
    writes = fixture.writes.length;
  page.tap(12);
  assert.equal(doc.activeElement, $('retry'));
  page.tap(1);
  assert.equal(doc.activeElement, $('next'));
  assert.deepEqual(authoritativeCheckpoint(page.run()), checkpoint);
  assert.equal(fixture.writes.length, writes);
  assert.equal(fixture.storage.getItem(creatorAttemptKey(fixture.pack.editionId)), null);
  page.tap(0);
  assert.equal(
    page.win.location.hash,
    '#installed',
    'Next retains the original return-to-creations handler',
  );
});
