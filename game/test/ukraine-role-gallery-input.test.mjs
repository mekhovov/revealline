import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Document, Events } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountUkraineRolePresentation } from '../../authoring/library/ukraine-role-presentations/presentation.mjs';
import { mountAuthoringReference } from '../ui/authoring-reference.mjs';
import { attachUkraineRoleReaders } from '../../authoring/library/ukraine-role-presentations/gallery.mjs';
import {
  UKRAINE_ROLE_SOURCES,
  UKRAINE_ROLE_MANIFEST,
  UKRAINE_ROLE_IMAGES,
} from '../../authoring/library/ukraine-role-presentations/sources.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import {
  ROLE_IDS,
  BODY_IDS,
  validatePresentations,
} from '../../authoring/library/ukraine-role-presentations/model.mjs';

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
  '../../authoring/library/ukraine-role-presentations/gallery.mjs',
  import.meta.url,
);
const galleryCode = (await readFile(galleryURL, 'utf8')).replace(
  /from '([^']+)'/g,
  (_, path) =>
    `from '${path === '../../design-atlas/reveal-audit-viewer.mjs' ? servedViewer : new URL(path, galleryURL).href}'`,
);
const { mountUkraineRoleGallery } = await import(
  `data:text/javascript;base64,${Buffer.from(galleryCode).toString('base64')}`
);

const presentationURL = new URL(
  '../../authoring/library/ukraine-role-presentations/presentation.mjs',
  import.meta.url,
);
const presentationCode = (await readFile(presentationURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, presentationURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify(
      'https://gallery.test/authoring/library/ukraine-role-presentations/presentation.mjs',
    ),
  );
const { readUkraineRolePresentations, loadUkraineRoleImage, paintUkraineRoleCard } = await import(
  `data:text/javascript;base64,${Buffer.from(presentationCode).toString('base64')}`
);

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = 'authoring/library/ukraine-role-presentations/';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
// Source/render contracts captured from main 1e0fa85b0; the gallery adapter must
// not rewrite artwork, rigs, candidate qualifications or the existing renderer.
const retainedPins = [
  {
    path: 'authoring/library/ukraine-role-presentations/README.md',
    bytes: 7872,
    sha256: 'dc0d270e899578017324844b894af9bf328c31ad9a73a3b2c9dfd74282083325',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/PROMPTS.md',
    bytes: 19176,
    sha256: '20280c517eea9323c1d1082b9b6996c453837f3974912959eada6c2f74ad5deb',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/presentations.json',
    bytes: 7605,
    sha256: '98bc5ebfd3fc20bfe9113c75c0da85692df61f2781d26d1cd75e848f4b69b4eb',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/model.mjs',
    bytes: 5565,
    sha256: 'd7a6df506a42dc209bb5e9a98ca78712fe20f47d134382a7b1389ead072327db',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/preview.mjs',
    bytes: 2237,
    sha256: 'c1bb4f6be7b5a2446c35af2cbe5337e4d57c4e3943222b2464e9a5b99cecd2ba',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/scout.json',
    bytes: 3939,
    sha256: 'b1eeda7edfe4405665d51fe9cadc1052b6da845b664fafe0c304d9529f44c057',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/bomber.json',
    bytes: 4100,
    sha256: '572624a22404bf323e47779650a4d674519d3a5d319115e7607d1d373f46e138',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/carrier.json',
    bytes: 4070,
    sha256: '2147dacd59bfb0663a1a165a5c791bda19ca6c71beeb908cc90a761d15cf32b3',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/interceptor.json',
    bytes: 3979,
    sha256: 'fd785a7399b045abf1760c6bedbbf16432baee3df8a29aeae10a0d2053b1fb18',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/fiber.json',
    bytes: 4043,
    sha256: 'ae8b6d4fdd6ae50e9cc81978b70cd5cfa1993eb9f9c844484c2b5a1a9adbb6f5',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/impact.json',
    bytes: 3982,
    sha256: 'cf4e56f1fa462e61c09aaa101df18861c0120f3fecb4783ccc5a20f1d7d47f92',
  },
  {
    path: 'authoring/library/ukraine-role-presentations/provenance/trapper.json',
    bytes: 4060,
    sha256: 'ca64e66b671a43408b7703691ffe39d3c990748396a7e5cccce2d28d41c36aa0',
  },
  {
    path: 'authoring/motion-lab/render-character.mjs',
    bytes: 6790,
    sha256: 'f853baf14aa57aba2419404cd3495325c6ddb5486ebfb8e832196bff423ea939',
  },
  {
    path: 'authoring/motion-lab/animation.mjs',
    bytes: 8068,
    sha256: 'e739040d96daea57fd782f13991d96241e11022803038af8d4d184be15981c40',
  },
];
const recordText = (await read(folder + 'presentations.json')).toString();
const records = validatePresentations(recordText);
const sourceBodies = new Map(
  await Promise.all(
    UKRAINE_ROLE_SOURCES.map(async (source) => [source.path, await read(source.path)]),
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

test('source records, qualifications, model, sizing and shared renderer stay byte-exact', async () => {
  for (const pin of retainedPins) {
    const bytes = await read(pin.path);
    assert.equal(bytes.length, pin.bytes, pin.path);
    assert.equal(sha(bytes), pin.sha256, pin.path);
  }
  assert.equal(records.stage, 'source-candidate');
  assert.equal(records.runtimeBinding, null);
  assert.deepEqual(
    records.roles.map((role) => role.classId),
    ROLE_IDS,
  );
});

test('seven originals retain their exact historical bytes, dimensions and independently authored rigs', async () => {
  let total = 0;
  for (const [index, role] of records.roles.entries()) {
    const provenance = JSON.parse(await read(folder + role.provenance));
    const bytes = await read(folder + role.body.src);
    assert.equal(provenance.classId, role.classId);
    assert.equal(provenance.bodyId, BODY_IDS[index]);
    assert.equal(provenance.original.path, role.body.src);
    assert.equal(bytes.length, provenance.original.bytes);
    assert.equal(sha(bytes), role.sha256);
    assert.equal(sha(bytes), provenance.original.sha256);
    assert.equal(sha(provenance.prompt), provenance.promptSha256);
    assert.deepEqual(provenance.transformations, []);
    assert.equal(provenance.runtimeBinding, null);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), role.width);
    assert.equal(bytes.readUInt32BE(20), role.height);
    assert.deepEqual([role.width, role.height], [1254, 1254]);
    assert.deepEqual(provenance.actualDimensions, [1254, 1254]);
    assert.equal(role.body.rotors.length, 0);
    assert.equal(role.recipe.components[0].type, 'wings');
    assert.equal(role.recipe.components[0].anchors.length, 2);
    total += bytes.length;
  }
  assert.equal(total, 5228557);
  // Headers/hashes qualify unchanged inputs, not current native pixel decoding,
  // alpha quality, collision behavior, physical-size readability or adoption.
});

test('default admission excludes this source gallery, its documents and its original artwork', async () => {
  const files = await collectBuildFiles(root);
  assert.deepEqual(
    files.filter((path) => path.startsWith(folder)),
    [],
  );
  assert.deepEqual(
    files.filter((path) => path.startsWith('game/test/')),
    [],
  );
});

test('bounded source descriptors expose only the three exact historical documents and their manifest identity', async () => {
  assert.ok(Object.isFrozen(UKRAINE_ROLE_SOURCES));
  assert.ok(Object.isFrozen(UKRAINE_ROLE_MANIFEST));
  assert.equal(UKRAINE_ROLE_SOURCES.length, 3);
  const expected = new Map([
    ['guide', 'README.md'],
    ['records', 'presentations.json'],
    ['prompts', 'PROMPTS.md'],
  ]);
  for (const source of UKRAINE_ROLE_SOURCES) {
    assert.ok(Object.isFrozen(source));
    assert.equal(source.kind, 'text');
    assert.equal(source.path, folder + expected.get(source.id));
    expected.delete(source.id);
    const bytes = await read(source.path);
    assert.equal(bytes.length, source.bytes);
    assert.equal(sha(bytes), source.sha256);
  }
  assert.equal(expected.size, 0);
  assert.equal(UKRAINE_ROLE_MANIFEST.path, folder + 'presentations.json');
  assert.equal(UKRAINE_ROLE_MANIFEST.bytes, Buffer.byteLength(recordText));
  assert.equal(UKRAINE_ROLE_MANIFEST.sha256, sha(recordText));
  assert.ok(Object.isFrozen(UKRAINE_ROLE_IMAGES));
  assert.deepEqual(
    UKRAINE_ROLE_IMAGES.map((pin) => pin.id),
    [...ROLE_IDS],
  );
  for (const pin of UKRAINE_ROLE_IMAGES) {
    const role = records.roles.find((role) => role.classId === pin.id);
    assert.ok(Object.isFrozen(pin));
    assert.equal(pin.path, folder + role.body.src);
    assert.equal(pin.sha256, role.sha256);
    assert.equal(pin.width, role.width);
    assert.equal(pin.height, role.height);
    assert.equal((await read(pin.path)).length, pin.bytes);
  }
});

test('one gallery entry preserves controls and three non-downloading in-page source destinations', () => {
  const byId = new Map(elements.map((node) => [attrs(node).id, node]).filter(([id]) => id));
  assert.equal(byId.size, elements.filter((node) => attrs(node).id).length);
  for (const id of ['role', 'board', 'width', 'heading', 'speed', 'background'])
    assert.equal(byId.get(id)?.tagName, 'select');
  for (const id of ['wings', 'guides', 'reduced']) {
    assert.equal(byId.get(id)?.tagName, 'input');
    assert.equal(attrs(byId.get(id)).type, 'checkbox');
  }
  for (const source of UKRAINE_ROLE_SOURCES) {
    const link = byId.get('ukraine-role-source-' + source.id);
    assert.equal(link?.tagName, 'a');
    assert.equal(folder + attrs(link).href, source.path);
    assert.equal(attrs(link)['data-ukraine-role-source'], source.id);
    assert.equal(attrs(link).target, undefined);
    assert.equal(attrs(link).download, undefined);
  }
  const scripts = elements.filter((node) => node.tagName === 'script');
  assert.equal(
    scripts.filter((node) => attrs(node).type === 'module' && attrs(node).src === 'gallery.mjs')
      .length,
    1,
  );
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
      'https://gallery.test/authoring/library/ukraine-role-presentations/index.html',
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
              disposed.push(role.classId);
            },
          });
    },
    paint: (card, options) => paints.push({ card, options: { ...options } }),
  };
  let host;
  if (gallery === 'readers') {
    const presentation = mountUkraineRolePresentation({ ...mountOptions, autoStart: false });
    host = mountAuthoringReference({ document: doc, window: win });
    const readers = attachUkraineRoleReaders({
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
      ? mountUkraineRoleGallery({ document: doc, window: win })
      : mountUkraineRolePresentation(mountOptions);
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

test('one complete load renders seven stable role cards and owns one animation frame at a time', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'playing');
  assert.equal(h.$('cards').querySelectorAll('article').length, 7);
  assert.equal(h.$('cards').querySelectorAll('canvas').length, 7);
  assert.equal(h.loads.length, 7);
  assert.equal(h.frames.size, 1);
  for (const id of ROLE_IDS) {
    const heading = h.$(`ukraine-role-${id}`),
      reader = h.$(`ukraine-role-read-${id}`),
      region = h.$(`ukraine-role-canvas-${id}`);
    assert.equal(heading.tagName, 'H2');
    assert.equal(heading.dataset.authoringTarget, reader.id);
    assert.equal(reader.tagName, 'BUTTON');
    const canvas = region.tagName === 'CANVAS' ? region : region.querySelector('canvas');
    assert.equal(canvas.width, 600);
    assert.equal(canvas.height, 190);
  }
  const painted = h.paints.length;
  h.tick();
  assert.equal(h.paints.length, painted + 7);
  assert.equal(h.frames.size, 1);
  h.tick();
  assert.equal(h.paints.length, painted + 14);
  assert.equal(h.frames.size, 1);
});

test('Pause stops scheduling while each explicit display edit repaints the current frozen view', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.$('pause').click();
  assert.equal(h.$('pause').getAttribute('aria-pressed'), 'true');
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'paused');
  assert.equal(h.frames.size, 0);
  const frozen = h.paints.length;
  h.tick();
  h.tick();
  assert.equal(h.paints.length, frozen);
  for (const [id, value, option, expected] of [
    ['board', '48', 'boardWidth', 48],
    ['width', '1152', 'arenaWidth', 1152],
    ['heading', '180', 'heading', Math.PI],
    ['speed', '0', 'speedRatio', 0],
    ['background', 'light', 'background', 'light'],
  ]) {
    const before = h.paints.length;
    h.change(id, value);
    assert.equal(h.paints.length, before + 7, id);
    assert.equal(h.paints.at(-1).options[option], expected, id);
    assert.equal(h.paints.at(-1).options.paused, true, id);
    assert.equal(h.frames.size, 0, id);
  }
  for (const [id, option] of [
    ['wings', 'showWings'],
    ['guides', 'guides'],
  ]) {
    const before = h.paints.length;
    h.$(id).click();
    assert.equal(h.paints.length, before + 7, id);
    assert.equal(h.paints.at(-1).options[option], h.$(id).checked);
    assert.equal(h.frames.size, 0);
  }
  h.$('pause').click();
  assert.equal(h.$('pause').getAttribute('aria-pressed'), 'false');
  assert.equal(h.frames.size, 0, 'Hidden wings do not run an invisible animation loop');
  h.$('wings').click();
  assert.equal(h.frames.size, 1);
});

test('manual reduced motion and live OS preference stop frames without losing the chosen pause state', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.$('reduced').click();
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'reduced');
  assert.equal(h.frames.size, 0);
  h.change('heading', '90');
  assert.equal(h.paints.at(-1).options.reducedMotion, true);
  assert.equal(h.frames.size, 0);
  h.motion(true);
  h.$('reduced').click();
  assert.equal(h.$('reduced').checked, false);
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'reduced');
  assert.equal(h.frames.size, 0, 'Manual checkbox cannot override a live OS reduce preference');
  h.motion(false);
  assert.equal(h.frames.size, 1);
  h.$('pause').click();
  h.motion(true);
  h.motion(false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('pause').getAttribute('aria-pressed'), 'true');
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'paused');
});

test('initial OS reduced motion paints a static composition without requesting preview frames', async (t) => {
  const h = fixture(t, { osReduced: true });
  await h.host.ready;
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'reduced');
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('reduced').checked, false, 'Manual preference stays distinct from the OS');
  assert.ok(h.paints.length >= 7);
  assert.equal(h.paints.at(-1).options.reducedMotion, true);
});

test('an open modal suspends preview scheduling and closing it resumes only the current live owner', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  const dialog = h.doc.createElement('dialog'),
    action = h.doc.createElement('button');
  dialog.append(action);
  h.doc.body.append(dialog);
  dialog.showModal();
  action.focus();
  h.observe();
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'suspended');
  const before = h.paints.length;
  h.tick();
  assert.equal(h.paints.length, before);
  dialog.close();
  h.observe();
  assert.equal(h.frames.size, 1);
  h.$('pause').click();
  dialog.showModal();
  h.observe();
  dialog.close();
  h.observe();
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('pause').getAttribute('aria-pressed'), 'true');
});

for (const event of ['blur', 'hidden', 'pagehide', 'persisted-pagehide'])
  test(`${event} stops preview work immediately and fences a late metadata response`, async (t) => {
    const pending = deferred();
    let readCount = 0;
    const h = fixture(t, {
      readPresentations: () => (++readCount === 1 ? structuredClone(records) : pending.promise),
    });
    await h.host.ready;
    h.$('ukraine-role-retry').focus();
    h.$('ukraine-role-retry').click();
    assert.equal(h.$('status').dataset.state, 'loading');
    if (event === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.win.emit('pagehide', { persisted: event === 'persisted-pagehide' });
    assert.equal(h.frames.size, 0);
    assert.equal(h.requests.at(-1).signal.aborted, true);
    const text = h.$('status').textContent,
      paints = h.paints.length,
      loaded = h.loads.length;
    pending.resolve(structuredClone(records));
    await settle();
    assert.equal(h.$('status').textContent, text);
    assert.equal(h.paints.length, paints);
    assert.equal(h.loads.length, loaded);
    assert.equal(h.frames.size, 0);
  });

for (const event of ['blur', 'hidden', 'pagehide', 'persisted-pagehide'])
  test(`ready animation stops on ${event} without waiting for another scheduled frame`, async (t) => {
    const h = fixture(t);
    await h.host.ready;
    assert.equal(h.frames.size, 1);
    if (event === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.win.emit('pagehide', { persisted: event === 'persisted-pagehide' });
    assert.equal(h.frames.size, 0);
    const before = h.paints.length;
    h.tick();
    h.tick();
    assert.equal(h.paints.length, before);
    assert.equal(h.frames.size, 0);
  });

const retry = (h) => {
  h.$('ukraine-role-retry').focus();
  h.$('ukraine-role-retry').click();
};

test('Cancel owns pending recheck and retired success cannot acquire images or replace the current view', async (t) => {
  const pending = deferred();
  let count = 0;
  const h = fixture(t, {
    readPresentations: () => (++count === 1 ? structuredClone(records) : pending.promise),
  });
  await h.host.ready;
  const cards = [...h.$('cards').children],
    beforeLoads = h.loads.length;
  retry(h);
  assert.equal(h.doc.activeElement, h.$('ukraine-role-cancel'));
  assert.equal(h.$('ukraine-role-cancel').hidden, false);
  h.$('ukraine-role-cancel').click();
  assert.equal(h.requests.at(-1).signal.aborted, true);
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.equal(h.doc.activeElement, h.$('ukraine-role-retry'));
  const text = h.$('status').textContent,
    beforePaints = h.paints.length;
  pending.resolve(structuredClone(records));
  await settle();
  assert.equal(h.$('status').textContent, text);
  assert.equal(h.loads.length, beforeLoads);
  assert.equal(h.paints.length, beforePaints);
  assert.deepEqual([...h.$('cards').children], cards);
});

test('older failed recheck cannot overwrite the result and ownership of a newer completed retry', async (t) => {
  const pending = deferred();
  let count = 0;
  const h = fixture(t, {
    readPresentations: () => (++count === 2 ? pending.promise : structuredClone(records)),
  });
  await h.host.ready;
  retry(h);
  h.$('ukraine-role-cancel').click();
  retry(h);
  await h.host.ready;
  const text = h.$('status').textContent,
    loaded = h.loads.length,
    painted = h.paints.length;
  assert.equal(h.$('status').dataset.state, 'ready');
  pending.reject(new Error('Old source response'));
  await settle();
  assert.equal(h.$('status').textContent, text);
  assert.equal(h.loads.length, loaded);
  assert.equal(h.paints.length, painted);
  assert.equal(h.doc.activeElement, h.$('ukraine-role-retry'));
  assert.equal(h.frames.size, 1);
});

test('failed image staging releases acquired resources and leaves Retry reachable without partial publication', async (t) => {
  const released = [];
  const h = fixture(t, {
    loadImage: async (role) => {
      if (role.classId === 'carrier') throw new Error('Image decode failed');
      return {
        image: { naturalWidth: role.width, naturalHeight: role.height, src: role.body.src },
        dispose() {
          released.push(role.classId);
        },
      };
    },
  });
  await h.host.ready;
  await settle();
  assert.equal(h.$('status').dataset.state, 'error');
  assert.equal(h.$('ukraine-role-retry').disabled, false);
  assert.equal(h.$('ukraine-role-cancel').hidden, true);
  assert.equal(h.frames.size, 0);
  assert.equal(h.paints.length, 0);
  assert.equal(new Set(released).size, released.length, 'Every acquired image released once');
  assert.equal(
    released.length,
    h.loads.length - 1,
    'Every successful sibling resource is released',
  );
});

test('pending image completion after Cancel is disposed and never replaces the later successful generation', async (t) => {
  const pending = deferred(),
    released = [],
    acquired = [];
  let generation = 0;
  const h = fixture(t, {
    readPresentations: async () => {
      generation++;
      return structuredClone(records);
    },
    loadImage: (role) => {
      const own = generation;
      acquired.push(`${own}:${role.classId}`);
      if (own === 1 && role.classId === 'scout') return pending.promise;
      return Promise.resolve({
        image: { naturalWidth: role.width, naturalHeight: role.height, source: own },
        dispose() {
          released.push(`${own}:${role.classId}`);
        },
      });
    },
  });
  await settle();
  assert.equal(acquired.filter((key) => key.startsWith('1:')).length, 7);
  h.$('ukraine-role-cancel').click();
  assert.deepEqual(
    released.filter((key) => key.startsWith('1:')).sort(),
    acquired.filter((key) => key.startsWith('1:') && key !== '1:scout').sort(),
    'Cancel releases the six already-decoded staging resources synchronously; one sibling may never settle',
  );
  retry(h);
  await h.host.ready;
  assert.equal(h.$('status').dataset.state, 'ready');
  const text = h.$('status').textContent,
    painted = h.paints.length;
  pending.resolve({
    image: { naturalWidth: 1254, naturalHeight: 1254, source: 1 },
    dispose() {
      released.push('1:scout');
    },
  });
  await settle();
  assert.equal(h.$('status').textContent, text);
  assert.equal(h.paints.length, painted);
  assert.equal(new Set(released).size, released.length);
  assert.deepEqual(
    released.filter((key) => key.startsWith('1:')).sort(),
    acquired.filter((key) => key.startsWith('1:')).sort(),
  );
  assert.equal(released.filter((key) => key.startsWith('2:')).length, 0);
  assert.ok(h.paints.slice(-7).every(({ card }) => card.image.source === 2));
});

test('newer focus and dialog ownership survive asynchronous source completion', async (t) => {
  const pending = deferred();
  const h = fixture(t, { readPresentations: () => pending.promise });
  const dialog = h.doc.createElement('dialog'),
    button = h.doc.createElement('button');
  dialog.append(button);
  h.doc.body.append(dialog);
  dialog.showModal();
  button.focus();
  h.observe();
  pending.resolve(structuredClone(records));
  await h.host.ready;
  assert.equal(h.doc.activeElement, button);
  assert.equal(dialog.open, true);
  assert.equal(h.frames.size, 0);
  dialog.close();
  h.observe();
});

test('destroy releases committed resources and subscriptions and makes later controls inert', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  const before = h.paints.length;
  h.host.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
  assert.deepEqual([...h.disposed].sort(), [...ROLE_IDS].sort());
  h.$('pause').click();
  h.change('heading', '180');
  h.motion(true);
  h.win.emit('focus');
  h.tick();
  assert.equal(h.paints.length, before);
  assert.equal(h.frames.size, 0);
  h.host.destroy();
  assert.equal(h.disposed.length, 7);
});

test('real reader adapters and reference owner retain all seven Sections and bounded two-axis reading', async (t) => {
  const h = fixture(t, { gallery: 'readers' });
  await h.host.presentation.ready;
  for (const role of ROLE_IDS) {
    const heading = h.$(`ukraine-role-${role}`),
      reader = h.$(`ukraine-role-read-${role}`),
      region = h.$(`ukraine-role-canvas-${role}`);
    h.sections.click();
    const chooser = h.doc.querySelector('.authoring-sections-dialog');
    const choice = [...chooser.querySelectorAll('button')].find(
      (button) => button.textContent === heading.textContent.trim(),
    );
    assert.ok(choice, role);
    choice.click();
    h.tick();
    h.tick();
    assert.equal(h.doc.activeElement, reader);
    assert.equal(h.host.navigation.editorState(), null);
    Object.assign(region, {
      clientWidth: 100,
      scrollWidth: 600,
      clientHeight: 100,
      scrollHeight: 190,
      scrollLeft: 0,
      scrollTop: 0,
    });
    h.pulse(0);
    assert.equal(h.host.navigation.editorState()?.element, reader);
    h.pulse(15);
    h.pulse(13);
    assert.ok(region.scrollLeft > 0 && region.scrollLeft <= 500, role);
    assert.ok(region.scrollTop > 0 && region.scrollTop <= 90, role);
    h.pulse(1);
    assert.equal(h.host.navigation.editorState(), null);
    assert.equal(h.doc.activeElement, reader);
  }
  assert.deepEqual(h.storageWrites, []);
});

test('three exact literal document views return to their own source without navigation or a saved project', async (t) => {
  const h = fixture(t, { gallery: true }),
    url = h.win.location.href;
  // This fixture qualifies static document bindings even while original loading
  // is unavailable in the Node file-origin host; complete browser boot is separate.
  for (const source of UKRAINE_ROLE_SOURCES) {
    const link = h.$(`ukraine-role-source-${source.id}`);
    link.focus();
    h.pulse(0);
    const dialog = h.$('reveal-source-dialog');
    assert.equal(dialog.open, true);
    assert.equal(dialog.dataset.path, source.path);
    for (let i = 0; i < 100 && dialog.dataset.state === 'loading'; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(dialog.dataset.state, 'ready');
    assert.equal(
      h.$('reveal-source-region').querySelector('pre').textContent,
      sourceBodies.get(source.path).toString(),
    );
    h.pulse(1);
    assert.equal(dialog.open, false);
    assert.equal(h.doc.activeElement, link);
    assert.equal(h.win.location.href, url);
  }
  assert.deepEqual(h.storageWrites, []);
});

test('live EN/UK labels preserve loaded cards, active source names and paused input ownership', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  h.$('pause').focus();
  h.$('pause').click();
  const title = h.$('ukraine-role-scout'),
    reader = h.$('ukraine-role-read-scout'),
    english = {
      title: title.textContent,
      reader: reader.getAttribute('aria-label'),
      pause: h.$('pause').textContent,
    },
    cards = [...h.$('cards').children];
  assert.equal(english.title, 'Courier swallow');
  assert.match(h.$('status').textContent, /All seven originals are ready/);
  translateDOM(h.doc.body);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('ukraine-role-motion-status').dataset.state, 'paused');
  setLocale('uk', { persist: false });
  assert.equal(title.textContent, 'Ластівка-кур’єр');
  assert.match(reader.getAttribute('aria-label'), /Ластівка-кур’єр/);
  assert.match(h.$('status').textContent, /Усі сім оригіналів готові/);
  assert.notEqual(h.$('pause').textContent, english.pause);
  assert.equal(h.doc.activeElement, h.$('pause'));
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('pause').getAttribute('aria-pressed'), 'true');
  assert.equal(h.$('ukraine-role-scout'), title);
  assert.equal(h.$('ukraine-role-read-scout'), reader);
  assert.deepEqual([...h.$('cards').children], cards);
  setLocale('en', { persist: false });
  assert.equal(title.textContent, english.title);
  assert.equal(reader.getAttribute('aria-label'), english.reader);
  assert.equal(h.$('pause').textContent, english.pause);
  assert.deepEqual(h.storageWrites, []);
});

test('BFCache resumes only an eligible retained view and never retries a canceled load implicitly', async (t) => {
  const pending = deferred();
  let reads = 0;
  const h = fixture(t, {
    readPresentations: () => (++reads === 1 ? structuredClone(records) : pending.promise),
  });
  await h.host.ready;
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 1);
  assert.equal(reads, 1);
  assert.equal(
    h.paints.at(-1).options.elapsed,
    0,
    'Resumption cannot catch up hidden elapsed time',
  );
  h.$('pause').click();
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 0);
  retry(h);
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(reads, 2);
  assert.equal(h.$('status').dataset.state, 'cancelled');
  pending.resolve(structuredClone(records));
  await settle();
  assert.equal(h.$('status').dataset.state, 'cancelled');
});

test('destroy releases acquired staging images immediately even if another decode never settles', async (t) => {
  const pending = deferred(),
    released = [];
  const h = fixture(t, {
    loadImage: (role) =>
      role.classId === 'scout'
        ? pending.promise
        : Promise.resolve({
            image: { naturalWidth: role.width, naturalHeight: role.height },
            dispose() {
              released.push(role.classId);
            },
          }),
  });
  await settle();
  assert.equal(h.loads.length, 7);
  assert.deepEqual(released, []);
  h.host.destroy();
  assert.deepEqual([...released].sort(), ROLE_IDS.filter((id) => id !== 'scout').sort());
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.frames.size, 0);
  assert.equal(h.paints.length, 0);
  pending.resolve({
    image: { naturalWidth: 1254, naturalHeight: 1254 },
    dispose() {
      released.push('scout');
    },
  });
  await h.host.ready;
  assert.deepEqual([...released].sort(), [...ROLE_IDS].sort());
  h.host.destroy();
  assert.equal(released.length, 7);
});

test('the selected role alone remains visible and explicit role changes reset only cosmetic animation state', async (t) => {
  const h = fixture(t);
  await h.host.ready;
  const articles = [...h.$('cards').querySelectorAll('article')],
    canvases = [...h.$('cards').querySelectorAll('canvas')];
  for (const { card } of h.paints.slice(-7)) card.state.time = 8;
  h.change('role', 'carrier');
  assert.equal(articles.filter((article) => !article.hidden).length, 1);
  assert.equal(h.paints.at(-1).card.role.classId, 'carrier');
  assert.equal(h.paints.at(-1).card.state.time, 0);
  const before = h.paints.length;
  h.tick();
  assert.equal(h.paints.length, before + 1);
  assert.deepEqual([...h.$('cards').querySelectorAll('canvas')], canvases);
  h.change('role', 'all');
  assert.equal(articles.filter((article) => !article.hidden).length, 7);
  assert.deepEqual(
    h.paints.slice(-7).map(({ card }) => card.role.classId),
    [...ROLE_IDS],
  );
  assert.deepEqual(h.storageWrites, []);
});

test('the actual 30-second load deadline aborts captured work and late metadata cannot replace retained cards', async (t) => {
  const pending = deferred();
  let reads = 0;
  const h = fixture(t, {
    readPresentations: () => (++reads === 2 ? pending.promise : structuredClone(records)),
  });
  await h.host.ready;
  const cards = [...h.$('cards').children],
    loads = h.loads.length;
  retry(h);
  assert.equal(h.timers.size, 1);
  const timer = [...h.timers.values()][0];
  assert.equal(timer.duration, 30000);
  timer.callback();
  assert.equal(h.requests.at(-1).signal.aborted, true);
  assert.equal(h.$('status').dataset.state, 'error');
  assert.equal(h.doc.activeElement, h.$('ukraine-role-retry'));
  assert.equal(h.frames.size, 0);
  const text = h.$('status').textContent;
  pending.resolve(structuredClone(records));
  await settle();
  assert.equal(h.$('status').textContent, text);
  assert.equal(h.loads.length, loads);
  assert.deepEqual([...h.$('cards').children], cards);
});

test('settlement restores user-navigated Cancel, preserves newer controls and explicit Cancel has a reachable fallback', async (t) => {
  let gate = deferred();
  const h = fixture(t, { autoStart: false, readPresentations: () => gate.promise });
  h.$('width').focus();
  h.host.load();
  assert.equal(h.doc.activeElement, h.$('width'));
  h.$('ukraine-role-cancel').focus();
  gate.resolve(structuredClone(records));
  await h.host.ready;
  assert.equal(
    h.doc.activeElement,
    h.$('ukraine-role-retry'),
    'The current user-focused Cancel must not become hidden with focus',
  );
  gate = deferred();
  h.$('ukraine-role-retry').focus();
  h.host.load();
  assert.equal(h.doc.activeElement, h.$('ukraine-role-cancel'));
  h.$('width').focus();
  gate.resolve(structuredClone(records));
  await h.host.ready;
  assert.equal(h.doc.activeElement, h.$('width'), 'Settling cannot steal newer control focus');
  gate = deferred();
  h.$('width').focus();
  h.host.load();
  h.$('ukraine-role-cancel').focus();
  h.$('ukraine-role-cancel').click();
  assert.equal(h.doc.activeElement, h.$('ukraine-role-retry'));
  assert.equal(h.$('status').dataset.state, 'cancelled');
  gate.resolve(structuredClone(records));
  await settle();
});

test('the production metadata reader hashes bounded exact bytes before applying the source-candidate schema', async () => {
  const requests = [],
    controller = new AbortController();
  const data = await readUkraineRolePresentations({
    signal: controller.signal,
    window: {
      crypto: webcrypto,
      async fetch(url, options) {
        requests.push({ url, options });
        return new Response(recordText);
      },
    },
  });
  assert.deepEqual(data, records);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://gallery.test/' + UKRAINE_ROLE_MANIFEST.path);
  assert.equal(requests[0].options.signal, controller.signal);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.cache, 'no-store');
});
for (const reason of ['same-length edited bytes', 'truncated bytes', 'aborted before fetch'])
  test(`production metadata rejects ${reason} before publishing candidates`, async () => {
    let bytes = Buffer.from(recordText),
      requests = 0;
    const controller = new AbortController();
    if (reason === 'same-length edited bytes') bytes[bytes.length - 2] ^= 1;
    if (reason === 'truncated bytes') bytes = bytes.subarray(0, bytes.length - 1);
    if (reason === 'aborted before fetch') controller.abort();
    await assert.rejects(
      readUkraineRolePresentations({
        signal: controller.signal,
        window: {
          crypto: webcrypto,
          async fetch() {
            requests++;
            return new Response(bytes);
          },
        },
      }),
    );
    assert.equal(requests, reason === 'aborted before fetch' ? 0 : 1);
  });

test('the production image loader refuses crossed role hashes before requesting an original', () => {
  const role = structuredClone(records.roles[0]);
  role.sha256 = records.roles[1].sha256;
  assert.throws(() =>
    loadUkraineRoleImage(role, {
      window: { fetch: () => assert.fail('Must reject before fetch') },
    }),
  );
});

test('the copied real painter retains four source samples and pauses its existing wing clock on explicit edits', () => {
  const calls = [];
  const context = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) =>
          calls.push([method, ...args]),
    },
  );
  const card = {
    role: structuredClone(records.roles[0]),
    image: { naturalWidth: 1254, naturalHeight: 1254 },
    state: { time: 0, phases: {}, rates: {} },
    canvas: { getContext: () => context },
  };
  const options = {
    elapsed: 0.05,
    paused: false,
    reducedMotion: false,
    speedRatio: 1,
    background: 'dark',
    arenaWidth: 294,
    boardWidth: 72,
    heading: 0,
    showWings: true,
    guides: false,
  };
  paintUkraineRoleCard(card, options);
  assert.deepEqual(
    calls.find((call) => call[0] === 'fillRect'),
    ['fillRect', 0, 0, 600, 190],
  );
  assert.deepEqual(
    calls.filter((call) => call[0] === 'translate' && call[2] === 93),
    [
      ['translate', 88, 93],
      ['translate', 238, 93],
      ['translate', 367, 93],
      ['translate', 508, 93],
    ],
  );
  assert.deepEqual(
    calls.filter((call) => call[0] === 'fillText').map((call) => call.slice(2)),
    [
      [18, 178],
      [184, 178],
      [313, 178],
      [451, 178],
    ],
  );
  assert.equal(calls.filter((call) => call[0] === 'drawImage').length, 4);
  assert.ok(card.state.time > 0 && card.state.phases.wings > 0);
  const state = structuredClone(card.state);
  paintUkraineRoleCard(card, { ...options, paused: true, heading: Math.PI, boardWidth: 48 });
  assert.deepEqual(card.state, state);
  paintUkraineRoleCard(card, { ...options, reducedMotion: true });
  assert.deepEqual(card.state, state);
});
