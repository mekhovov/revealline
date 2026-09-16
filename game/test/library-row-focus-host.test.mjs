import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { emptyLibrary } from '../library.mjs';
import { emptyPackLibrary, installPack, preparePack, exportPackLibrary } from '../packs.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { captureOperationFocus } from '../ui/operation-focus.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const source = await read('../content/packs/fieldcraft.json');
const prepared = new Map();
for (const [id, version] of [
  ['row-a', '1.0.0'],
  ['row-b', '1.0.0'],
  ['row-c', '1.0.0'],
  ['row-b', '2.0.0'],
  ['row-c', '2.0.0'],
  ['row-d', '1.0.0'],
]) {
  const pack = structuredClone(source);
  Object.assign(pack, { id, version, name: id });
  Object.assign(pack.campaigns[0], { id: `${id}-campaign`, title: `${id} campaign` });
  pack.campaigns[0].levels = [pack.campaigns[0].levels[0]];
  pack.campaigns[0].levels[0].id = `${id}-level`;
  pack.levelVisuals = [];
  prepared.set(`${id}@${version}`, (await preparePack(pack)).pack);
}
function packs(ids = ['row-a', 'row-b', 'row-c']) {
  return ids.reduce(
    (library, id) => installPack(library, prepared.get(id.includes('@') ? id : `${id}@1.0.0`)),
    emptyPackLibrary(),
  );
}
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function nativeDisable(element) {
  let disabled = element.disabled;
  Object.defineProperty(element, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && element.ownerDocument.activeElement === element) {
        element.blur();
        element.emit('blur', { bubbles: false, relatedTarget: null });
      }
    },
  });
}
function nativeDialogs(t) {
  const show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
  });
}
function action(element) {
  const handler = element.onclick;
  let result;
  element.onclick = function (...args) {
    return (result = handler.apply(this, args));
  };
  try {
    element.click();
  } finally {
    element.onclick = handler;
  }
  return Promise.resolve(result);
}
const rows = (h) => [...h.$('installed-packs').children];
const row = (h, id) => rows(h).find((item) => item.dataset.packId === id);
const control = (h, id, kind) =>
  row(h, id)?.children.find((item) => item.dataset.packAction === kind);
const packTab = (h) => h.doc.querySelector('[data-library-panel="packs"]');

async function seed(memory, library) {
  const db = await new Promise((resolve, reject) => {
    const request = memory.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put(exportPackLibrary(library), 'revealline.packs.dev.v1');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
async function fullHost(t, ids) {
  nativeDialogs(t);
  const memory = memoryIndexedDB(),
    gate = deferred();
  await seed(memory, packs(ids));
  let armed = false,
    entered = false,
    fail = false;
  const h = await soloPage(t, {
    titleScreen: true,
    assetIndexedDB: memory.indexedDB,
    lockManager: {
      request(name, options, callback) {
        const work = () => (callback ?? options)({ name });
        if (armed && name.endsWith('.backup-lock')) {
          armed = false;
          entered = true;
          return gate.promise.then(() => {
            if (fail) throw new Error('Held pack storage refused');
            return work();
          });
        }
        return Promise.resolve(work());
      },
    },
  });
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  h.$('shell-workshop').click();
  h.$('shell-library').click();
  packTab(h).click();
  assert.equal(h.$('library-dialog').open, true);
  assert.deepEqual(
    rows(h).map((item) => item.dataset.packId),
    ids ?? ['row-a', 'row-b', 'row-c'],
  );
  t.after(gate.resolve);
  const begin = async (id, failure = false) => {
    const opener = control(h, id, 'remove');
    nativeDisable(opener);
    opener.focus();
    armed = true;
    fail = failure;
    const operation = action(opener);
    await settle(() => entered);
    assert.equal(
      h.doc.activeElement === h.doc.body,
      true,
      'Disabling the actual opener moves focus to BODY',
    );
    assert.equal(opener.disabled, true);
    assert.equal(h.$('library-operation-cancel').textContent, 'Stop waiting');
    assert.equal(h.$('library-operation-cancel').hidden, false);
    return {
      opener,
      finish: async () => {
        gate.resolve();
        await operation;
        h.frame(0);
      },
    };
  };
  return { h, memory, begin };
}
function stableFlight(h) {
  const run = h.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  return () => {
    h.frame(0);
    assert.equal(h.rendered.run === run, true, 'The flight object remains the same');
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
    assert.equal(h.rendered.paused, true);
    assert.deepEqual(h.errors, []);
  };
}
for (const [ids, removed, next, kind] of [
  [['row-a', 'row-b', 'row-c'], 'row-b', 'row-c', 'play'],
  [['row-a', 'row-b'], 'row-b', 'row-a', 'play'],
  [['row-b'], 'row-b', null, null],
]) {
  test(`full Solo: removing ${removed} returns to ${next ?? 'Expansion packs'} after actual rows are rebuilt`, async (t) => {
    const { h, memory, begin } = await fullHost(t, ids),
      unchanged = stableFlight(h);
    const { opener, finish } = await begin(removed);
    await finish();
    assert.equal(opener.isConnected, false);
    assert.equal(row(h, removed), undefined);
    assert.equal(
      h.doc.activeElement === (next ? control(h, next, kind) : packTab(h)),
      true,
      'Resolve the expected current action',
    );
    assert.match(h.$('pack-status').textContent, /Pack removed/);
    const saved = JSON.parse(memory.contents().get('assets').get('revealline.packs.dev.v1'));
    assert.deepEqual(
      saved.packs.map((item) => item.id),
      ids.filter((id) => id !== removed),
    );
    unchanged();
  });
}
test('full Solo: rejected durable write recreates the same-version Remove and preserves its stored pack', async (t) => {
  const { h, memory, begin } = await fullHost(t),
    unchanged = stableFlight(h);
  const before = memory.contents().get('assets').get('revealline.packs.dev.v1');
  const { opener, finish } = await begin('row-b', true);
  await finish();
  assert.equal(opener.isConnected, false);
  assert.equal(row(h, 'row-b').dataset.packVersion, '1.0.0');
  assert.equal(
    h.doc.activeElement === control(h, 'row-b', 'remove'),
    true,
    'Restore the rebuilt same-version Remove',
  );
  assert.match(h.$('pack-status').textContent, /Held pack storage refused/);
  assert.equal(memory.contents().get('assets').get('revealline.packs.dev.v1'), before);
  unchanged();
});
for (const interruption of [
  'foreign-focus',
  'blur-return',
  'hidden-return',
  'close-reopen',
  'new-dialog',
  'stop-waiting',
]) {
  test(`full Solo: pending durable Remove does not take focus after ${interruption}`, async (t) => {
    const { h, begin } = await fullHost(t),
      unchanged = stableFlight(h);
    const { finish } = await begin('row-b');
    const root = h.$('library-dialog');
    if (interruption === 'foreign-focus') {
      root.querySelector('[data-close]').focus();
      h.doc.activeElement.blur();
    } else if (interruption === 'blur-return') {
      h.win.emit('blur');
      h.win.emit('focus');
    } else if (interruption === 'hidden-return') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    } else if (interruption === 'close-reopen') {
      root.close();
      root.showModal();
    } else if (interruption === 'new-dialog') {
      h.$('help-dialog').showModal();
      h.$('help-dialog').close();
    } else {
      const stop = h.$('library-operation-cancel');
      stop.focus();
      stop.click();
      assert.match(h.$('pack-status').textContent, /still finishing/);
      assert.equal(
        control(h, 'row-a', 'remove').disabled,
        true,
        'Stop waiting does not unlock a durable mutation',
      );
    }
    const survivingClose = root.querySelector('[data-close]');
    const closeHadFocus = h.doc.activeElement === survivingClose;
    await finish();
    const rowTargets = rows(h).flatMap((item) =>
      item.children.filter((child) => ['play', 'remove'].includes(child.dataset.packAction)),
    );
    assert.equal(
      [...rowTargets, packTab(h)].includes(h.doc.activeElement),
      false,
      'Neither a recreated row nor the Packs fallback may steal focus after newer intent',
    );
    if (closeHadFocus) assert.equal(h.doc.activeElement === survivingClose, true);
    if (interruption === 'foreign-focus') assert.equal(h.doc.activeElement === h.doc.body, true);
    assert.equal(
      row(h, 'row-b'),
      undefined,
      'Durable Remove still finishes; Stop waiting is not deletion cancellation',
    );
    assert.match(
      h.$('pack-status').textContent,
      ['blur-return', 'hidden-return'].includes(interruption)
        ? /Pack selection was replaced by a newer action/
        : /Pack removed/,
    );
    unchanged();
  });
}

// Panel-only adversarial model changes use actual markup and the production
// Library presenter. They do not invent a concurrent full-app writer pathway.
async function panelHost(t) {
  nativeDialogs(t);
  const doc = new Document(),
    win = new Events();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  doc.documentElement = doc.createElement('html');
  doc.documentElement.parentNode = doc;
  doc.children = [doc.documentElement];
  doc.body = doc.createElement('body');
  doc.documentElement.append(doc.body);
  doc.activeElement = doc.body;
  doc.parentNode = win;
  doc.defaultView = win;
  const stack = [doc.body],
    html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const token of html
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!text.startsWith('<')) {
      stack.at(-1)._text += text.trim();
      continue;
    }
    const tag = text.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of text
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (name.startsWith('data-'))
        node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    fetch: async () => ({ json: async () => ({ packs: [] }) }),
  })) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() =>
      before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key],
    );
  }
  const state = {
    packs: packs(),
    library: emptyLibrary(),
    presets: await read('../../authoring/motion-lab/presets.json'),
  };
  const gate = deferred();
  let result = null,
    failure = null;
  const api = {
    get: () => state,
    pause() {},
    saved: () => null,
    attemptExportSource: () => ({ source: null, label: 'No attempt', reason: 'Panel fixture' }),
    catalog: () => [],
    base: () => ({ campaign: source.campaigns[0], classRecipes: source.classRecipes }),
    async setPacks(next) {
      await gate.promise;
      state.packs = result ?? next;
      if (failure) throw new Error(failure);
    },
  };
  const panel = attachLibraryPanel(api),
    h = { doc, win, $: (id) => doc.getElementById(id) };
  panel.open('packs');
  const opener = control(h, 'row-b', 'remove');
  nativeDisable(opener);
  opener.focus();
  const operation = action(opener);
  assert.equal(opener.disabled, true);
  t.after(gate.resolve);
  return {
    h,
    panel,
    state,
    opener,
    finish: async (next, error = null) => {
      result = next;
      failure = error;
      gate.resolve();
      await operation;
    },
  };
}
for (const [name, next, target] of [
  ['same ID newer version', ['row-a', 'row-b@2.0.0', 'row-c'], null],
  ['next captured row disappeared', ['row-a'], 'row-a'],
  ['next changed version and previous disappeared', ['row-c@2.0.0'], null],
  ['new unrelated row cannot replace captured neighbors', ['row-d'], null],
]) {
  test(`Library panel model: ${name} uses only a valid captured neighbor or Packs tab`, async (t) => {
    const { h, opener, finish } = await panelHost(t);
    await finish(packs(next));
    assert.equal(opener.isConnected, false);
    assert.equal(
      h.doc.activeElement === (target ? control(h, target, 'play') : packTab(h)),
      true,
      'Use only the current permitted logical action',
    );
  });
}
test('Library panel model: a section change while finishing vetoes a recreated row target', async (t) => {
  const { h, panel, finish } = await panelHost(t);
  panel.open('scores');
  // Other task controls remain disabled. The visible Close action stays usable.
  const close = h.$('library-dialog').querySelector('[data-close]');
  close.focus();
  await finish(packs(['row-a', 'row-c']));
  assert.equal(h.doc.activeElement === close, true);
  assert.equal(h.$('library-packs').hidden, true);
});
test('Library panel model: a changed model followed by rejection resolves from the actual surviving rows', async (t) => {
  const { h, opener, finish } = await panelHost(t);
  await finish(packs(['row-a', 'row-c']), 'Removal committed before reconciliation refused');
  assert.equal(opener.isConnected, false);
  assert.equal(row(h, 'row-b'), undefined);
  assert.equal(h.doc.activeElement === control(h, 'row-c', 'play'), true);
  assert.match(h.$('pack-status').textContent, /Removal committed before reconciliation refused/);
});
for (const decision of [
  'foreign-root',
  'disconnected',
  'hidden',
  'throws',
  'focus-then-body',
  'blur-return',
  'recursive-restore',
]) {
  test(`logical helper: resolved ${decision} cannot bypass final ownership checks`, async (t) => {
    const { h, finish } = await panelHost(t);
    await finish(packs());
    const opener = control(h, 'row-b', 'remove'),
      target = control(h, 'row-c', 'play');
    opener.focus();
    let lease,
      nested = false;
    lease = captureOperationFocus(opener, {
      resolveTarget() {
        if (decision === 'foreign-root') return h.$('shell-featured');
        if (decision === 'disconnected') target.remove();
        if (decision === 'hidden') target.hidden = true;
        if (decision === 'throws') throw new Error('Resolver refused');
        if (decision === 'focus-then-body') {
          packTab(h).focus();
          packTab(h).blur();
        }
        if (decision === 'blur-return') {
          h.win.emit('blur');
          h.win.emit('focus');
        }
        if (decision === 'recursive-restore' && !nested) {
          nested = true;
          lease.cancel();
          lease.restore();
        }
        return target;
      },
    });
    opener.blur();
    assert.equal(lease.restore(), false);
    assert.equal(h.doc.activeElement === target, false);
  });
}
