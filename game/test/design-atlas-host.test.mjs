import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, parseFragment } from 'parse5';
import { Document, Element } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { attachAtlasInput } from '../../authoring/design-atlas/atlas-input.mjs';
import { attachAtlasBriefDownload } from '../../authoring/design-atlas/atlas-brief-download.mjs';

const html = await readFile(
  new URL('../../authoring/design-atlas/index.html', import.meta.url),
  'utf8',
);
const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((resolve) => setImmediate(resolve));
};
let serial = 0;

// Execute the actual Atlas module and actual markup. Geometry is deliberately
// finite test data; browser layout and OS clipboard permissions are separate.
async function fixture(t, { clipboard = async () => {}, objectURLs = true } = {}) {
  const doc = new Document(),
    win = doc.defaultView,
    writes = [],
    selected = [];
  const blobs = new Map(),
    revoked = [];
  doc.parentNode = win;
  let now = 1000,
    frameSerial = 0;
  const frames = new Map();
  const pad = {
    id: 'Atlas test pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: now,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    URL: objectURLs
      ? {
          createObjectURL(blob) {
            const url = `blob:atlas-test/${blobs.size + 1}`;
            blobs.set(url, blob);
            return url;
          },
          revokeObjectURL(url) {
            revoked.push(url);
          },
        }
      : {},
    location: new URL('https://atlas.example/authoring/design-atlas/'),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      frames.set(++frameSerial, callback);
      return frameSerial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    innerHeight: 700,
    scrollY: 0,
    scrollX: 0,
    scrollTo({ left, top }) {
      win.scrollX = left;
      win.scrollY = top;
    },
    getComputedStyle: (node) => ({
      display: node.style.display || 'block',
      visibility: 'visible',
      overflowY: node.style.overflowY || 'hidden',
    }),
  });
  doc.documentElement.scrollHeight = 8000;
  const tick = () => {
    now += 50;
    pad.timestamp = now;
    const pending = [...frames];
    frames.clear();
    pending.forEach(([, callback]) => callback(now));
  };
  const create = doc.createElement.bind(doc);
  function append(parent, source) {
    if (source.nodeName === '#text') {
      parent._text = (parent._text || '') + source.value;
      return;
    }
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs || []) {
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (['id', 'type', 'value', 'href', 'lang'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'inert', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
  }
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'a')
      for (const name of ['href', 'download'])
        Object.defineProperty(node, name, {
          get() {
            return node.getAttribute(name) || '';
          },
          set(value) {
            node.setAttribute(name, value);
          },
        });
    node.before = (sibling) => node.parentNode.insertBefore(sibling, node);
    Object.defineProperty(node, 'innerHTML', {
      set(markup) {
        this.replaceChildren();
        for (const child of parseFragment(String(markup)).childNodes) append(this, child);
      },
    });
    return node;
  };
  doc.createTextNode = (text) => {
    const node = create('span');
    node.textContent = text;
    return node;
  };
  const body = parse(html)
    .childNodes.find((n) => n.tagName === 'html')
    .childNodes.find((n) => n.tagName === 'body');
  for (const child of body.childNodes) append(doc.body, child);
  doc.fonts = { load: async () => [{}] };
  doc.createRange = () => ({ selectNodeContents: (node) => selected.push(node) });
  win.getSelection = () => ({ removeAllRanges() {}, addRange() {} });
  const install = (key, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key],
    );
  };
  install('document', doc);
  install('window', win);
  install('location', {
    hostname: 'atlas.example',
    origin: 'https://atlas.example',
    href: 'https://atlas.example/authoring/design-atlas/',
  });
  install('navigator', {
    getGamepads: () => [pad],
    clipboard: {
      writeText: (text) => {
        writes.push(text);
        return clipboard(text);
      },
    },
  });
  install(
    'Option',
    class extends Element {
      constructor(label, value) {
        super(doc, 'option');
        this.textContent = label;
        this.value = value;
      }
    },
  );
  for (const storage of ['localStorage', 'sessionStorage'])
    install(storage, {
      getItem: () => assert.fail('Atlas view choices must not read player storage.'),
      setItem: () => assert.fail('Atlas view choices must not write player storage.'),
      removeItem: () => assert.fail('Atlas must not remove player data.'),
    });
  install('indexedDB', { open: () => assert.fail('Atlas must not open durable stores.') });
  install('fetch', () => assert.fail('Published Atlas must not request local research sources.'));
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
  translateDOM(doc.body);
  await import(`../../authoring/design-atlas/atlas.mjs?host=${++serial}`);
  await settle();
  const inputHost = mountAuthoringInputHost({ document: doc, window: win });
  const readers = attachAtlasInput({ document: doc, window: win, host: inputHost });
  const briefDownload = attachAtlasBriefDownload({ document: doc, window: win });
  t.after(() => {
    briefDownload?.destroy();
    readers.destroy();
    inputHost.destroy();
  });
  const pulse = (index) => {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  const $ = (id) => doc.getElementById(id);
  const select = (id, value) => {
    const node = $(id);
    node.focus();
    node.value = value;
    node.emit('change');
  };
  return {
    doc,
    win,
    $,
    select,
    writes,
    selected,
    inputHost,
    readers,
    tick,
    pulse,
    briefDownload,
    blobs,
    revoked,
  };
}

test('actual Atlas presents all nine studies and eighteen states without saving or launching a game', async (t) => {
  const h = await fixture(t);
  assert.equal(h.$('screen-select').value, 'title');
  assert.equal(h.$('state-select').value, 'returning');
  const cases = {
    title: ['returning', 'first-visit'],
    missions: ['progress', 'unrevealed'],
    briefing: ['standard', 'gentle'],
    flight: ['running', 'warning', 'life-loss'],
    pause: ['paused'],
    results: ['victory', 'defeat'],
    settings: ['standard', 'large-text'],
    collection: ['gallery', 'picture'],
    workshop: ['draft', 'validation'],
  };
  assert.deepEqual(
    h.$('screen-select').options.map((node) => node.value),
    Object.keys(cases),
  );
  for (const [screen, states] of Object.entries(cases)) {
    h.select('screen-select', screen);
    assert.deepEqual(
      h.$('state-select').options.map((node) => node.value),
      states,
    );
    for (const state of states) {
      h.select('state-select', state);
      assert.ok(h.$('screen-preview').querySelector('.mock-screen'), `${screen}/${state}`);
      assert.ok(h.$('screen-preview').textContent.trim().length > 80, `${screen}/${state}`);
      assert.equal(h.doc.activeElement, h.$('state-select'));
      assert.ok(h.$('study-purpose').textContent.trim());
      assert.ok(
        h
          .$('review-status')
          .textContent.includes(
            h.$('screen-select').options.find((o) => o.value === screen).textContent,
          ),
      );
    }
  }
  assert.equal(h.$('font-status').dataset.state, 'ready');
  assert.match(h.$('reference-status').textContent, /only in the local research folder/);
});

test('mock preview navigation replaces its own screen and returns focus to the screen chooser', async (t) => {
  const h = await fixture(t);
  const initial = h.$('screen-preview').querySelector('[data-screen="briefing"]');
  initial.focus();
  initial.click();
  assert.equal(initial.isConnected, false);
  assert.equal(h.$('screen-select').value, 'briefing');
  assert.equal(h.doc.activeElement, h.$('screen-select'));
  h.select('screen-select', 'results');
  h.$('screen-preview').querySelector('[data-intent="picture"]').click();
  assert.equal(h.$('screen-select').value, 'collection');
  assert.equal(h.$('state-select').value, 'picture');
  h.select('screen-select', 'workshop');
  h.$('screen-preview').querySelector('[data-intent="asset-brief"]').click();
  assert.equal(h.doc.querySelector('.prompt-example').open, true);
  assert.equal(h.doc.activeElement, h.$('copy-prompt'));
});

test('viewport, specimen and coverage choices are local views; live locale changes keep screen controls', async (t) => {
  const h = await fixture(t);
  for (const view of ['phone', 'landscape', 'tablet', 'desktop']) {
    const button = h.doc.querySelector(`button[data-viewport="${view}"]`);
    button.focus();
    button.click();
    assert.equal(h.$('screen-stage').dataset.viewport, view);
    assert.equal(h.doc.activeElement, button);
    assert.equal(
      h.doc
        .querySelectorAll('button[data-viewport]')
        .filter((node) => node.getAttribute('aria-pressed') === 'true').length,
      1,
    );
  }
  h.doc.querySelector('[data-language="uk"]').click();
  assert.equal(h.$('display-specimen').lang, 'uk');
  assert.match(h.$('display-specimen').textContent, /Обери/);
  for (const [filter, count] of Object.entries({
    all: 32,
    player: 10,
    support: 11,
    system: 4,
    authoring: 7,
  })) {
    h.select('inventory-filter', filter);
    assert.equal(h.$('screen-matrix-body').children.length, count, filter);
  }
  h.select('screen-select', 'briefing');
  h.select('state-select', 'gentle');
  const action = h.$('screen-preview').querySelector('[data-screen="flight"]');
  action.focus();
  const english = action.textContent;
  setLocale('uk', { persist: false });
  assert.equal(h.doc.activeElement, action);
  assert.equal(action.isConnected, true);
  assert.notEqual(action.textContent, english);
  assert.equal(h.$('state-select').value, 'gentle');
  setLocale('en', { persist: false });
  assert.equal(action.textContent, english);
  assert.equal(h.doc.activeElement, action);
});

test('copy sends the exact visible brief and a stale result cannot replace a newer copy outcome', async (t) => {
  const first = deferred(),
    second = deferred();
  let call = 0;
  const h = await fixture(t, { clipboard: () => (++call === 1 ? first : second).promise });
  h.$('copy-prompt').focus();
  h.$('copy-prompt').click();
  assert.equal(h.writes[0], h.$('prompt-example-text').textContent);
  assert.equal(h.$('copy-status').dataset.state, 'busy');
  h.$('copy-prompt').click();
  second.resolve();
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'ready');
  assert.match(h.$('copy-status').textContent, /Example brief copied/);
  first.reject(new Error('Old copy denied'));
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'ready');
  assert.deepEqual(h.selected, []);
  assert.equal(h.doc.activeElement, h.$('copy-prompt'));
});

for (const destination of ['opener', 'newer', 'hidden', 'unfocused'])
  test(`denied clipboard fallback only selects the brief for its current foreground opener: ${destination}`, async (t) => {
    const copy = deferred(),
      h = await fixture(t, { clipboard: () => copy.promise });
    h.$('copy-prompt').focus();
    h.$('copy-prompt').click();
    if (destination === 'newer') h.$('screen-select').focus();
    if (destination === 'hidden') h.doc.hidden = true;
    if (destination === 'unfocused') h.doc.focused = false;
    const focused = h.doc.activeElement;
    copy.reject(new Error('Clipboard unavailable'));
    await settle();
    assert.equal(h.$('copy-status').dataset.state, 'error');
    assert.equal(h.doc.activeElement, focused);
    assert.deepEqual(h.selected, destination === 'opener' ? [h.$('prompt-example-text')] : []);
    assert.match(
      h.$('copy-status').textContent,
      destination === 'opener' ? /Brief selected/ : /Copy was unavailable/,
    );
  });

function nativeKey(node, key) {
  const event = node.emit('keydown', { key });
  // Model the browser's default activation only when the production owner did
  // not consume it. Domain handlers are never called directly by these tests.
  if (!event.defaultPrevented && ['Enter', ' '].includes(key)) node.click();
  node.emit('keyup', { key });
  return event;
}

function matrixGeometry(h) {
  const matrix = h.doc.querySelector('.matrix-wrap');
  Object.assign(matrix, {
    clientWidth: 300,
    scrollWidth: 760,
    clientHeight: 200,
    scrollHeight: 1600,
  });
  return matrix;
}

test('production controller router enters the coverage reader, scrolls both axes within bounds and returns on Back', async (t) => {
  const h = await fixture(t),
    matrix = matrixGeometry(h),
    button = h.$('atlas-read-matrix');
  const content = h.$('screen-matrix-body').textContent;
  button.focus();
  h.inputHost.navigation.engage();
  h.tick();
  h.pulse(0);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(matrix.getAttribute('data-atlas-reading'), 'true');
  const entryScrolls = button.scrolled || 0;
  h.pulse(15);
  h.pulse(13);
  assert.equal(matrix.scrollLeft, 180);
  assert.equal(matrix.scrollTop, 120);
  assert.equal(h.doc.activeElement, button);
  for (let i = 0; i < 15; i++) {
    h.pulse(15);
    h.pulse(13);
  }
  assert.equal(matrix.scrollLeft, 460);
  assert.equal(matrix.scrollTop, 1400);
  assert.equal(
    button.scrolled || 0,
    entryScrolls,
    'Reading must not snap back to its entry on every direction.',
  );
  h.pulse(1);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(matrix.getAttribute('data-atlas-reading'), null);
  assert.equal(h.doc.activeElement, button);
  assert.equal(
    button.scrolled,
    entryScrolls + 1,
    'Deliberate Back must bring the entry into view.',
  );
  assert.equal(h.doc.querySelector('.authoring-sections-dialog').open, false);
  assert.equal(h.$('screen-matrix-body').textContent, content);
});

test('inactive reader buttons retain ordinary native arrow navigation', async (t) => {
  const h = await fixture(t),
    button = h.$('atlas-read-matrix');
  button.focus();
  assert.equal(nativeKey(button, 'ArrowDown').defaultPrevented, true);
  assert.notEqual(h.doc.activeElement, button);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(h.doc.querySelector('.matrix-wrap').getAttribute('tabindex'), null);
});

test('long section reading stays within that section and ignores horizontal scroll without altering content', async (t) => {
  const h = await fixture(t),
    region = h.$('direction'),
    button = h.$('atlas-read-direction');
  region.getBoundingClientRect = () => ({
    top: 200 - h.win.scrollY,
    bottom: 2000 - h.win.scrollY,
    width: 800,
    height: 1800,
  });
  const content = region.textContent;
  button.focus();
  nativeKey(button, 'Enter');
  nativeKey(button, 'ArrowDown');
  assert.equal(h.win.scrollY, 420);
  nativeKey(button, 'ArrowRight');
  assert.equal(h.win.scrollX, 0);
  nativeKey(button, 'End');
  assert.equal(h.win.scrollY, 1300);
  nativeKey(button, 'ArrowDown');
  assert.equal(h.win.scrollY, 1300);
  nativeKey(button, 'Home');
  assert.equal(h.win.scrollY, 200);
  nativeKey(button, 'ArrowUp');
  assert.equal(h.win.scrollY, 200);
  nativeKey(button, 'Enter');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(h.doc.activeElement, button);
  assert.equal(region.textContent, content);
});

test('native first Enter enters reading once; arrows and page keys scroll, Escape returns without opening Sections', async (t) => {
  const h = await fixture(t),
    matrix = matrixGeometry(h),
    button = h.$('atlas-read-matrix');
  button.focus();
  nativeKey(button, 'Enter');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(nativeKey(button, 'ArrowRight').defaultPrevented, true);
  nativeKey(button, 'PageDown');
  assert.equal(matrix.scrollLeft, 180);
  assert.equal(matrix.scrollTop, 120);
  nativeKey(button, 'End');
  assert.equal(matrix.scrollTop, 1400);
  nativeKey(button, 'Home');
  assert.equal(matrix.scrollTop, 0);
  nativeKey(button, 'Escape');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(h.doc.activeElement, button);
  assert.equal(h.doc.querySelector('.authoring-sections-dialog').open, false);
});

test('native reading Tab preserves normal onward navigation instead of trapping its entry', async (t) => {
  const h = await fixture(t),
    button = h.$('atlas-read-matrix');
  matrixGeometry(h);
  button.focus();
  nativeKey(button, 'Enter');
  const event = nativeKey(button, 'Tab');
  if (!event.defaultPrevented) h.$('inventory-filter').focus();
  h.inputHost.navigation.sync();
  assert.notEqual(h.doc.activeElement, button);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('short-landscape mock reader scrolls the current preview and a new study invalidates the old owner', async (t) => {
  const h = await fixture(t);
  h.select('screen-select', 'missions');
  const preview = h.$('screen-preview').querySelector('.mock-screen'),
    button = h.$('atlas-read-preview');
  Object.assign(preview, {
    clientWidth: 740,
    scrollWidth: 740,
    clientHeight: 350,
    scrollHeight: 900,
  });
  preview.style.overflowY = 'auto';
  button.focus();
  nativeKey(button, 'Enter');
  nativeKey(button, 'ArrowDown');
  assert.equal(preview.scrollTop, 210);
  assert.equal(h.win.scrollY, 0);
  h.select('screen-select', 'results');
  h.inputHost.navigation.sync();
  assert.equal(preview.isConnected, false);
  assert.equal(preview.getAttribute('data-atlas-reading'), null);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(h.doc.activeElement, h.$('screen-select'));
  assert.equal(h.$('state-select').value, 'victory');
});

test('brief reading needs its open disclosure and never copies or modifies the visible brief on cancel', async (t) => {
  const h = await fixture(t),
    button = h.$('atlas-read-brief'),
    brief = h.$('prompt-example-text');
  Object.assign(brief, {
    clientWidth: 400,
    scrollWidth: 400,
    clientHeight: 200,
    scrollHeight: 900,
  });
  const details = brief.closest('details');
  assert.equal(details.open, false);
  details.querySelector('summary').focus();
  nativeKey(details.querySelector('summary'), 'Enter');
  assert.equal(details.open, true, 'Native disclosure activation must open the brief.');
  button.focus();
  nativeKey(button, 'Enter');
  nativeKey(button, 'PageDown');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(brief.scrollTop, 120);
  const content = brief.textContent;
  nativeKey(button, 'Escape');
  assert.equal(h.doc.activeElement, button);
  assert.equal(brief.textContent, content);
  assert.deepEqual(h.writes, []);
});

for (const change of ['newer-focus', 'blur', 'hidden', 'modal', 'persisted-pagehide', 'pagehide'])
  test(`Atlas reading retires for ${change} without taking a newer focus owner`, async (t) => {
    const h = await fixture(t),
      matrix = matrixGeometry(h),
      button = h.$('atlas-read-matrix');
    button.focus();
    nativeKey(button, 'Enter');
    nativeKey(button, 'ArrowDown');
    const position = matrix.scrollTop;
    if (change === 'newer-focus') h.$('inventory-filter').focus();
    if (change === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    }
    if (change === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (change === 'modal') {
      const dialog = h.doc.createElement('dialog'),
        cancel = h.doc.createElement('button');
      dialog.append(cancel);
      h.doc.body.append(dialog);
      dialog.showModal();
    }
    if (change.includes('pagehide'))
      h.win.emit('pagehide', { persisted: change.startsWith('persisted') });
    const focus = h.doc.activeElement;
    h.inputHost.navigation.sync();
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(matrix.getAttribute('data-atlas-reading'), null);
    assert.equal(matrix.scrollTop, position);
    assert.equal(h.doc.activeElement, focus);
    if (change === 'persisted-pagehide') {
      h.win.emit('pageshow', { persisted: true });
      button.focus();
      nativeKey(button, 'Enter');
      assert.equal(button.getAttribute('aria-pressed'), 'true');
      nativeKey(button, 'Escape');
    }
    if (change === 'pagehide') {
      assert.equal(button.isConnected, false);
      assert.equal(h.doc.querySelector('.authoring-input-rail'), null);
    }
  });

test('Sections chooses explicit reading entries and preserves them during live locale changes', async (t) => {
  const h = await fixture(t);
  const pairs = [
    ['direction-title', 'atlas-read-direction'],
    ['studies-title', 'atlas-read-preview'],
    ['type-title', 'atlas-read-type'],
    ['coverage-title', 'atlas-read-matrix'],
    ['assets-title', 'atlas-read-assets'],
    ['baseline-title', 'atlas-read-baseline'],
    ['references-title', 'atlas-read-references'],
  ];
  h.inputHost.navigation.engage();
  h.tick();
  for (const [headingId, entryId] of pairs) {
    h.inputHost.navigation.handle({ menu: true });
    const dialog = h.doc.querySelector('.authoring-sections-dialog');
    h.tick();
    const option = dialog
      .querySelectorAll('button')
      .find((node) => node.textContent === h.$(headingId).textContent);
    assert.ok(option, headingId);
    option.focus();
    h.pulse(0);
    assert.equal(
      dialog.open,
      false,
      `${headingId}: ${h.doc.activeElement.id}/${h.doc.activeElement.textContent}/${JSON.stringify(h.inputHost.navigation.editorState())}`,
    );
    assert.equal(h.doc.activeElement, h.$(entryId), headingId);
    h.tick();
  }
  const button = h.$('atlas-read-references'),
    before = button.getAttribute('aria-label');
  setLocale('uk', { persist: false });
  assert.equal(h.doc.activeElement, button);
  assert.notEqual(button.getAttribute('aria-label'), before);
  setLocale('en', { persist: false });
  assert.equal(button.getAttribute('aria-label'), before);
});

test('brief download contains exact visible UTF-8 text and locale changes retire old URLs after final translation', async (t) => {
  const h = await fixture(t),
    link = h.$('download-prompt'),
    brief = h.$('prompt-example-text');
  let oldURL = null;
  for (const locale of ['en', 'uk', 'en']) {
    setLocale(locale, { persist: false });
    assert.equal(link.hidden, false);
    assert.equal(link.download, `fpv-line-atlas-example-brief-${locale}.txt`);
    const blob = h.blobs.get(link.href);
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'text/plain;charset=utf-8');
    assert.deepEqual(
      new Uint8Array(await blob.arrayBuffer()),
      new TextEncoder().encode(brief.textContent),
    );
    assert.match(await blob.text(), locale === 'uk' ? /оригінальн/ : /Create an original/);
    if (oldURL) assert.ok(h.revoked.includes(oldURL));
    oldURL = link.href;
    const count = h.blobs.size;
    h.briefDownload.refresh();
    assert.equal(h.blobs.size, count);
    assert.equal(link.href, oldURL);
  }
  assert.deepEqual(h.writes, [], 'Preparing a download never copies to the clipboard.');
});

for (const input of ['native', 'controller'])
  test(`${input} activates the real prepared download anchor explicitly, without an automatic click`, async (t) => {
    const h = await fixture(t),
      link = h.$('download-prompt'),
      clicks = [];
    h.doc.addEventListener('click', (event) => {
      if (event.target === link) clicks.push({ href: link.href, name: link.download });
    });
    h.briefDownload.refresh();
    assert.deepEqual(clicks, []);
    const summary = h.$('prompt-example-text').closest('details').querySelector('summary');
    summary.focus();
    nativeKey(summary, 'Enter');
    link.focus();
    if (input === 'controller') {
      h.inputHost.navigation.engage();
      h.tick();
      h.pulse(0);
    } else nativeKey(link, 'Enter');
    assert.deepEqual(clicks, [{ href: link.href, name: 'fpv-line-atlas-example-brief-en.txt' }]);
    assert.equal(h.doc.activeElement, link);
    assert.equal(h.blobs.size, 1);
    assert.deepEqual(h.writes, []);
  });

test('brief URL is revoked on pagehide, rebuilt only on persisted return, and fully retired on disposal', async (t) => {
  const h = await fixture(t),
    link = h.$('download-prompt'),
    first = link.href;
  h.win.emit('pagehide', { persisted: true });
  assert.equal(link.hidden, true);
  assert.equal(link.getAttribute('href'), null);
  assert.equal(link.getAttribute('download'), null);
  assert.deepEqual(h.revoked, [first]);
  setLocale('uk', { persist: false });
  assert.equal(h.blobs.size, 1, 'A suspended document must not prepare replacement URLs.');
  h.win.emit('pageshow', { persisted: true });
  assert.equal(link.hidden, false);
  assert.notEqual(link.href, first);
  assert.equal(link.download, 'fpv-line-atlas-example-brief-uk.txt');
  assert.equal(await h.blobs.get(link.href).text(), h.$('prompt-example-text').textContent);
  const second = link.href;
  h.win.emit('pagehide', { persisted: false });
  assert.deepEqual(h.revoked, [first, second]);
  assert.equal(link.hidden, true);
  const count = h.blobs.size;
  setLocale('en', { persist: false });
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.blobs.size, count);
  assert.equal(link.getAttribute('href'), null);
});

test('unavailable object URL support leaves Copy usable and exposes no invalid download', async (t) => {
  const h = await fixture(t, { objectURLs: false }),
    link = h.$('download-prompt');
  assert.equal(link.hidden, true);
  assert.equal(link.getAttribute('href'), null);
  h.$('copy-prompt').focus();
  h.$('copy-prompt').click();
  await settle();
  assert.equal(h.writes[0], h.$('prompt-example-text').textContent);
  assert.equal(h.$('copy-status').dataset.state, 'ready');
});
function copyClock(t) {
  const originalTimeout = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout,
    timers = new Map(),
    scheduled = [],
    cleared = [];
  let now = 0,
    serial = 0;
  globalThis.setTimeout = (callback, delay) => {
    const id = ++serial;
    timers.set(id, { callback, at: now + delay });
    scheduled.push({ id, delay });
    return id;
  };
  globalThis.clearTimeout = (id) => {
    timers.delete(id);
    cleared.push(id);
  };
  t.after(() => {
    globalThis.setTimeout = originalTimeout;
    globalThis.clearTimeout = originalClear;
  });
  return {
    timers,
    scheduled,
    cleared,
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at > now) continue;
        timers.delete(id);
        timer.callback();
      }
    },
  };
}

test('Copy invokes the native clipboard synchronously and clears its two-second deadline on early success', async (t) => {
  const pending = deferred();
  let clock,
    started = false;
  const h = await fixture(t, {
    clipboard: () => {
      started = true;
      assert.equal(
        clock.scheduled.length,
        0,
        'Native write must precede scheduling the status timeout.',
      );
      return pending.promise;
    },
  });
  clock = copyClock(t);
  h.$('copy-prompt').focus();
  h.$('copy-prompt').click();
  assert.equal(started, true);
  assert.deepEqual(
    clock.scheduled.map((row) => row.delay),
    [2000],
  );
  assert.equal(h.$('copy-status').dataset.state, 'busy');
  pending.resolve();
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'ready');
  assert.equal(clock.timers.size, 0);
  assert.deepEqual(clock.cleared, [1]);
  clock.advance(2000);
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'ready');
  assert.deepEqual(h.selected, []);
});

for (const late of ['resolve', 'reject'])
  test(`a pending Copy becomes owned fallback at two seconds; late clipboard ${late} cannot publish success`, async (t) => {
    const pending = deferred(),
      h = await fixture(t, { clipboard: () => pending.promise }),
      clock = copyClock(t);
    h.$('copy-prompt').focus();
    h.$('copy-prompt').click();
    clock.advance(1999);
    await settle();
    assert.equal(h.$('copy-status').dataset.state, 'busy');
    assert.deepEqual(h.selected, []);
    clock.advance(1);
    await settle();
    assert.equal(h.$('copy-status').dataset.state, 'error');
    assert.match(h.$('copy-status').textContent, /Brief selected/);
    assert.deepEqual(h.selected, [h.$('prompt-example-text')]);
    assert.equal(h.doc.activeElement, h.$('copy-prompt'));
    assert.equal(clock.timers.size, 0);
    const fallback = h.$('copy-status').textContent;
    h.$('screen-select').focus();
    if (late === 'resolve') pending.resolve();
    else pending.reject(new Error('Late operating-system rejection'));
    await settle();
    assert.equal(h.$('copy-status').textContent, fallback);
    assert.equal(h.$('copy-status').dataset.state, 'error');
    assert.equal(h.doc.activeElement, h.$('screen-select'));
    assert.equal(h.selected.length, 1);
  });

for (const destination of ['newer', 'hidden', 'unfocused'])
  test(`Copy timeout preserves ${destination} ownership and does not select text`, async (t) => {
    const pending = deferred(),
      h = await fixture(t, { clipboard: () => pending.promise }),
      clock = copyClock(t);
    h.$('copy-prompt').focus();
    h.$('copy-prompt').click();
    if (destination === 'newer') h.$('inventory-filter').focus();
    if (destination === 'hidden') h.doc.hidden = true;
    if (destination === 'unfocused') h.doc.focused = false;
    const focus = h.doc.activeElement;
    clock.advance(2000);
    await settle();
    assert.equal(h.$('copy-status').dataset.state, 'error');
    assert.match(h.$('copy-status').textContent, /Copy was unavailable/);
    assert.equal(h.doc.activeElement, focus);
    assert.deepEqual(h.selected, []);
    assert.equal(clock.timers.size, 0);
    pending.resolve();
    await settle();
    assert.equal(h.$('copy-status').dataset.state, 'error');
    assert.equal(h.doc.activeElement, focus);
    assert.deepEqual(h.selected, []);
  });

test('older Copy timeout and late rejection cannot replace a newer pending or successful Copy', async (t) => {
  const first = deferred(),
    second = deferred();
  let call = 0;
  const h = await fixture(t, { clipboard: () => (++call === 1 ? first : second).promise }),
    clock = copyClock(t);
  h.$('copy-prompt').focus();
  h.$('copy-prompt').click();
  clock.advance(1000);
  h.$('copy-prompt').click();
  clock.advance(1000);
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'busy');
  assert.deepEqual(h.selected, []);
  assert.equal(clock.timers.size, 1);
  second.resolve();
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'ready');
  assert.equal(clock.timers.size, 0);
  first.reject(new Error('Old operation rejected after its timeout'));
  await settle();
  clock.advance(1000);
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'ready');
  assert.match(h.$('copy-status').textContent, /Example brief copied/);
  assert.deepEqual(h.selected, []);
});

test('synchronous clipboard denial uses the existing owned fallback without leaving a deadline', async (t) => {
  const h = await fixture(t, {
      clipboard: () => {
        throw new Error('Clipboard denied synchronously');
      },
    }),
    clock = copyClock(t);
  h.$('copy-prompt').focus();
  h.$('copy-prompt').click();
  await settle();
  assert.equal(h.$('copy-status').dataset.state, 'error');
  assert.deepEqual(h.selected, [h.$('prompt-example-text')]);
  assert.deepEqual(clock.scheduled, []);
  assert.equal(clock.timers.size, 0);
});
