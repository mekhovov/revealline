import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { attachStillMediaHost } from '../ui/still-media-host.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { SoloElement } from './helpers/solo-dom.mjs';
import { memoryIndexedDB, fixture } from './helpers/soundtrack-fixtures.mjs';
import { mediaFixture, pngBytes, deferred } from './helpers/media-fixtures.mjs';

const audioFixture = await fixture();
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
test('actual classic entry gives file-URL guidance before module/storage access', async () => {
  const code = await readFile(
    new URL('../../authoring/still-media/launch.js', import.meta.url),
    'utf8',
  );
  const status = { textContent: '' },
    open = { disabled: false };
  runInNewContext(code, {
    document: { getElementById: (id) => (id === 'still-host-status' ? status : open) },
    location: { protocol: 'file:' },
  });
  assert.equal(open.disabled, true);
  assert.match(status.textContent, /file URL.*no database/i);
});
async function setup(t, options = {}) {
  const doc = new Document();
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag);
    if (options.nativeReloadFocus && tag === 'button') {
      let disabled = element.disabled;
      Object.defineProperty(element, 'disabled', {
        get: () => disabled,
        set(value) {
          disabled = value;
          if (value && element.id === 'still-media-reload' && doc.activeElement === element)
            element.blur();
        },
      });
    }
    return element;
  };
  const html = await readFile(
    new URL('../../authoring/still-media/index.html', import.meta.url),
    'utf8',
  );
  for (const [, tag, id] of html.matchAll(/<(button|a|p)\b[^>]*id="([^"]+)"/g)) {
    const item = doc.createElement(tag);
    item.id = id;
    doc.body.append(item);
  }
  doc.getElementById('still-host-download-audio').hidden = true;
  const win = new Events(),
    frames = new Map();
  let frame = 0;
  if (options.nativeReloadFocus) doc.defaultView = Object.assign(win, doc.defaultView);
  win.location = { protocol: 'http:' };
  win.requestAnimationFrame = (fn) => {
    frames.set(++frame, fn);
    return frame;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  const f = mediaFixture(true),
    memory = options.memory ?? memoryIndexedDB(),
    managers = [],
    adapters = [];
  const source = { baseEntry: { campaign: f.campaign, themes: [{ id: 'fpv' }] }, presets: {} };
  const urls = new Map(),
    revoked = [];
  const host = attachStillMediaHost({
    document: doc,
    window: win,
    readBase: async () => source,
    readAsset: async () => null,
    storage: { getItem: () => null },
    lockManager: { request: async (_name, _options, work) => work({}) },
    decodeImage,
    createManager(args) {
      assert.deepEqual(args, { storyMedia: true, soundtrackCatalogue: true });
      const manager = createManagedMediaStore({ ...args, indexedDB: memory.indexedDB });
      managers.push(manager);
      return manager;
    },
    createStills(args) {
      adapters.push(args.managedStore);
      return createStillMediaStore(args);
    },
    createAudio(args) {
      adapters.push(args.managedStore);
      return createSoundtrackStore(args);
    },
    createStories(args) {
      adapters.push(args.managedStore);
      return createStoryMediaStore(args);
    },
    createPreview: ({ canvas }) => ({ canvas, show: async () => true, clear() {}, dispose() {} }),
    URLImpl: {
      createObjectURL(blob) {
        const id = `blob:owned-${urls.size}`;
        urls.set(id, blob);
        return id;
      },
      revokeObjectURL(id) {
        revoked.push(id);
      },
    },
    ...options.host,
  });
  t.after(() => host.dispose());
  return {
    doc,
    win,
    host,
    memory,
    managers,
    adapters,
    urls,
    revoked,
    frames,
    $: (id) => doc.getElementById(id),
  };
}
test('actual authoring entry opens no DB until explicit activation and shares one real manager for audio and media', async (t) => {
  const h = await setup(t);
  assert.equal(h.memory.openCount, 0);
  assert.equal(h.managers.length, 0);
  h.$('still-host-open').focus();
  assert.equal(await h.$('still-host-open').onclick(), true);
  assert.equal(h.managers.length, 1);
  assert.deepEqual(h.adapters, [h.managers[0], h.managers[0], h.managers[0]]);
  h.$('still-media-file').files = [new Blob([pngBytes()])];
  h.$('still-media-file').onchange();
  h.$('still-media-credit').value = 'Fixture';
  h.$('still-media-source').value = 'Original test';
  h.$('still-media-description').value = 'Owned one pixel';
  h.win.emit('blur'); // A native file dialog can blur without hiding the page.
  assert.equal(h.host.panel.snapshot().ready, true);
  assert.equal(await h.$('still-media-preview').onclick(), true);
  assert.equal(await h.$('still-media-save').onclick(), true);
  h.host.panel.close();
  assert.equal(h.doc.activeElement, h.$('still-host-open'));
  const stills = createStillMediaStore({ managedStore: h.managers[0], decodeImage });
  assert.equal((await stills.read()).document.library.assets.length, 1);
  h.$('still-host-close').onclick();
  assert.equal(h.host.panel, null);
  await assert.rejects(h.managers[0].readDomain('audio'), /closed/);
  await new Promise(setImmediate);
  assert.ok(h.memory.closed > 0);
});
function modelNativeDisabledFocus(h, opener) {
  let disabled = opener.disabled;
  const focus = opener.focus.bind(opener);
  // A native disabled focused button blurs before the awaited catalogue resolves.
  Object.defineProperty(opener, 'disabled', {
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && h.doc.activeElement === opener) h.doc.activeElement = h.doc.body;
    },
  });
  opener.focus = () => {
    if (!disabled) focus();
  };
}
test('cold workshop Escape restores the invoker blurred by its disabled loading state', async (t) => {
  const gate = deferred(),
    f = mediaFixture(true),
    source = { baseEntry: { campaign: f.campaign, themes: [{ id: 'fpv' }] }, presets: {} };
  const h = await setup(t, { host: { readBase: () => gate.promise } });
  const opener = h.$('still-host-open');
  modelNativeDisabledFocus(h, opener);
  opener.focus();
  const opening = opener.onclick();
  assert.equal(opener.disabled, true);
  assert.equal(h.doc.activeElement, h.doc.body);
  assert.equal(h.host.panel, null);
  gate.resolve(source);
  assert.equal(await opening, true);
  assert.equal(opener.disabled, false);
  assert.equal(h.host.panel.dialog.open, true);
  const close = h.host.panel.dialog.emit('cancel');
  assert.equal(close.defaultPrevented, true);
  assert.equal(h.host.panel.dialog.open, false);
  assert.equal(h.doc.activeElement === opener, true, 'Escape returns to the original invoker.');

  // A reused panel takes this invocation's target, not its previous opener.
  const other = h.$('still-host-export-audio');
  other.focus();
  assert.equal(await h.host.open(), true);
  h.host.panel.dialog.emit('cancel');
  assert.equal(h.doc.activeElement === other, true, 'Reopen retains its own invoker.');
});
test('closing a pending workshop read restores the invoker before settling and preserves later focus', async (t) => {
  const gate = deferred(),
    entered = deferred();
  const h = await setup(t, {
    host: {
      createStills(args) {
        const store = createStillMediaStore(args);
        return {
          ...store,
          async read(options) {
            entered.resolve();
            await gate.promise;
            return store.read(options);
          },
        };
      },
    },
  });
  const opener = h.$('still-host-open');
  modelNativeDisabledFocus(h, opener);
  opener.focus();
  const opening = opener.onclick();
  await entered.promise;
  assert.equal(h.host.panel.dialog.open, true);
  assert.equal(opener.disabled, true);
  h.host.panel.dialog.emit('cancel');
  assert.equal(h.host.panel.dialog.open, true, 'First Back cancels busy work without closing.');
  const close = h.host.panel.dialog.emit('cancel');
  assert.equal(close.defaultPrevented, true);
  assert.equal(h.host.panel.dialog.open, false);
  assert.equal(
    opener.disabled,
    false,
    'Closing detaches the pending host owner before return focus.',
  );
  assert.equal(
    h.doc.activeElement === opener,
    true,
    'Pending-read Close returns to enabled invoker.',
  );
  const other = h.$('still-host-close');
  other.focus();
  const status = h.$('still-host-status').textContent;
  gate.resolve();
  assert.equal(await opening, false);
  assert.equal(
    h.doc.activeElement === other,
    true,
    'Late read settlement cannot steal later focus.',
  );
  assert.equal(h.$('still-host-status').textContent, status);
  assert.equal(h.host.panel.dialog.open, false);
});
test('v1 MP3 bytes remain exact through shared v4 upgrade and explicit native backup preparation', async (t) => {
  const memory = memoryIndexedDB(),
    old = createSoundtrackStore({ indexedDB: memory.indexedDB });
  await old.commit(audioFixture.prepared, { expectedGeneration: 0 });
  old.close();
  const before = await exportSoundtrackBundle(audioFixture.library, audioFixture.assets);
  const h = await setup(t, { memory });
  await h.host.open();
  h.$('still-media-file').files = [new Blob([pngBytes()])];
  h.$('still-media-file').onchange();
  h.$('still-media-credit').value = 'Fixture';
  h.$('still-media-source').value = 'Original test';
  h.$('still-media-description').value = 'Image alongside original MP3';
  assert.equal(await h.$('still-media-preview').onclick(), true);
  assert.equal(await h.$('still-media-save').onclick(), true);
  h.host.panel.close();
  assert.equal(await h.$('still-host-export-audio').onclick(), true);
  assert.equal(h.$('still-host-download-audio').hidden, false);
  const blob = h.urls.get(h.$('still-host-download-audio').href);
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(await before.arrayBuffer()));
  assert.equal(h.doc.activeElement, h.$('still-host-download-audio'));
  assert.equal(h.$('still-host-download-audio').download, 'RevealLine-soundtrack.rlsound');
  h.$('still-host-download-audio').click();
  assert.match(h.$('still-host-status').textContent, /Download requested/);
  h.$('still-host-close').onclick();
  assert.equal(h.revoked.length, 1);
});
test('file URL and cancelled late source load do not open or upgrade media', async (t) => {
  const h = await setup(t);
  h.win.location.protocol = 'file:';
  assert.equal(await h.host.open(), false);
  assert.equal(h.memory.openCount, 0);
  assert.match(h.$('still-host-status').textContent, /File URLs/);
  const gate = deferred(),
    j = await setup(t, { host: { readBase: () => gate.promise } });
  const opening = j.host.open();
  j.$('still-host-close').onclick();
  gate.resolve({});
  assert.equal(await opening, false);
  assert.equal(j.memory.openCount, 0);
});
test('rejected shared-store access remains visible and cannot become an empty media save', async (t) => {
  const h = await setup(t, {
    host: {
      createStills() {
        return {
          read: async () => {
            throw new DOMException('Use the newer compatible game to export.', 'VersionError');
          },
          close() {},
        };
      },
    },
  });
  assert.equal(await h.host.open(), false);
  assert.match(h.$('still-media-status').textContent, /newer compatible/);
  assert.equal(h.$('still-media-save').disabled, true);
  assert.equal(h.host.panel.snapshot().generation, null);
});
test('persisted pagehide cancels a pending first Open before it can create or upgrade a manager', async (t) => {
  const gate = deferred(),
    f = mediaFixture(true);
  let first = true;
  const source = { baseEntry: { campaign: f.campaign, themes: [{ id: 'fpv' }] }, presets: {} };
  const h = await setup(t, {
    host: {
      readBase: () => {
        if (first) {
          first = false;
          return gate.promise;
        }
        return source;
      },
    },
  });
  const pending = h.host.open();
  h.win.emit('pagehide', { persisted: true });
  gate.resolve(source);
  assert.equal(await pending, false);
  assert.equal(h.host.panel, null);
  assert.equal(h.managers.length, 0);
  assert.equal(h.memory.openCount, 0);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.host.panel, null);
  assert.equal(h.memory.openCount, 0);
  assert.equal(await h.host.open(), true);
  assert.equal(h.managers.length, 1);
});
test('existing host navigation owns Back and neutralizes native handoff; hidden page cancels the edit context', async (t) => {
  const h = await setup(t);
  await h.host.open();
  const close = h.$('still-media-close');
  close.focus();
  h.host.navigation.sync();
  h.host.navigation.handle({ back: true });
  assert.equal(h.host.panel.dialog.open, false);
  await h.host.open();
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(h.host.panel.snapshot().ready, false);
  assert.equal(h.$('still-media-save').disabled, true);
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  h.doc.hidden = false;
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 1);
  assert.equal(h.host.panel.dialog.open, false);
});
test('actual shared router prevents held Confirm across modal close and native pointer handoff', async (t) => {
  const pad = {
    index: 0,
    id: 'Still workshop test controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const h = await setup(t, { host: { readPads: () => [pad] } });
  const frame = (now) => {
    const [id, callback] = h.frames.entries().next().value;
    h.frames.delete(id);
    callback(now);
  };
  const press = (id, down) => {
    pad.buttons[id] = { pressed: down, value: down ? 1 : 0 };
  };
  await h.host.open();
  frame(0);
  press(0, true);
  frame(1);
  press(0, false);
  frame(2);
  h.$('still-media-close').focus();
  press(0, true);
  frame(3);
  assert.equal(h.host.panel.dialog.open, false);
  frame(500);
  assert.equal(h.host.panel.dialog.open, false, 'Held Close/Confirm cannot reopen local media.');
  press(0, false);
  frame(501);
  await h.host.open();
  frame(502);
  press(13, true);
  frame(503);
  h.doc.emit('pointerdown', { target: h.$('still-media-show-authored') });
  h.$('still-media-show-authored').focus();
  frame(1200);
  assert.equal(h.doc.activeElement, h.$('still-media-show-authored'));
  press(13, false);
  frame(1201);
  press(13, true);
  frame(1202);
  assert.notEqual(h.doc.activeElement, h.$('still-media-show-authored'));
  const tab = h.doc.emit('keydown', { key: 'Tab', target: h.doc.activeElement });
  assert.equal(tab.defaultPrevented, false, 'Native modal Tab default is left to the browser.');
});

test('opening announces the held catalogue read and Close fences its late failure', async (t) => {
  const pending = deferred();
  const h = await setup(t, { host: { readBase: () => pending.promise } });
  const opening = h.host.open();
  assert.equal(h.$('still-host-status').dataset.state, 'busy');
  assert.equal(h.$('still-host-status').dataset.stage, 'reading');
  assert.match(h.$('still-host-status').textContent, /Opening the picture workshop/);
  assert.equal(h.$('still-host-close').disabled, false);
  h.$('still-host-close').onclick();
  h.$('still-host-close').focus(); // Deliberate navigation after Close restored its own default.
  const closed = h.$('still-host-status').textContent;
  pending.reject(new Error('Late catalogue failure'));
  assert.equal(await opening, false);
  assert.equal(h.$('still-host-status').textContent, closed);
  assert.equal(h.$('still-host-status').dataset.state, 'ready');
  assert.equal(h.host.panel, null);
  assert.equal(
    h.doc.activeElement === h.$('still-host-close'),
    true,
    'Late cancelled reads retain deliberate focus.',
  );
});

test('classic picture workshop exposes loading and Back before storage explanation', async () => {
  const html = await readFile(
    new URL('../../authoring/still-media/index.html', import.meta.url),
    'utf8',
  );
  const title = html.indexOf('</h1>'),
    status = html.indexOf('id="still-host-status"'),
    back = html.indexOf('class="still-host-navigation"'),
    explanation = html.indexOf('Upload an original');
  assert.ok(title < status && status < back && back < explanation);
  assert.match(html.slice(status, back), /data-state="busy"[\s\S]*Loading the picture workshop/);
});

async function recoverableWorkshop(t, { reloadGate, failReload = false } = {}) {
  let reads = 0;
  const entered = deferred();
  const h = await setup(t, {
    nativeReloadFocus: true,
    host: {
      createStills(args) {
        const store = createStillMediaStore(args);
        return {
          ...store,
          async read(options) {
            if (++reads === 1) throw new Error('Picture originals temporarily unavailable.');
            entered.resolve();
            if (reloadGate) await reloadGate.promise;
            if (failReload) throw new Error('Picture originals remain unavailable.');
            return store.read(options);
          },
        };
      },
    },
  });
  h.$('still-host-open').focus();
  assert.equal(await h.host.open(), false);
  assert.match(h.$('still-host-status').textContent, /Workshop open failed/);
  assert.equal(h.$('still-host-status').dataset.state, 'error');
  return { ...h, entered };
}

test('successful in-dialog reload reconciles the failed host opening without moving focus or writing media', async (t) => {
  const h = await recoverableWorkshop(t);
  const before = h.memory.allPuts.length;
  h.$('still-media-reload').focus();
  assert.equal(await h.$('still-media-reload').onclick(), true);
  assert.equal(h.host.panel.snapshot().ready, true);
  assert.equal(h.host.panel.snapshot().generation, 0);
  assert.match(h.$('still-media-status').textContent, /Saved originals verified/);
  assert.equal(h.$('still-host-status').dataset.state, 'ready');
  assert.match(h.$('still-host-status').textContent, /Real local media opened for dev/);
  assert.equal(h.memory.allPuts.length, before, 'Recovery reads do not write media.');
  assert.equal(h.doc.activeElement === h.$('still-media-reload'), true);
  h.host.panel.close();
  assert.equal(h.doc.activeElement === h.$('still-host-open'), true);
});

test('failed in-dialog reload retains the host failure and the current panel error', async (t) => {
  const h = await recoverableWorkshop(t, { failReload: true });
  const failed = h.$('still-host-status').textContent;
  assert.equal(await h.$('still-media-reload').onclick(), false);
  assert.equal(h.$('still-host-status').textContent, failed);
  assert.equal(h.$('still-host-status').dataset.state, 'error');
  assert.match(h.$('still-media-status').textContent, /remain unavailable/);
});

for (const action of ['hide', 'close'])
  test(`cancelled reload after ${action} cannot reconcile a late read as success`, async (t) => {
    const gate = deferred();
    const h = await recoverableWorkshop(t, { reloadGate: gate });
    const recovery = h.$('still-media-reload').onclick();
    await h.entered.promise;
    if (action === 'hide') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.$('still-host-close').onclick();
    const retained = h.$('still-host-status').textContent;
    gate.resolve();
    assert.equal(await recovery, false);
    assert.equal(h.$('still-host-status').textContent, retained);
    assert.doesNotMatch(retained, /Real local media opened/);
  });

test('successful reload cannot overwrite a newer host status owner', async (t) => {
  const gate = deferred();
  const h = await recoverableWorkshop(t, { reloadGate: gate });
  const recovery = h.$('still-media-reload').onclick();
  await h.entered.promise;
  // Exercise the existing host-message callback while the panel read is held.
  // This tests status ownership; it does not claim native activation of an inert link.
  h.$('still-host-download-audio').onclick();
  const newer = h.$('still-host-status').textContent;
  assert.match(newer, /Download requested/);
  gate.resolve();
  assert.equal(await recovery, true);
  assert.equal(h.$('still-host-status').textContent, newer);
});

for (const newerFails of [false, true])
  test(`retired reload cannot change a newer ${newerFails ? 'failed' : 'successful'} opening`, async (t) => {
    const gate = deferred(),
      entered = deferred();
    let reads = 0;
    const h = await setup(t, {
      host: {
        createStills(args) {
          const store = createStillMediaStore(args);
          return {
            ...store,
            async read(options) {
              const read = ++reads;
              if (read === 1 || (read === 3 && newerFails))
                throw new Error(`Picture read ${read} unavailable.`);
              if (read === 2) {
                entered.resolve();
                await gate.promise;
              }
              return store.read(options);
            },
          };
        },
      },
    });
    h.$('still-host-open').focus();
    assert.equal(await h.host.open(), false);
    const retired = h.$('still-media-reload').onclick();
    await entered.promise;
    h.host.panel.close();
    assert.equal(await h.host.open(), !newerFails);
    const status = h.$('still-host-status').textContent;
    const state = h.$('still-host-status').dataset.state;
    const focus = h.doc.activeElement;
    gate.resolve();
    assert.equal(await retired, false);
    assert.equal(h.$('still-host-status').textContent, status);
    assert.equal(h.$('still-host-status').dataset.state, state);
    assert.equal(h.doc.activeElement === focus, true);
    assert.equal(state, newerFails ? 'error' : 'ready');
    if (newerFails) {
      assert.equal(await h.$('still-media-reload').onclick(), true);
      assert.equal(h.$('still-host-status').dataset.state, 'ready');
      assert.match(h.$('still-host-status').textContent, /Real local media opened/);
    }
  });

for (const initialFailure of [false, true])
  test(`workshop initial ${initialFailure ? 'failed' : 'successful'} load and reopen restore Reload after native disabled blur`, async (t) => {
    let reads = 0;
    const h = await setup(t, {
      nativeReloadFocus: true,
      host: {
        createStills(args) {
          const store = createStillMediaStore(args);
          return {
            ...store,
            read(options) {
              assert.equal(h.doc.activeElement, h.doc.body, 'The focused Reload really blurred');
              if (++reads === 1 && initialFailure) throw new Error('Initial read unavailable');
              return store.read(options);
            },
          };
        },
      },
    });
    const opener = h.$('still-host-open');
    opener.focus();
    assert.equal(await opener.onclick(), !initialFailure);
    assert.equal(h.doc.activeElement, h.$('still-media-reload'));
    assert.equal(h.$('still-media-reload').disabled, false);
    h.host.panel.close();
    assert.equal(h.doc.activeElement, opener);
    assert.equal(await opener.onclick(), true);
    assert.equal(h.doc.activeElement, h.$('still-media-reload'));
    h.host.panel.close();
    assert.equal(h.doc.activeElement, opener);
    assert.equal(h.memory.allPuts.length, 0, 'Verification does not write media');
  });
