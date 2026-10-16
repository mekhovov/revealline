import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountFpvEnemyGallery } from '../../authoring/library/fpv-enemy-presentations/gallery.mjs';
import {
  mountFpvEnemyPresentation,
  validateFpvEnemyInspection,
} from '../../authoring/library/fpv-enemy-presentations/presentation.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { FPV_ENEMY_SOURCES } from '../../authoring/library/fpv-enemy-presentations/sources.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = 'authoring/library/fpv-enemy-presentations/';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const types = [
  'bouncer',
  'border-patrol',
  'contour-patrol',
  'claimed-rover',
  'eroder',
  'lane-boss',
  'relay-sentinel',
];
const historicalPins = [
  {
    path: 'README.md',
    bytes: 4170,
    sha256: '4c5defe333fd03ab0a1c33511f506985ba6d42383f3764ef5e383211d7a26626',
  },
  {
    path: 'inspection.json',
    bytes: 7818,
    sha256: 'b49a23d7dc16998f7c2331a255e315848afac5aa708f97572e95d416a1e03603',
  },
  {
    path: 'provenance.json',
    bytes: 14247,
    sha256: '3de2da43dddca5135c2d1a0c16bb1072c576c2176b3a492d202d39801d85fdcb',
  },
];
const provenance = JSON.parse(await read(folder + 'provenance.json'));
const inspection = JSON.parse(await read(folder + 'inspection.json'));
const markup = parse((await read(folder + 'index.html')).toString());
const elements = [];
const visit = (node) => {
  if (node.tagName) elements.push(node);
  node.childNodes?.forEach(visit);
};
visit(markup);
const attributes = (node) =>
  Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));

test('the viewer exposes exactly seven original image pins plus the retained guide and measurements', async () => {
  assert.ok(Object.isFrozen(FPV_ENEMY_SOURCES));
  assert.equal(FPV_ENEMY_SOURCES.length, 9);
  assert.equal(new Set(FPV_ENEMY_SOURCES.map((source) => source.id)).size, 9);
  const images = FPV_ENEMY_SOURCES.filter((source) => source.kind === 'image');
  assert.deepEqual(
    images.map((source) => source.id),
    types,
  );
  assert.deepEqual(
    provenance.items.map((item) => item.type),
    types,
  );
  for (const source of images) {
    const original = provenance.items.find((item) => item.type === source.id);
    assert.ok(Object.isFrozen(source));
    assert.equal(source.path, folder + original.original);
    assert.equal(source.bytes, original.bytes);
    assert.equal(source.sha256, original.sha256);
    assert.equal(source.width, original.actualDimensions[0]);
    assert.equal(source.height, original.actualDimensions[1]);
  }
  const documents = FPV_ENEMY_SOURCES.filter((source) => source.kind === 'text');
  assert.deepEqual(documents.map((source) => source.id).sort(), ['guide', 'inspection']);
  assert.deepEqual(
    documents.map((source) => source.path).sort(),
    [folder + 'README.md', folder + 'inspection.json'].sort(),
  );
  for (const source of documents) {
    assert.ok(Object.isFrozen(source));
    const bytes = await read(source.path);
    assert.equal(source.bytes, bytes.length);
    assert.equal(source.sha256, sha(bytes));
    assert.ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes).length);
  }
});

test('original bodies, prompts and historical source qualifications remain byte-exact and source-only', async () => {
  for (const pin of historicalPins) {
    const bytes = await read(folder + pin.path);
    assert.equal(bytes.length, pin.bytes, pin.path);
    assert.equal(sha(bytes), pin.sha256, pin.path);
  }
  assert.equal(provenance.sourceOnly, true);
  assert.deepEqual(
    inspection.images.map((row) => row.type),
    types,
  );
  let total = 0;
  for (const original of provenance.items) {
    const bytes = await read(folder + original.original),
      measured = inspection.images.find((row) => row.type === original.type);
    assert.equal(bytes.length, original.bytes, original.type);
    assert.equal(sha(bytes), original.sha256, original.type);
    assert.equal(measured.bytes, original.bytes);
    assert.equal(measured.sha256, original.sha256);
    assert.deepEqual(measured.dimensions, [1254, 1254]);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), 1254);
    assert.equal(bytes.readUInt32BE(20), 1254);
    assert.equal(bytes[24], 8);
    assert.equal(bytes[25], 6);
    assert.equal(original.runtimeBinding, null);
    assert.deepEqual(original.transforms, []);
    assert.equal(sha(await read(folder + original.prompt)), original.promptSha256);
    total += bytes.length;
  }
  assert.equal(total, 6522849);
  assert.equal(total, inspection.totalOriginalBytes);
  // Byte/header and historical-record checks do not repeat alpha analysis or
  // native full PNG decoding and do not certify gameplay/pivot/animation quality.
});

test('the gallery retains its three controls and two literal document destinations under one module entry', () => {
  const byId = new Map(elements.map((node) => [attributes(node).id, node]).filter(([id]) => id));
  assert.equal(byId.size, elements.filter((node) => attributes(node).id).length);
  assert.equal(byId.get('heading')?.tagName, 'select');
  assert.equal(byId.get('role')?.tagName, 'select');
  assert.equal(byId.get('pivots')?.tagName, 'input');
  assert.equal(attributes(byId.get('pivots')).type, 'checkbox');
  const directions = byId
    .get('heading')
    .childNodes.filter((node) => node.tagName === 'option')
    .map((node) => attributes(node).value);
  assert.deepEqual(directions, ['0', '90', '180', '270']);
  for (const [id, path] of [
    ['guide', 'README.md'],
    ['inspection', 'inspection.json'],
  ]) {
    const link = byId.get(`fpv-enemy-source-${id}`);
    assert.equal(link?.tagName, 'a');
    assert.equal(attributes(link).href, path);
    assert.equal(attributes(link).target, undefined);
    assert.equal(attributes(link).download, undefined);
  }
  const scripts = elements.filter((node) => node.tagName === 'script');
  assert.equal(
    scripts.filter(
      (node) => attributes(node).type === 'module' && attributes(node).src === 'gallery.mjs',
    ).length,
    1,
  );
  assert.equal(
    scripts.filter((node) => attributes(node).src?.endsWith('authoring-reference-entry.mjs'))
      .length,
    0,
  );
  assert.equal(
    scripts.filter(
      (node) => !attributes(node).src && node.childNodes.some((child) => child.value?.trim()),
    ).length,
    0,
    'No competing inline owner',
  );
});

test('the candidate gallery and all seven originals stay outside default distribution admission', async () => {
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

function fixture(
  t,
  {
    presentationOnly = false,
    readInspection = async () => structuredClone(inspection),
    decodeImage = async () => {},
  } = {},
) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set();
  doc.parentNode = win;
  const pad = {
    id: 'FPV source finite test pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let time = 1000,
    serial = 0;
  Object.assign(win, {
    location: new URL('https://gallery.test/authoring/library/fpv-enemy-presentations/index.html'),
    innerHeight: 600,
    devicePixelRatio: 1,
    performance: { now: () => time },
    scrollBy() {},
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
      observe() {
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
    node.before = (sibling) => node.parentNode.insertBefore(sibling, node);
    if (tag === 'a')
      Object.defineProperty(node, 'href', {
        get: () => node.getAttribute('href') ?? '',
        set: (value) => node.setAttribute('href', value),
      });
    // Resolve finite image commands only. Native source/pixel decoding is a
    // separate browser qualification, not supplied by this DOM boundary.
    if (tag === 'img') node.decode = async () => {};
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
      if (['hidden', 'disabled', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
  };
  const documentNode = markup.childNodes.find((node) => node.tagName === 'html');
  for (const name of ['head', 'body'])
    documentNode.childNodes
      .find((node) => node.tagName === name)
      .childNodes.forEach((node) => append(doc[name], node));
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    locale = getLocale();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => [pad] },
  });
  setLocale('en', { persist: false });
  const requests = [],
    decoded = [];
  const host = presentationOnly
    ? mountFpvEnemyPresentation({
        document: doc,
        window: win,
        readInspection: (options) => {
          requests.push(options);
          return readInspection(options);
        },
        decodeImage: (image) => {
          decoded.push({ image, src: image.src });
          return decodeImage(image);
        },
      })
    : mountFpvEnemyGallery({ document: doc, window: win });
  translateDOM(doc.body);
  const tick = () => {
    time += 50;
    pad.timestamp = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(time));
    [...observers].forEach((observer) => observer.callback());
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
    prior ? Object.defineProperty(globalThis, 'navigator', prior) : delete globalThis.navigator;
    setLocale(locale, { persist: false });
  });
  tick();
  tick();
  return {
    doc,
    win,
    host,
    frames,
    observers,
    requests,
    decoded,
    $: (id) => doc.getElementById(id),
    tick,
    pulse,
    sections: doc.querySelector('.authoring-input-rail button'),
  };
}

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

// These are finite DOM/standard-pad ownership checks. They do not establish
// browser layout, native PNG decoding, physical controllers or runtime adoption.
test('seven enemy sections retain all 57 image samples and exact source openers', async (t) => {
  const h = fixture(t, { presentationOnly: true });
  await settle();
  const images = h.doc.querySelectorAll('img'),
    cards = h.$('grid').querySelectorAll('article');
  assert.equal(images.length, 57);
  assert.equal(cards.length, 7);
  assert.equal(h.$('role').options.length, 7);
  assert.deepEqual(
    h.$('role').options.map((option) => option.value),
    types,
  );
  for (const [index, type] of types.entries()) {
    const heading = h.$(`fpv-enemy-${type}`),
      link = h.$(`fpv-enemy-source-${type}`),
      samples = cards[index].querySelectorAll('img');
    assert.equal(heading.tagName, 'H2');
    assert.equal(heading.dataset.authoringTarget, link.id);
    assert.equal(link.tagName, 'A');
    assert.equal(link.getAttribute('href'), `originals/${type}.png`);
    assert.equal(link.dataset.fpvEnemySource, type);
    assert.equal(samples.length, 8);
    assert.ok(samples.every((image) => image.src.endsWith(`originals/${type}.png`)));
    assert.deepEqual(
      cards[index].querySelectorAll('.frame').map((frame) => frame.style['--size']),
      ['16px', '24px', '32px', '64px', '16px', '24px', '32px', '64px'],
    );
  }
  for (const source of FPV_ENEMY_SOURCES) {
    const link = h.$(`fpv-enemy-source-${source.id}`);
    assert.equal(link.dataset.fpvEnemySource, source.id);
    assert.equal(folder + link.getAttribute('href'), source.path);
    assert.equal(link.getAttribute('target'), null);
    assert.equal(link.getAttribute('download'), null);
  }
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('grid').querySelectorAll('.metric').length, 7);
});

test('heading, pivot and enlarged-body edits preserve every original sample and section identity', async (t) => {
  const h = fixture(t, { presentationOnly: true });
  await settle();
  const cards = [...h.$('grid').children],
    samples = h.$('grid').querySelectorAll('img'),
    sources = samples.map((image) => image.src);
  h.$('heading').value = '270';
  h.$('heading').emit('change');
  assert.equal(h.doc.documentElement.style['--heading'], '270deg');
  h.$('pivots').click();
  assert.equal(h.doc.body.classList.contains('pivots'), true);
  h.$('pivots').click();
  assert.equal(h.doc.body.classList.contains('pivots'), false);
  const alt = h.$('large').getAttribute('alt');
  h.$('role').value = 'relay-sentinel';
  h.$('role').emit('change');
  await settle();
  assert.ok(h.$('large').src.endsWith('originals/relay-sentinel.png'));
  assert.notEqual(h.$('large').getAttribute('alt'), alt);
  assert.deepEqual([...h.$('grid').children], cards);
  assert.deepEqual(h.$('grid').querySelectorAll('img'), samples);
  assert.deepEqual(
    samples.map((image) => image.src),
    sources,
  );
});

test('every image and document opens the same owned viewer and Back restores the exact source', (t) => {
  const h = fixture(t),
    url = h.win.location.href;
  for (const source of FPV_ENEMY_SOURCES) {
    const link = h.$(`fpv-enemy-source-${source.id}`);
    link.focus();
    h.pulse(0);
    const dialog = h.$('reveal-source-dialog');
    assert.equal(dialog.open, true, source.id);
    assert.equal(dialog.dataset.path, source.path);
    assert.equal(h.doc.querySelectorAll('.authoring-input-rail').length, 1);
    h.pulse(1);
    assert.equal(dialog.open, false, source.id);
    assert.equal(h.doc.activeElement, link, source.id);
    assert.equal(h.win.location.href, url);
  }
});

test('all seven Sections land on an inactive source link through neutral pad frames', (t) => {
  const h = fixture(t);
  for (const type of types) {
    h.sections.click();
    const dialog = h.doc.querySelector('.authoring-sections-dialog'),
      heading = h.$(`fpv-enemy-${type}`),
      choice = [...dialog.querySelectorAll('button')].find(
        (button) => button.textContent === heading.textContent.trim(),
      );
    assert.ok(choice, type);
    choice.click();
    h.tick();
    h.tick();
    assert.equal(h.doc.activeElement.id, `fpv-enemy-source-${type}`);
    assert.equal(h.$('reveal-source-dialog').open, false);
  }
});

const retry = (h) => {
  h.$('fpv-enemy-retry').focus();
  h.$('fpv-enemy-retry').click();
};
const metricTexts = (h) =>
  h
    .$('grid')
    .querySelectorAll('.metric')
    .map((node) => node.textContent);

test('Cancel aborts pending metadata and late completion cannot publish or replace retained measurements', async (t) => {
  const pending = deferred();
  let reads = 0;
  const h = fixture(t, {
    presentationOnly: true,
    readInspection: () => (++reads === 1 ? structuredClone(inspection) : pending.promise),
  });
  await settle();
  const metrics = metricTexts(h);
  retry(h);
  assert.equal(h.$('status').dataset.state, 'loading');
  assert.equal(h.doc.activeElement, h.$('fpv-enemy-cancel'));
  assert.equal(h.$('fpv-enemy-cancel').hidden, false);
  h.$('fpv-enemy-cancel').click();
  assert.equal(h.requests.at(-1).signal.aborted, true);
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.equal(h.doc.activeElement, h.$('fpv-enemy-retry'));
  const text = h.$('status').textContent;
  pending.resolve(structuredClone(inspection));
  await settle();
  assert.equal(h.$('status').textContent, text);
  assert.equal(h.$('status').dataset.state, 'cancelled');
  assert.deepEqual(metricTexts(h), metrics);
  assert.equal(h.doc.activeElement, h.$('fpv-enemy-retry'));
});

test('an older rejected load cannot change the result or ownership of a later successful retry', async (t) => {
  const pending = deferred();
  let reads = 0;
  const h = fixture(t, {
    presentationOnly: true,
    readInspection: () => (++reads === 2 ? pending.promise : structuredClone(inspection)),
  });
  await settle();
  retry(h);
  h.$('fpv-enemy-cancel').click();
  retry(h);
  await settle();
  assert.equal(h.$('status').dataset.state, 'ready');
  const text = h.$('status').textContent,
    metrics = metricTexts(h);
  pending.reject(new Error('Obsolete metadata response'));
  await settle();
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.$('status').textContent, text);
  assert.deepEqual(metricTexts(h), metrics);
  assert.equal(h.doc.activeElement, h.$('fpv-enemy-retry'));
});

test('a decode failure remains an actionable error and a later successful recheck clears it', async (t) => {
  let fail = true;
  const h = fixture(t, {
    presentationOnly: true,
    decodeImage: async (image) => {
      if (fail && image.src.endsWith('originals/eroder.png')) throw new Error('Decode failed');
    },
  });
  await settle();
  assert.equal(h.$('status').dataset.state, 'error');
  assert.equal(h.$('fpv-enemy-retry').disabled, false);
  assert.equal(h.$('fpv-enemy-cancel').hidden, true);
  fail = false;
  retry(h);
  await settle();
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.doc.activeElement, h.$('fpv-enemy-retry'));
  assert.equal(h.$('grid').querySelectorAll('article').length, 7);
});

for (const event of ['blur', 'hidden', 'pagehide', 'persisted-pagehide'])
  test(`${event} retires pending image/metadata work without stealing newer focus`, async (t) => {
    const pending = deferred();
    let reads = 0;
    const h = fixture(t, {
      presentationOnly: true,
      readInspection: () => (++reads === 1 ? structuredClone(inspection) : pending.promise),
    });
    await settle();
    const metrics = metricTexts(h);
    retry(h);
    const request = h.requests.at(-1);
    if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else if (event === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else h.win.emit('pagehide', { persisted: event === 'persisted-pagehide' });
    assert.equal(request.signal.aborted, true);
    const text = h.$('status').textContent;
    h.$('role').focus();
    pending.resolve(structuredClone(inspection));
    await settle();
    assert.equal(h.$('status').textContent, text);
    assert.deepEqual(metricTexts(h), metrics);
    assert.equal(h.doc.activeElement, h.$('role'));
  });

test('successful pending recheck respects another control and an open dialog owner', async (t) => {
  const pending = [];
  let reads = 0;
  const h = fixture(t, {
    presentationOnly: true,
    readInspection: () => {
      if (++reads === 1) return structuredClone(inspection);
      const task = deferred();
      pending.push(task);
      return task.promise;
    },
  });
  await settle();
  retry(h);
  h.$('role').focus();
  pending[0].resolve(structuredClone(inspection));
  await settle();
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.doc.activeElement, h.$('role'));
  retry(h);
  const dialog = h.doc.createElement('dialog'),
    action = h.doc.createElement('button');
  dialog.append(action);
  h.doc.body.append(dialog);
  dialog.showModal();
  action.focus();
  pending[1].resolve(structuredClone(inspection));
  await settle();
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.doc.activeElement, action);
  assert.equal(dialog.open, true);
  dialog.close();
});

test('destroy aborts pending work and detaches presentation event handlers', async (t) => {
  const pending = deferred();
  const h = fixture(t, { presentationOnly: true, readInspection: () => pending.promise });
  const request = h.requests[0];
  h.host.destroy();
  assert.equal(request.signal.aborted, true);
  const text = h.$('status').textContent,
    before = h.doc.documentElement.style['--heading'];
  h.$('heading').value = '90';
  h.$('heading').emit('change');
  assert.equal(h.doc.documentElement.style['--heading'], before);
  pending.resolve(structuredClone(inspection));
  await settle();
  assert.equal(h.$('status').textContent, text);
});

test('inspection publication rejects mismatched identities, duplicates and invalid measured values', () => {
  assert.equal(validateFpvEnemyInspection(inspection), inspection);
  for (const corrupt of [
    (value) => {
      value.format = 'unknown';
    },
    (value) => {
      value.images.pop();
    },
    (value) => {
      value.images[1] = structuredClone(value.images[0]);
    },
    (value) => {
      value.images[0].type = 'unknown';
    },
    (value) => {
      value.images[0].bytes++;
    },
    (value) => {
      value.images[0].sha256 = '0'.repeat(64);
    },
    (value) => {
      value.images[0].dimensions[0]++;
    },
    (value) => {
      value.images[0].substantialWidthFraction = Infinity;
    },
    (value) => {
      value.images[0].substantialWidthFraction = -1;
    },
    (value) => {
      value.images[0].actualVisibleRGBColorsAlpha128 = 0.5;
    },
    (value) => {
      value.images[0].alpha.zero = 1254 * 1254 + 1;
    },
  ]) {
    const candidate = structuredClone(inspection);
    corrupt(candidate);
    assert.throws(() => validateFpvEnemyInspection(candidate));
  }
});

test('a stale enlarged-body decode rejection retries the selected source without repeating immutable samples', async (t) => {
  const obsolete = deferred();
  const h = fixture(t, {
    presentationOnly: true,
    decodeImage: (image) =>
      image.id === 'large' && image.src.endsWith('originals/bouncer.png')
        ? obsolete.promise
        : Promise.resolve(),
  });
  await settle();
  assert.equal(h.$('status').dataset.state, 'loading');
  assert.equal(h.decoded.filter(({ image }) => image.id !== 'large').length, 56);
  assert.equal(h.decoded.filter(({ image }) => image.id === 'large').length, 1);
  h.$('role').value = 'relay-sentinel';
  h.$('role').emit('change');
  obsolete.reject(new Error('Prior URL superseded during decode'));
  await h.host.ready;
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.equal(h.decoded.filter(({ image }) => image.id !== 'large').length, 56);
  assert.deepEqual(
    h.decoded.filter(({ image }) => image.id === 'large').map(({ src }) => src),
    ['originals/bouncer.png', 'originals/relay-sentinel.png'],
  );
});

for (const lifecycle of ['blur-and-return', 'persisted-pagehide'])
  test(`late selected-preview failure stays retired after ${lifecycle}`, async (t) => {
    const pending = deferred();
    const h = fixture(t, {
      presentationOnly: true,
      decodeImage: (image) =>
        image.id === 'large' && image.src.endsWith('originals/relay-sentinel.png')
          ? pending.promise
          : Promise.resolve(),
    });
    await h.host.ready;
    h.$('role').value = 'relay-sentinel';
    h.$('role').emit('change');
    await settle();
    assert.equal(h.$('status').dataset.state, 'ready');
    if (lifecycle === 'blur-and-return') {
      h.doc.focused = false;
      h.win.emit('blur');
      h.doc.focused = true;
      h.win.emit('focus');
    } else {
      h.win.emit('pagehide', { persisted: true });
      h.win.emit('pageshow', { persisted: true });
    }
    const text = h.$('status').textContent;
    pending.reject(new Error('Retired selected preview decode'));
    await settle();
    assert.equal(h.$('status').textContent, text);
    assert.equal(h.$('status').dataset.state, 'ready');
  });

test('live locale and late bootstrap preserve selected-body names, ready status and section identities', async (t) => {
  const h = fixture(t, { presentationOnly: true });
  await h.host.ready;
  h.$('role').value = 'relay-sentinel';
  h.$('role').emit('change');
  await settle();
  const title = h.$('fpv-enemy-relay-sentinel'),
    link = h.$('fpv-enemy-source-relay-sentinel'),
    english = title.textContent;
  assert.equal(h.$('large').getAttribute('alt'), english);
  translateDOM(h.doc.body);
  assert.equal(h.$('large').getAttribute('alt'), english);
  assert.equal(h.$('status').dataset.state, 'ready');
  assert.match(h.$('status').textContent, /57/);
  setLocale('uk', { persist: false });
  assert.notEqual(title.textContent, english);
  assert.equal(h.$('large').getAttribute('alt'), title.textContent);
  assert.ok(link.getAttribute('aria-label').endsWith(title.textContent));
  assert.match(h.$('status').textContent, /57/);
  assert.equal(h.$('fpv-enemy-relay-sentinel'), title);
  assert.equal(h.$('fpv-enemy-source-relay-sentinel'), link);
  setLocale('en', { persist: false });
  assert.equal(title.textContent, english);
  assert.equal(h.$('large').getAttribute('alt'), english);
});

test('invalid metadata reload publishes no partial measurements and preserves all prior card identities', async (t) => {
  let report = structuredClone(inspection);
  const h = fixture(t, { presentationOnly: true, readInspection: async () => report });
  await h.host.ready;
  const cards = [...h.$('grid').children],
    metrics = metricTexts(h);
  report = structuredClone(inspection);
  report.images[0].substantialWidthFraction = 0.01;
  report.images[6].sha256 = '0'.repeat(64);
  retry(h);
  await h.host.ready;
  assert.equal(h.$('status').dataset.state, 'error');
  assert.deepEqual(metricTexts(h), metrics);
  assert.deepEqual([...h.$('grid').children], cards);
  assert.equal(h.doc.activeElement, h.$('fpv-enemy-retry'));
});

test('modified native sources keep their fallback and mount/destroy do not duplicate input ownership', (t) => {
  const h = fixture(t),
    link = h.$('fpv-enemy-source-bouncer');
  assert.equal(mountFpvEnemyGallery({ document: h.doc, window: h.win }), h.host);
  assert.equal(h.frames.size, 1);
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    assert.equal(link.emit('click', { [modifier]: true }).defaultPrevented, false);
    assert.equal(h.$('reveal-source-dialog').open, false);
  }
  const href = link.getAttribute('href');
  h.host.destroy();
  assert.equal(h.$('reveal-source-dialog'), null);
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
  assert.equal(link.emit('click').defaultPrevented, false);
  assert.equal(link.getAttribute('href'), href);
});
