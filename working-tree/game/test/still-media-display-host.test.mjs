import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { Events } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { workshop } from './helpers/still-workshop.mjs';

// Execute the display entry selected by the real HTML alongside the real media
// host and store. Geometry, native font metrics and BFCache remain browser gates.
let entrySerial = 0;
async function setup(t, initial = { textFace: 'plain', textSize: 'large', reducedEffects: true }) {
  const h = await workshop(t),
    media = Object.assign(new Events(), { matches: false }),
    timers = new Map(),
    writes = [];
  let raw = JSON.stringify(initial),
    serial = 0;
  const storage = {
    getItem(key) {
      assert.equal(key, DISPLAY_PREFERENCES_KEY);
      return raw;
    },
    setItem(key, value) {
      writes.push({ key, value });
      assert.fail('Reading a shared preference must not write it.');
    },
  };
  h.win.localStorage = storage;
  h.win.matchMedia = () => media;
  h.win.setTimeout = (fn, ms) => {
    assert.equal(ms, 0);
    timers.set(++serial, fn);
    return serial;
  };
  h.win.clearTimeout = (id) => timers.delete(id);
  h.doc.defaultView = h.win;
  const htmlURL = new URL('../../authoring/still-media/index.html', import.meta.url),
    html = await readFile(htmlURL, 'utf8'),
    entries = [...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"/g)]
      .map((match) => new URL(match[1], htmlURL))
      .filter((url) => url.pathname.endsWith('/tool-display-entry.mjs'));
  // These file-local tests run sequentially. Give the real entry its browser
  // globals only during import; the mounted owner captures this document/host.
  const descriptors = ['document', 'window'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: h.doc });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: h.win });
    for (const url of entries) {
      url.searchParams.set('still-media-display-test', String(++entrySerial));
      await import(url.href);
    }
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  t.after(() => h.win.emit('pagehide', { persisted: false }));
  return {
    ...h,
    entries,
    media,
    timers,
    writes,
    external(value, notify = true) {
      raw = JSON.stringify(value);
      if (notify)
        h.win.emit('storage', {
          key: DISPLAY_PREFERENCES_KEY,
          newValue: raw,
          storageArea: storage,
        });
    },
    flush() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
  };
}

function reading(h, face, size, effects) {
  assert.equal(h.doc.body.dataset.textFace, face);
  assert.equal(h.doc.body.dataset.textSize, size);
  assert.equal(h.doc.body.dataset.effects, effects);
}

test('Still Media actual entry adopts shared Large/Plain before local media is opened', async (t) => {
  const h = await setup(t);
  reading(h, 'plain', 'large', 'reduced');
  assert.equal(h.entries.length, 1, 'One independent shared reading entry owns the document.');
  assert.equal(h.memory.openCount, 0);
  assert.equal(h.managers.length, 0);
  assert.equal(h.host.panel, null);
  assert.deepEqual(h.writes, []);
});

test('shared reading updates preserve the open Still Media draft, original, preview and focus', async (t) => {
  const h = await setup(t);
  await h.open();
  const file = new Blob([pngBytes()]);
  h.$('file').files = [file];
  h.$('file').onchange();
  h.$('credit').value = 'Owned fixture';
  h.$('source').value = 'Retained original';
  h.$('description').value = 'Uncommitted picture';
  assert.equal(await h.$('preview').onclick(), true);
  h.$('credit').focus();
  const state = h.host.panel.snapshot(),
    before = await h.store().read(),
    dialog = h.host.panel.dialog,
    canvas = h.$('preview-canvas'),
    paints = [...h.paints],
    clears = h.clears,
    urls = [...h.urls];
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  reading(h, 'pixel', 'standard', 'full');
  h.external({ textFace: 'plain', textSize: 'large', reducedEffects: false });
  h.media.matches = true;
  h.media.emit('change');
  reading(h, 'plain', 'large', 'reduced');
  assert.equal(h.doc.activeElement, h.$('credit'));
  assert.equal(h.$('file').files[0], file);
  assert.equal(h.$('credit').value, 'Owned fixture');
  assert.equal(h.$('source').value, 'Retained original');
  assert.equal(h.$('description').value, 'Uncommitted picture');
  assert.equal(h.host.panel.dialog, dialog);
  assert.equal(dialog.open, true);
  assert.equal(h.$('preview-canvas'), canvas);
  assert.deepEqual(h.host.panel.snapshot(), state);
  assert.deepEqual(h.paints, paints);
  assert.equal(h.clears, clears);
  assert.deepEqual([...h.urls], urls);
  assert.deepEqual(await h.store().read(), before);
  assert.equal(before.generation, 0);
  assert.equal(before.document.library.assets.length, 0);
  assert.deepEqual(h.writes, []);
});

test('Still Media cached return refreshes missed reading changes without reopening media', async (t) => {
  const h = await setup(t);
  await h.open();
  h.$('description').value = 'Keep this draft text';
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.host.panel.dialog.open, false, 'Existing host closes its panel on departure.');
  const focus = h.doc.activeElement,
    snapshot = h.host.panel.snapshot(),
    opens = h.memory.openCount;
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false }, false);
  h.win.emit('pageshow', { persisted: true });
  h.flush();
  reading(h, 'pixel', 'standard', 'full');
  assert.equal(h.doc.activeElement, focus);
  assert.equal(h.host.panel.dialog.open, false);
  assert.deepEqual(h.host.panel.snapshot(), snapshot);
  assert.equal(h.$('description').value, 'Keep this draft text');
  assert.equal(h.memory.openCount, opens);
  assert.deepEqual(h.writes, []);
});

test('terminal Still Media departure releases reading listeners and ignores retained callbacks', async (t) => {
  const h = await setup(t);
  h.win.emit('pageshow', { persisted: false });
  const pending = [...h.timers.values()],
    storageCallbacks = [...(h.win.listeners.get('storage') || [])],
    showCallbacks = [...(h.win.listeners.get('pageshow') || [])],
    motionCallbacks = [...(h.media.listeners.get('change') || [])];
  h.win.emit('pagehide', { persisted: false });
  const state = { ...h.doc.body.dataset },
    focus = h.doc.activeElement;
  assert.equal(h.timers.size, 0);
  assert.equal(h.win.listeners.get('storage')?.size ?? 0, 0);
  assert.equal(h.media.listeners.get('change')?.size ?? 0, 0);
  h.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  h.media.matches = true;
  for (const callback of pending) callback();
  for (const callback of storageCallbacks) callback({ key: DISPLAY_PREFERENCES_KEY });
  for (const callback of showCallbacks) callback({ persisted: true });
  for (const callback of motionCallbacks) callback();
  assert.deepEqual({ ...h.doc.body.dataset }, state);
  assert.equal(h.doc.activeElement, focus);
  assert.equal(h.timers.size, 0);
  assert.equal(h.memory.openCount, 0);
  assert.deepEqual(h.writes, []);
});
