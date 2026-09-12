import test from 'node:test';
import assert from 'node:assert/strict';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { campaignKey, emptyLibrary } from '../library.mjs';

// A DOM lifecycle adapter: removing cards really detaches them, and focusing a
// stale or disabled node fails. Painting and browser image decoding are separate.
class Element {
  constructor(owner, tagName = 'div', connected = false) {
    this.owner = owner;
    this.tagName = tagName;
    this.rootConnected = connected;
    this.parent = null;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.hidden = false;
    this.open = false;
  }
  get isConnected() {
    return this.rootConnected || !!this.parent?.isConnected;
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }
  setAttribute() {}
  getContext() {
    return {};
  }
  querySelectorAll(selector) {
    const names = selector.split(',');
    return this.children.flatMap((child) => [
      ...(names.includes(child.tagName) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  emit(type) {
    const event = {
      type,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const fn of this.listeners.get(type) || []) fn(event);
    return event;
  }
  focus() {
    assert.equal(this.isConnected, true, 'focus must target a current DOM node');
    assert.equal(this.disabled || this.hidden, false, 'focus must target an enabled visible node');
    this.owner.activeElement = this;
  }
  showModal() {
    assert.equal(this.open, false, 'an already open dialog must not be reopened');
    this.open = true;
    this.owner.activeElement = this;
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.owner.activeElement = null;
    this.emit('close');
  }
  requestClose() {
    const event = this.emit('cancel');
    if (!event.defaultPrevented) this.close();
    return event;
  }
}

async function setup(t, count = 30) {
  const prior = new Map(
    ['document', 'fetch', 'Image', 'cancelAnimationFrame'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const document = { activeElement: null },
    nodes = new Map();
  document.getElementById = (id) => {
    if (!nodes.has(id))
      nodes.set(
        id,
        new Element(document, id.endsWith('search') || id.endsWith('json') ? 'input' : 'div', true),
      );
    return nodes.get(id);
  };
  document.createElement = (tag) => new Element(document, tag);
  document.querySelectorAll = () => [];
  const node = document.getElementById;
  node('collection-dialog').append(
    node('gallery-search'),
    node('gallery-grid'),
    node('gallery-pages'),
  );
  const decodeJobs = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => ({ ok: true, json: async () => ({ packs: [] }) }),
  });
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      decode() {
        return new Promise((resolve) => decodeJobs.push(resolve));
      }
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value() {} });
  const paints = [];
  t.mock.method(BoardPainter.prototype, 'drawGallery', (_context, args) => paints.push(args));
  const levels = Array.from({ length: count }, (_, index) => ({
    version: 'xonix-level.v1',
    id: `picture-${index}`,
    revision: '1',
    name: `Picture ${String(index).padStart(2, '0')}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    walls: [],
    enemies: [],
    objectives: [],
    supplies: [],
    goal: { coverage: 0.5 },
  }));
  const entry = {
    campaign: { id: 'gallery-test', revision: '1', levels },
    themes: [{ id: 'fpv', name: 'FPV Front' }],
    visualOverrides: {},
  };
  let catalog = [entry],
    library = emptyLibrary();
  library.gallery = levels.map((level, index) => ({
    key: `picture-key-${index}`,
    campaignKey: campaignKey(entry.campaign),
    levelId: level.id,
    levelName: level.name,
    themeId: 'fpv',
    medal: 'gold',
    score: 100,
    seed: 17,
  }));
  const selections = [],
    api = attachLibraryPanel({
      get: () => ({ library, packs: { packs: [] }, presets: {} }),
      catalog: () => catalog,
      base: () => entry,
      pause() {},
      saved: () => null,
      select: (...args) => selections.push(args),
      focusMission: () => node('mission-start').focus(),
    });
  await Promise.resolve();
  await Promise.resolve();
  t.after(() => {
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    api,
    node,
    document,
    entry,
    selections,
    paints,
    decodeJobs,
    get library() {
      return library;
    },
    setLibrary: (next) => (library = next),
    setCatalog: (next) => (catalog = next),
    cards: () => node('gallery-grid').children,
    collection() {
      api.populateGallery();
      node('collection-dialog').showModal();
    },
    search(value) {
      node('gallery-search').value = value;
      node('gallery-search').oninput();
    },
    next: () => node('gallery-pages').children[2].onclick(),
  };
}

test('Back restores the same stable picture on its page and preserves the original filter', async (t) => {
  const h = await setup(t);
  h.collection();
  h.search('  Picture  ');
  h.next();
  const original = h.cards()[4];
  original.focus();
  await original.onclick();
  assert.equal(h.node('gallery-view-dialog').open, true);
  h.node('gallery-search').value = 'changed while viewing';
  h.node('gallery-view-dialog').close();
  const restored = h.cards()[4];
  assert.notEqual(restored, original);
  assert.equal(original.isConnected, false);
  assert.equal(restored.children[1].textContent, 'Picture 16');
  assert.equal(h.document.activeElement, restored);
  assert.equal(h.node('gallery-search').value, '  Picture  ');
  assert.match(h.node('gallery-pages').children[1].textContent, /page 2 of 3/);
});

test('native cancel follows the same picture return path and does not clear collection context', async (t) => {
  const h = await setup(t);
  h.collection();
  h.search('Picture 2');
  await h.cards()[3].onclick();
  const event = h.node('gallery-view-dialog').requestClose();
  assert.equal(event.defaultPrevented, false);
  assert.equal(h.node('collection-dialog').open, true);
  assert.equal(h.document.activeElement.children[1].textContent, 'Picture 23');
  assert.equal(h.node('gallery-search').value, 'Picture 2');
});

test('a reordered collection resolves the stable picture key rather than the old card index', async (t) => {
  const h = await setup(t);
  h.collection();
  await h.cards()[7].onclick();
  const [moved] = h.library.gallery.splice(7, 1);
  h.library.gallery.splice(1, 0, moved);
  h.node('gallery-view-dialog').close();
  assert.equal(h.document.activeElement, h.cards()[1]);
  assert.equal(h.document.activeElement.children[1].textContent, 'Picture 07');
});

test('a removed picture clamps the page and focuses a remaining enabled card', async (t) => {
  const h = await setup(t);
  h.collection();
  h.next();
  h.next();
  await h.cards()[5].onclick();
  h.library.gallery.splice(12);
  h.node('gallery-view-dialog').close();
  assert.match(h.node('gallery-pages').children[1].textContent, /page 1 of 1/);
  assert.equal(h.document.activeElement, h.cards()[0]);
  assert.equal(h.document.activeElement.disabled, false);
});

test('a missing pack or empty filtered collection falls back to the enabled search field', async (t) => {
  const h = await setup(t);
  h.collection();
  await h.cards()[2].onclick();
  h.setCatalog([]);
  h.node('gallery-view-dialog').close();
  assert.equal(
    h.cards().every((card) => card.disabled),
    true,
  );
  assert.equal(h.document.activeElement, h.node('gallery-search'));
  h.setCatalog([h.entry]);
  h.api.populateGallery();
  await h.cards()[2].onclick();
  h.library.gallery.length = 0;
  h.node('gallery-view-dialog').close();
  assert.equal(h.cards().length, 0);
  assert.equal(h.document.activeElement, h.node('gallery-search'));
});

test('Replay leaves the collection closed and preserves the host mission focus', async (t) => {
  const h = await setup(t);
  h.collection();
  await h.cards()[3].onclick();
  h.node('gallery-replay').onclick();
  assert.equal(h.node('gallery-view-dialog').open, false);
  assert.equal(h.node('collection-dialog').open, false);
  assert.equal(h.document.activeElement, h.node('mission-start'));
  assert.deepEqual(h.selections[0], [h.entry, { levelId: 'picture-3', themeId: 'fpv', seed: 17 }]);
});

test('late decoding and a queued old close cannot steal focus from a new picture', async (t) => {
  const h = await setup(t, 3);
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'cover' };
  h.collection();
  const first = h.cards()[0].onclick();
  h.node('gallery-view-dialog').close();
  const second = h.cards()[1].onclick();
  h.node('gallery-replay').focus();
  h.node('gallery-view-dialog').emit('close');
  assert.equal(h.node('collection-dialog').open, false);
  for (const resolve of h.decodeJobs) resolve();
  await Promise.all([first, second]);
  assert.equal(h.document.activeElement, h.node('gallery-replay'));
  h.node('gallery-view-dialog').close();
  assert.equal(h.document.activeElement.children[1].textContent, 'Picture 01');
});

test('busy library import still prevents cancel until its guarded task finishes', async (t) => {
  const h = await setup(t, 1);
  h.setLibrary(emptyLibrary());
  h.api.open('saves');
  let finish;
  h.node('save-file').files = [
    { size: 1, text: () => new Promise((resolve) => (finish = resolve)) },
  ];
  const job = h.node('save-file').onchange();
  assert.equal(h.node('library-dialog').requestClose().defaultPrevented, true);
  assert.equal(h.node('library-dialog').open, true);
  finish('invalid json');
  await job;
  assert.equal(h.node('library-dialog').requestClose().defaultPrevented, false);
  assert.equal(h.node('library-dialog').open, false);
});
