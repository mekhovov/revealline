import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const [html, packCatalog] = await Promise.all([
  readFile(new URL('../../site/about.html', import.meta.url), 'utf8'),
  readFile(new URL('../content/packs/catalog.json', import.meta.url), 'utf8'),
]);
let instance = 0;
function mount(doc) {
  doc.documentElement.dataset.currentVersion = html.match(/data-current-version="([^"]+)"/)[1];
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
      if (['value', 'href', 'type'].includes(name)) el[name] = value;
      if (name === 'class') el.className = value;
      if (['hidden', 'disabled'].includes(name)) el[name] = true;
    }
    stack.at(-1).append(el);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(el);
  }
}

async function about(t, pageHref, { packs = null } = {}) {
  const doc = new Document(),
    win = new Events(),
    frames = new Map();
  mount(doc);
  for (const select of doc.querySelectorAll('select'))
    Object.defineProperty(select, 'selectedOptions', {
      configurable: true,
      get: () => select.options.filter((option) => option.value === select.value),
    });
  const requests = [],
    navigations = [],
    writes = [];
  let resolveArchive,
    evaluation,
    frameId = 0;
  const archiveGate = new Promise((resolve) => {
    resolveArchive = resolve;
  });
  const location = {
    href: pageHref,
    assign: (href) => navigations.push(href),
    replace: (href) => navigations.push(href),
  };
  const globals = {
    document: doc,
    window: win,
    navigator: { getGamepads: () => [] },
    requestAnimationFrame: (callback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    location,
    localStorage: {
      getItem: () => null,
      setItem: (...args) => writes.push(args),
    },
    fetch: async (url, options) => {
      requests.push({ href: String(url), options });
      if (requests.length === 1) return archiveGate;
      assert.match(String(url), /\/game\/content\/packs\/catalog\.json$/);
      return packs === null
        ? new Response('', { status: 503 })
        : new Response(packs, { status: 200 });
    },
  };
  const previous = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    resolveArchive(new Response('', { status: 503 }));
    if (evaluation) await evaluation;
    for (const [key, descriptor] of Object.entries(previous))
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  for (const link of doc.querySelectorAll('a'))
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigations.push(new URL(link.href, pageHref).href);
    });
  const $ = (id) => doc.getElementById(id);
  return {
    doc,
    $,
    location,
    requests,
    navigations,
    writes,
    async start() {
      evaluation = import(`../../site/landing.mjs?history-host=${++instance}`);
      await waitFor(() => requests.length > 0, {
        message: 'About did not request its release index.',
      });
    },
    async complete(payload = null, responseHref = '') {
      const response = new Response(payload ? JSON.stringify(payload) : '', {
        status: payload ? 200 : 503,
      });
      if (responseHref) Object.defineProperty(response, 'url', { value: responseHref });
      resolveArchive(response);
      await evaluation;
    },
  };
}

const payload = {
  releases: [
    { version: 'v0.28.0', play: 'v0.28.0/site/game/' },
    {
      version: 'v0.29.0',
      play: 'v0.29.0/site/game/',
      canonicalPlay: 'javascript:alert(1)',
    },
    {
      version: 'v0.1.0',
      play: 'v0.1.0/site/game/',
      canonicalPlay: 'https://archive.example.test/releases/v0.1.0/site/game/',
    },
    {
      version: 'v9.0.0',
      play: '../unsafe/site/game/',
      canonicalPlay: 'https://name:secret@example.test/releases/v9.0.0/site/game/',
    },
  ],
};
for (const [page, shared, responseHref] of [
  [
    'https://example.test/revealline/site/about.html#versions',
    'https://example.test/revealline/releases/',
    '',
  ],
  [
    'https://example.test/revealline/releases/v0.60.8/site/site/about.html#versions',
    'https://example.test/revealline/releases/',
    '',
  ],
  [
    'https://example.test/preview/releases/v0.60.8/site/site/about.html',
    'https://example.test/preview/releases/',
    'https://cdn.example.test/catalog/releases/index.json',
  ],
  [
    'https://mekhovov.github.io/revealline-archive-21/releases/v0.61.3/site/site/about.html',
    'https://mekhovov.github.io/revealline/releases/',
    '',
  ],
])
  test(`About exposes history while pending and only changes explicit links: ${page}`, async (t) => {
    const h = await about(t, page);
    assert.equal(
      h.$('release-history')?.hidden,
      true,
      'Archive link waits for its real URL, not a placeholder.',
    );
    await h.start();
    const history = h.$('release-history'),
      picker = h.$('version-picker'),
      play = h.$('version-play');
    assert.equal(history.hidden, false);
    assert.equal(history.closest('#versions'), h.$('versions'));
    const main = h.doc.querySelector('main');
    assert.equal(h.$('versions').parentElement, main);
    assert.equal(
      main.children[0].id,
      'versions',
      'Build information precedes long page content so it is not displaced by that content.',
    );
    assert.ok(
      [...main.children].indexOf(h.$('versions')) <
        [...main.children].indexOf(h.doc.querySelector('.hero')),
    );
    assert.equal(history.href, shared);
    assert.deepEqual(h.requests, [{ href: `${shared}index.json`, options: { cache: 'no-cache' } }]);
    assert.equal(picker.value, '../game/');
    assert.equal(play.href, '../game/');
    assert.equal(h.location.href, page);
    assert.deepEqual(h.navigations, []);
    await h.complete(payload, responseHref);
    const index = responseHref || `${shared}index.json`;
    assert.deepEqual(
      picker.options.map((option) => option.value),
      [
        '../game/',
        new URL('v0.29.0/site/game/', index).href,
        new URL('v0.28.0/site/game/', index).href,
        'https://archive.example.test/releases/v0.1.0/site/game/',
      ],
    );
    assert.match(h.$('version-status').textContent, /3 preserved builds.*remains the default/);
    assert.equal(picker.value, '../game/');
    assert.equal(play.href, '../game/');
    picker.value = picker.options[1].value;
    picker.emit('change');
    assert.equal(play.href, picker.value);
    assert.deepEqual(h.navigations, [], 'Choosing a preserved version never starts it.');
    assert.equal(h.location.href, page);
    assert.deepEqual(h.writes, []);
    play.click();
    assert.deepEqual(h.navigations, [new URL('v0.29.0/site/game/', index).href]);
    history.click();
    assert.deepEqual(h.navigations, [new URL('v0.29.0/site/game/', index).href, shared]);
  });

test('About relocalizes loaded selectors without changing focus or launch identity', async (t) => {
  const originalLocale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(originalLocale, { persist: false }));

  const page = 'https://example.test/revealline/site/about.html#versions';
  const h = await about(t, page, { packs: packCatalog });
  await h.start();
  await h.complete(payload);

  const picker = h.$('version-picker');
  const pack = h.$('landing-pack-select');
  const level = h.$('landing-level-select');
  const play = h.$('landing-pack-play');
  picker.value = picker.options.find((option) => option.value.includes('/v0.28.0/')).value;
  picker.emit('change');
  level.focus();

  const selected = () => ({
    release: picker.value,
    pack: pack.value,
    campaign: level.options[level.selectedIndex].dataset.campaignId,
    level: level.value,
    href: play.href,
  });
  const identity = selected();
  assert.equal(picker.options[picker.selectedIndex].textContent, 'v0.28.0 · preserved');
  assert.equal(pack.options[pack.selectedIndex].textContent, 'FPV Front · Pressure Lines');
  assert.equal(level.options[level.selectedIndex].textContent, '01 · Orchard Crossing');
  assert.match(
    h.$('landing-pack-status').textContent,
    /Orchard Crossing.*ready to install and play/,
  );

  setLocale('uk', { persist: false });
  assert.equal(h.doc.activeElement, level);
  assert.deepEqual(selected(), identity);
  assert.equal(picker.options[picker.selectedIndex].textContent, 'v0.28.0 · збережено');
  assert.equal(pack.options[pack.selectedIndex].textContent, 'Фронт FPV · Лінії тиску');
  assert.equal(level.options[level.selectedIndex].textContent, '01 · Садова переправа');
  assert.match(
    h.$('landing-pack-status').textContent,
    /Садова переправа.*готово до встановлення й гри/,
  );

  setLocale('en', { persist: false });
  assert.equal(h.doc.activeElement, level);
  assert.deepEqual(selected(), identity);
  assert.equal(picker.options[picker.selectedIndex].textContent, 'v0.28.0 · preserved');
  assert.equal(pack.options[pack.selectedIndex].textContent, 'FPV Front · Pressure Lines');
  assert.equal(level.options[level.selectedIndex].textContent, '01 · Orchard Crossing');
});

test('About retains current play and shared history when the archive request fails', async (t) => {
  const page = 'https://example.test/revealline/releases/v0.60.8/site/site/about.html#versions';
  const h = await about(t, page);
  await h.start();
  assert.ok(h.$('release-history'), 'About owns the release-history route.');
  const href = h.$('release-history').href;
  assert.equal(href, 'https://example.test/revealline/releases/');
  await h.complete();
  assert.match(h.$('version-status').textContent, /current build is ready.*archive is available/);
  assert.equal(h.$('release-history').hidden, false);
  assert.equal(h.$('release-history').href, href);
  assert.equal(h.$('version-picker').options.length, 1);
  assert.equal(h.$('version-play').href, '../game/');
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(h.writes, []);
  assert.equal(h.location.href, page);
  h.$('version-play').click();
  assert.deepEqual(h.navigations, ['https://example.test/revealline/releases/v0.60.8/site/game/']);
});
