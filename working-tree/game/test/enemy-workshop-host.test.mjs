import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const html = await readFile(
  new URL('../../authoring/enemy-catalog/index.html', import.meta.url),
  'utf8',
);
const themes = await readFile(new URL('../content/themes.json', import.meta.url), 'utf8');
let instance = 0;
const until = (predicate) =>
  waitFor(predicate, { message: 'Enemy workshop did not reach the expected state.' });

// Finite DOM/native-default boundary for the actual workshop module. Canvas
// painting, browser layout, native Tab traversal and child gameplay are outside
// this fixture; the existing practice-return test exercises the actual child.
function mount(doc) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1)._text = (stack.at(-1)._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      el = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      el.setAttribute(name, value);
      if (name === 'class') el.className = value;
      if (['type', 'value'].includes(name)) el[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) el[name] = true;
    }
    stack.at(-1).append(el);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(el);
  }
}

async function workshop(
  t,
  url = 'https://example.test/revealline/releases/v0.60.8/site/authoring/enemy-catalog/',
) {
  const doc = new Document(),
    win = new Events(),
    callbacks = new Map();
  class HostElement extends Element {
    getContext() {
      return null;
    }
    prepend(child) {
      this.append(child);
      this.children.unshift(this.children.pop());
    }
    showModal() {
      this.open = true;
      this.setAttribute('open', '');
    }
    close() {
      this.open = false;
      this.removeAttribute('open');
      this.emit('close');
    }
  }
  doc.createElement = (tag) => new HostElement(doc, tag);
  mount(doc);
  win.location = { href: url };
  win.crypto = globalThis.crypto;
  const pad = {
    index: 0,
    id: 'Modeled workshop controller',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const storage = () => {
    const values = new Map(),
      writes = [];
    return {
      writes,
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        writes.push([key, value]);
        values.set(key, String(value));
      },
    };
  };
  const local = storage(),
    session = storage(),
    navigations = [],
    requests = [];
  let resolveThemes,
    raf = 0,
    now = 0;
  const themeGate = new Promise((resolve) => {
    resolveThemes = resolve;
  });
  const globals = {
    document: doc,
    window: win,
    localStorage: local,
    sessionStorage: session,
    navigator: { getGamepads: () => [pad] },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(fn) {
      callbacks.set(++raf, fn);
      return raf;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    fetch: async (path) => {
      requests.push(path);
      assert.equal(path, '../../game/content/themes.json');
      return themeGate;
    },
  };
  const previous = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    for (const [key, descriptor] of Object.entries(previous))
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  const $ = (id) => doc.getElementById(id);
  const back = $('return-game');
  assert.ok(back, 'The actual workshop has an explicit native Return to game action.');
  assert.equal(back.tagName, 'A');
  // Observe native navigation activation without leaving the modeled document.
  // Resolution uses the actual href and page URL, not a guessed global game URL.
  back.addEventListener('click', (event) => {
    event.preventDefault();
    navigations.push(new URL(back.getAttribute('href'), url).href);
  });
  const frame = () => {
    now += 16;
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((fn) => fn(now));
  };
  const key = (value) => {
    const target = doc.activeElement;
    const event = target.emit('keydown', { key: value });
    if (!event.defaultPrevented && value === 'Enter' && ['A', 'BUTTON'].includes(target.tagName))
      target.click();
    if (!event.defaultPrevented && value === 'Escape')
      doc.querySelector('dialog[open]')?.emit('cancel');
    return event;
  };
  const start = () =>
    import(`../../authoring/enemy-catalog/workshop.mjs?return-host=${++instance}`);
  const resolve = (status = 200) =>
    resolveThemes(new Response(status === 200 ? themes : '', { status }));
  return {
    doc,
    win,
    $,
    back,
    local,
    session,
    requests,
    navigations,
    pad,
    frame,
    key,
    start,
    resolve,
    message: () => $('catalog-host-status').querySelector('.operation-status-label').textContent,
    tap(index) {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
    },
    async ready() {
      $('open-catalog').focus();
      await start();
      resolve();
      await until(() => $('enemy-catalog-dialog')?.open);
    },
  };
}

for (const [base, expected] of [
  ['http://localhost:8000/authoring/enemy-catalog/', 'http://localhost:8000/game/'],
  [
    'https://example.test/revealline/releases/v0.60.8/site/authoring/enemy-catalog/',
    'https://example.test/revealline/releases/v0.60.8/site/game/',
  ],
])
  test(`native Return remains available before loading and after theme failure: ${base}`, async (t) => {
    const h = await workshop(t, base);
    assert.equal(h.back.textContent, 'Return to game');
    assert.equal(h.back.closest('[hidden],[inert],[disabled]'), null);
    assert.equal(h.$('open-catalog').disabled, true);
    assert.equal(h.requests.length, 0);
    h.back.focus();
    h.key('Enter');
    assert.deepEqual(h.navigations, [expected]);
    await h.start();
    assert.match(h.message(), /Loading registered themes/);
    assert.equal(h.$('open-catalog').disabled, true);
    h.back.focus();
    h.key('Enter');
    assert.deepEqual(h.navigations, [expected, expected]);
    h.resolve(503);
    await until(() => /Workshop unavailable/.test(h.message()));
    assert.equal(h.back.isConnected, true);
    assert.equal(h.back.closest('[hidden],[inert],[disabled]'), null);
    assert.equal(h.$('open-catalog').disabled, true);
    h.back.focus();
    h.key('Enter');
    assert.deepEqual(h.navigations, [expected, expected, expected]);
    assert.deepEqual(h.local.writes, []);
    assert.deepEqual(h.session.writes, []);
    assert.deepEqual(h.requests, ['../../game/content/themes.json']);
  });

test('workshop modal Back keeps its draft before a separate keyboard Return to game', async (t) => {
  const h = await workshop(t);
  await h.ready();
  h.$('enemy-catalog-role').value = 'eroder';
  h.$('enemy-catalog-role').onchange();
  h.$('enemy-catalog-skin').value = 'ukraine';
  h.$('enemy-catalog-skin').onchange();
  assert.equal(h.doc.activeElement, h.$('enemy-catalog-role'));
  h.key('Escape');
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.equal(h.doc.activeElement, h.$('open-catalog'));
  assert.deepEqual(h.navigations, [], 'Modal Back does not leave the workshop.');
  h.key('Enter');
  assert.equal(h.$('enemy-catalog-dialog').open, true);
  assert.equal(h.$('enemy-catalog-role').value, 'eroder');
  assert.equal(h.$('enemy-catalog-skin').value, 'ukraine');
  h.$('enemy-catalog-back').focus();
  h.key('Enter');
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  h.back.focus();
  h.key('Enter');
  assert.deepEqual(h.navigations, ['https://example.test/revealline/releases/v0.60.8/site/game/']);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('ready controller navigation keeps modal ownership then activates the page Return link explicitly', async (t) => {
  const h = await workshop(t);
  await h.ready();
  h.frame();
  h.tap(0);
  for (let i = 0; i < 5; i++) {
    h.tap(13);
    assert.ok(h.$('enemy-catalog-dialog').contains(h.doc.activeElement));
  }
  assert.deepEqual(h.navigations, []);
  h.tap(1);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.deepEqual(h.navigations, []);
  for (let i = 0; i < 8 && h.doc.activeElement !== h.back; i++) h.tap(13);
  assert.equal(h.doc.activeElement, h.back);
  assert.deepEqual(h.navigations, [], 'Highlighting the page action never navigates.');
  h.tap(0);
  assert.deepEqual(h.navigations, ['https://example.test/revealline/releases/v0.60.8/site/game/']);
  assert.deepEqual(h.local.writes, []);
  assert.deepEqual(h.session.writes, []);
});

test('focused practice keeps parent controls idle and authenticated return restores the draft', async (t) => {
  const h = await workshop(t);
  await h.ready();
  h.$('enemy-catalog-role').value = 'eroder';
  h.$('enemy-catalog-role').onchange();
  h.$('enemy-catalog-skin').value = 'ukraine';
  h.$('enemy-catalog-skin').onchange();
  await h.$('enemy-catalog-play').onclick();
  const child = h.$('catalog-practice');
  await until(() => h.doc.activeElement === child);
  assert.equal(child.hidden, false);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  const launch = new URL(child.src);
  assert.equal(launch.pathname, '/revealline/releases/v0.60.8/site/game/');
  assert.equal(launch.searchParams.get('practice'), '1');
  assert.equal(h.session.writes.length, 1);
  assert.equal(h.session.writes[0][0], 'revealline.playground.current');
  assert.equal(JSON.parse(h.session.writes[0][1]).level.id, 'catalog-eroder');
  h.pad.buttons[0] = { pressed: true, value: 1 };
  h.frame();
  h.frame();
  assert.equal(h.doc.activeElement, child);
  assert.equal(h.$('enemy-catalog-dialog').open, false);
  assert.deepEqual(h.navigations, []);
  child.contentWindow = {};
  h.win.emit('message', {
    source: child.contentWindow,
    origin: launch.origin,
    data: {
      format: 'revealline.enemy-workshop-return.v1',
      session: launch.searchParams.get('enemy-workshop-session'),
    },
  });
  assert.equal(child.hidden, true);
  assert.equal(child.src, 'about:blank');
  assert.equal(h.$('enemy-catalog-dialog').open, true);
  assert.equal(h.doc.activeElement, h.$('enemy-catalog-role'));
  h.frame();
  h.frame();
  assert.equal(
    h.doc.activeElement,
    h.$('enemy-catalog-role'),
    'Held child Confirm cannot activate the parent page exit.',
  );
  assert.equal(h.$('enemy-catalog-role').value, 'eroder');
  assert.equal(h.$('enemy-catalog-skin').value, 'ukraine');
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(
    h.local.writes,
    [],
    'Neither explicit return path implicitly applies authoring choices.',
  );
  assert.equal(h.session.writes.length, 1);
});
