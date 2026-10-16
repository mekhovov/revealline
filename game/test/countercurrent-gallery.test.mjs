import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountCountercurrentGallery } from '../../authoring/library/countercurrent-art/gallery.mjs';
import { collectBuildFiles } from '../../scripts/game-cli.mjs';
import { COUNTERCURRENT_SOURCES } from '../../authoring/library/countercurrent-art/sources.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = 'authoring/library/countercurrent-art/';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const manifestRaw = await read(`${folder}manifest.json`);
const manifest = JSON.parse(manifestRaw);
const historical = JSON.parse(await read(`${folder}verification.json`));
const derivatives = JSON.parse(await read(`${folder}derivatives.json`));
const html = parse((await read(`${folder}index.html`)).toString());
const elements = [];
const walk = (node) => {
  if (node.tagName) elements.push(node);
  node.childNodes?.forEach(walk);
};
walk(html);
const attrs = (node) =>
  Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));

test('the bounded viewer declares exactly twelve recorded originals and the existing README', async () => {
  assert.equal(
    sha(manifestRaw),
    '27f31bdaa91db438066107e221ed77f16ad5325873b1512566edb7881475e6b1',
  );
  assert.equal(COUNTERCURRENT_SOURCES.length, 13);
  assert.equal(new Set(COUNTERCURRENT_SOURCES.map((source) => source.id)).size, 13);
  assert.ok(Object.isFrozen(COUNTERCURRENT_SOURCES));
  const images = COUNTERCURRENT_SOURCES.filter((source) => source.kind === 'image');
  assert.equal(images.length, 12);
  assert.deepEqual(
    images.map((source) => source.path).sort(),
    manifest.images.map((image) => folder + image.path).sort(),
  );
  for (const source of images) {
    const original = manifest.images.find((image) => folder + image.path === source.path);
    assert.ok(Object.isFrozen(source));
    for (const key of ['bytes', 'sha256', 'width', 'height', 'title'])
      assert.equal(source[key], original[key], `${source.path}: ${key}`);
  }
  const docs = COUNTERCURRENT_SOURCES.filter((source) => source.kind === 'text');
  assert.equal(docs.length, 1);
  assert.equal(docs[0].path, folder + 'README.md');
  const bytes = await read(docs[0].path);
  assert.equal(docs[0].bytes, bytes.length);
  assert.equal(docs[0].sha256, sha(bytes));
  assert.ok(Object.isFrozen(docs[0]));
});

test('all original PNG and review JPEG bytes remain exact against preserved provenance', async () => {
  assert.equal(derivatives.originalManifestSha256, sha(manifestRaw));
  let originalBytes = 0,
    thumbnailBytes = 0;
  for (const original of manifest.images) {
    const bytes = await read(folder + original.path);
    assert.equal(bytes.length, original.bytes, original.path);
    assert.equal(sha(bytes), original.sha256, original.path);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), original.width);
    assert.equal(bytes.readUInt32BE(20), original.height);
    assert.equal(original.width, 1774);
    assert.equal(original.height, 887);
    originalBytes += bytes.length;
    const thumb = derivatives.images.find((image) => image.cellId === original.cellId);
    assert.equal(thumb.originalPath, original.path);
    assert.equal(thumb.originalSha256, original.sha256);
    const preview = await read(folder + thumb.path);
    assert.equal(preview.length, thumb.bytes, thumb.path);
    assert.equal(sha(preview), thumb.sha256, thumb.path);
    thumbnailBytes += preview.length;
  }
  assert.equal(originalBytes, 31692501);
  assert.equal(thumbnailBytes, 483255);
  // This is byte/header validation; full native PNG/JPEG decoding is separate.
  for (const path of [
    'README.md',
    'manifest.json',
    'derivatives.json',
    'provenance.json',
    'prompts.json',
    'generation-results.json',
    'layout-briefs.json',
  ]) {
    const prior = historical.files.find((file) => file.path === path);
    assert.ok(prior, path);
    const bytes = await read(folder + path);
    assert.equal(bytes.length, prior.bytes, path);
    assert.equal(sha(bytes), prior.sha256, path);
  }
});

test('every original/document link retains its exact destination and a stable unique opener', () => {
  const byId = new Map(elements.map((node) => [attrs(node).id, node]).filter(([id]) => id));
  assert.equal(
    byId.size,
    elements.filter((node) => attrs(node).id).length,
    'No duplicate element IDs',
  );
  const sources = elements
    .filter((node) => node.tagName === 'a')
    .map((node) => ({ node, ...attrs(node) }))
    .filter((node) => COUNTERCURRENT_SOURCES.some((source) => source.path === folder + node.href));
  assert.equal(sources.length, 13);
  assert.deepEqual(
    sources.map((link) => folder + link.href).sort(),
    COUNTERCURRENT_SOURCES.map((source) => source.path).sort(),
  );
  for (const link of sources) {
    const source = COUNTERCURRENT_SOURCES.find((source) => source.path === folder + link.href);
    assert.equal(link.id, `countercurrent-source-${source.id}`);
    assert.equal(link['data-countercurrent-source'], source.id);
    assert.equal(link.target, undefined, 'No detached tab handoff');
    assert.equal(
      link.download,
      undefined,
      'Read-only gallery keeps inspection separate from file downloads',
    );
  }
  const headings = elements.filter(
    (node) => /^h[23]$/.test(node.tagName) && attrs(node)['data-authoring-target'],
  );
  assert.deepEqual(
    headings.map((node) => attrs(node).id),
    [
      'countercurrent-fpv',
      'countercurrent-ukraine',
      'countercurrent-retro',
      'countercurrent-coupa',
    ],
  );
  for (const heading of headings) {
    const target = byId.get(attrs(heading)['data-authoring-target']);
    assert.ok(target, 'Every section points to an existing control');
    assert.ok(
      ['A', 'BUTTON'].includes(target.tagName.toUpperCase()),
      'Section targets remain focusable actions',
    );
    assert.equal(attrs(target).disabled, undefined);
    assert.equal(attrs(target).hidden, undefined);
  }
  const scripts = elements.filter((node) => node.tagName === 'script').map(attrs);
  assert.equal(
    scripts.filter((script) => script.type === 'module' && script.src === 'gallery.mjs').length,
    1,
  );
  assert.equal(
    scripts.filter((script) => script.src?.endsWith('authoring-reference-entry.mjs')).length,
    0,
    'One local adapter owns the shared host',
  );
});

test('source-only gallery and originals remain excluded from the default distribution collector', async () => {
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

function fixture(t) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set();
  doc.parentNode = win;
  const pad = {
    id: 'Gallery finite test pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let time = 1000,
    serial = 0;
  Object.assign(win, {
    location: new URL('https://gallery.test/authoring/library/countercurrent-art/index.html'),
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
  const host = mountCountercurrentGallery({ document: doc, window: win });
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

// Real markup/adapter/shared owner; Node's file-origin viewer cannot fetch source
// files. Source publication/decoding is qualified in the separate viewer tests.
test('all thirteen gallery openers use the same owned modal and Back restores the exact link', (t) => {
  const h = fixture(t),
    url = h.win.location.href;
  for (const source of COUNTERCURRENT_SOURCES) {
    const link = h.doc.getElementById(`countercurrent-source-${source.id}`);
    link.focus();
    h.pulse(0);
    const dialog = h.doc.getElementById('reveal-source-dialog');
    assert.equal(dialog.open, true, source.id);
    assert.equal(dialog.dataset.path, source.path);
    assert.equal(h.doc.querySelectorAll('.authoring-input-rail').length, 1);
    h.pulse(1);
    assert.equal(dialog.open, false);
    assert.equal(h.doc.activeElement, link);
    assert.equal(h.win.location.href, url);
  }
});

test('theme Sections retain an inactive first-source link through neutral input frames', (t) => {
  const h = fixture(t);
  for (const theme of ['fpv', 'ukraine', 'retro', 'coupa']) {
    h.sections.click();
    const dialog = h.doc.querySelector('.authoring-sections-dialog');
    const heading = h.doc.getElementById(`countercurrent-${theme}`);
    const option = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === heading.textContent.trim(),
    );
    assert.ok(option, theme);
    option.click();
    h.tick();
    h.tick();
    assert.equal(h.doc.activeElement.id, heading.dataset.authoringTarget);
    assert.equal(h.doc.getElementById('reveal-source-dialog').open, false);
  }
});

test('modified native links keep their fallback and repeated mounting never duplicates ownership', (t) => {
  const h = fixture(t),
    link = h.doc.getElementById(`countercurrent-source-${COUNTERCURRENT_SOURCES[0].id}`);
  assert.equal(mountCountercurrentGallery({ document: h.doc, window: h.win }), h.host);
  assert.equal(h.frames.size, 1);
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const event = link.emit('click', { [modifier]: true });
    assert.equal(event.defaultPrevented, false);
    assert.equal(h.doc.getElementById('reveal-source-dialog').open, false);
  }
  const href = link.getAttribute('href');
  h.host.destroy();
  assert.equal(h.doc.getElementById('reveal-source-dialog'), null);
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
  assert.equal(link.emit('click').defaultPrevented, false);
  assert.equal(link.getAttribute('href'), href);
});
