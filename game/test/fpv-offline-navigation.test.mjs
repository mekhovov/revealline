import test from 'node:test';
import assert from 'node:assert/strict';
import { installPracticeWorker } from '../../optional-practice/worker-template.mjs';

test('FPV offline entry navigation retains language and game return while using its pinned document', async () => {
  const base = 'https://example.test/revealline/optional-practice/civilian-fpv/';
  const listeners = new Map(),
    matches = [],
    fetches = [];
  installPracticeWorker(
    {
      registration: { scope: base },
      addEventListener: (name, listener) => listeners.set(name, listener),
      caches: {
        open: async () => ({
          match: async (url) => {
            matches.push(url);
            return new Response('verified cached bytes');
          },
        }),
      },
      fetch: async (request) => {
        fetches.push(request.url);
        throw new Error('Network is offline');
      },
    },
    [{ path: 'index.html' }, { path: 'app.mjs' }],
    'exact-revision',
  );
  for (const relative of [
    '',
    'index.html',
    '?lang=uk',
    'index.html?lang=uk',
    '?lang=en&game-return=%2Frevealline%2Fgame%2Findex.html',
    'index.html?lang=uk&game-return=%2Frevealline%2Fgame%2Findex.html%3Fedition%3Dfpv-learning',
  ]) {
    const request = Object.freeze({
      url: new URL(relative, base).href,
      method: 'GET',
      mode: 'navigate',
    });
    let response;
    listeners.get('fetch')({ request, respondWith: (value) => (response = value) });
    assert.ok(response, relative);
    assert.equal(await (await response).text(), 'verified cached bytes');
    assert.equal(matches.at(-1), base + 'index.html');
    assert.equal(request.url, new URL(relative, base).href, 'browser parameters remain intact');
  }
  assert.deepEqual(fetches, []);

  for (const [url, method, mode] of [
    [base + 'index.html?lang=uk', 'POST', 'navigate'],
    [base + 'index.html?lang=uk', 'GET', 'cors'],
    [base + 'app.mjs?changed=1', 'GET', 'navigate'],
    [base + 'unknown.html?lang=uk', 'GET', 'navigate'],
    [new URL('../civilian-flight/index.html?lang=uk', base).href, 'GET', 'navigate'],
    ['https://foreign.test/revealline/optional-practice/civilian-fpv/?lang=uk', 'GET', 'navigate'],
  ]) {
    let intercepted = false;
    listeners.get('fetch')({
      request: { url, method, mode },
      respondWith: () => (intercepted = true),
    });
    assert.equal(intercepted, false, `${method} ${mode} ${url}`);
  }
  let resource;
  listeners.get('fetch')({
    request: { url: base + 'app.mjs', method: 'GET', mode: 'cors' },
    respondWith: (value) => (resource = value),
  });
  assert.equal(await (await resource).text(), 'verified cached bytes');
  assert.equal(matches.at(-1), base + 'app.mjs', 'exact resource requests are unchanged');
});

test('entry navigation never substitutes an unadmitted document', () => {
  const listeners = new Map(),
    base = 'https://example.test/practice/civilian-fpv/app/';
  installPracticeWorker(
    {
      registration: { scope: base },
      addEventListener: (name, listener) => listeners.set(name, listener),
    },
    [{ path: 'app.mjs' }],
    'exact-revision',
  );
  let intercepted = false;
  listeners.get('fetch')({
    request: { url: base + '?lang=uk', method: 'GET', mode: 'navigate' },
    respondWith: () => (intercepted = true),
  });
  assert.equal(intercepted, false);
});
