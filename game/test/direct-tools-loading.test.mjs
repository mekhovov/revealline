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

test('reserve catalog labels delayed metadata and fences stale selected image completion', async (t) => {
  const h = host(t),
    gate = deferred(),
    started = deferred();
  const manifest = JSON.parse(
    await readFile(
      new URL(
        '../../authoring/library/reserve-illustrations-catalog/manifest.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  h.install('fetch', () => {
    started.resolve();
    return gate.promise;
  });
  const loading = import(
    `../../authoring/library/reserve-illustrations-catalog/catalog.mjs?loading=${++serial}`
  );
  await started.promise;
  assert.equal(h.$('catalog-status').dataset.state, 'busy');
  assert.match(h.$('catalog-status').textContent, /Loading the reserve catalog/);
  h.$('theme').value = 'all';
  gate.resolve({ ok: true, json: async () => manifest });
  await loading;
  assert.equal(h.$('catalog-status').dataset.state, 'ready');
  const old = h.$('image-slot').querySelector('img');
  assert.equal(h.$('image-status').dataset.state, 'busy');
  h.$('next').click();
  const next = h.$('image-slot').querySelector('img');
  assert.notEqual(next, old);
  old.onload();
  assert.equal(h.$('image-status').dataset.state, 'busy');
  next.onerror();
  assert.equal(h.$('image-status').dataset.state, 'error');
  assert.match(h.$('image-status').textContent, /source links remain available/);
  h.$('previous').click();
  h.$('image-slot').querySelector('img').onload();
  assert.equal(h.$('image-status').dataset.state, 'ready');
});

test('atlas font, optional reference and clipboard waits remain independently scoped', async (t) => {
  const h = host(t),
    fonts = deferred(),
    reference = deferred(),
    clipboard = deferred();
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
