import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { mountPreparedTitleReview } from '../../authoring/library/fpv-field-kit/prepared/titles/review.mjs';
import { PREPARED_TITLE_SOURCES } from '../../authoring/library/fpv-field-kit/prepared/titles/review-sources.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = 'authoring/library/fpv-field-kit/prepared/titles/';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const manifestPath = 'authoring/library/fpv-field-kit/prepared-scenes-v2.json';
const manifestRaw = await read(manifestPath);
const manifest = JSON.parse(manifestRaw);
const html = parse((await read(folder + 'review.html')).toString());
const elements = [];
const walk = (node) => {
  if (node.tagName) elements.push(node);
  node.childNodes?.forEach(walk);
};
walk(html);
const attrs = (node) =>
  Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
const imageIds = ['landscape-v1', 'landscape-v2', 'portrait-v1', 'portrait-v2'];
const sourceById = new Map(PREPARED_TITLE_SOURCES.map((source) => [source.id, source]));
const expectedImages = [
  manifest.records[0].previous,
  manifest.records[0].output,
  manifest.records[1].previous,
  manifest.records[1].output,
];

test('prepared-title sources pin only the four preserved preparations and exact literal manifest', () => {
  assert.equal(manifestRaw.length, 8116);
  assert.equal(
    sha(manifestRaw),
    '199c8b23990af731377560e0f70f1469338ed68239986a47bd852f91dcbbac55',
  );
  assert.deepEqual(
    PREPARED_TITLE_SOURCES.map((source) => source.id),
    [...imageIds, 'manifest'],
  );
  assert.ok(Object.isFrozen(PREPARED_TITLE_SOURCES));
  assert.equal(sourceById.size, 5);
  for (const [index, id] of imageIds.entries()) {
    const source = sourceById.get(id),
      expected = expectedImages[index];
    assert.ok(Object.isFrozen(source), id);
    assert.equal(source.kind, 'image', id);
    for (const key of ['path', 'bytes', 'sha256', 'width', 'height'])
      assert.equal(source[key], expected[key], `${id}: ${key}`);
    assert.equal(
      new URL(source.href, `https://titles.test/${folder}review.html`).pathname,
      `/${source.path}`,
    );
  }
  const document = sourceById.get('manifest');
  assert.ok(Object.isFrozen(document));
  assert.equal(document.kind, 'text');
  assert.equal(document.path, manifestPath);
  assert.equal(document.bytes, 8116);
  assert.equal(document.sha256, sha(manifestRaw));
  assert.equal(
    new URL(document.href, `https://titles.test/${folder}review.html`).pathname,
    `/${manifestPath}`,
  );
});

test('the four historical PNG bytes and intrinsic dimensions still match the preserved preparation records', async () => {
  let total = 0;
  for (const [index, expected] of expectedImages.entries()) {
    const bytes = await read(expected.path),
      dimensions = index < 2 ? [960, 540] : [540, 960];
    assert.equal(bytes.length, expected.bytes, expected.path);
    assert.equal(sha(bytes), expected.sha256, expected.path);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], dimensions);
    total += bytes.length;
  }
  assert.equal(total, 1706455);
  // Exact bytes and IHDR validation do not establish fresh browser pixel decoding.
});

test('all four stable Sections point to actual source actions and preserve truthful image attributes', () => {
  const byId = new Map(elements.map((node) => [attrs(node).id, node]).filter(([id]) => id));
  assert.equal(byId.size, elements.filter((node) => attrs(node).id).length);
  const headings = elements.filter(
    (node) => /^h[23]$/.test(node.tagName) && attrs(node)['data-authoring-target'],
  );
  assert.deepEqual(
    headings.map((node) => attrs(node).id),
    imageIds.map((id) => `title-${id}`),
  );
  for (const [index, id] of imageIds.entries()) {
    const heading = byId.get(`title-${id}`),
      target = byId.get(`title-source-${id}`);
    assert.equal(attrs(heading)['data-authoring-target'], attrs(target).id);
    assert.equal(target.tagName, 'a');
    assert.equal(attrs(target).href, sourceById.get(id).href);
    const image = heading.parentNode.childNodes.find((node) => node.tagName === 'img');
    assert.ok(image, id);
    assert.deepEqual(
      [Number(attrs(image).width), Number(attrs(image).height)],
      index < 2 ? [960, 540] : [540, 960],
    );
    assert.equal(
      new URL(attrs(image).src, `https://titles.test/${folder}review.html`).pathname,
      `/${sourceById.get(id).path}`,
    );
  }
  for (const source of PREPARED_TITLE_SOURCES) {
    const link = byId.get(`title-source-${source.id}`);
    assert.equal(attrs(link)['data-prepared-title-source'], source.id);
    assert.equal(attrs(link).href, source.href);
    assert.equal(attrs(link).target, undefined);
    assert.equal(attrs(link).download, undefined);
  }
  const scripts = elements.filter((node) => node.tagName === 'script').map(attrs);
  assert.deepEqual(
    scripts.map((script) => ({ type: script.type, src: script.src })),
    [{ type: 'module', src: 'review.mjs' }],
  );
});

test('title review modules, v2 candidates and preparation manifest remain source-only', async () => {
  const files = await collectBuildFiles(root);
  assert.deepEqual(
    files.filter((path) => path.startsWith(folder)),
    [],
  );
  assert.equal(files.includes(manifestPath), false);
  for (const previous of [manifest.records[0].previous, manifest.records[1].previous])
    assert.equal(files.includes(previous.path), true, previous.path);
  assert.deepEqual(
    files.filter((path) => path.startsWith('game/test/')),
    [],
  );
});

function fixture(t, { referrer = '', alter } = {}) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set();
  doc.parentNode = win;
  doc.referrer = referrer;
  win.document = doc;
  const pad = {
    id: 'Prepared-title finite test pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let time = 1000,
    serial = 0;
  Object.assign(win, {
    location: new URL(
      'https://titles.test/authoring/library/fpv-field-kit/prepared/titles/review.html',
    ),
    innerHeight: 600,
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
  const documentNode = html.childNodes.find((node) => node.tagName === 'html');
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
  alter?.(doc);
  const host = mountPreparedTitleReview({ document: doc, window: win });
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
    tick,
    pulse,
    sections: doc.querySelector('.authoring-input-rail button'),
  };
}

// Real adapter and shared owner; deterministic geometry is modeled input evidence.
// Shared source fetch/hash/decode/lifecycle behavior has its separate 31-case suite.
test('all five source actions use one modal and controller Back restores the exact opener', (t) => {
  const h = fixture(t),
    before = h.win.location.href;
  for (const source of PREPARED_TITLE_SOURCES) {
    const link = h.doc.getElementById(`title-source-${source.id}`);
    link.focus();
    h.pulse(0);
    const dialog = h.doc.getElementById('reveal-source-dialog');
    assert.equal(dialog.open, true, source.id);
    assert.equal(dialog.dataset.path, source.path);
    assert.equal(h.doc.querySelectorAll('.authoring-input-rail').length, 1);
    h.pulse(1);
    assert.equal(dialog.open, false);
    assert.ok(h.doc.activeElement === link, `${source.id}: exact opener identity`);
    assert.equal(h.win.location.href, before);
  }
});

test('four Sections focus their source actions without activating a source on neutral input', (t) => {
  const h = fixture(t);
  for (const id of imageIds) {
    h.sections.click();
    const dialog = h.doc.querySelector('.authoring-sections-dialog'),
      heading = h.doc.getElementById(`title-${id}`);
    const option = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === heading.textContent.trim(),
    );
    assert.ok(option, id);
    option.click();
    h.tick();
    h.tick();
    assert.equal(h.doc.activeElement.id, `title-source-${id}`);
    assert.equal(h.doc.getElementById('reveal-source-dialog').open, false);
  }
});

test('modified source clicks keep native destinations while ordinary clicks stay owned', (t) => {
  const h = fixture(t);
  for (const source of PREPARED_TITLE_SOURCES) {
    const link = h.doc.getElementById(`title-source-${source.id}`),
      href = link.getAttribute('href');
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      const event = link.emit('click', { [modifier]: true });
      assert.equal(event.defaultPrevented, false, `${source.id}: ${modifier}`);
      assert.equal(h.doc.getElementById('reveal-source-dialog').open, false);
      assert.equal(link.getAttribute('href'), href);
    }
    link.focus();
    assert.equal(link.emit('click', { button: 0 }).defaultPrevented, true);
    assert.equal(h.doc.getElementById('reveal-source-dialog').dataset.path, source.path);
    h.pulse(1);
    assert.ok(h.doc.activeElement === link);
  }
});

test('a mismatched declared source destination is not silently bound to another image', (t) => {
  const h = fixture(t, {
    alter(doc) {
      doc
        .getElementById('title-source-landscape-v1')
        .setAttribute('href', 'https://other.test/unrelated.png');
    },
  });
  const link = h.doc.getElementById('title-source-landscape-v1');
  assert.equal(link.emit('click').defaultPrevented, false);
  assert.equal(h.doc.getElementById('reveal-source-dialog').open, false);
  assert.equal(link.getAttribute('href'), 'https://other.test/unrelated.png');
});

test('idempotent mount, disposal and remount retain one reference/input owner and remove source listeners', (t) => {
  const h = fixture(t),
    link = h.doc.getElementById('title-source-manifest');
  assert.ok(mountPreparedTitleReview({ document: h.doc, window: h.win }) === h.host);
  assert.equal(h.frames.size, 1);
  assert.equal(h.doc.querySelectorAll('.authoring-input-rail').length, 1);
  h.host.destroy();
  h.host.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
  assert.equal(h.doc.getElementById('reveal-source-dialog'), null);
  assert.equal(link.emit('click').defaultPrevented, false);
  const next = mountPreparedTitleReview({ document: h.doc, window: h.win });
  t.after(() => next.destroy());
  assert.ok(next !== h.host);
  assert.equal(h.doc.querySelectorAll('.authoring-input-rail').length, 1);
  assert.equal(h.doc.querySelectorAll('#reveal-source-dialog').length, 1);
  link.focus();
  assert.equal(link.emit('click').defaultPrevented, true);
  assert.equal(h.doc.getElementById('reveal-source-dialog').open, true);
});

test('same-origin authoring referrer owns Return without replacing the existing reveal-family link', (t) => {
  const safe = 'https://titles.test/authoring/asset-studio/?project=retained';
  const h = fixture(t, { referrer: safe });
  assert.equal(h.doc.querySelector('.authoring-reference-rail a').href, safe);
  assert.equal(
    h.doc.getElementById('title-reveal-comparison').getAttribute('href'),
    '../reveals/review.html',
  );
});

test('an external referrer cannot replace the Asset Studio fallback', (t) => {
  const h = fixture(t, { referrer: 'https://unrelated.test/private' });
  const returned = h.doc.querySelector('.authoring-reference-rail a').href;
  assert.ok(returned.endsWith('/authoring/asset-studio/'));
  assert.equal(returned.includes('unrelated.test'), false);
});

test('live EN/UK names stay attached to first-open sources and Sections without moving focus', (t) => {
  const h = fixture(t),
    link = h.doc.getElementById('title-source-portrait-v2');
  link.focus();
  h.pulse(0);
  const title = h.doc.getElementById('reveal-source-title'),
    read = h.doc.getElementById('reveal-read-source');
  const before = h.doc.activeElement;
  const seen = [];
  for (const locale of ['en', 'uk', 'en']) {
    setLocale(locale, { persist: false });
    const source = sourceById.get('portrait-v2');
    const expected = typeof source.title === 'function' ? source.title() : source.title;
    assert.equal(title.textContent, expected);
    assert.ok(read.getAttribute('aria-label').endsWith(`: ${expected}`));
    assert.ok(link.getAttribute('aria-label').endsWith(`: ${expected}`));
    assert.ok(h.doc.activeElement === before, 'Locale refresh does not take focus');
    seen.push({
      title: title.textContent,
      heading: h.doc.getElementById('title-portrait-v2').textContent,
      link: link.textContent,
    });
  }
  assert.notEqual(seen[0].title, seen[1].title);
  assert.notEqual(seen[0].heading, seen[1].heading);
  assert.notEqual(seen[0].link, seen[1].link);
  assert.deepEqual(seen[0], seen[2]);
});
