import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, serializeOuter } from 'parse5';
import { COMMUNITY_ROUTES, communityEntryURL, gameDocumentURL } from '../community-routes.mjs';
import { loadCommunityEntry, prepareCommunityDocument } from '../communities/entry.mjs';
import { Events } from './helpers/couch-dom.mjs';

const descendants = (node) => [node, ...(node.childNodes ?? []).flatMap(descendants)];
const attributeName = (attribute) =>
  attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;

// A parse5-backed DOMParser boundary exercises HTML parsing and serialization;
// the adapter only supplies the standard DOM methods used by the transformer.
class Parser {
  parseFromString(source, type) {
    assert.equal(type, 'text/html');
    const document = parse(source);
    const wrap = (node) => ({
      getAttribute(name) {
        return node.attrs?.find((attribute) => attributeName(attribute) === name)?.value ?? null;
      },
      setAttribute(name, value) {
        const attribute = node.attrs.find((attribute) => attributeName(attribute) === name);
        if (attribute) attribute.value = String(value);
        else node.attrs.push({ name, value: String(value) });
      },
      get textContent() {
        return descendants(node)
          .filter((child) => child.nodeName === '#text')
          .map((child) => child.value)
          .join('');
      },
      set textContent(value) {
        node.childNodes = [{ nodeName: '#text', value, parentNode: node }];
      },
      get outerHTML() {
        return serializeOuter(node);
      },
    });
    const select = (selector) => {
      const nodes = descendants(document).filter((node) => node.tagName);
      if (selector.startsWith('#'))
        return nodes.filter((node) => wrap(node).getAttribute('id') === selector.slice(1));
      const match = /^(\w+)?(?:\[([\w:\\-]+)(?:="([^"]*)")?\])?$/.exec(selector);
      assert.ok(match, `Test adapter supports selector ${selector}`);
      return nodes.filter((node) => {
        if (match[1] && node.tagName !== match[1]) return false;
        if (!match[2]) return true;
        const value = wrap(node).getAttribute(match[2].replaceAll('\\', ''));
        return match[3] === undefined ? value !== null : value === match[3];
      });
    };
    return {
      doctype: document.childNodes.find((node) => node.nodeName === '#documentType'),
      documentElement: wrap(select('html')[0]),
      querySelector: (selector) => {
        const node = select(selector)[0];
        return node ? wrap(node) : null;
      },
      querySelectorAll: (selector) => select(selector).map(wrap),
    };
  }
}
const documentURL = 'https://owner.github.io/project/releases/v1/site/game/index.html';
const html = (head = '', body = '') =>
  `<!doctype html><html data-boot-state="loading"><head><script src="boot.mjs" defer></script>${head}</head><body><section id="boot-screen"><p id="boot-status">Loading</p><a id="boot-online" href="https://example.test/game/">Play online</a></section>${body}</body></html>`;
const transform = (source, base = documentURL) =>
  prepareCommunityDocument(source, { documentURL: base, DOMParserClass: Parser });
const parsed = (source) => new Parser().parseFromString(source, 'text/html');

test('the real shared host rebases every resource while keeping empty and fragment links local', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const output = transform(source);
  const document = parsed(output);
  assert.ok(output.startsWith('<!doctype html>'));
  assert.equal(document.querySelector('base'), null);
  assert.equal(document.querySelector('iframe'), null);
  for (const attribute of ['src', 'data-boot-href'])
    for (const node of document.querySelectorAll(`[${attribute}]`)) {
      const path = node.getAttribute(attribute);
      assert.ok(path.startsWith(new URL('./', documentURL).href), path);
    }
  assert.equal(document.querySelector('#boot-retry').getAttribute('href'), '');
  assert.equal(
    document.querySelector('#boot-phaser').getAttribute('src'),
    new URL('vendor/phaser-4.2.1.min.js', documentURL).href,
  );
  assert.equal(
    parsed(transform(html('', '<a href="#details">Details</a>')))
      .querySelector('a[href="#details"]')
      .getAttribute('href'),
    '#details',
  );
});

test('relative CSS, srcset, posters and offline metadata keep the shared host resource scope', () => {
  const config = {
    format: 'revealline-offline.v1',
    scope: '../',
    worker: '../service-worker.js',
    buildId: 'f'.repeat(64),
    downloadCatalogue: true,
  };
  const output = transform(
    html(
      `<meta name="revealline-offline" content='${JSON.stringify(config)}'>
       <style>@import "ui/font.css"; .picture{background:url('art/map.png')} .mask{filter:url(#filter)}</style>`,
      `<a id="tool" href="../site/about.html#version">About</a>
       <img srcset="art/small.png 1x, art/large.png 2x, data:image/png;base64,YQ== 3x" style="background: url(art/paper.png)">
       <video poster="art/poster.png"></video><svg><use xlink:href="ui/icons.svg#play"></use></svg>`,
    ),
  );
  const document = parsed(output);
  assert.deepEqual(JSON.parse(document.querySelector('meta').getAttribute('content')), {
    ...config,
    scope: new URL('../', documentURL).href,
    worker: new URL('../service-worker.js', documentURL).href,
  });
  assert.equal(
    document.querySelector('#tool').getAttribute('href'),
    new URL('../site/about.html#version', documentURL).href,
  );
  assert.equal(
    document.querySelector('video').getAttribute('poster'),
    new URL('art/poster.png', documentURL).href,
  );
  assert.equal(
    document.querySelector('use').getAttribute('xlink:href'),
    new URL('ui/icons.svg#play', documentURL).href,
  );
  assert.equal(
    document.querySelector('img').getAttribute('srcset'),
    `${new URL('art/small.png', documentURL)} 1x, ${new URL('art/large.png', documentURL)} 2x, data:image/png;base64,YQ== 3x`,
  );
  assert.ok(
    document
      .querySelector('img')
      .getAttribute('style')
      .includes(new URL('art/paper.png', documentURL).href),
  );
  assert.ok(
    document.querySelector('style').textContent.includes(new URL('ui/font.css', documentURL).href),
  );
  assert.ok(
    document.querySelector('style').textContent.includes(new URL('art/map.png', documentURL).href),
  );
  assert.ok(document.querySelector('style').textContent.includes('url("#filter")'));
});

test('unrelated HTML, base overrides and foreign offline scopes fail before a host is serialized', () => {
  for (const source of [
    '<!doctype html><title>404</title>',
    html('<base href="https://foreign.test/">'),
    html().replace('data-boot-state="loading"', ''),
    html().replace('src="boot.mjs"', 'src="https://foreign.test/boot.mjs"'),
    html(
      `<meta name="revealline-offline" content='${JSON.stringify({ format: 'revealline-offline.v1', scope: 'https://foreign.test/', worker: 'https://foreign.test/service-worker.js' })}'>`,
    ),
    'x'.repeat(1024 * 1024 + 1),
  ])
    assert.throws(() => transform(source));
});

function host(href = 'https://owner.github.io/project/game/communities/coupa/?lang=uk#settings') {
  const windowRef = new Events();
  const elements = new Map([
    ['community-status', { textContent: 'Loading' }],
    ['community-fallback', { href: '' }],
  ]);
  const writes = [];
  const documentRef = {
    documentElement: { dataset: {} },
    getElementById: (id) => elements.get(id),
    open: () => writes.push('open'),
    write: (value) => writes.push(value),
    close: () => writes.push('close'),
  };
  const locationRef = { href };
  const requests = [];
  const response = (overrides = {}) => ({
    ok: true,
    redirected: false,
    url: new URL('index.html', gameDocumentURL(href)).href,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    text: async () => html(),
    ...overrides,
  });
  const options = {
    documentRef,
    locationRef,
    windowRef,
    DOMParserClass: Parser,
    fetcher: async (...args) => {
      requests.push(args);
      return response();
    },
  };
  return { options, writes, elements, requests, response };
}

for (const route of COMMUNITY_ROUTES)
  test(`${route.slug} loads the one shared document without changing its visible URL`, async () => {
    const f = host(
      `https://owner.github.io/project/game/communities/${route.slug}/?lang=uk#settings`,
    );
    const before = f.options.locationRef.href;
    assert.equal(await loadCommunityEntry(f.options), true);
    assert.equal(f.options.locationRef.href, before);
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0][0], 'https://owner.github.io/project/game/index.html');
    assert.equal(f.requests[0][1].mode, 'same-origin');
    assert.equal(f.requests[0][1].redirect, 'error');
    assert.equal(f.requests[0][1].credentials, 'same-origin');
    assert.equal(f.writes[0], 'open');
    assert.ok(f.writes[1].startsWith('<!doctype html>'));
    assert.equal(
      parsed(f.writes[1]).querySelector('#boot-online').getAttribute('href'),
      communityEntryURL(before).href,
      'Later game-boot recovery also stays in the selected community.',
    );
    assert.equal(f.writes[2], 'close');
    assert.equal(f.options.windowRef.listeners.get('pagehide').size, 0);
    const source = await readFile(
      new URL(`../communities/${route.slug}/index.html`, import.meta.url),
      'utf8',
    );
    const document = parsed(source);
    assert.equal(document.querySelector('script').getAttribute('src'), '../entry.mjs');
    const fallback = new URL(
      document.querySelector('#community-fallback').getAttribute('href'),
      before,
    );
    assert.equal(fallback.searchParams.get('edition'), route.editionId);
    assert.equal(document.querySelector('iframe'), null);
    assert.equal(document.querySelector('base'), null);
    assert.equal(
      document.querySelector('#boot-screen'),
      null,
      'The entry never duplicates the game host.',
    );
  });

test('a foreign edition query cannot fetch or write a host and retains only its own fallback', async () => {
  const f = host('https://owner.github.io/project/game/communities/coupa/?edition=droneaid');
  assert.equal(await loadCommunityEntry(f.options), false);
  assert.equal(f.requests.length, 0);
  assert.deepEqual(f.writes, []);
  assert.equal(
    f.elements.get('community-fallback').href,
    communityEntryURL('https://owner.github.io/project/game/communities/coupa/').href,
  );
  assert.equal(f.options.documentRef.documentElement.dataset.communityEntry, 'failed');
});

for (const [name, overrides] of [
  ['foreign response', { url: 'https://foreign.test/game/index.html' }],
  ['same-origin wrong document', { url: 'https://owner.github.io/login/' }],
  ['redirect', { redirected: true }],
  ['non-HTML', { headers: new Headers({ 'content-type': 'application/json' }) }],
  ['HTTP failure', { ok: false }],
  ['unrelated HTML', { text: async () => '<!doctype html><h1>Not the game</h1>' }],
])
  test(`${name} preserves the readable entry and never writes returned content`, async () => {
    const f = host();
    assert.equal(
      await loadCommunityEntry({ ...f.options, fetcher: async () => f.response(overrides) }),
      false,
    );
    assert.deepEqual(f.writes, []);
    assert.match(f.elements.get('community-status').textContent, /direct game link/);
    assert.equal(
      new URL(f.elements.get('community-fallback').href).searchParams.get('edition'),
      'coupa-all',
    );
  });

test('a pagehide during fetch prevents late document replacement and retires its listener', async () => {
  const f = host();
  let resolve, signal;
  const loading = loadCommunityEntry({
    ...f.options,
    fetcher: (_url, options) => {
      signal = options.signal;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  f.options.windowRef.emit('pagehide');
  assert.equal(signal.aborted, true);
  resolve(f.response());
  assert.equal(await loading, false);
  assert.deepEqual(f.writes, []);
  assert.equal(f.options.windowRef.listeners.get('pagehide').size, 0);
});

test('a stalled fetch expires into the same readable recovery page without document writes', async () => {
  const f = host();
  assert.equal(
    await loadCommunityEntry({
      ...f.options,
      timeoutMs: 1,
      fetcher: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Timed out', 'AbortError')),
            {
              once: true,
            },
          );
        }),
    }),
    false,
  );
  assert.deepEqual(f.writes, []);
  assert.equal(f.options.documentRef.documentElement.dataset.communityEntry, 'failed');
  assert.match(f.elements.get('community-status').textContent, /direct game link/);
  assert.equal(f.options.windowRef.listeners.get('pagehide').size, 0);
});
