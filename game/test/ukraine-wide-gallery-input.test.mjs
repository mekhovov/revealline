import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Document, Events } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountUkraineWidePresentation } from '../../authoring/library/ukraine-role-wide-variants/presentation.mjs';
import { mountAuthoringReference } from '../ui/authoring-reference.mjs';
import { attachUkraineWideReaders } from '../../authoring/library/ukraine-role-wide-variants/gallery.mjs';
import {
  UKRAINE_WIDE_SOURCES,
  UKRAINE_WIDE_MANIFESTS,
  UKRAINE_WIDE_IMAGES,
} from '../../authoring/library/ukraine-role-wide-variants/sources.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import {
  ROLE_IDS,
  validateVariants,
} from '../../authoring/library/ukraine-role-wide-variants/model.mjs';

// Only the module origin is adapted: source viewer code remains unchanged and
// executes with the HTTP URL boundary that production requires for literal reads.
const viewerURL = new URL('../../authoring/design-atlas/reveal-audit-viewer.mjs', import.meta.url);
const viewerCode = (await readFile(viewerURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, viewerURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify('https://gallery.test/authoring/design-atlas/reveal-audit-viewer.mjs'),
  );
const servedViewer = `data:text/javascript;base64,${Buffer.from(viewerCode).toString('base64')}`;
const galleryURL = new URL(
  '../../authoring/library/ukraine-role-wide-variants/gallery.mjs',
  import.meta.url,
);
const galleryCode = (await readFile(galleryURL, 'utf8')).replace(
  /from '([^']+)'/g,
  (_, path) =>
    `from '${path === '../../design-atlas/reveal-audit-viewer.mjs' ? servedViewer : new URL(path, galleryURL).href}'`,
);
const { mountUkraineWideGallery } = await import(
  `data:text/javascript;base64,${Buffer.from(galleryCode).toString('base64')}`
);

const presentationURL = new URL(
  '../../authoring/library/ukraine-role-wide-variants/presentation.mjs',
  import.meta.url,
);
const presentationCode = (await readFile(presentationURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, presentationURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify(
      'https://gallery.test/authoring/library/ukraine-role-wide-variants/presentation.mjs',
    ),
  );
const { readUkraineWidePresentations, loadUkraineWideImage, paintUkraineWideCard } = await import(
  `data:text/javascript;base64,${Buffer.from(presentationCode).toString('base64')}`
);

import { validatePresentations } from '../../authoring/library/ukraine-role-presentations/model.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = 'authoring/library/ukraine-role-wide-variants/';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const records = {
  newer: validateVariants((await read(folder + 'variants.json')).toString()),
  older: validatePresentations(
    (await read('authoring/library/ukraine-role-presentations/presentations.json')).toString(),
  ),
};
const sourceBodies = new Map(
  await Promise.all(
    UKRAINE_WIDE_SOURCES.map(async (source) => [source.path, await read(source.path)]),
  ),
);
const markup = parse((await read(folder + 'index.html')).toString());
const elements = [];
const visit = (node) => {
  if (node.tagName) elements.push(node);
  node.childNodes?.forEach(visit);
};
visit(markup);
const attrs = (node) =>
  Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
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

function fixture(
  t,
  {
    gallery = false,
    autoStart = true,
    osReduced = false,
    readPresentations = async () => structuredClone(records),
    loadImage,
  } = {},
) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set(),
    storageWrites = [],
    timers = new Map();
  doc.parentNode = win;
  const preference = Object.assign(new Events(), { matches: osReduced });
  let time = 1000,
    serial = 0;
  const pad = {
    id: 'Finite Ukraine role pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL(
      'https://gallery.test/authoring/library/ukraine-role-wide-variants/index.html',
    ),
    innerHeight: 600,
    crypto: webcrypto,
    async fetch(url) {
      const path = new URL(url).pathname.slice(1);
      assert.ok(sourceBodies.has(path), `unexpected source-viewer request ${path}`);
      return new Response(sourceBodies.get(path));
    },
    setTimeout(callback, duration) {
      timers.set(++serial, { callback, duration });
      return serial;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    localStorage: {
      getItem: () => null,
      setItem: (...args) => storageWrites.push(['local', ...args]),
      removeItem: (...args) => storageWrites.push(['local-remove', ...args]),
    },
    sessionStorage: {
      getItem: () => null,
      setItem: (...args) => storageWrites.push(['session', ...args]),
      removeItem: (...args) => storageWrites.push(['session-remove', ...args]),
    },
    performance: { now: () => time },
    scrollBy() {},
    matchMedia: () => preference,
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
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
    if (tag === 'a')
      Object.defineProperty(node, 'href', {
        get: () => node.getAttribute('href') ?? '',
        set: (value) => node.setAttribute('href', value),
      });
    // Finite canvas commands model application ownership, not raster pixels.
    if (tag === 'canvas') node.getContext = () => new Proxy({}, { get: () => () => {} });
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
      if (['id', 'type', 'value', 'href', 'content', 'src'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'open', 'checked', 'selected'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
    if (node.tagName === 'SELECT') {
      const option = node.options.find((option) => option.selected) || node.options[0];
      if (option) node.value = option.value || option.textContent.trim();
    }
  };
  const documentNode = markup.childNodes.find((node) => node.tagName === 'html');
  for (const name of ['head', 'body'])
    documentNode.childNodes
      .find((node) => node.tagName === name)
      .childNodes.forEach((node) => append(doc[name], node));
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    oldLocale = getLocale();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => [pad] },
  });
  setLocale('en', { persist: false });
  const requests = [],
    loads = [],
    disposed = [],
    paints = [];
  const mountOptions = {
    document: doc,
    window: win,
    autoStart,
    readPresentations: (options) => {
      requests.push(options);
      return readPresentations(options);
    },
    loadImage: (role, options) => {
      loads.push({ role, options });
      return loadImage
        ? loadImage(role, options)
        : Promise.resolve({
            image: { naturalWidth: role.width, naturalHeight: role.height, src: role.body.src },
            dispose() {
              disposed.push(`${options.version}:${role.classId}`);
            },
          });
    },
    paint: (card, options) => {
      paintUkraineWideCard(card, options);
      paints.push({ card, options: { ...options } });
    },
  };
  let host;
  if (gallery === 'readers') {
    const presentation = mountUkraineWidePresentation({ ...mountOptions, autoStart: false });
    host = mountAuthoringReference({ document: doc, window: win });
    const readers = attachUkraineWideReaders({
      document: doc,
      window: win,
      navigation: host.navigation,
    });
    const destroy = host.destroy;
    host.presentation = presentation;
    host.destroy = () => {
      readers.destroy();
      presentation.destroy();
      destroy();
    };
    presentation.load();
  } else
    host = gallery
      ? mountUkraineWideGallery({ document: doc, window: win })
      : mountUkraineWidePresentation(mountOptions);
  translateDOM(doc.body);
  const observe = () => [...observers].forEach((observer) => observer.callback());
  const tick = () => {
    time += 50;
    pad.timestamp = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
    // A neutral scheduler tick is not an `open` attribute mutation. Broad input
    // observers still see the finite DOM updates that their shared host expects.
    [...observers]
      .filter((observer) => observer.options?.attributeFilter?.join(',') !== 'open')
      .forEach((observer) => observer.callback());
  };
  const pulse = (index) => {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  t.after(() => {
    host.destroy();
    doc.body.replaceChildren();
    doc.head.replaceChildren();
    oldNavigator
      ? Object.defineProperty(globalThis, 'navigator', oldNavigator)
      : delete globalThis.navigator;
    setLocale(oldLocale, { persist: false });
  });
  if (gallery) {
    tick();
    tick();
  }
  return {
    doc,
    win,
    storageWrites,
    host,
    frames,
    timers,
    observers,
    preference,
    requests,
    loads,
    disposed,
    paints,
    tick,
    pulse,
    observe,
    $: (id) => doc.getElementById(id),
    sections: doc.querySelector('.authoring-input-rail button'),
    change(id, value) {
      const node = doc.getElementById(id);
      node.value = value;
      node.emit('change');
    },
    motion(matches) {
      preference.matches = matches;
      preference.emit('change', { matches });
    },
  };
}

const retry = (h) => {
  h.$('ukraine-wide-retry').focus();
  h.$('ukraine-wide-retry').click();
};
const cards = (h) => [...new Set(h.paints.map(({ card }) => card))];
const states = (h) =>
  cards(h).flatMap((card) => card.items.map(({ state }) => structuredClone(state)));
const itemKeys = ROLE_IDS.flatMap((id) => [`v1:${id}`, `v3:${id}`]).sort();

test('two documents, two manifests and six originals have exact immutable identities without package admission', async () => {
  assert.equal(UKRAINE_WIDE_SOURCES.length, 2);
  assert.equal(UKRAINE_WIDE_MANIFESTS.length, 2);
  assert.equal(UKRAINE_WIDE_IMAGES.length, 6);
  for (const pin of [...UKRAINE_WIDE_SOURCES, ...UKRAINE_WIDE_MANIFESTS, ...UKRAINE_WIDE_IMAGES]) {
    assert.ok(Object.isFrozen(pin));
    const bytes = await read(pin.path);
    assert.equal(bytes.length, pin.bytes, pin.path);
    assert.equal(sha(bytes), pin.sha256, pin.path);
    if (pin.kind === 'image') {
      assert.equal(bytes.readUInt32BE(16), 1254);
      assert.equal(bytes.readUInt32BE(20), 1254);
    }
  }
  assert.equal(
    UKRAINE_WIDE_IMAGES.reduce((sum, pin) => sum + pin.bytes, 0),
    3993831,
  );
  const files = await collectBuildFiles(root);
  assert.deepEqual(
    files.filter((path) => path.startsWith(folder)),
    [],
  );
  assert.deepEqual(
    files.filter((path) => path.startsWith('authoring/library/ukraine-role-presentations/')),
    [],
  );
  assert.deepEqual(
    files.filter((path) => path.startsWith('game/test/')),
    [],
  );
});

test('one executable gallery retains existing controls and non-downloading owned source links', () => {
  const byId = new Map(elements.map((node) => [attrs(node).id, node]).filter(([id]) => id));
  assert.equal(byId.size, elements.filter((node) => attrs(node).id).length);
  for (const id of ['heading', 'background', 'phase', 'speed'])
    assert.equal(byId.get(id)?.tagName, 'select');
  for (const id of ['wings', 'guides', 'reduced'])
    assert.equal(attrs(byId.get(id)).type, 'checkbox');
  for (const source of UKRAINE_WIDE_SOURCES) {
    const link = byId.get(`ukraine-wide-source-${source.id}`);
    assert.equal(folder + attrs(link).href, source.path);
    assert.equal(attrs(link)['data-ukraine-wide-source'], source.id);
    assert.equal(attrs(link).download, undefined);
    assert.equal(attrs(link).target, undefined);
  }
  const scripts = elements.filter((node) => node.tagName === 'script');
  assert.equal(scripts.filter((node) => attrs(node).src === 'gallery.mjs').length, 1);
  assert.equal(
    scripts.filter((node) => attrs(node).src?.endsWith('authoring-reference-entry.mjs')).length,
    0,
  );
  assert.equal(
    scripts.filter(
      (node) => !attrs(node).src && node.childNodes.some((child) => child.value?.trim()),
    ).length,
    0,
  );
});

test('initial load commits all six images to three stable actual-size rows while initially paused', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('ukraine-wide-motion-status').dataset.state, 'paused');
  assert.equal(h.$('play').getAttribute('aria-pressed'), 'false');
  assert.equal(h.loads.length, 6);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('rows').querySelectorAll('article').length, 3);
  for (const id of ROLE_IDS) {
    assert.equal(h.$(`ukraine-wide-${id}`).dataset.authoringTarget, `ukraine-wide-read-${id}`);
    assert.equal(h.$(`ukraine-wide-read-${id}`).disabled, false);
    const canvas = h.$(`ukraine-wide-canvas-${id}`).querySelector('canvas');
    assert.deepEqual([canvas.width, canvas.height], [780, 215]);
  }
  assert.ok(
    cards(h).every(
      (card) => card.items.length === 2 && card.items.every((item) => item.image && item.role),
    ),
  );
  assert.deepEqual(h.storageWrites, []);
});

test('Play preserves held phases and resumes only the elapsed baseline; every held phase stops and resets its clock', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  for (const phase of [0, 1, 2, 3]) {
    h.change('phase', String(phase));
    assert.equal(h.frames.size, 0);
    assert.equal(h.$('play').getAttribute('aria-pressed'), 'false');
    for (const state of states(h)) {
      assert.equal(state.time, 0);
      assert.equal(state.phases.wings, (phase * Math.PI) / 2);
    }
    const held = states(h);
    h.$('play').click();
    assert.equal(h.$('play').getAttribute('aria-pressed'), 'true');
    assert.equal(h.frames.size, 1);
    assert.deepEqual(states(h), held, 'Play must not rephase the chosen comparison');
    h.tick();
    assert.deepEqual(states(h), held, 'First frame resets only its elapsed baseline');
    h.tick();
    assert.ok(states(h).every((state) => state.time > 0));
    const flown = states(h);
    h.$('play').click();
    h.tick();
    assert.deepEqual(states(h), flown);
    assert.equal(h.frames.size, 0);
    h.$('play').click();
    h.tick();
    assert.deepEqual(states(h), flown);
    h.$('play').click();
  }
});

test('paused display edits repaint once without advancing the cosmetic phases', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.change('phase', '3');
  const held = states(h);
  for (const [id, value, key, expected] of [
    ['heading', '180', 'heading', Math.PI],
    ['speed', '0', 'speedRatio', 0],
    ['background', 'light', 'background', 'light'],
  ]) {
    const before = h.paints.length;
    h.change(id, value);
    assert.equal(h.paints.length, before + 3);
    assert.equal(h.paints.at(-1).options[key], expected);
    assert.deepEqual(states(h), held);
    assert.equal(h.frames.size, 0);
  }
  h.$('guides').click();
  h.$('wings').click();
  assert.deepEqual(states(h), held);
  assert.equal(h.frames.size, 0);
  h.$('play').click();
  assert.equal(h.frames.size, 0);
  h.$('wings').click();
  assert.equal(h.frames.size, 1);
});

test('live OS/manual reduced motion and hidden wings stop scheduling without changing the play choice', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.$('play').click();
  h.tick();
  h.tick();
  const frozen = states(h);
  h.$('reduced').click();
  assert.equal(h.frames.size, 0);
  h.motion(true);
  h.$('reduced').click();
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('reduced').checked, false);
  assert.equal(h.$('ukraine-wide-motion-status').dataset.state, 'reduced');
  h.motion(false);
  assert.equal(h.frames.size, 1);
  h.tick();
  assert.deepEqual(states(h), frozen);
  h.$('wings').click();
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('ukraine-wide-motion-status').dataset.state, 'static');
  h.$('wings').click();
  assert.equal(h.frames.size, 1);
  h.$('play').click();
  h.motion(true);
  h.motion(false);
  assert.equal(h.frames.size, 0);
});

test('initial OS reduce stays distinct from the manual checkbox and never schedules animation', async (t) => {
  const h = fixture(t, { osReduced: true });
  await h.host.ready;
  h.$('play').click();
  assert.equal(h.$('reduced').checked, false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('ukraine-wide-motion-status').dataset.state, 'reduced');
});

for (const event of ['blur', 'hidden', 'pagehide'])
  test(`${event} suspends and resumes retained playback without hidden clock catch-up`, async (t) => {
    const h = fixture(t);
    await h.host.ready;
    h.$('play').click();
    h.tick();
    h.tick();
    const frozen = states(h);
    if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else {
      if (event === 'blur') h.doc.focused = false;
      h.win.emit(event, { persisted: true });
    }
    assert.equal(h.frames.size, 0);
    h.tick();
    h.tick();
    assert.deepEqual(states(h), frozen);
    if (event === 'hidden') {
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    } else {
      h.doc.focused = true;
      h.win.emit(event === 'blur' ? 'focus' : 'pageshow', { persisted: true });
    }
    assert.equal(h.frames.size, 1);
    h.tick();
    assert.deepEqual(states(h), frozen);
    h.$('play').click();
    h.win.emit('pagehide', { persisted: true });
    h.win.emit('pageshow', { persisted: true });
    assert.equal(h.frames.size, 0);
  });

test('top-modal ownership suspends frames and cannot be stolen by completion or resume', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.$('play').click();
  const dialog = h.doc.createElement('dialog'),
    button = h.doc.createElement('button');
  dialog.append(button);
  h.doc.body.append(dialog);
  dialog.showModal();
  button.focus();
  h.observe();
  assert.equal(h.frames.size, 0);
  const before = h.paints.length;
  h.tick();
  assert.equal(h.paints.length, before);
  assert.equal(h.$('ukraine-wide-motion-status').dataset.state, 'suspended');
  h.win.emit('focus');
  assert.ok(h.doc.activeElement === button);
  assert.equal(h.frames.size, 0);
  dialog.close();
  h.observe();
  assert.equal(h.frames.size, 1);
});

for (const failure of ['malformed old manifest', 'image failure', 'wrong dimensions'])
  test(`${failure} preserves previous complete rows atomically`, async (t) => {
    let attempt = 0;
    const h = fixture(t, {
      readPresentations: () => {
        attempt++;
        const data = structuredClone(records);
        if (attempt === 2 && failure === 'malformed old manifest') data.older.roles = [];
        return data;
      },
      loadImage: (role, options) => {
        if (
          attempt === 2 &&
          failure === 'image failure' &&
          role.classId === 'interceptor' &&
          options.version === 'v3'
        )
          throw new Error('decode failed');
        return Promise.resolve({
          image: {
            naturalWidth:
              attempt === 2 && failure === 'wrong dimensions' && role.classId === 'scout'
                ? 12
                : 1254,
            naturalHeight: 1254,
            attempt,
          },
          dispose() {},
        });
      },
    });
    await h.host.ready;
    const before = cards(h).flatMap((card) => card.items.map((item) => item.image));
    retry(h);
    await h.host.ready;
    assert.equal(h.$('status').dataset.state, 'error');
    assert.equal(h.frames.size, 0);
    assert.equal(h.doc.activeElement.id, 'ukraine-wide-retry');
    assert.deepEqual(
      cards(h).flatMap((card) => card.items.map((item) => item.image)),
      before,
    );
    retry(h);
    await h.host.ready;
    assert.equal(h.$('status').dataset.state, 'ready');
    assert.ok(cards(h).every((card) => card.items.every((item) => item.image.attempt === 3)));
  });

for (const boundary of ['Cancel', 'blur', 'hidden', 'pagehide', 'modal', 'timeout', 'destroy'])
  test(`${boundary} releases acquired staging immediately and rejects late siblings`, async (t) => {
    const gate = deferred(),
      released = [];
    let attempt = 0;
    const h = fixture(t, {
      readPresentations: () => {
        attempt++;
        return structuredClone(records);
      },
      loadImage: (role, options) => {
        const key = `${attempt}:${options.version}:${role.classId}`;
        if (attempt === 2 && options.version === 'v1' && role.classId === 'scout')
          return gate.promise;
        return Promise.resolve({
          image: { naturalWidth: 1254, naturalHeight: 1254, key },
          dispose() {
            released.push(key);
          },
        });
      },
    });
    await h.host.ready;
    const before = cards(h).flatMap((card) => card.items.map((item) => item.image));
    retry(h);
    await settle();
    assert.equal(released.length, 0);
    if (boundary === 'Cancel') h.$('ukraine-wide-cancel').click();
    if (boundary === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    }
    if (boundary === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (boundary === 'pagehide') h.win.emit('pagehide', { persisted: true });
    if (boundary === 'modal') {
      const dialog = h.doc.createElement('dialog');
      h.doc.body.append(dialog);
      dialog.showModal();
      h.observe();
    }
    if (boundary === 'timeout') {
      const timer = [...h.timers.values()][0];
      assert.equal(timer.duration, 30000);
      timer.callback();
    }
    if (boundary === 'destroy') h.host.destroy();
    assert.equal(h.requests.at(-1).signal.aborted, true);
    assert.equal(h.frames.size, 0);
    assert.equal(released.filter((key) => key.startsWith('2:')).length, 5);
    gate.resolve({
      image: { naturalWidth: 1254, naturalHeight: 1254, key: '2:v1:scout' },
      dispose() {
        released.push('2:v1:scout');
      },
    });
    await h.host.ready;
    assert.equal(new Set(released).size, released.length);
    assert.equal(released.filter((key) => key.startsWith('2:')).length, 6);
    assert.deepEqual(
      cards(h).flatMap((card) => card.items.map((item) => item.image)),
      before,
    );
    if (boundary === 'pagehide') {
      h.win.emit('pageshow', { persisted: true });
      assert.equal(attempt, 2);
      assert.equal(h.$('status').dataset.state, 'cancelled');
    }
  });

test('a replaced generation cannot publish over its fresh successor and keeps newer focus', async (t) => {
  const first = deferred();
  let reads = 0;
  const h = fixture(t, {
    autoStart: false,
    readPresentations: () => (++reads === 1 ? first.promise : structuredClone(records)),
  });
  retry(h);
  const prior = h.host.ready;
  h.$('heading').focus();
  h.host.load();
  await h.host.ready;
  assert.equal(h.doc.activeElement.id, 'heading');
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.loads.length, 6);
  first.resolve(structuredClone(records));
  await prior;
  assert.equal(h.loads.length, 6);
  assert.equal(h.doc.activeElement.id, 'heading');
});

test('current focused Cancel settles to Retry while unrelated focus remains owned', async (t) => {
  let gate = deferred();
  const h = fixture(t, { autoStart: false, readPresentations: () => gate.promise });
  h.$('heading').focus();
  h.host.load();
  assert.equal(h.doc.activeElement.id, 'heading');
  h.$('ukraine-wide-cancel').focus();
  gate.resolve(structuredClone(records));
  await h.host.ready;
  assert.equal(h.doc.activeElement.id, 'ukraine-wide-retry');
  gate = deferred();
  retry(h);
  assert.equal(h.doc.activeElement.id, 'ukraine-wide-cancel');
  h.$('background').focus();
  gate.resolve(structuredClone(records));
  await h.host.ready;
  assert.equal(h.doc.activeElement.id, 'background');
});

test('destroy releases retained resources once and removes lifecycle scheduling', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.$('play').click();
  const before = h.paints.length;
  h.host.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
  assert.deepEqual(h.disposed.sort(), itemKeys);
  h.$('play').click();
  h.change('phase', '2');
  h.motion(true);
  h.win.emit('focus');
  h.tick();
  assert.equal(h.paints.length, before);
  h.host.destroy();
  assert.equal(h.disposed.length, 6);
});

test('real owner exposes all three stable Sections and bounded canvas reading with exact Back', async (t) => {
  const h = fixture(t, { gallery: 'readers' });
  await h.host.presentation.ready;
  for (const role of ROLE_IDS) {
    const title = h.$(`ukraine-wide-${role}`),
      reader = h.$(`ukraine-wide-read-${role}`),
      region = h.$(`ukraine-wide-canvas-${role}`);
    h.sections.click();
    const dialog = h.doc.querySelector('.authoring-sections-dialog');
    const choice = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === title.textContent.trim(),
    );
    assert.ok(choice, role);
    choice.click();
    h.tick();
    h.tick();
    assert.ok(h.doc.activeElement === reader);
    Object.assign(region, {
      clientWidth: 100,
      scrollWidth: 780,
      clientHeight: 100,
      scrollHeight: 215,
      scrollLeft: 0,
      scrollTop: 0,
    });
    h.pulse(0);
    assert.ok(h.host.navigation.editorState()?.element === reader);
    h.pulse(15);
    h.pulse(13);
    assert.ok(region.scrollLeft > 0 && region.scrollLeft <= 680);
    assert.ok(region.scrollTop > 0 && region.scrollTop <= 115);
    h.pulse(1);
    assert.equal(h.host.navigation.editorState(), null);
    assert.ok(h.doc.activeElement === reader);
  }
  assert.deepEqual(h.storageWrites, []);
});

test('both pinned documents open literally and preserve two-step reader/modal Back and live names', async (t) => {
  const h = fixture(t, { gallery: true }),
    url = h.win.location.href;
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    for (const source of UKRAINE_WIDE_SOURCES) {
      const link = h.$(`ukraine-wide-source-${source.id}`);
      link.focus();
      h.pulse(0);
      const dialog = h.$('reveal-source-dialog');
      assert.equal(dialog?.open, true, source.id);
      for (let i = 0; i < 100 && dialog.dataset.state === 'loading'; i++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(dialog.dataset.state, 'ready');
      assert.equal(dialog.dataset.path, source.path);
      assert.equal(
        h.$('reveal-source-region').querySelector('pre').textContent,
        sourceBodies.get(source.path).toString(),
      );
      const reader = h.$('reveal-read-source');
      assert.match(
        reader.getAttribute('aria-label'),
        new RegExp(source.title().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
      reader.focus();
      h.pulse(0);
      assert.equal(h.host.navigation.readingState()?.regionId, 'reveal-source-region');
      h.pulse(1);
      assert.equal(dialog.open, true);
      assert.ok(h.doc.activeElement === reader);
      h.pulse(1);
      assert.equal(dialog.open, false);
      assert.ok(h.doc.activeElement === link);
      assert.equal(h.win.location.href, url);
    }
  }
  assert.deepEqual(h.storageWrites, []);
});

test('live labels do not rephase the selected comparison or replace nodes after bootstrap translation', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.change('phase', '2');
  const held = states(h),
    title = h.$('ukraine-wide-scout'),
    english = title.textContent,
    nodes = [...h.$('rows').children];
  translateDOM(h.doc.body);
  assert.equal(h.$('status').dataset.state, 'ready');
  setLocale('uk', { persist: false });
  assert.notEqual(title.textContent, english);
  assert.match(h.$('ukraine-wide-read-scout').getAttribute('aria-label'), /scout/);
  assert.deepEqual(states(h), held);
  assert.deepEqual([...h.$('rows').children], nodes);
  assert.equal(h.frames.size, 0);
  setLocale('en', { persist: false });
  assert.equal(title.textContent, english);
  assert.deepEqual(states(h), held);
});

test('production reader verifies both exact manifest bytes before returning their schemas', async () => {
  const requests = [];
  const controller = new AbortController();
  const data = await readUkraineWidePresentations({
    signal: controller.signal,
    window: {
      crypto: webcrypto,
      async fetch(url, options) {
        requests.push({ url, options });
        return new Response(await read(new URL(url).pathname.slice(1)));
      },
    },
  });
  assert.deepEqual(data, records);
  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((entry) => entry.url),
    UKRAINE_WIDE_MANIFESTS.map((pin) => 'https://gallery.test/' + pin.path),
  );
  for (const { options } of requests) {
    assert.equal(options.signal, controller.signal);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
  }
});
for (const index of [0, 1])
  test(`production metadata rejects altered manifest ${index} despite valid-length data`, async () => {
    await assert.rejects(
      readUkraineWidePresentations({
        window: {
          crypto: webcrypto,
          async fetch(url) {
            const bytes = await read(new URL(url).pathname.slice(1));
            if (new URL(url).pathname.slice(1) === UKRAINE_WIDE_MANIFESTS[index].path)
              bytes[bytes.length - 2] ^= 1;
            return new Response(bytes);
          },
        },
      }),
    );
  });
test('production reader refuses pre-aborted loading before requesting source bytes', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readUkraineWidePresentations({
      signal: controller.signal,
      window: {
        crypto: webcrypto,
        fetch() {
          assert.fail('No aborted fetch');
        },
      },
    }),
  );
});
test('image loader refuses crossed version or role identities before network access', () => {
  for (const role of [
    records.newer.roles[0],
    { ...records.older.roles[0], sha256: records.newer.roles[0].sha256 },
  ])
    assert.throws(() =>
      loadUkraineWideImage(role, {
        version: 'v1',
        window: {
          fetch() {
            assert.fail('No crossed image request');
          },
        },
      }),
    );
});

test('real painter keeps six source samples and exact comparison coordinates while paused edits preserve wing clocks', () => {
  const calls = [],
    ctx = new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args) =>
            calls.push([method, ...args]),
      },
    );
  const card = {
    items: [records.older.roles[0], records.newer.roles[0]].map((role) => ({
      role,
      image: { naturalWidth: 1254, naturalHeight: 1254 },
      state: { time: 0, phases: { wings: Math.PI / 2 }, rates: {} },
    })),
    canvas: { getContext: () => ctx },
  };
  const options = {
    elapsed: 0.05,
    paused: false,
    reducedMotion: false,
    speedRatio: 1,
    background: 'dark',
    heading: 0,
    showWings: true,
    guides: false,
  };
  paintUkraineWideCard(card, options);
  assert.deepEqual(
    calls.find((call) => call[0] === 'fillRect'),
    ['fillRect', 0, 0, 780, 215],
  );
  assert.deepEqual(
    calls.filter((call) => call[0] === 'translate' && call[2] === 105).map((call) => call[1]),
    [90, 389, 553, 252, 447, 628],
  );
  assert.equal(calls.filter((call) => call[0] === 'drawImage').length, 6);
  assert.ok(
    card.items.every((item) => item.state.time > 0 && item.state.phases.wings > Math.PI / 2),
  );
  const prior = card.items.map((item) => structuredClone(item.state));
  paintUkraineWideCard(card, { ...options, paused: true, heading: Math.PI });
  assert.deepEqual(
    card.items.map((item) => item.state),
    prior,
  );
  paintUkraineWideCard(card, { ...options, reducedMotion: true });
  assert.deepEqual(
    card.items.map((item) => item.state),
    prior,
  );
});
