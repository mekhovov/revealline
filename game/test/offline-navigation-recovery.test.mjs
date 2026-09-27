import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readOfflineDestination,
  continueOfflineDestination,
} from '../offline-navigation-recovery.mjs';

const scope = 'https://game.example/releases/v2/site/';
const exactId = '["published-owner", "original-revision"]';
const file = { path: 'game/couch/index.html', kind: 'gameplay', bytes: 4, sha256: 'a'.repeat(64) };
const catalogue = {
  format: 'revealline-offline-content.v2',
  version: '2',
  files: [file],
  groups: [
    {
      id: 'runtime:versus',
      title: 'Versus runtime',
      kind: 'gameplay',
      requires: [],
      files: [file.path],
    },
    {
      id: 'versus:horizon',
      title: 'Horizon',
      kind: 'gameplay',
      requires: ['runtime:versus'],
      files: [],
    },
    {
      id: 'versus:exact',
      title: 'Original chapter',
      kind: 'gameplay',
      requires: ['runtime:versus'],
      files: [],
    },
  ],
  destinations: [
    {
      path: 'game/couch/',
      mode: 'versus',
      routeId: 'whole-spatial-v11',
      groups: ['versus:horizon'],
      runtimeGroups: ['runtime:versus'],
    },
    {
      path: 'game/couch/',
      mode: 'versus',
      routeId: 'whole-spatial-v11',
      libraryId: exactId,
      groups: ['versus:exact'],
      runtimeGroups: ['runtime:versus'],
    },
    {
      path: 'game/couch/',
      mode: 'versus',
      routeId: 'legacy',
      groups: ['versus:horizon'],
      runtimeGroups: ['runtime:versus'],
    },
  ],
};
const page = (destination) => {
  const url = new URL('game/downloads.html', scope);
  url.searchParams.set('offline-destination', destination);
  return url.href;
};
const read = (destination, overrides = {}) =>
  readOfflineDestination({
    pageURL: page(destination),
    scope,
    catalogue,
    version: '2',
    ...overrides,
  });

test('standalone continuation selects the exact published owner and preserves opaque query values', () => {
  const target = new URL('game/couch/index.html', scope);
  target.searchParams.set('journey', 'whole-spatial-v11');
  target.searchParams.set('library-mission', exactId);
  target.searchParams.set('return-token-v2', 'opaque+/=token');
  target.searchParams.set('journey-return', 'whole-spatial-v2');
  const request = read(target.href);
  assert.equal(request.href, target.href);
  assert.deepEqual(request.groups, ['versus:exact']);
  assert.equal(request.title, 'Versus · Original chapter');
  assert.equal(Object.isFrozen(request.groups), true);
  assert.deepEqual(read(new URL('game/couch/', scope).href).groups, ['versus:horizon']);
  const local = new URL('game/couch/?mode-return=opaque%2Bvalue', scope);
  assert.deepEqual(read(local.href).groups, ['runtime:versus']);
  assert.equal(read(local.href).href, local.href);
  assert.equal(
    readOfflineDestination({ pageURL: new URL('game/downloads.html', scope).href }),
    null,
  );
});

test('unknown, external, cross-edition and ambiguous continuations never acquire a fallback owner', () => {
  for (const destination of [
    'https://outside.invalid/game/couch/',
    'https://user:password@game.example/releases/v2/site/game/couch/',
    'https://game.example/releases/v3/site/game/couch/',
    new URL('game/downloads.html', scope).href,
    new URL('game/couch/?journey=unpublished', scope).href,
    new URL('game/couch/?journey=legacy&journey=whole-spatial-v11', scope).href,
    new URL('game/couch/?library-mission=unknown', scope).href,
    new URL('game/couch/?library-mission=&library-mission=another', scope).href,
  ])
    assert.throws(() => read(destination));
  const duplicate = new URL(page(new URL('game/couch/', scope).href));
  duplicate.searchParams.append('offline-destination', new URL('game/', scope).href);
  assert.throws(() => read('', { pageURL: duplicate.href }), /invalid/);
  const ambiguous = structuredClone(catalogue);
  ambiguous.destinations.push(ambiguous.destinations[0]);
  assert.throws(
    () => read(new URL('game/couch/', scope).href, { catalogue: ambiguous }),
    /exact destination/,
  );
  assert.throws(() => read(new URL('game/couch/', scope).href, { version: '3' }), /differs/);
  const empty = structuredClone(catalogue);
  empty.destinations[0].groups = [];
  assert.throws(() => read(new URL('game/couch/', scope).href, { catalogue: empty }), /incomplete/);
});

test('standalone opening waits for local verification, never starts a download, and stays put on missing bytes', async () => {
  const request = read(new URL('game/couch/', scope).href),
    visits = [];
  let finish;
  const pending = continueOfflineDestination({
    request,
    navigate: (href) => visits.push(href),
    verify: (groups) => {
      assert.deepEqual(groups, ['versus:horizon']);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  assert.deepEqual(visits, []);
  finish({ ready: true });
  await pending;
  assert.deepEqual(visits, [request.href]);
  visits.length = 0;
  await assert.rejects(
    continueOfflineDestination({
      request,
      navigate: (href) => visits.push(href),
      verify: async () => ({ ready: false }),
    }),
    /not ready offline/,
  );
  assert.deepEqual(visits, []);
});

test('Cancel or Back during final verification cannot reopen the abandoned destination', async () => {
  const request = read(new URL('game/couch/', scope).href),
    controller = new AbortController(),
    visits = [];
  let finish;
  const pending = continueOfflineDestination({
    request,
    signal: controller.signal,
    navigate: (href) => visits.push(href),
    verify: async (_groups, { signal }) => {
      assert.equal(signal, controller.signal);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  controller.abort();
  finish({ ready: true });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(visits, []);
});
