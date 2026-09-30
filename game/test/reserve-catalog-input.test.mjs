import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountReservePresentation } from '../../authoring/library/reserve-illustrations-catalog/presentation.mjs';
import {
  validateReserveManifest,
  RESERVE_MANIFEST,
  RESERVE_README,
} from '../../authoring/library/reserve-illustrations-catalog/sources.mjs';

// The reference viewer must execute at an HTTP module origin. Only import URLs
// are adapted for this finite host; production viewer and catalog logic are intact.
const viewerURL = new URL('../../authoring/design-atlas/reveal-audit-viewer.mjs', import.meta.url);
const viewerCode = (await readFile(viewerURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, viewerURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify('https://reserve.test/authoring/design-atlas/reveal-audit-viewer.mjs'),
  );
const servedViewer = `data:text/javascript;base64,${Buffer.from(viewerCode).toString('base64')}`;
const catalogURL = new URL(
  '../../authoring/library/reserve-illustrations-catalog/catalog.mjs',
  import.meta.url,
);
const catalogCode = (await readFile(catalogURL, 'utf8')).replace(
  /from '([^']+)'/g,
  (_, path) =>
    `from '${path === '../../design-atlas/reveal-audit-viewer.mjs' ? servedViewer : new URL(path, catalogURL).href}'`,
);
const { mountReserveCatalog } = await import(
  `data:text/javascript;base64,${Buffer.from(catalogCode).toString('base64')}`
);

const sourcesURL = new URL(
  '../../authoring/library/reserve-illustrations-catalog/sources.mjs',
  import.meta.url,
);
const sourcesCode = (await readFile(sourcesURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, sourcesURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify(
      'https://reserve.test/authoring/library/reserve-illustrations-catalog/sources.mjs',
    ),
  );
const { readReserveManifest } = await import(
  `data:text/javascript;base64,${Buffer.from(sourcesCode).toString('base64')}`
);

const folder = new URL('../../authoring/library/reserve-illustrations-catalog/', import.meta.url);
const manifestBytes = await readFile(new URL('manifest.json', folder));
const manifest = JSON.parse(manifestBytes);
const sourceBodies = new Map([
  [RESERVE_MANIFEST.path, manifestBytes],
  [RESERVE_README.path, await readFile(new URL('README.md', folder))],
  [
    manifest.entries[0].prompts[0].path,
    await readFile(new URL('../../' + manifest.entries[0].prompts[0].path, import.meta.url)),
  ],
]);
const markup = parse(await readFile(new URL('index.html', folder), 'utf8'));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

test('the same forty selected records and two excluded originals retain their historical manifest identity', () => {
  assert.equal(manifestBytes.length, 71251);
  assert.equal(
    createHash('sha256').update(manifestBytes).digest('hex'),
    '2b6f772031c46a6c59784ea2fffdfb5459900d7913503f7415c5da9cc495b9d2',
  );
  const valid = validateReserveManifest(structuredClone(manifest));
  assert.deepEqual(valid, manifest);
  assert.equal(valid.selectedWorks, 40);
  assert.equal(valid.selectedOriginalBytes, 92797189);
  assert.equal(
    valid.entries.reduce((total, entry) => total + entry.original.bytes, 0),
    valid.selectedOriginalBytes,
  );
  assert.equal(valid.excludedRetainedOriginals.length, 2);
  for (const id of Object.keys(valid.themes))
    assert.equal(valid.entries.filter((entry) => entry.themeId === id).length, 10);
  assert.equal(new Set(valid.entries.map((entry) => entry.id)).size, 40);
  const originals = new Set(valid.entries.map((entry) => entry.original.path));
  for (const excluded of valid.excludedRetainedOriginals)
    assert.equal(originals.has(excluded.path), false);
  // This pins records only; it does not reread/decode 92,797,189 source PNG bytes.
});

const mutations = [
  [
    'format',
    (data) => {
      data.format = 'unknown';
    },
  ],
  [
    'source scope',
    (data) => {
      data.sourceOnly = false;
    },
  ],
  [
    'missing record',
    (data) => {
      data.entries.pop();
    },
  ],
  [
    'duplicate record',
    (data) => {
      data.entries[1] = structuredClone(data.entries[0]);
    },
  ],
  [
    'unknown theme',
    (data) => {
      data.entries[0].themeId = 'unknown';
    },
  ],
  [
    'non-source record',
    (data) => {
      data.entries[0].sourceOnly = false;
    },
  ],
  [
    'incorrect aspect',
    (data) => {
      data.entries[0].width++;
    },
  ],
  [
    'remote original',
    (data) => {
      data.entries[0].original.url = 'https://example.invalid/image.png';
    },
  ],
  [
    'escaped original',
    (data) => {
      data.entries[0].original.url = '../reserve-illustrations-wave-1/../../secret.png';
    },
  ],
  [
    'path and URL disagreement',
    (data) => {
      data.entries[0].original.path = data.entries[1].original.path;
    },
  ],
  [
    'bad content hash',
    (data) => {
      data.entries[0].original.sha256 = 'not-a-sha';
    },
  ],
  [
    'bad blob identity',
    (data) => {
      data.entries[0].original.gitBlob = 'not-a-blob';
    },
  ],
  [
    'unbounded body',
    (data) => {
      data.entries[0].original.bytes = Number.MAX_SAFE_INTEGER;
    },
  ],
  [
    'missing prompt',
    (data) => {
      data.entries[0].prompts = [];
    },
  ],
  [
    'executable text source',
    (data) => {
      data.entries[0].notes.url = '../reserve-illustrations-wave-1/notes.mjs';
    },
  ],
];
for (const [reason, mutate] of mutations)
  test(`reserve metadata validation rejects ${reason}`, () => {
    const data = structuredClone(manifest);
    mutate(data);
    assert.throws(() => validateReserveManifest(data));
  });

function fixture(
  t,
  {
    readManifest = async () => structuredClone(manifest),
    loadImage,
    autoStart = true,
    catalog = false,
  } = {},
) {
  const doc = new Document(),
    win = doc.defaultView,
    timers = new Map(),
    observers = new Set(),
    fetches = [];
  let timerId = 0;
  doc.parentNode = win;
  Object.assign(win, {
    location: new URL('https://reserve.test/authoring/library/reserve-illustrations-catalog/'),
    crypto: webcrypto,
    innerHeight: 600,
    scrollBy() {},
    fetch: async (url) => {
      const path = new URL(url).pathname.slice(1);
      fetches.push(path);
      const allowed = [
        RESERVE_MANIFEST.path,
        RESERVE_README.path,
        manifest.entries[0].prompts[0].path,
      ];
      assert.ok(allowed.includes(path), `unexpected source request ${path}`);
      return new Response(sourceBodies.get(path));
    },
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(_target, options) {
        this.options = options;
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
      }
    },
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    for (const property of tag === 'a' ? ['href', 'download'] : tag === 'img' ? ['src'] : [])
      Object.defineProperty(node, property, {
        get: () => node.getAttribute(property) ?? '',
        set: (value) => node.setAttribute(property, value),
      });
    return node;
  };
  doc.createTextNode = (value) => {
    const node = create('span');
    node.textContent = value;
    return node;
  };
  const append = (parent, source) => {
    if (source.nodeName === '#text') {
      parent._text = (parent._text || '') + source.value;
      return;
    }
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs || []) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value', 'href', 'src'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'checked', 'selected', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
  };
  const html = markup.childNodes.find((node) => node.tagName === 'html');
  for (const name of ['head', 'body'])
    html.childNodes
      .find((node) => node.tagName === name)
      .childNodes.forEach((node) => append(doc[name], node));
  const locale = getLocale();
  setLocale('en', { persist: false });
  const requests = [],
    loads = [],
    disposed = [],
    publications = [];
  const mountOptions = {
    document: doc,
    window: win,
    autoStart,
    readManifest: async (options) => {
      requests.push(options);
      return validateReserveManifest(await readManifest(options));
    },
    loadImage: (entry, options) => {
      loads.push({ entry, options });
      if (loadImage) return loadImage(entry, options, doc);
      const image = doc.createElement('img');
      image.naturalWidth = entry.width;
      image.naturalHeight = entry.height;
      image.src = 'blob:fixture-' + entry.id;
      return Promise.resolve({
        image,
        dispose() {
          disposed.push(entry.id);
        },
      });
    },
    onManifest: (value) => publications.push(value),
  };
  const host = catalog ? mountReserveCatalog(mountOptions) : null;
  const owner = host?.presentation || mountReservePresentation(mountOptions);
  translateDOM(doc.body);
  t.after(() => {
    if (host) host.destroy();
    else owner.destroy();
    doc.body.replaceChildren();
    doc.head.replaceChildren();
    setLocale(locale, { persist: false });
  });
  return {
    doc,
    win,
    owner,
    requests,
    loads,
    disposed,
    publications,
    timers,
    host,
    fetches,
    notifyOpen() {
      // Deliver only a modeled open-attribute mutation, not a neutral input poll.
      [...observers]
        .filter((observer) => observer.options?.attributeFilter?.includes('open'))
        .forEach((observer) => observer.callback([{ type: 'attributes', attributeName: 'open' }]));
    },
    $: (id) => doc.getElementById(id),
    change(id, value) {
      const node = doc.getElementById(id);
      node.value = value;
      node.emit('change');
    },
  };
}
const waitForViewer = async (h) => {
  for (let i = 0; i < 100 && h.$('reveal-source-dialog').dataset.state === 'loading'; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(h.$('reveal-source-dialog').dataset.state, 'ready');
};
const retry = (h) => {
  h.$('reserve-retry').focus();
  h.$('reserve-retry').click();
};

test('delayed metadata is visible and only the first selected original is requested', async (t) => {
  const gate = deferred();
  const h = fixture(t, { readManifest: () => gate.promise });
  assert.equal(h.$('catalog-status').dataset.state, 'loading');
  assert.equal(h.loads.length, 0);
  gate.resolve(structuredClone(manifest));
  await h.owner.ready;
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'ready');
  assert.equal(h.publications.length, 1);
  assert.equal(h.$('theme').options.length, 5);
  assert.equal(h.$('selection').options.length, 40);
  assert.deepEqual(
    h.loads.map(({ entry }) => entry.id),
    [manifest.entries[0].id],
  );
  assert.equal(h.$('image-slot').querySelectorAll('img').length, 1);
});

test('filters and Previous/Next request only explicit selected originals and reload preserves the selected ID', async (t) => {
  const h = fixture(t);
  await h.owner.ready;
  await settle();
  h.change('theme', 'retro');
  await settle();
  const list = manifest.entries.filter((entry) => entry.themeId === 'retro');
  assert.equal(h.$('selection').options.length, 10);
  assert.equal(h.$('selection').value, list[0].id);
  h.$('next').click();
  await settle();
  assert.equal(h.$('selection').value, list[1].id);
  h.$('previous').click();
  await settle();
  assert.equal(h.$('selection').value, list[0].id);
  h.change('selection', list[4].id);
  await settle();
  assert.equal(h.$('selection').value, list[4].id);
  retry(h);
  await h.owner.ready;
  await settle();
  assert.equal(h.$('selection').value, list[4].id);
  assert.equal(h.loads.at(-1).entry.id, list[4].id);
  assert.equal(h.$('image-slot').querySelectorAll('img').length, 1);
  assert.deepEqual(
    h.loads.map(({ entry }) => entry.id),
    [manifest.entries[0].id, list[0].id, list[1].id, list[0].id, list[4].id, list[4].id],
  );
});

test('pending and failed same-selection retry retain the last complete image and source data stays owned', async (t) => {
  const pending = deferred();
  let count = 0;
  const released = [];
  const h = fixture(t, {
    loadImage: (entry, _options, doc) => {
      if (++count === 2) return pending.promise;
      const image = doc.createElement('img');
      image.naturalWidth = entry.width;
      image.naturalHeight = entry.height;
      return Promise.resolve({
        image,
        dispose() {
          released.push(entry.id);
        },
      });
    },
  });
  await h.owner.ready;
  await settle();
  const original = h.$('image-slot').querySelector('img');
  retry(h);
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'loading');
  assert.equal(h.$('image-slot').querySelector('img'), original);
  assert.deepEqual(released, []);
  pending.reject(new Error('Chosen source unavailable'));
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'error');
  assert.equal(h.$('image-slot').querySelector('img'), original);
  assert.deepEqual(released, []);
  assert.equal(h.$('reserve-retry').disabled, false);
  retry(h);
  await h.owner.ready;
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'ready');
  assert.notEqual(h.$('image-slot').querySelector('img'), original);
  assert.deepEqual(released, [manifest.entries[0].id]);
});

test('Cancel retires pending metadata without publishing bindings or starting original requests', async (t) => {
  const pending = deferred();
  let count = 0;
  const h = fixture(t, {
    readManifest: () => (++count === 1 ? structuredClone(manifest) : pending.promise),
  });
  await h.owner.ready;
  await settle();
  const original = h.$('image-slot').querySelector('img'),
    loads = h.loads.length,
    publications = h.publications.length;
  retry(h);
  assert.equal(h.doc.activeElement, h.$('reserve-cancel'));
  h.$('reserve-cancel').click();
  assert.equal(h.requests.at(-1).signal.aborted, true);
  assert.equal(h.doc.activeElement, h.$('reserve-retry'));
  const status = h.$('catalog-status').textContent;
  pending.resolve(structuredClone(manifest));
  await settle();
  assert.equal(h.$('catalog-status').textContent, status);
  assert.equal(h.loads.length, loads);
  assert.equal(h.publications.length, publications);
  assert.equal(h.$('image-slot').querySelector('img'), original);
});

test('old image result is disposed immediately and cannot replace the newer chosen original', async (t) => {
  const pending = deferred(),
    released = [];
  let count = 0;
  const h = fixture(t, {
    loadImage: (entry, _options, doc) => {
      const image = doc.createElement('img');
      image.naturalWidth = entry.width;
      image.naturalHeight = entry.height;
      if (++count === 2) return pending.promise;
      return Promise.resolve({
        image,
        dispose() {
          released.push(entry.id);
        },
      });
    },
  });
  await h.owner.ready;
  await settle();
  h.$('next').click();
  const stale = h.loads.at(-1);
  assert.equal(
    h.$('image-slot').querySelector('img'),
    null,
    'new title never retains the prior original',
  );
  assert.deepEqual(released, [manifest.entries[0].id]);
  assert.equal(h.$('download').getAttribute('href'), null);
  assert.equal(h.$('image-read').disabled, true);
  h.$('next').click();
  await settle();
  assert.equal(stale.options.signal.aborted, true);
  const current = h.$('image-slot').querySelector('img'),
    status = h.$('catalog-status').textContent;
  const image = h.doc.createElement('img');
  image.naturalWidth = stale.entry.width;
  image.naturalHeight = stale.entry.height;
  pending.resolve({
    image,
    dispose() {
      released.push('obsolete');
    },
  });
  await settle();
  assert.equal(released.filter((id) => id === 'obsolete').length, 1);
  assert.equal(h.$('image-slot').querySelector('img'), current);
  assert.equal(h.$('catalog-status').textContent, status);
  assert.equal(h.$('selection').value, manifest.entries[2].id);
});

test('older failed manifest cannot overwrite a later successful reload or steal its focus', async (t) => {
  const pending = deferred();
  let count = 0;
  const h = fixture(t, {
    readManifest: () => (++count === 2 ? pending.promise : structuredClone(manifest)),
  });
  await h.owner.ready;
  await settle();
  retry(h);
  h.$('reserve-cancel').click();
  retry(h);
  await h.owner.ready;
  await settle();
  const image = h.$('image-slot').querySelector('img'),
    text = h.$('catalog-status').textContent;
  pending.reject(new Error('Retired metadata response'));
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'ready');
  assert.equal(h.$('catalog-status').textContent, text);
  assert.equal(h.$('image-slot').querySelector('img'), image);
  assert.equal(h.doc.activeElement, h.$('reserve-retry'));
});

test('invalid reload retains the complete previous chooser and never installs partial manifest bindings', async (t) => {
  let data = structuredClone(manifest);
  const h = fixture(t, { readManifest: async () => data });
  await h.owner.ready;
  await settle();
  const options = [...h.$('selection').options],
    image = h.$('image-slot').querySelector('img'),
    published = h.publications.length;
  data = structuredClone(manifest);
  data.entries[39].original.url = 'https://invalid.test/stolen.png';
  retry(h);
  await h.owner.ready;
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'error');
  assert.deepEqual([...h.$('selection').options], options);
  assert.equal(h.$('image-slot').querySelector('img'), image);
  assert.equal(h.publications.length, published);
  assert.equal(h.doc.activeElement, h.$('reserve-retry'));
});

for (const event of ['blur', 'hidden', 'pagehide', 'persisted-pagehide'])
  test(`${event} aborts pending source work and a late result cannot steal focus or replace the image`, async (t) => {
    const pending = deferred();
    let count = 0;
    const released = [];
    const h = fixture(t, {
      loadImage: (entry, _options, doc) => {
        if (++count === 2) return pending.promise;
        const image = doc.createElement('img');
        image.naturalWidth = entry.width;
        image.naturalHeight = entry.height;
        return Promise.resolve({
          image,
          dispose() {
            released.push(entry.id);
          },
        });
      },
    });
    await h.owner.ready;
    await settle();
    const original = h.$('image-slot').querySelector('img');
    retry(h);
    await settle();
    const request = h.loads.at(-1);
    if (event === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.win.emit('pagehide', { persisted: event === 'persisted-pagehide' });
    assert.equal(request.options.signal.aborted, true);
    h.$('theme').focus();
    const text = h.$('catalog-status').textContent;
    const image = h.doc.createElement('img');
    image.naturalWidth = request.entry.width;
    image.naturalHeight = request.entry.height;
    pending.resolve({
      image,
      dispose() {
        released.push('obsolete');
      },
    });
    await settle();
    assert.equal(h.$('catalog-status').textContent, text);
    assert.equal(h.$('image-slot').querySelector('img'), original);
    assert.equal(h.doc.activeElement, h.$('theme'));
    assert.equal(released.filter((id) => id === 'obsolete').length, 1);
  });

test('asynchronous completion and Cancel preserve a newer control or open dialog owner', async (t) => {
  const pending = [];
  let count = 0;
  const h = fixture(t, {
    readManifest: () => {
      if (++count === 1) return structuredClone(manifest);
      const task = deferred();
      pending.push(task);
      return task.promise;
    },
  });
  await h.owner.ready;
  await settle();
  retry(h);
  h.$('theme').focus();
  pending[0].resolve(structuredClone(manifest));
  await h.owner.ready;
  await settle();
  assert.equal(h.doc.activeElement, h.$('theme'));
  retry(h);
  const dialog = h.doc.createElement('dialog'),
    action = h.doc.createElement('button');
  dialog.append(action);
  h.doc.body.append(dialog);
  dialog.showModal();
  action.focus();
  pending[1].resolve(structuredClone(manifest));
  await h.owner.ready;
  await settle();
  assert.equal(h.doc.activeElement, action);
  assert.equal(dialog.open, true);
  dialog.close();
  retry(h);
  h.$('selection').focus();
  h.owner.cancel();
  assert.equal(h.doc.activeElement, h.$('selection'));
  pending[2].resolve(structuredClone(manifest));
  await settle();
  assert.equal(h.doc.activeElement, h.$('selection'));
});

test('destroy retires staged images and releases the retained image exactly once', async (t) => {
  const pending = deferred();
  let count = 0;
  const released = [];
  const h = fixture(t, {
    loadImage: (entry, _options, doc) => {
      if (++count === 2) return pending.promise;
      const image = doc.createElement('img');
      image.naturalWidth = entry.width;
      image.naturalHeight = entry.height;
      return Promise.resolve({
        image,
        dispose() {
          released.push('retained');
        },
      });
    },
  });
  await h.owner.ready;
  await settle();
  retry(h);
  await settle();
  h.owner.destroy();
  assert.equal(h.loads.at(-1).options.signal.aborted, true);
  assert.deepEqual(released, ['retained']);
  const image = h.doc.createElement('img');
  image.naturalWidth = 1774;
  image.naturalHeight = 887;
  pending.resolve({
    image,
    dispose() {
      released.push('late');
    },
  });
  await settle();
  assert.deepEqual(released, ['retained', 'late']);
  const countAfter = h.loads.length;
  h.$('next').click();
  await settle();
  assert.equal(h.loads.length, countAfter);
  h.owner.destroy();
  assert.equal(released.length, 2);
});

test('static sources stay readable through pending and failed metadata, with exact Back and one later expanded viewer', async (t) => {
  const pending = deferred();
  let calls = 0;
  const h = fixture(t, {
    catalog: true,
    readManifest: () => {
      calls++;
      if (calls === 1) return pending.promise;
      if (calls === 2) throw new Error('Catalog metadata unavailable');
      return structuredClone(manifest);
    },
  });
  assert.equal(h.$('catalog-status').dataset.state, 'loading');
  assert.equal(h.doc.querySelectorAll('#reveal-source-dialog').length, 1);
  const initialDialog = h.$('reveal-source-dialog');
  h.$('catalog-readme').focus();
  h.$('catalog-readme').click();
  h.notifyOpen();
  await waitForViewer(h);
  assert.equal(initialDialog.open, true);
  assert.equal(initialDialog.dataset.state, 'ready');
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.$('catalog-status').dataset.state, 'cancelled');
  assert.equal(
    h.$('reveal-source-region').querySelector('pre').textContent,
    (await readFile(new URL('README.md', folder))).toString(),
  );
  assert.equal(h.doc.activeElement, h.$('reveal-source-close'));
  pending.resolve(structuredClone(manifest));
  await settle();
  assert.equal(h.loads.length, 0);
  assert.equal(h.$('reveal-source-dialog'), initialDialog);
  assert.equal(h.doc.activeElement, h.$('reveal-source-close'));
  h.$('reveal-source-close').click();
  h.notifyOpen();
  assert.equal(h.doc.activeElement, h.$('catalog-readme'));

  retry(h);
  await h.owner.ready;
  assert.equal(h.$('catalog-status').dataset.state, 'error');
  h.$('catalog-manifest').focus();
  h.$('catalog-manifest').click();
  h.notifyOpen();
  await waitForViewer(h);
  assert.equal(h.$('reveal-source-dialog').dataset.state, 'ready');
  assert.equal(
    h.$('reveal-source-region').querySelector('pre').textContent,
    manifestBytes.toString(),
  );
  h.$('reveal-source-close').click();
  h.notifyOpen();
  assert.equal(h.doc.activeElement, h.$('catalog-manifest'));

  retry(h);
  await h.owner.ready;
  await settle();
  assert.equal(h.$('catalog-status').dataset.state, 'ready');
  assert.equal(h.doc.querySelectorAll('#reveal-source-dialog').length, 1);
  assert.notEqual(h.$('reveal-source-dialog'), initialDialog);
  assert.equal(h.doc.activeElement, h.$('reserve-retry'));
  h.$('prompt').focus();
  h.$('prompt').click();
  h.notifyOpen();
  await waitForViewer(h);
  assert.equal(h.$('reveal-source-dialog').dataset.state, 'ready');
  assert.equal(h.$('reveal-source-dialog').dataset.path, manifest.entries[0].prompts[0].path);
  assert.equal(
    h.$('reveal-source-region').querySelector('pre').textContent,
    (
      await readFile(new URL('../../' + manifest.entries[0].prompts[0].path, import.meta.url))
    ).toString(),
  );
  h.$('reveal-source-close').click();
  h.notifyOpen();
  assert.equal(h.doc.activeElement, h.$('prompt'));
  assert.deepEqual(h.fetches, [
    RESERVE_README.path,
    RESERVE_MANIFEST.path,
    manifest.entries[0].prompts[0].path,
  ]);
});

test('production manifest reading verifies exact pinned bytes before publishing frozen descriptors', async () => {
  const requests = [];
  const controller = new AbortController();
  const data = await readReserveManifest({
    signal: controller.signal,
    window: {
      crypto: webcrypto,
      async fetch(url, options) {
        requests.push({ url, options });
        return new Response(manifestBytes);
      },
    },
  });
  assert.deepEqual(data, manifest);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://reserve.test/' + RESERVE_MANIFEST.path);
  assert.equal(requests[0].options.signal, controller.signal);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(Object.isFrozen(data), true);
  assert.equal(Object.isFrozen(data.entries[0].original), true);
});

for (const reason of ['same-size changed bytes', 'truncated bytes', 'aborted before read'])
  test(`production metadata read rejects ${reason}`, async () => {
    const controller = new AbortController();
    let body = Buffer.from(manifestBytes),
      requests = 0;
    if (reason === 'same-size changed bytes') body[body.length - 2] ^= 1;
    if (reason === 'truncated bytes') body = body.subarray(0, body.length - 1);
    if (reason === 'aborted before read') controller.abort();
    await assert.rejects(
      readReserveManifest({
        signal: controller.signal,
        window: {
          crypto: webcrypto,
          async fetch() {
            requests++;
            return new Response(body);
          },
        },
      }),
    );
    assert.equal(requests, reason === 'aborted before read' ? 0 : 1);
  });

test('timeout aborts its operation, retains its completed original and fences late completion', async (t) => {
  const gate = deferred();
  let count = 0;
  const h = fixture(t, {
    readManifest: () => (++count === 2 ? gate.promise : structuredClone(manifest)),
  });
  await h.owner.ready;
  const image = h.$('image-slot').querySelector('img');
  retry(h);
  assert.equal(h.timers.size, 1);
  for (const callback of [...h.timers.values()]) callback();
  assert.equal(h.requests.at(-1).signal.aborted, true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.$('catalog-status').dataset.state, 'error');
  assert.equal(h.doc.activeElement, h.$('reserve-retry'));
  assert.equal(h.$('image-slot').querySelector('img'), image);
  const status = h.$('catalog-status').textContent;
  gate.resolve(structuredClone(manifest));
  await settle();
  assert.equal(h.$('catalog-status').textContent, status);
  assert.equal(h.$('image-slot').querySelector('img'), image);
  assert.equal(h.loads.length, 1);
});

test('real Sections reach chooser, image and source identity while live locale labels retain selected identity', async (t) => {
  const h = fixture(t, { catalog: true });
  await h.owner.ready;
  const sections = h.doc.querySelector('.authoring-sections-dialog');
  const opener = h.doc.querySelector('.authoring-input-rail button');
  for (const [heading, target] of [
    ['chooser-title', 'theme'],
    ['title', 'image-read'],
    ['identity-title', 'identity-toggle'],
  ]) {
    opener.focus();
    opener.click();
    h.notifyOpen();
    assert.equal(sections.open, true);
    const action = [...sections.querySelectorAll('button')].find(
      (node) => node.textContent === h.$(heading).textContent.trim(),
    );
    assert.ok(action, heading);
    action.click();
    h.notifyOpen();
    assert.equal(sections.open, false);
    assert.equal(h.doc.activeElement, h.$(target), heading);
  }
  const current = h.owner.current;
  assert.equal(h.$('image-read').getAttribute('aria-label'), 'Inspect original: ' + current.title);
  assert.match(h.$('catalog-status').textContent, /Verified original shown/);
  setLocale('uk', { persist: false });
  assert.equal(h.$('chooser-title').textContent, 'Вибрати ілюстрацію');
  assert.equal(h.$('identity-title').textContent, 'Дані оригіналу');
  assert.equal(
    h.$('image-read').getAttribute('aria-label'),
    'Переглянути оригінал: ' + current.title,
  );
  assert.match(h.$('catalog-status').textContent, /Перевірений оригінал показано/);
  assert.equal(h.owner.current, current);
  assert.equal(h.$('selection').value, current.id);
  assert.equal(h.loads.length, 1);
});

test('Previous and Next keep an available neighbour focused at the ends without stealing other control focus', async (t) => {
  const h = fixture(t);
  await h.owner.ready;
  h.change('selection', manifest.entries.at(-2).id);
  await h.owner.ready;
  h.$('next').focus();
  h.$('next').click();
  await h.owner.ready;
  assert.equal(h.owner.current.id, manifest.entries.at(-1).id);
  assert.equal(h.$('next').disabled, true);
  assert.equal(h.doc.activeElement, h.$('previous'));
  h.change('selection', manifest.entries[1].id);
  await h.owner.ready;
  h.$('previous').focus();
  h.$('previous').click();
  await h.owner.ready;
  assert.equal(h.owner.current.id, manifest.entries[0].id);
  assert.equal(h.$('previous').disabled, true);
  assert.equal(h.doc.activeElement, h.$('next'));
  h.$('selection').focus();
  h.change('selection', manifest.entries.at(-1).id);
  await h.owner.ready;
  assert.equal(h.$('next').disabled, true);
  assert.equal(h.doc.activeElement, h.$('selection'));
  h.$('theme').focus();
  h.change('theme', 'fpv');
  await h.owner.ready;
  assert.equal(h.doc.activeElement, h.$('theme'));
});
