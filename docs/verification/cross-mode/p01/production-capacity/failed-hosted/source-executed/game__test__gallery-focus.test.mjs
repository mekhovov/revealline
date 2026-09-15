import { Element as DOMElement } from './helpers/couch-dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { campaignKey, emptyLibrary, recordLibraryCompletion } from '../library.mjs';
import { createRun, CLASSES, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { STEADY_SIGNAL, masteryDefinitionIdentity } from '../mastery.mjs';

// A DOM lifecycle adapter: removing cards really detaches them, and focusing a
// stale or disabled node fails. Painting and browser image decoding are separate.
class Element extends DOMElement {
  constructor(owner, tagName = 'div', connected = false) {
    super(owner, tagName);
    this.owner = owner;
    this.tagName = tagName;
    this.rootConnected = connected;
    this.parent = null;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.value = '';
    this.textContent = '';
    this.disabled = false;
    this.hidden = false;
    this.open = false;
  }
  get isConnected() {
    return this.rootConnected || !!this.parent?.isConnected;
  }
  get parentNode() {
    return this.parent;
  }
  set parentNode(value) {
    this.parent = value;
  }
  append(...children) {
    for (const child of children) {
      child.remove();
      child.rootConnected = false;
      child.parent = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getContext() {
    return {
      drawImage: (...args) => {
        (this.copies ??= []).push(args);
      },
    };
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

async function setup(t, count = 30, hostOverrides = {}) {
  const prior = new Map(
    ['document', 'fetch', 'Image', 'cancelAnimationFrame', 'requestAnimationFrame'].map((key) => [
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
  // Library feedback moves existing nodes; retain their actual parent/sibling
  // relationships instead of supplying permanently detached status elements.
  node('library-dialog').append(node('library-operation-rail'), node('library-saves'));
  node('library-operation-rail').append(
    node('library-operation-message'),
    node('library-operation-controls'),
  );
  node('library-operation-controls').append(node('library-operation-cancel'));
  node('library-operation-rail').hidden = true;
  node('library-saves').append(node('save-status'), node('cancel-attempt-export'));
  node('collection-dialog').append(
    node('gallery-search'),
    node('gallery-grid'),
    node('gallery-pages'),
  );
  const closeButton = new Element(document, 'button');
  closeButton.setAttribute('aria-label', 'Close picture');
  node('gallery-view-dialog').append(closeButton, node('gallery-view-masteries'));
  node('gallery-canvas').width = 768;
  node('gallery-canvas').height = 576;
  const decodeJobs = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => ({ ok: true, json: async () => ({ packs: [] }) }),
  });
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      width = 1;
      height = 1;
      naturalWidth = 1;
      naturalHeight = 1;
      set src(value) {
        this.source = value;
        if (this.onload) queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this.source;
      }
      removeAttribute(name) {
        if (name === 'src') this.released = true;
      }
      decode() {
        return new Promise((resolve, reject) =>
          decodeJobs.push(Object.assign(resolve, { reject, src: this.src, image: this })),
        );
      }
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value() {} });
  const frames = [];
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback) => frames.push(callback),
  });
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
    campaign: { version: 'xonix-campaign.v1', id: 'gallery-test', revision: '1', levels },
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
      get: () => ({ library, packs: { format: 'xonix-pack-library.v1', packs: [] }, presets: {} }),
      catalog: () => catalog,
      base: () => entry,
      pause() {},
      saved: () => null,
      attemptExportSource: () => ({
        source: null,
        label: 'Export saved attempt',
        reason: 'No saved attempt.',
      }),
      select: (...args) => selections.push(args),
      focusMission: () => node('mission-start').focus(),
      ...hostOverrides,
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
    frames,
    decodeJobs,
    closeButton,
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

for (const count of [0, 12, 13])
  test(`Collection shows pagination only when ${count} pictures need a second page`, async (t) => {
    const h = await setup(t, count);
    h.collection();
    const nav = h.node('gallery-pages');
    assert.equal(nav.hidden, count <= 12);
    assert.equal(nav.children.length, count <= 12 ? 0 : 3);
    if (count > 12) {
      h.next();
      assert.equal(h.cards().length, 1);
      assert.match(nav.children[1].textContent, /page 2 of 2/);
    }
  });

for (const pagerFocused of [false, true])
  test(`Filtering to one page ${pagerFocused ? 'restores removed pager focus to search' : 'preserves unrelated focus'}`, async (t) => {
    const h = await setup(t);
    h.collection();
    const target = pagerFocused
      ? h.node('gallery-pages').children[2]
      : h.node('collection-records');
    target.focus();
    h.search('Picture 00');
    assert.equal(h.node('gallery-pages').hidden, true);
    assert.equal(h.node('gallery-pages').children.length, 0);
    assert.ok(h.document.activeElement === (pagerFocused ? h.node('gallery-search') : target));
    assert.equal(h.cards().length, 1);
  });

test('wide and legacy pictures adopt their own bitmap ratio for cards, full view and celebration without changing records', async (t) => {
  const h = await setup(t, 1);
  const wideLevel = {
    ...structuredClone(h.entry.campaign.levels[0]),
    id: 'wide-picture',
    name: 'Wide picture',
    version: 'xonix-level.v3',
    width: 72,
    encounter: null,
  };
  const wideEntry = {
    ...h.entry,
    campaign: { ...h.entry.campaign, id: 'wide-gallery', levels: [wideLevel] },
    classRecipes: CLASSES,
  };
  h.setCatalog([h.entry, wideEntry]);
  const record = {
    ...h.library.gallery[0],
    key: 'wide-key',
    campaignKey: campaignKey(wideEntry.campaign),
    levelId: wideLevel.id,
    levelName: wideLevel.name,
  };
  h.setLibrary({ ...h.library, gallery: [...h.library.gallery, record] });
  const before = structuredClone(h.library);
  h.collection();
  const wideCard = h.cards().find((card) => card.children[1].textContent === 'Wide picture');
  assert.equal(wideCard.children[0].width, 320);
  assert.equal(wideCard.children[0].height, 160);
  await wideCard.onclick();
  assert.equal(h.node('gallery-canvas').width, 1152);
  assert.equal(h.node('gallery-canvas').height, 576);
  assert.equal(h.node('gallery-canvas').style.aspectRatio, '1152 / 576');
  assert.equal(h.paints.at(-1).width, 1152);
  const draws = [];
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {});
  t.mock.method(BoardPainter.prototype, 'startCelebration', () => {});
  t.mock.method(BoardPainter.prototype, 'draw', (_ctx, run) =>
    draws.push({ width: run.width, bitmap: h.node('gallery-canvas').width }),
  );
  await h.node('gallery-animate').onclick();
  h.frames.at(-1)(100);
  assert.deepEqual(draws, [{ width: 72, bitmap: 1152 }]);
  h.node('gallery-view-dialog').close();
  const oldCard = h.cards().find((card) => card.children[1].textContent === 'Picture 00');
  assert.equal(oldCard.children[0].width, 320);
  assert.equal(oldCard.children[0].height, 240);
  await oldCard.onclick();
  assert.equal(h.node('gallery-canvas').width, 768);
  assert.equal(h.node('gallery-canvas').height, 576);
  assert.equal(h.node('gallery-canvas').style.aspectRatio, '768 / 576');
  assert.equal(h.paints.at(-1).width, 768);
  assert.deepEqual(h.library, before);
});

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
  assert.equal(h.node('gallery-pages').hidden, true);
  assert.equal(h.node('gallery-pages').children.length, 0);
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

test('the underlying Collection cannot replace its open child picture', async (t) => {
  const h = await setup(t, 2);
  h.collection();
  await h.cards()[0].onclick();
  const title = h.node('gallery-view-title').textContent,
    paints = h.paints.length;
  h.closeButton.focus();
  await h.cards()[1].onclick();
  assert.equal(h.node('gallery-view-title').textContent, title);
  assert.equal(h.node('gallery-view-dialog').open, true);
  assert.equal(h.node('collection-dialog').open, true);
  assert.equal(h.document.activeElement, h.closeButton);
  assert.equal(h.paints.length, paints);
});

test('Replay leaves the collection closed and preserves the host mission focus', async (t) => {
  const h = await setup(t);
  h.collection();
  await h.cards()[3].onclick();
  h.node('gallery-replay').onclick();
  assert.equal(h.node('gallery-view-dialog').open, false);
  assert.equal(h.node('collection-dialog').open, false);
  assert.equal(h.document.activeElement, h.node('mission-start'));
  assert.deepEqual(h.selections[0], [
    h.entry,
    { levelId: 'picture-3', themeId: 'fpv', seed: 17, difficulty: 'standard' },
  ]);
});

test('late decoding and a queued old close cannot steal focus from a new picture', async (t) => {
  const h = await setup(t, 3);
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'cover' };
  h.collection();
  const first = h.cards()[0].onclick();
  h.node('gallery-view-dialog').close();
  const second = h.cards()[1].onclick();
  h.closeButton.focus();
  h.node('gallery-view-dialog').emit('close');
  assert.equal(h.node('collection-dialog').open, true);
  for (const resolve of h.decodeJobs) resolve();
  await Promise.all([first, second]);
  assert.equal(h.document.activeElement, h.closeButton);
  h.node('gallery-view-dialog').close();
  assert.equal(h.document.activeElement.children[1].textContent, 'Picture 01');
});

test('a new picture hides the previous artwork and blocks actions until its own decode completes', async (t) => {
  const h = await setup(t, 2);
  h.collection();
  await h.cards()[0].onclick();
  const canvas = h.node('gallery-canvas'),
    previous = structuredClone(h.library),
    fullPaints = () => h.paints.filter((paint) => paint.width === 768);
  assert.equal(fullPaints().at(-1).level.id, 'picture-0');
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'contain' };
  h.node('gallery-view-dialog').close();
  const loading = h.cards()[1].onclick();
  assert.equal(h.node('gallery-view-title').textContent, 'Picture 01');
  assert.equal(canvas.style.visibility, 'hidden');
  assert.equal(canvas.hidden, false, 'Keep the canvas layout box while its pixels are hidden.');
  assert.equal(canvas.width, 768);
  assert.equal(canvas.height, 576);
  assert.equal(canvas.attributes.get('aria-hidden'), 'true');
  assert.equal(h.node('gallery-canvas').attributes.get('aria-busy'), 'true');
  assert.equal(
    h.node('gallery-view-dialog').attributes.has('aria-busy'),
    false,
    'The live status stays outside the busy canvas.',
  );
  assert.equal(h.node('gallery-view-meta').children[1].attributes.get('role'), 'status');
  assert.match(
    h.node('gallery-view-meta').textContent,
    /FPV Front · Standard · Best picture score: 100 points · GOLD.*Decoding the exact picture artwork/,
  );
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.equal(h.node('gallery-animate').disabled, true);
  h.node('gallery-replay').onclick();
  await h.node('gallery-animate').onclick();
  assert.equal(h.selections.length, 0, 'Synthetic activation cannot bypass the loading gate.');
  assert.equal(h.node('gallery-view-dialog').open, true);
  assert.equal(fullPaints().length, 1, 'The previous drawing must not be advertised as ready.');
  h.decodeJobs.at(-1)();
  await loading;
  assert.equal(fullPaints().at(-1).level.id, 'picture-1');
  assert.equal(canvas.style.visibility, '');
  assert.equal(canvas.attributes.get('aria-hidden'), 'false');
  assert.equal(h.node('gallery-canvas').attributes.get('aria-busy'), 'false');
  assert.equal(
    h.node('gallery-view-meta').textContent,
    'FPV Front · Standard · Best picture score: 100 points · GOLD',
  );
  assert.equal(h.node('gallery-replay').disabled, false);
  assert.equal(h.node('gallery-animate').disabled, false);
  assert.deepEqual(h.library, previous);
});

test('an older decode completing during rapid navigation cannot reveal or enable the newer pending picture', async (t) => {
  const h = await setup(t, 2);
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'contain' };
  h.collection();
  const first = h.cards()[0].onclick(),
    finishFirst = h.decodeJobs.at(-1);
  h.node('gallery-view-dialog').requestClose();
  assert.equal(h.node('collection-dialog').open, true, 'Close remains available while loading.');
  const second = h.cards()[1].onclick(),
    finishSecond = h.decodeJobs.at(-1);
  finishFirst();
  await first;
  assert.equal(h.node('gallery-view-title').textContent, 'Picture 01');
  assert.equal(h.node('gallery-canvas').style.visibility, 'hidden');
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.equal(h.node('gallery-canvas').attributes.get('aria-busy'), 'true');
  assert.equal(h.paints.filter((paint) => paint.width === 768).length, 0);
  finishSecond();
  await second;
  assert.deepEqual(
    h.paints.filter((paint) => paint.width === 768).map((paint) => paint.level.id),
    ['picture-1'],
  );
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  assert.equal(h.node('gallery-replay').disabled, false);
});

test('an older rejected decode cannot replace the selected ready picture with an error', async (t) => {
  const h = await setup(t, 2);
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'contain' };
  h.collection();
  const first = h.cards()[0].onclick(),
    failFirst = h.decodeJobs.at(-1).reject;
  h.node('gallery-view-dialog').close();
  const second = h.cards()[1].onclick();
  h.decodeJobs.at(-1)();
  await second;
  failFirst(new Error('Stale first decode failed'));
  await first;
  assert.equal(h.node('gallery-view-title').textContent, 'Picture 01');
  assert.equal(
    h.node('gallery-view-meta').textContent,
    'FPV Front · Standard · Best picture score: 100 points · GOLD',
  );
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  assert.equal(h.node('gallery-animate').disabled, false);
  assert.equal(h.node('gallery-replay').disabled, false);
});

test('a failed selected decode keeps stale pixels hidden and can be closed and retried', async (t) => {
  const h = await setup(t, 2);
  h.collection();
  await h.cards()[0].onclick();
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'contain' };
  h.node('gallery-view-dialog').close();
  const loading = h.cards()[1].onclick();
  h.decodeJobs.at(-1).reject(new Error('Selected image decode failed'));
  await loading;
  assert.equal(h.node('gallery-canvas').style.visibility, 'hidden');
  assert.equal(h.node('gallery-canvas').attributes.get('aria-busy'), 'false');
  assert.match(h.node('gallery-view-meta').textContent, /Picture could not load.*Selected image/);
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.equal(h.node('gallery-animate').disabled, true);
  h.node('gallery-view-dialog').requestClose();
  assert.equal(h.document.activeElement, h.cards()[1]);
  const retry = h.cards()[1].onclick();
  h.decodeJobs.at(-1)();
  await retry;
  assert.equal(
    h.node('gallery-view-meta').textContent,
    'FPV Front · Standard · Best picture score: 100 points · GOLD',
  );
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  assert.equal(h.node('gallery-replay').disabled, false);
});

test('a rejected celebration preparation preserves the ready picture and reports failure without an unhandled promise', async (t) => {
  const h = await setup(t, 1);
  h.entry.classRecipes = CLASSES;
  h.collection();
  await h.cards()[0].onclick();
  let attempts = 0;
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {
    if (++attempts === 1) throw new Error('Celebration asset load failed');
  });
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {});
  t.mock.method(BoardPainter.prototype, 'startCelebration', () => {});
  const paints = h.paints.length;
  await h.node('gallery-animate').onclick();
  assert.equal(h.paints.length, paints);
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  assert.equal(h.node('gallery-replay').disabled, false);
  assert.equal(h.node('gallery-animate').disabled, false);
  assert.match(h.node('gallery-view-meta').textContent, /Celebration could not start/);
  assert.equal(h.frames.length, 0);
  await h.node('gallery-animate').onclick();
  assert.equal(attempts, 2);
  assert.equal(h.frames.length, 1, 'A successful retry can start the celebration.');
  assert.equal(
    h.node('gallery-view-meta').textContent,
    'FPV Front · Standard · Best picture score: 100 points · GOLD',
  );
  h.node('gallery-replay').onclick();
  assert.equal(h.selections[0][1].levelId, 'picture-0');
});

test('a failed illustration reload cannot start a procedural celebration over the ready authored picture', async (t) => {
  const h = await setup(t, 1);
  h.entry.visualOverrides.background = { dataUrl: 'data:image/png;base64,AA==', fit: 'contain' };
  h.collection();
  const loading = h.cards()[0].onclick();
  h.decodeJobs.at(-1)();
  await loading;
  t.mock.method(BoardPainter.prototype, 'setLook', async function () {
    // The renderer settles individual asset failures and leaves no background image.
    this.images = {};
  });
  const paints = h.paints.length;
  await h.node('gallery-animate').onclick();
  assert.equal(h.paints.length, paints);
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  assert.equal(h.node('gallery-replay').disabled, false);
  assert.match(h.node('gallery-view-meta').textContent, /Celebration could not start/);
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

test('profile replacement cancels pending writes before its Undo snapshot and restores the prior profile', async (t) => {
  const order = [];
  let pendingWrite = true,
    h;
  h = await setup(t, 1, {
    beforeProfileReplacement() {
      order.push('boundary');
      pendingWrite = false;
    },
    canSnapshotBackup: () => true,
    currentSession() {
      // backupContents is the point where the previous profile is captured.
      // A later cancellation could omit a just-earned seal from Undo.
      assert.equal(pendingWrite, false, 'cancel pending profile writes before taking the snapshot');
      order.push('snapshot');
      return null;
    },
    async applyBackup(prepared) {
      order.push('apply');
      h.setLibrary(prepared.library);
      return { ok: true };
    },
  });
  const previous = emptyLibrary();
  previous.preferences.musicEnabled = false;
  h.setLibrary(previous);
  h.api.open('saves');
  const incoming = {
    format: 'xonix-backup.v1',
    library: emptyLibrary(),
    packs: { format: 'xonix-pack-library.v1', packs: [] },
    session: null,
  };
  incoming.library.preferences.musicEnabled = true;
  h.node('save-json').value = JSON.stringify(incoming);
  await h.node('import-save').onclick();
  assert.deepEqual(order, ['boundary', 'snapshot', 'apply']);
  assert.equal(h.library.preferences.musicEnabled, true);
  assert.match(h.node('save-status').textContent, /Game data restored/);
  assert.equal(h.node('undo-backup').disabled, false);
  await h.node('undo-backup').onclick();
  assert.deepEqual(order, ['boundary', 'snapshot', 'apply', 'apply']);
  assert.deepEqual(
    h.library,
    previous,
    'Undo returns the full profile captured after cancellation',
  );
  assert.equal(h.node('undo-backup').disabled, true);
});

test('a rejected replacement boundary preserves the active profile without taking an Undo snapshot', async (t) => {
  let snapshots = 0,
    applications = 0;
  const h = await setup(t, 1, {
    beforeProfileReplacement() {
      throw new Error('Profile replacement is temporarily unavailable.');
    },
    canSnapshotBackup: () => true,
    currentSession() {
      snapshots++;
      return null;
    },
    async applyBackup() {
      applications++;
      return { ok: true };
    },
  });
  const previous = emptyLibrary();
  previous.preferences.musicEnabled = false;
  h.setLibrary(previous);
  h.api.open('saves');
  h.node('save-json').value = JSON.stringify({
    format: 'xonix-backup.v1',
    library: emptyLibrary(),
    packs: { format: 'xonix-pack-library.v1', packs: [] },
    session: null,
  });
  await h.node('import-save').onclick();
  assert.equal(snapshots, 0);
  assert.equal(applications, 0);
  assert.deepEqual(h.library, previous);
  assert.equal(h.node('undo-backup').disabled, true);
  assert.match(h.node('save-status').textContent, /temporarily unavailable/);
});

let homewardPack;
async function homewardCollection(t) {
  homewardPack ??= JSON.parse(
    await readFile(new URL('../content/packs/homeward-skies.json', import.meta.url), 'utf8'),
  );
  const h = await setup(t, 1);
  const entry = {
    campaign: { ...homewardPack.campaigns[0], classRecipes: homewardPack.classRecipes },
    classRecipes: homewardPack.classRecipes,
    themes: [{ id: 'fpv', name: 'FPV Front' }],
    visualOverrides: {},
  };
  const level = entry.campaign.levels[0],
    key = campaignKey(entry.campaign);
  const library = emptyLibrary();
  library.gallery = [
    {
      key: 'homeward-picture',
      campaignKey: key,
      levelId: level.id,
      levelName: level.name,
      themeId: 'fpv',
      medal: 'gold',
      score: 100,
      seed: 1,
    },
  ];
  h.setLibrary(library);
  h.setCatalog([entry]);
  h.collection();
  const state = createRun(level, { seed: 1, classId: 'fiber', classRecipes: entry.classRecipes });
  // Local imported-record presentation fixture, not a newly awarded result.
  const seal = {
    format: 'xonix-mastery-record.v1',
    campaignKey: key,
    levelId: level.id,
    levelRevision: level.revision,
    levelIdentity: `level-v1-${dataIdentity(state.level)}`,
    definitionId: STEADY_SIGNAL.id,
    definitionRevision: STEADY_SIGNAL.revision,
    definitionHash: masteryDefinitionIdentity(STEADY_SIGNAL),
    setup: {
      ruleset: state.ruleset,
      seed: state.seed,
      turnPolicy: state.turnPolicy,
      classId: state.classId,
      classRevision: state.classRevision,
      loadoutHash: state.loadoutHash,
      rosterHash: state.rosterHash,
      classHistory: state.classHistory,
    },
    runId: 'gallery-local-metadata',
    earnedAt: '2026-09-12T12:00:00.000Z',
  };
  return { ...h, seal, homewardEntry: entry };
}

test('a late seal updates an existing focused collection card without repaint or replacement', async (t) => {
  const h = await homewardCollection(t);
  const card = h.cards()[0],
    slot = card.children[3],
    canvas = card.children[0];
  card.focus();
  const paints = h.paints.length;
  assert.equal(slot.hidden, true);
  h.library.masteries.push(h.seal);
  h.api.refreshMasteries();
  assert.equal(h.cards()[0], card);
  assert.equal(card.children[0], canvas);
  assert.equal(card.children[3], slot);
  assert.equal(slot.hidden, false);
  assert.equal(slot.textContent, '◇ Steady Signal');
  assert.equal(h.document.activeElement, card);
  assert.equal(h.node('collection-dialog').open, true);
  assert.equal(h.node('gallery-view-dialog').open, false);
  assert.equal(h.paints.length, paints);
});

test('an already open picture receives friendly seal details without disturbing its focus or artwork', async (t) => {
  const h = await homewardCollection(t),
    card = h.cards()[0];
  await card.onclick();
  const list = h.node('gallery-view-masteries'),
    canvas = h.node('gallery-canvas');
  h.node('gallery-replay').focus();
  const paints = h.paints.length;
  assert.equal(list.hidden, true);
  h.library.masteries.push(h.seal, {
    ...structuredClone(h.seal),
    setup: { ...structuredClone(h.seal.setup), seed: 2 },
    runId: 'gallery-other-seed',
  });
  h.api.refreshMasteries();
  assert.equal(h.node('gallery-view-masteries'), list);
  assert.equal(list.hidden, false);
  assert.equal(list.children.length, 2);
  assert.match(list.children[0].textContent, /Steady Signal · Fiber relay · Immediate · seed 1/);
  assert.match(list.children[1].textContent, /seed 2/);
  const row = list.children[0];
  h.api.refreshMasteries();
  assert.equal(list.children[0], row, 'An unchanged detail list is not replaced.');
  assert.equal(h.document.activeElement, h.node('gallery-replay'));
  assert.equal(h.node('gallery-canvas'), canvas);
  assert.equal(h.cards()[0], card);
  assert.equal(h.node('gallery-view-dialog').open, true);
  assert.equal(h.node('collection-dialog').open, true);
  assert.equal(h.paints.length, paints);
});

test('late detail refresh keeps foreign records out, labels changed definitions archived and clears removed seals', async (t) => {
  const h = await homewardCollection(t),
    card = h.cards()[0];
  await card.onclick();
  h.node('gallery-replay').focus();
  h.library.masteries.push({ ...structuredClone(h.seal), levelId: 'homeward-02' });
  h.api.refreshMasteries();
  assert.equal(card.children[3].hidden, true);
  assert.equal(h.node('gallery-view-masteries').hidden, true);
  h.library.masteries.push({
    ...structuredClone(h.seal),
    definitionHash: 'mastery-v1-0000000000000000',
  });
  h.api.refreshMasteries();
  assert.equal(card.children[3].textContent, '◇ Archived seal: steady-signal');
  assert.match(
    h.node('gallery-view-masteries').children[0].textContent,
    /Archived seal: steady-signal/,
  );
  h.library.masteries.length = 0;
  h.api.refreshMasteries();
  assert.equal(card.children[3].hidden, true);
  assert.equal(card.children[3].textContent, '');
  assert.equal(h.node('gallery-view-masteries').hidden, true);
  assert.equal(h.node('gallery-view-masteries').children.length, 0);
  assert.equal(h.document.activeElement, h.node('gallery-replay'));
});

async function difficultyCollection(t, { count = 1, illustrated = false, saved = null } = {}) {
  let executions = [];
  const h = await setup(t, count, { executionCatalog: () => executions, saved: () => saved });
  h.entry.classRecipes = CLASSES;
  if (illustrated) h.entry.visualOverrides = { background: { dataUrl: 'fixture-image' } };
  executions = createExecutionCatalog([h.entry]).entries;
  h.library.gallery = h.library.gallery.flatMap((row) => [
    {
      ...row,
      key: `${row.key}-gentle`,
      campaignKey: executions[1].executionKey,
      score: 200,
      time: 5,
    },
    { ...row, time: 3 },
  ]);
  return { ...h, executions };
}

test('both difficulty records share a card while mode changes preserve focus and Back returns to that card', async (t) => {
  const h = await difficultyCollection(t, { count: 18 });
  const before = JSON.stringify(h.library);
  h.collection();
  h.search('gentle');
  h.next();
  const card = h.cards()[2];
  await card.onclick();
  const selector = h.node('gallery-difficulty'),
    option = selector.children[0];
  assert.equal(selector.value, 'standard');
  assert.equal(h.node('gallery-difficulty-field').hidden, false);
  assert.match(
    h.node('gallery-view-meta').textContent,
    /Standard · Best picture score: 100 points · GOLD · 3\.00s/,
  );
  assert.match(card.children[2].textContent, /Standard · Picture best 100 points · Score run GOLD/);
  selector.focus();
  selector.value = 'gentle';
  await selector.onchange();
  assert.equal(selector.children[0], option);
  assert.equal(h.document.activeElement, selector);
  assert.match(
    h.node('gallery-view-meta').textContent,
    /Gentle · Best picture score: 200 points · GOLD · 5\.00s/,
  );
  assert.equal(h.node('gallery-view-dialog').open, true);
  h.node('gallery-view-dialog').close();
  assert.equal(h.cards().length, 6);
  assert.equal(h.document.activeElement, h.cards()[2]);
  assert.match(h.node('gallery-pages').children[1].textContent, /18 entries · page 2 of 2/);
  assert.equal(h.node('gallery-search').value, 'gentle');
  assert.equal(JSON.stringify(h.library), before);
});

for (const difficulty of ['standard', 'gentle'])
  test(`picture Replay explicitly selects stored ${difficulty} despite the opposite next-attempt preference`, async (t) => {
    const h = await difficultyCollection(t);
    h.library.preferences.campaignDifficulty = difficulty === 'gentle' ? 'standard' : 'gentle';
    const before = JSON.stringify(h.library);
    h.collection();
    await h.cards()[0].onclick();
    if (difficulty === 'gentle') {
      h.node('gallery-difficulty').value = 'gentle';
      await h.node('gallery-difficulty').onchange();
    }
    h.node('gallery-replay').onclick();
    const [entry, options] = h.selections[0];
    assert.equal(entry.difficulty, difficulty);
    assert.equal(options.difficulty, difficulty);
    assert.equal(options.seed, 17);
    assert.equal(options.levelId, 'picture-0');
    assert.equal(h.node('collection-dialog').open, false);
    assert.equal(h.document.activeElement, h.node('mission-start'));
    assert.equal(JSON.stringify(h.library), before);
  });

test('rapid difficulty switches retain the latest image generation and keep stale actions blocked', async (t) => {
  const h = await difficultyCollection(t, { illustrated: true });
  h.collection();
  h.decodeJobs[0]();
  await Promise.resolve();
  const standard = h.cards()[0].onclick();
  const selector = h.node('gallery-difficulty');
  selector.focus();
  selector.value = 'gentle';
  const gentle = selector.onchange();
  selector.value = 'standard';
  const latest = selector.onchange();
  const paints = h.paints.length;
  h.decodeJobs[2]();
  await gentle;
  assert.equal(h.paints.length, paints);
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.equal(h.node('gallery-canvas').style.visibility, 'hidden');
  h.decodeJobs[3]();
  await latest;
  assert.equal(h.node('gallery-replay').disabled, false);
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  h.decodeJobs[1].reject(new Error('old Standard decode'));
  await standard;
  assert.match(
    h.node('gallery-view-meta').textContent,
    /Standard · Best picture score: 100 points · GOLD · 3\.00s$/,
  );
  assert.doesNotMatch(h.node('gallery-view-meta').textContent, /old Standard/);
  assert.equal(h.document.activeElement, selector);
});

test('score and saved-attempt mode labels use exact execution keys and searchable separate boards', async (t) => {
  const saved = { replay: { level: { name: 'Picture 00' } }, savedAt: '2026-09-12T12:00:00.000Z' };
  const h = await difficultyCollection(t, { saved });
  saved.campaignKey = h.executions[1].executionKey;
  let library = emptyLibrary();
  for (const entry of h.executions) {
    const run = createRun(entry.campaign.levels[0], {
      classId: 'scout',
      classRecipes: entry.classRecipes,
    });
    for (let tick = 0; run.status === 'running' && tick < 1000; tick++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won');
    library = recordLibraryCompletion(library, {
      campaign: entry.campaign,
      result: getSummary(run),
      runId: `view-${entry.difficulty}`,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      completedAt: saved.savedAt,
    });
  }
  h.setLibrary(library);
  h.api.open('scores');
  assert.equal(h.node('scoreboard').children.length, 2);
  assert.match(h.node('suspended-status').textContent, /Gentle/);
  h.node('score-search').value = 'gentle';
  h.node('score-search').oninput();
  assert.equal(h.node('scoreboard').children.length, 1);
  assert.match(h.node('scoreboard').children[0].children[1].textContent, /Gentle/);
  saved.campaignKey = `${saved.campaignKey}0`;
  h.api.refresh();
  assert.match(h.node('suspended-status').textContent, /Archived.*unavailable/);
});

test('a late Standard seal decorates the shared card without appearing on its selected Gentle variant', async (t) => {
  const h = await homewardCollection(t),
    entries = createExecutionCatalog([h.homewardEntry]).entries;
  h.setCatalog(entries);
  h.library.gallery.push({
    ...h.library.gallery[0],
    key: 'gentle-homeward-picture',
    campaignKey: entries[1].executionKey,
  });
  h.api.populateGallery();
  const card = h.cards()[0];
  await card.onclick();
  const selector = h.node('gallery-difficulty');
  selector.focus();
  selector.value = 'gentle';
  await selector.onchange();
  h.library.masteries.push(h.seal);
  h.api.refreshMasteries();
  assert.equal(h.cards().length, 1);
  assert.equal(card.children[3].textContent, '◇ Steady Signal');
  assert.equal(h.node('gallery-view-masteries').hidden, true);
  assert.equal(h.document.activeElement, selector);
  selector.value = 'standard';
  await selector.onchange();
  assert.equal(h.node('gallery-view-masteries').hidden, false);
  assert.match(h.node('gallery-view-masteries').children[0].textContent, /Steady Signal/);
});

test('an open picture cannot replay a pack removed after the picture was resolved', async (t) => {
  const h = await setup(t, 1);
  h.collection();
  await h.cards()[0].onclick();
  h.setCatalog([]);
  h.node('gallery-replay').onclick();
  assert.equal(h.selections.length, 0);
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.match(h.node('gallery-view-meta').textContent, /Archived.*exact pack/);
});

test('a trusted Challenge picture keeps its activity label and replay has no campaign difficulty override', async (t) => {
  const h = await setup(t, 1),
    challenge = { ...h.entry, activity: 'challenge' };
  h.setCatalog([challenge]);
  h.library.preferences.campaignDifficulty = 'gentle';
  h.collection();
  await h.cards()[0].onclick();
  assert.match(
    h.node('gallery-view-meta').textContent,
    /Challenge · Best picture score: 100 points · GOLD$/,
  );
  assert.equal(h.node('gallery-difficulty-field').hidden, true);
  h.node('gallery-replay').onclick();
  assert.equal(h.selections[0][0], challenge);
  assert.equal(Object.hasOwn(h.selections[0][1], 'difficulty'), false);
});

const flushGallery = async (condition) => {
  await waitFor(() => condition() === true, {
    message: 'gallery operation must settle through the observable DOM',
  });
};

async function managedGallery(t, { removed = false, metadataFailure = false } = {}) {
  const f = await earnedPictureFixture();
  t.after(() => f.manager.close());
  const h = await setup(t, 0, {
    pictureMedia: async () => {
      if (metadataFailure) throw new Error('Original media storage is unavailable');
      return { store: f.store, metadata: await f.store.readMetadata() };
    },
  });
  h.setLibrary(f.profile);
  h.setCatalog(removed ? [] : f.entries);
  h.collection();
  await flushGallery(() => h.cards().length === 1);
  return { ...h, f };
}

test('Collection shows the first earned revision after reassignment, releases images and returns keyboard focus', async (t) => {
  const h = await managedGallery(t);
  await flushGallery(() => h.decodeJobs.length === 1);
  h.decodeJobs[0]();
  await flushGallery(() => h.paints.length === 1);
  assert.equal(h.decodeJobs[0].image.released, true, 'thumbnail releases its decoded original');
  const next = structuredClone(h.f.metadata.document.library);
  next.presentations.push({ ...next.presentations[0], revision: 2 });
  next.assignments[0].revision = 2;
  const saved = await h.f.store.read();
  await h.f.store.commit(
    await h.f.store.prepare(next, saved.assets, {
      previous: saved.document,
      executionCatalog: h.f.catalog,
    }),
    { expectedGeneration: saved.generation },
  );
  const opening = h.cards()[0].onclick();
  await flushGallery(() => h.decodeJobs.length === 2);
  h.decodeJobs[1]();
  await opening;
  assert.equal(h.paints[1].image, h.decodeJobs[1].image);
  assert.equal(h.paints[1].seed, h.f.receipt.seed);
  assert.equal(h.node('gallery-canvas').copies.length, 1);
  assert.equal(h.node('gallery-replay').disabled, false);
  assert.equal(h.decodeJobs[1].image.released, undefined, 'full view owns the live drawable');
  h.node('gallery-view-dialog').close();
  await flushGallery(
    () => h.node('collection-dialog').open && h.document.activeElement === h.cards()[0],
  );
  assert.equal(h.decodeJobs[1].image.released, true);
  assert.equal(h.document.activeElement, h.cards()[0]);
  await flushGallery(() => h.decodeJobs.length === 3);
  h.decodeJobs[2]();
  await flushGallery(() => h.decodeJobs[2].image.released === true);
  assert.equal(h.f.profile.gallery.length, 1, 'viewing grants no extra completion');
});

test('Collection retains an earned original after its pack is removed without offering replay or invented animation', async (t) => {
  const h = await managedGallery(t, { removed: true });
  await flushGallery(() => h.decodeJobs.length === 1);
  h.decodeJobs[0]();
  await flushGallery(() => h.paints.length === 1);
  assert.equal(h.cards()[0].disabled, false);
  const opening = h.cards()[0].onclick();
  await flushGallery(() => h.decodeJobs.length === 2);
  h.decodeJobs[1]();
  await opening;
  assert.equal(h.node('gallery-canvas').style.visibility, '');
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.equal(h.node('gallery-animate').disabled, true);
  assert.equal(h.selections.length, 0);
  h.node('gallery-view-dialog').close();
  await flushGallery(() => h.decodeJobs.length === 3);
  h.decodeJobs[2]();
  await flushGallery(() => h.decodeJobs[2].image.released === true);
});

test('an unavailable original never silently falls back to current authored artwork', async (t) => {
  const h = await managedGallery(t, { metadataFailure: true });
  await flushGallery(() => h.cards()[0].dataset.pictureState === 'unavailable');
  assert.match(h.cards()[0].children[4].textContent, /Original picture unavailable/);
  await h.cards()[0].onclick();
  assert.equal(h.paints.length, 0);
  assert.match(h.node('gallery-view-meta').textContent, /Restore its originals/);
  assert.equal(h.node('gallery-replay').disabled, true);
  assert.equal(h.node('gallery-canvas').copies, undefined);
  h.node('gallery-view-dialog').close();
  await flushGallery(
    () => h.node('collection-dialog').open && h.document.activeElement === h.cards()[0],
  );
  assert.equal(h.document.activeElement, h.cards()[0]);
});

test('closing while an earned original decodes prevents stale canvas replacement and releases the late drawable', async (t) => {
  const h = await managedGallery(t);
  await flushGallery(() => h.decodeJobs.length === 1);
  h.decodeJobs[0]();
  await flushGallery(() => h.paints.length === 1);
  const opening = h.cards()[0].onclick();
  await flushGallery(() => h.decodeJobs.length === 2);
  h.node('gallery-view-dialog').close();
  h.decodeJobs[1]();
  await opening;
  assert.equal(h.node('gallery-canvas').copies, undefined);
  assert.equal(h.decodeJobs[1].image.released, true);
  await flushGallery(() => h.decodeJobs.length === 3);
  h.decodeJobs[2]();
  await flushGallery(() => h.decodeJobs[2].image.released === true);
  assert.equal(h.document.activeElement, h.cards()[0]);
});

for (const reopen of [false, true])
  test(`Back keeps its scope but late metadata cannot steal focus after ${reopen ? 'a new Collection visit' : 'navigation'}`, async (t) => {
    const f = await earnedPictureFixture();
    t.after(() => f.manager.close());
    let releaseRead,
      reads = 0;
    const mediaReads = [];
    const delayed = new Promise((resolve) => {
      releaseRead = resolve;
    });
    const h = await setup(t, 0, {
      pictureMedia: () => {
        const pending = (async () => {
          if (++reads > 1) await delayed;
          return { store: f.store, metadata: await f.store.readMetadata() };
        })();
        mediaReads.push(pending);
        return pending;
      },
    });
    h.setLibrary(f.profile);
    h.setCatalog(f.entries);
    h.collection();
    await flushGallery(() => h.decodeJobs.length === 1);
    h.decodeJobs[0]();
    await flushGallery(() => h.paints.length === 1);
    const opening = h.cards()[0].onclick();
    await flushGallery(() => h.decodeJobs.length === 2);
    h.decodeJobs[1]();
    await opening;
    h.node('gallery-view-dialog').close();
    assert.equal(
      h.node('collection-dialog').open,
      true,
      'Back keeps an immediate modal focus scope',
    );
    h.node('collection-dialog').close();
    if (reopen) {
      h.node('collection-dialog').showModal();
      h.api.populateGallery();
      h.node('gallery-search').focus();
    } else h.node('library-dialog').showModal();
    const target = h.document.activeElement;
    releaseRead();
    await Promise.all(mediaReads);
    if (reopen) await flushGallery(() => h.decodeJobs.length === 3);
    assert.equal(h.node('collection-dialog').open, reopen);
    assert.equal(h.document.activeElement, target);
    assert.equal(
      h.decodeJobs.length,
      reopen ? 3 : 2,
      'only the new visit may render replacement thumbnails',
    );
    if (reopen) {
      h.decodeJobs[2]();
      await flushGallery(() => h.decodeJobs[2].image.released === true);
    }
  });

test('Collection labels the retained score run separately from a later best medal without rewriting either record', async (t) => {
  const h = await setup(t, 1);
  const item = { ...h.library.gallery[0], score: 14410, medal: 'silver', time: 55.77 };
  h.setLibrary({
    ...h.library,
    gallery: [item],
    campaigns: {
      [item.campaignKey]: {
        clears: {
          [item.levelId]: { score: 14410, time: 12, medals: 3, clean: true, variants: {} },
        },
      },
    },
  });
  const before = structuredClone(h.library);
  h.collection();
  assert.match(h.cards()[0].children[2].textContent, /Level best GOLD/);
  assert.ok(h.cards()[0].children[2].textContent.includes(item.score.toLocaleString()));
  await h.cards()[0].onclick();
  assert.match(
    h.node('gallery-view-meta').textContent,
    /SILVER · 55\.77s · Level best medal: GOLD/,
  );
  assert.deepEqual(h.library, before);
});
