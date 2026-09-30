import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';

const page = new URL('../../authoring/design-atlas/reveal-audit.html', import.meta.url);
const html = await readFile(page, 'utf8');
const audit = JSON.parse(await readFile(new URL('./reveal-audit.json', page), 'utf8'));
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};
let serial = 0;

async function fixture(
  t,
  { read = async () => ({ ok: true, json: async () => structuredClone(audit) }) } = {},
) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set(),
    requests = [];
  doc.parentNode = win;
  let time = 1000,
    frameId = 0;
  const pad = {
    id: 'Reveal audit pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL('https://reveal.test/authoring/design-atlas/reveal-audit.html'),
    performance: { now: () => time },
    innerHeight: 600,
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
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
    node.before = (sibling) => node.parentNode.insertBefore(sibling, node); // Finite paint command surface: no browser decoding or pixel qualification.
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
      if (['id', 'type', 'value', 'href'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
  };
  const body = parse(html)
    .childNodes.find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  body.childNodes.forEach((node) => append(doc.body, node));
  const restores = [];
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    navigator: { getGamepads: () => [pad] },
    fetch: (url, options = {}) => {
      requests.push({ url, ...options });
      return read(url, options);
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restores.push(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key],
    );
  }
  const locale = getLocale();
  setLocale('en', { persist: false });
  let host;
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    host?.destroy();
    doc.body.replaceChildren();
    restores.reverse().forEach((fn) => fn());
    setLocale(locale, { persist: false });
  });
  await import(`${new URL('./reveal-audit.mjs', page).href}?host=${++serial}`);
  const reference = html.match(/src="([^"]*authoring-reference-entry\.mjs)"/);
  if (reference) await import(`${new URL(reference[1], page).href}?host=${serial}`);
  host = mountAuthoringInputHost({ document: doc, window: win });
  await settle();
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
  const key = (key) => {
    const node = doc.activeElement,
      event = node.emit('keydown', { key, code: key });
    node.emit('keyup', { key, code: key });
    if (
      !event.defaultPrevented &&
      ['Enter', ' '].includes(key) &&
      ['BUTTON', 'SUMMARY'].includes(node.tagName)
    )
      node.click();
    return event;
  };
  tick();
  tick();
  return { doc, win, host, tick, pulse, key, requests, $: (id) => doc.getElementById(id) };
}

test('Reveal audit publishes the complete real historical records and survives late static translation', async (t) => {
  const h = await fixture(t);
  assert.equal(h.$('rasters').querySelectorAll('article').length, 21);
  assert.equal(h.$('procedures').querySelectorAll('article').length, 17);
  assert.match(h.$('status').textContent, /56/);
  translateDOM(h.doc.body);
  assert.match(
    h.$('status').textContent,
    /56/,
    'Late bootstrap must not replace a ready result with Loading the audit.',
  );
  assert.equal(h.$('status').dataset.error, 'false');
});

test('Reveal audit offers stable section readers and preserves native first Enter ownership', async (t) => {
  const h = await fixture(t),
    read = h.$('reveal-read-rasters'),
    region = h.$('rasters');
  assert.ok(read, 'The raster section needs its own reachable reading action.');
  Object.assign(region, { clientHeight: 200, scrollHeight: 1000, scrollTop: 0 });
  read.focus();
  h.key('Enter');
  assert.equal(h.host.navigation.readingState()?.regionId, 'rasters');
  h.key('End');
  assert.equal(region.scrollTop, 800);
  h.key('Escape');
  assert.equal(h.doc.activeElement, read);
  assert.equal(h.doc.querySelector('dialog[open]'), null);
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const response = (value = audit) => ({ ok: true, json: async () => structuredClone(value) });
const cards = (h) => [...h.$('rasters').children, ...h.$('procedures').children];
const startRetry = (h) => {
  h.$('reveal-reload').focus();
  h.$('reveal-reload').click();
};

test('Reveal audit shared controller opens exact owner reading and two Back presses preserve the summary', async (t) => {
  const h = await fixture(t),
    details = h.$('reveal-owners-raster-1');
  const summary = details.querySelector('summary'),
    read = h.$('reveal-read-raster-1-owners');
  summary.focus();
  h.pulse(0);
  assert.equal(details.open, true);
  read.focus();
  h.pulse(0);
  assert.equal(h.host.navigation.readingState()?.regionId, 'reveal-raster-1-owners-region');
  h.pulse(1);
  assert.equal(h.doc.activeElement, read);
  assert.equal(details.open, true);
  h.pulse(1);
  assert.equal(details.open, false);
  assert.equal(h.doc.activeElement, summary);
  assert.equal(h.doc.querySelector('dialog[open]'), null);
});

test('Reveal audit Sections reach their own stable readers, and live localized labels keep node identity', async (t) => {
  const h = await fixture(t),
    read = h.$('reveal-read-rasters');
  translateDOM(h.doc.body);
  h.pulse(9);
  const dialog = h.doc.querySelector('dialog[open]');
  const choice = [...dialog.querySelectorAll('button')].find(
    (button) => button.textContent === 'Raster originals',
  );
  assert.ok(choice);
  choice.click();
  assert.equal(h.doc.activeElement, read);
  const en = read.getAttribute('aria-label');
  setLocale('uk', { persist: false });
  assert.match(read.getAttribute('aria-label'), /Читати/);
  assert.notEqual(read.getAttribute('aria-label'), en);
  setLocale('en', { persist: false });
  assert.equal(read.getAttribute('aria-label'), en);
  assert.equal(h.$('reveal-read-rasters'), read);
});

test('Reveal audit failed late staging preserves the complete previously published article identities', async (t) => {
  let next = audit;
  const h = await fixture(t, { read: async () => response(next) });
  const before = cards(h);
  next = structuredClone(audit);
  next.procedural.at(-1).owner = null;
  startRetry(h);
  await settle();
  assert.deepEqual(cards(h), before);
  assert.equal(h.$('status').dataset.error, 'true');
  assert.equal(h.doc.activeElement, h.$('reveal-reload'));
});

test('Reveal audit historical owner mismatches render unavailable previews without rewriting or losing records', async (t) => {
  const snapshot = structuredClone(audit);
  snapshot.procedural[0].id = 'historical-owner-no-longer-current';
  const h = await fixture(t, { read: async () => response(snapshot) });
  assert.equal(h.$('procedures').querySelectorAll('article').length, 17);
  assert.equal(h.$('procedures').querySelectorAll('canvas').length, 16);
  assert.match(h.$('procedures').textContent, /historical-owner-no-longer-current/);
  assert.equal(h.$('status').dataset.error, 'false');
});

for (const action of ['Cancel', 'Back', 'Escape'])
  test(`Reveal audit pending ${action} aborts and fences late success without replacing records`, async (t) => {
    const pending = deferred();
    let count = 0;
    const h = await fixture(t, { read: () => (++count === 1 ? response() : pending.promise) });
    const before = cards(h);
    startRetry(h);
    h.tick();
    assert.equal(h.doc.activeElement, h.$('reveal-cancel'));
    if (action === 'Cancel') h.pulse(0);
    else if (action === 'Back') h.pulse(1);
    else h.key('Escape');
    assert.equal(h.requests.at(-1).signal.aborted, true);
    assert.equal(h.doc.activeElement, h.$('reveal-reload'));
    const status = h.$('status').textContent;
    pending.resolve(response());
    await settle();
    assert.deepEqual(cards(h), before);
    assert.equal(h.$('status').textContent, status);
    assert.equal(h.doc.activeElement, h.$('reveal-reload'));
  });

test('Reveal audit older response and finally cannot replace a newer completed retry', async (t) => {
  const pending = deferred();
  let count = 0;
  const h = await fixture(t, { read: () => (++count === 2 ? pending.promise : response()) });
  startRetry(h);
  const older = h.requests.at(-1);
  startRetry(h);
  await settle();
  const before = cards(h),
    text = h.$('status').textContent;
  assert.equal(older.signal.aborted, true);
  pending.reject(new Error('Obsolete failure'));
  await settle();
  assert.deepEqual(cards(h), before);
  assert.equal(h.$('status').textContent, text);
  assert.equal(h.$('status').dataset.error, 'false');
});

for (const event of [
  'focus',
  'pointerdown',
  'touchstart',
  'wheel',
  'input',
  'blur',
  'hidden',
  'persisted-pagehide',
  'pagehide',
])
  test(`Reveal audit pending reload respects newer ${event} ownership`, async (t) => {
    const pending = deferred();
    let count = 0;
    const h = await fixture(t, { read: () => (++count === 1 ? response() : pending.promise) });
    const before = cards(h);
    startRetry(h);
    if (event === 'focus') h.$('reveal-audit-home').focus();
    else if (['pointerdown', 'touchstart', 'wheel', 'input'].includes(event))
      h.$('reveal-audit-home').emit(event);
    else if (event === 'blur') h.win.emit('blur');
    else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.win.emit('pagehide', { persisted: event === 'persisted-pagehide' });
    assert.equal(h.requests.at(-1).signal.aborted, true);
    const focus = h.doc.activeElement,
      status = h.$('status').textContent;
    pending.resolve(response());
    await settle();
    assert.deepEqual(cards(h), before);
    assert.equal(h.doc.activeElement, focus);
    assert.equal(h.$('status').textContent, status);
  });

test('Reveal audit cancels initial JSON decoding without stealing focus or restarting on cached return', async (t) => {
  const pending = deferred();
  const h = await fixture(t, { read: async () => ({ ok: true, json: () => pending.promise }) });
  const before = h.doc.activeElement;
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  pending.resolve(structuredClone(audit));
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(cards(h).length, 0);
  assert.equal(h.doc.activeElement, before);
});

test('Reveal audit stale image errors cannot alter a replacement generation', async (t) => {
  const h = await fixture(t),
    image = h.$('rasters').querySelector('img');
  startRetry(h);
  await settle();
  const before = cards(h);
  image.emit('error');
  assert.deepEqual(cards(h), before);
  assert.equal(h.$('rasters').querySelectorAll('img').length, 21);
  const current = h.$('rasters').querySelector('img');
  current.emit('error');
  assert.equal(h.$('rasters').querySelectorAll('img').length, 20);
  assert.match(h.$('rasters').textContent, /unavailable/i);
});

test('Reveal audit reader cleanup cancels on lifecycle changes and terminal cleanup removes local handlers', async (t) => {
  const h = await fixture(t),
    read = h.$('reveal-read-rasters');
  read.focus();
  h.pulse(0);
  assert.equal(h.host.navigation.readingState()?.regionId, 'rasters');
  h.win.emit('pagehide', { persisted: true });
  assert.equal(h.host.navigation.readingState(), null);
  h.win.emit('pageshow', { persisted: true });
  read.focus();
  h.pulse(0);
  h.win.emit('pagehide', { persisted: false });
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(read.onclick, null);
  assert.equal(h.$('reveal-reload').onclick, null);
});

test('Reveal audit consumed Escape in a reader does not close its surrounding disclosure', async (t) => {
  const h = await fixture(t),
    details = h.$('reveal-owners-procedural-1');
  details.open = true;
  const read = h.$('reveal-read-procedural-1-owners');
  read.focus();
  h.key('Enter');
  assert.ok(h.host.navigation.readingState());
  h.key('Escape');
  assert.equal(details.open, true);
  assert.equal(h.doc.activeElement, read);
  h.key('Escape');
  assert.equal(details.open, false);
});

test('Atlas exposes one unique, actual Reveal audit reentry link', async () => {
  const source = await readFile(new URL('./index.html', page), 'utf8');
  const matches = [...source.matchAll(/<a\s+[^>]*id="reveal-audit-link"[^>]*>/g)];
  assert.equal(matches.length, 1);
  assert.match(matches[0][0], /href="reveal-audit.html"/);
});

test('Reveal audit Page actions returns to its real home link instead of reopening Sections', async (t) => {
  const h = await fixture(t);
  h.$('reveal-read-procedures').focus();
  h.pulse(9);
  const dialog = h.doc.querySelector('dialog[open]');
  const action = [...dialog.querySelectorAll('button')].find(
    (button) => button.textContent === 'Page actions',
  );
  assert.ok(action);
  action.focus();
  h.pulse(0);
  assert.equal(h.doc.querySelector('dialog[open]'), null);
  assert.equal(h.doc.activeElement, h.$('reveal-audit-home'));
  assert.equal(h.doc.activeElement.getAttribute('href'), 'index.html');
  h.pulse(0);
  assert.equal(h.doc.querySelector('dialog[open]'), null);
});

for (const field of ['path', 'subject', 'bytes', 'sha256', 'width', 'height'])
  test(`Reveal audit rejects ${field} drift before binding a pinned source viewer`, async (t) => {
    let next = audit;
    const h = await fixture(t, { read: async () => response(next) });
    const before = cards(h);
    next = structuredClone(audit);
    const target = ['path', 'subject'].includes(field) ? next.images[0] : next.images[0].image;
    target[field] =
      typeof target[field] === 'number' ? target[field] + 1 : `${target[field]}-changed`;
    startRetry(h);
    await settle();
    assert.deepEqual(cards(h), before);
    assert.equal(h.$('status').dataset.error, 'true');
    assert.equal(h.doc.activeElement, h.$('reveal-reload'));
  });
