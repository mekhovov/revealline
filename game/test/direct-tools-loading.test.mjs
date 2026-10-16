import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};
let serial = 0;
function host(t) {
  const document = new Document(),
    window = new Events(),
    nodes = new Map();
  const create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = create(tag);
    element.before = (sibling) => element.parentNode.insertBefore(sibling, element);
    Object.defineProperty(element, 'innerHTML', {
      set(value) {
        this._markup = String(value);
      },
      get() {
        return this._markup || '';
      },
    });
    element.getContext = () => new Proxy({}, { get: () => () => {} });
    return element;
  };
  Object.assign(window, {
    getComputedStyle: document.defaultView.getComputedStyle,
    location: new URL('http://localhost:8767/authoring/design-atlas/'),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
  document.defaultView = window;
  document.parentNode = window;
  t.after(() => window.emit('pagehide', { persisted: false }));
  const $ = (id) => {
    if (!nodes.has(id)) {
      const element = document.createElement('div');
      element.id = id;
      document.body.append(element);
      nodes.set(id, element);
    }
    return nodes.get(id);
  };
  document.getElementById = $;
  document.querySelector = (selector) =>
    selector.startsWith('#') ? $(selector.slice(1)) : document.body.querySelector(selector);
  const install = (key, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key],
    );
  };
  install('document', document);
  install('window', window);
  install('location', {
    hostname: 'localhost',
    origin: 'http://localhost:8767',
    href: 'http://localhost:8767/authoring/design-atlas/',
  });
  install(
    'Option',
    class extends Element {
      constructor(label, value) {
        super(document, 'option');
        this.textContent = label;
        this.value = value;
      }
    },
  );
  install('localStorage', {
    getItem: () => assert.fail('Loading must not access player storage.'),
    setItem: () => assert.fail('Loading must not write player storage.'),
  });
  return { document, window, $, install };
}

test('reserve presentation labels delayed metadata and disposes stale selected image completion', async (t) => {
  const { mountReservePresentation } = await import(
    '../../authoring/library/reserve-illustrations-catalog/presentation.mjs'
  );
  const { validateReserveManifest } = await import(
    '../../authoring/library/reserve-illustrations-catalog/sources.mjs'
  );
  const h = host(t),
    gate = deferred(),
    pending = [],
    disposed = [],
    timers = new Map();
  let timerId = 0;
  Object.assign(h.window, {
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  const manifest = JSON.parse(
    await readFile(
      new URL(
        '../../authoring/library/reserve-illustrations-catalog/manifest.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  h.$('theme').value = 'all';
  const owner = mountReservePresentation({
    document: h.document,
    window: h.window,
    readManifest: async () => validateReserveManifest(await gate.promise),
    loadImage(entry) {
      const task = deferred();
      pending.push({ entry, ...task });
      return task.promise;
    },
  });
  t.after(() => owner.destroy());
  assert.equal(h.$('catalog-status').dataset.state, 'loading');
  assert.match(h.$('catalog-status').textContent, /Loading/);
  assert.equal(pending.length, 0);
  gate.resolve(manifest);
  await settle();
  assert.equal(pending.length, 1);
  assert.equal(h.$('catalog-status').dataset.state, 'loading');
  h.$('next').click();
  assert.equal(pending.length, 2);
  const old = h.document.createElement('img');
  old.naturalWidth = 1774;
  old.naturalHeight = 887;
  pending[0].resolve({
    image: old,
    dispose() {
      disposed.push('old');
    },
  });
  await settle();
  assert.deepEqual(disposed, ['old']);
  assert.equal(h.$('catalog-status').dataset.state, 'loading');
  assert.equal(h.$('image-slot').querySelector('img'), null);
  pending[1].reject(new Error('Current image unavailable'));
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'error');
  h.$('previous').click();
  const current = h.document.createElement('img');
  current.naturalWidth = 1774;
  current.naturalHeight = 887;
  current.src = 'blob:finite-current';
  pending[2].resolve({
    image: current,
    dispose() {
      disposed.push('current');
    },
  });
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'ready');
  assert.equal(h.$('image-slot').querySelector('img'), current);
});

test('atlas font, optional reference and clipboard waits remain independently scoped', async (t) => {
  const h = host(t),
    fonts = deferred(),
    reference = deferred(),
    clipboard = deferred();
  const details = h.document.createElement('details'),
    summary = h.document.createElement('summary');
  h.document.body.append(details);
  details.append(summary, h.$('prompt-example-text'));
  h.document.fonts = { load: () => fonts.promise };
  const link = h.document.createElement('a');
  link.setAttribute('data-local-reference', 'local.png');
  link.hidden = true;
  h.document.body.append(link);
  h.install('fetch', () => reference.promise);
  h.install('navigator', { clipboard: { writeText: () => clipboard.promise } });
  h.window.getSelection = () => assert.fail('A late failure cannot change a newer selection.');
  await import(`../../authoring/design-atlas/atlas.mjs?loading=${++serial}`);
  assert.equal(h.$('font-status').dataset.state, 'busy');
  assert.equal(h.$('reference-status').dataset.state, 'busy');
  h.$('copy-prompt').focus();
  h.$('copy-prompt').click();
  assert.equal(h.$('copy-status').dataset.state, 'busy');
  h.$('elsewhere').focus();
  clipboard.reject(new Error('Clipboard unavailable'));
  fonts.resolve([]);
  reference.resolve({ ok: false });
  await settle();
  assert.equal(h.$('font-status').dataset.state, 'error');
  assert.match(h.$('font-status').textContent, /Fallback text is visible/);
  assert.equal(h.$('reference-status').dataset.state, 'ready');
  assert.match(h.$('reference-status').textContent, /not present in this local build/);
  assert.equal(link.hidden, true);
  assert.equal(h.$('copy-status').dataset.state, 'error');
  assert.equal(h.document.activeElement, h.$('elsewhere'));
});

test('motion study reports initial dependency wait and a retryable startup failure', async (t) => {
  const h = host(t),
    gate = deferred();
  h.install('matchMedia', () => ({ matches: true }));
  let reads = 0;
  h.install('fetch', () => {
    reads++;
    return gate.promise;
  });
  await import(`../../authoring/motion-lab/app.js?loading=${++serial}`);
  assert.equal(reads, 3);
  assert.equal(h.$('motion-load-status').dataset.state, 'busy');
  assert.match(h.$('motion-load-status').textContent, /presentation, collection and ability/);
  gate.reject(new Error('Study files unavailable'));
  await settle();
  assert.equal(h.$('motion-load-status').dataset.state, 'error');
  assert.match(h.$('motion-load-status').textContent, /Reload this page to retry/);
  assert.equal(h.$('load-error').hidden, false);
});
