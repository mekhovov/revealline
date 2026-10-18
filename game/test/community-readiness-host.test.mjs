import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'parse5';
import * as i18n from '../i18n/index.mjs';
import { attachCommunityReadiness, communityRequest } from '../community/readiness.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const source = (await readFile(new URL('../community/page.mjs', import.meta.url), 'utf8')).replace(
  /^import[\s\S]*?from '[^']+';\n/gmu,
  '',
);
const markup = parse(await readFile(new URL('../community/store.html', import.meta.url), 'utf8'));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  for (let turn = 0; turn < 25; turn++) await Promise.resolve();
};
function host(
  t,
  { probe = async () => true, catalog, injected = false, publish, select, session, signOut } = {},
) {
  const document = new Document();
  const append = (parent, node) => {
    if (!node.tagName) {
      if (node.nodeName === '#text') parent.append(document.createTextNode(node.value));
      else for (const child of node.childNodes ?? []) append(parent, child);
      return;
    }
    if (['script', 'style', 'head'].includes(node.tagName)) return;
    const element =
      node.tagName === 'html'
        ? document.documentElement
        : node.tagName === 'body'
          ? document.body
          : document.createElement(node.tagName);
    for (const { name, value } of node.attrs ?? []) element.setAttribute(name, value);
    if (!['html', 'body'].includes(node.tagName)) parent.append(element);
    for (const child of node.childNodes ?? []) append(element, child);
  };
  append(document, markup);
  const $ = (id) => document.getElementById(id);
  $('filter').value = 'all';
  const calls = { session: 0, catalog: 0, publish: 0, selected: 0 };
  let closed = false;
  const window = new Events();
  vm.runInNewContext(source, {
    ...i18n,
    document,
    window,
    URL,
    Set,
    AbortController,
    setTimeout,
    clearTimeout,
    location: { href: 'https://local/game/community/store.html' },
    history: { replaceState() {} },
    RevealLineCommunityAuth: injected ? { headers: async () => ({}) } : undefined,
    attachCommunityReadiness,
    communityRequest,
    probeCommunityService: probe,
    createCommunityAccountClient: () => ({
      headers: async () => ({}),
      session: async () => {
        calls.session++;
        return session?.() ?? null;
      },
      signOut: async () => signOut?.(),
    }),
    createCommunityClient: () => ({}),
    createCreatorStore: () => ({
      close() {
        closed = true;
      },
    }),
    createCommunityStateStore: () => ({}),
    createCommunityDownloadStore: () => ({}),
    createTusBrowserUpload: () => ({}),
    createCommunityLibrary: () => ({
      catalog: async (args) => {
        calls.catalog++;
        if (closed) throw new Error('Store closed permanently');
        return catalog?.(args) ?? { editions: [], nextCursor: null };
      },
      close() {
        closed = true;
      },
    }),
    createCommunityPublisher: () => ({
      current: () => (injected ? {} : null),
      select: async () => {
        calls.selected++;
        return select?.() ?? {};
      },
      publish: async () => {
        calls.publish++;
        return publish?.() ?? { status: 'published', id: 'fixture' };
      },
    }),
  });
  t.after(() => window.dispatchEvent(new Event('pagehide')));
  return { $, calls, window };
}

test('actual page makes no setup requests until preflight succeeds; retry preserves typed local values', async (t) => {
  let ready = false;
  const h = host(t, {
    probe: async () => {
      if (!ready) throw new Error('unavailable');
    },
  });
  await settle();
  assert.equal(h.$('service-status').dataset.state, 'unavailable');
  assert.deepEqual(h.calls, { session: 0, catalog: 0, publish: 0, selected: 0 });
  assert.equal(h.$('service-account-fields').disabled, true);
  h.$('publish-title').value = 'Retained local title';
  ready = true;
  await h.$('service-retry').onclick();
  await settle();
  assert.equal(h.calls.catalog, 1);
  assert.equal(h.calls.session, 1);
  assert.equal(h.$('publish-title').value, 'Retained local title');
  assert.equal(h.$('publish').disabled, true, 'a ready service does not sign the player in');
});

test('actual page ignores obsolete catalog errors and late results after leaving', async (t) => {
  const requests = [];
  const h = host(t, {
    catalog: (args) => {
      const d = deferred();
      requests.push({ ...d, args });
      return d.promise;
    },
  });
  await settle();
  const first = requests[0];
  h.$('search').value = 'new search';
  const newer = h.$('search').oninput();
  await settle();
  assert.equal(first.args.signal.aborted, true);
  requests[1].resolve({ editions: [], nextCursor: null });
  await newer;
  first.reject(new Error('obsolete service failure'));
  await settle();
  assert.equal(h.$('service-status').dataset.state, 'ready');
  const latest = h.$('search').oninput();
  await settle();
  h.window.dispatchEvent(new Event('pagehide'));
  requests[2].resolve({ editions: [], nextCursor: null });
  await latest;
  assert.equal(requests[2].args.signal.aborted, true);
  assert.doesNotMatch(h.$('status').textContent, /obsolete/u);
});

test('rechecking connectivity cannot unlock an in-flight publication or duplicate it', async (t) => {
  const upload = deferred();
  const h = host(t, { injected: true, publish: () => upload.promise });
  await settle();
  assert.equal(h.$('publish').disabled, false);
  const publishing = h.$('publish').onclick();
  await settle();
  assert.equal(h.calls.publish, 1);
  await h.$('service-retry').onclick();
  assert.equal(h.$('publish').disabled, true);
  await h.$('publish').onclick();
  assert.equal(h.calls.publish, 1);
  upload.resolve({ status: 'published', id: 'fixture' });
  await publishing;
  assert.equal(h.$('publish').disabled, false);
});

test('offline then online events recheck availability without submitting player data', async (t) => {
  const h = host(t);
  await settle();
  h.window.dispatchEvent(new Event('offline'));
  assert.equal(h.$('service-account-fields').disabled, true);
  h.window.dispatchEvent(new Event('online'));
  await settle();
  assert.equal(h.$('service-account-fields').disabled, false);
  assert.equal(h.calls.publish, 0);
  assert.equal(h.calls.selected, 0);
});

test('a rejected new package cannot re-enable the previously selected package on retry', async (t) => {
  const h = host(t, {
    injected: true,
    select: () => {
      throw new Error('Invalid new package');
    },
  });
  await settle();
  h.$('publish-file').files = [new Blob(['invalid'])];
  await h.$('publish-file').onchange();
  assert.match(h.$('publish-status').textContent, /Invalid new package/u);
  assert.equal(h.$('publish').disabled, true);
  await h.$('service-retry').onclick();
  assert.equal(h.$('publish').disabled, true);
  await h.$('publish').onclick();
  assert.equal(h.calls.publish, 0);
});

test('persisted navigation keeps local owners open before the pageshow recheck', async (t) => {
  const h = host(t);
  await settle();
  h.window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }));
  h.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
  await settle();
  assert.equal(h.calls.catalog, 2);
  assert.equal(h.$('service-status').dataset.state, 'ready');
  assert.doesNotMatch(h.$('status').textContent, /closed/u);
});

test('Retry during sign-out cannot restore a stale signed-in session', async (t) => {
  const signingOut = deferred(),
    oldRead = deferred();
  let reads = 0;
  const identity = { user: { name: 'Review creator', email: 'review@example.test' } };
  const h = host(t, {
    session: () => (++reads === 1 ? identity : oldRead.promise),
    signOut: () => signingOut.promise,
  });
  await settle();
  assert.equal(h.$('account-signed-in').hidden, false);
  await h.$('service-retry').onclick(); // A slow read started before sign-out.
  const exiting = h.$('account-sign-out').onclick();
  await h.$('service-retry').onclick(); // No automatic read while mutation runs.
  assert.equal(reads, 2);
  signingOut.resolve();
  await exiting;
  oldRead.resolve(identity);
  await settle();
  assert.equal(h.$('account-signed-in').hidden, true);
  assert.equal(h.$('account-signed-out').hidden, false);
  assert.equal(h.$('publish').disabled, true);
});

const catalogEdition = (id) => ({
  editionId: id,
  title: `Edition ${id}`,
  description: 'Query ownership fixture',
  version: 1,
  packageSize: 1024,
  publishedAt: '2026-10-18T12:00:00Z',
});
const shownTitles = (h) =>
  h
    .$('catalog')
    .querySelectorAll('h2')
    .map((node) => node.textContent);

test('new search owns rows and cursor; old Load more cannot replace the pending first page', async (t) => {
  const requests = [];
  const h = host(t, {
    catalog: (args) => {
      const pending = deferred();
      requests.push({ ...pending, args });
      return pending.promise;
    },
  });
  await settle();
  requests[0].resolve({ editions: [catalogEdition('old')], nextCursor: 'old-next' });
  await settle();
  assert.deepEqual(shownTitles(h), ['Edition old']);
  h.$('search').value = 'new';
  h.$('search').focus();
  const searching = h.$('search').oninput();
  await settle();
  assert.equal(h.$('more').hidden, true);
  assert.equal(h.$('more').disabled, true);
  assert.equal(h.$('catalog').getAttribute('aria-busy'), 'true');
  assert.deepEqual(shownTitles(h), []);
  await h.$('more').onclick();
  assert.equal(requests.length, 2, 'even a queued activation cannot supersede the new first page');
  requests[1].resolve({ editions: [catalogEdition('new')], nextCursor: 'new-next' });
  await searching;
  assert.deepEqual(shownTitles(h), ['Edition new']);
  assert.equal(h.$('catalog').getAttribute('aria-busy'), 'false');
  h.$('more').focus();
  const more = h.$('more').onclick();
  await settle();
  assert.equal(requests[2].args.query, 'new');
  assert.equal(requests[2].args.cursor, 'new-next');
  await h.$('more').onclick();
  assert.equal(requests.length, 3, 'pagination is not duplicated while pending');
  requests[2].resolve({
    editions: [catalogEdition('new'), catalogEdition('next')],
    nextCursor: null,
  });
  await more;
  assert.deepEqual(shownTitles(h), ['Edition new', 'Edition next']);
  assert.equal(h.$('catalog').ownerDocument.activeElement.textContent, 'Edition next');
  assert.equal(h.$('more').hidden, true);
});

test('a filter change cancels old pagination and owns later errors and the next cursor', async (t) => {
  const requests = [];
  const h = host(t, {
    catalog: (args) => {
      const pending = deferred();
      requests.push({ ...pending, args });
      return pending.promise;
    },
  });
  await settle();
  requests[0].resolve({ editions: [catalogEdition('all')], nextCursor: 'all-next' });
  await settle();
  const more = h.$('more').onclick();
  await settle();
  h.$('filter').value = 'installed';
  const filtered = h.$('filter').onchange();
  await settle();
  assert.equal(requests[1].args.signal.aborted, true);
  assert.equal(requests[2].args.installed, 'installed');
  assert.equal(requests[2].args.cursor, null);
  requests[2].resolve({ editions: [catalogEdition('installed')], nextCursor: 'installed-next' });
  await filtered;
  requests[1].reject(new Error('obsolete pagination failure'));
  await more;
  assert.equal(h.$('service-status').dataset.state, 'ready');
  assert.deepEqual(shownTitles(h), ['Edition installed']);
  const next = h.$('more').onclick();
  await settle();
  assert.equal(requests[3].args.cursor, 'installed-next');
  requests[3].resolve({ editions: [], nextCursor: null });
  await next;
  assert.deepEqual(shownTitles(h), ['Edition installed']);
});

test('a failed replacement query cannot present prior rows as its results, and Retry uses the current query', async (t) => {
  let fail = false;
  const args = [];
  const h = host(t, {
    catalog: async (request) => {
      args.push(request);
      if (fail) throw new Error('current query unavailable');
      return { editions: [catalogEdition(request.query || 'first')], nextCursor: 'next' };
    },
  });
  await settle();
  fail = true;
  h.$('search').value = 'replacement';
  await h.$('search').oninput();
  assert.deepEqual(shownTitles(h), []);
  assert.equal(h.$('more').hidden, true);
  assert.equal(h.$('more').disabled, true);
  assert.equal(h.$('catalog').getAttribute('aria-busy'), 'false');
  assert.equal(h.$('service-status').dataset.state, 'unavailable');
  fail = false;
  await h.$('service-retry').onclick();
  await settle();
  assert.equal(args.at(-1).query, 'replacement');
  assert.equal(args.at(-1).cursor, null);
  assert.deepEqual(shownTitles(h), ['Edition replacement']);
});

test('out-of-order successes and an offline interruption cannot replace the latest results or restore its pager', async (t) => {
  const requests = [];
  const h = host(t, {
    catalog: (args) => {
      const pending = deferred();
      requests.push({ ...pending, args });
      return pending.promise;
    },
  });
  await settle();
  h.$('search').value = 'second';
  const second = h.$('search').oninput();
  await settle();
  h.$('search').value = 'latest';
  const latest = h.$('search').oninput();
  await settle();
  requests[2].resolve({
    editions: [catalogEdition('latest'), catalogEdition('latest')],
    nextCursor: 'latest-next',
  });
  await latest;
  requests[1].resolve({ editions: [catalogEdition('obsolete')], nextCursor: 'obsolete-next' });
  requests[0].resolve({ editions: [catalogEdition('oldest')], nextCursor: 'oldest-next' });
  await second;
  await settle();
  assert.deepEqual(shownTitles(h), ['Edition latest']);
  const more = h.$('more').onclick();
  await settle();
  assert.equal(requests[3].args.cursor, 'latest-next');
  h.window.dispatchEvent(new Event('offline'));
  assert.equal(requests[3].args.signal.aborted, true);
  requests[3].resolve({ editions: [catalogEdition('late-page')], nextCursor: 'late-next' });
  await more;
  assert.deepEqual(shownTitles(h), ['Edition latest']);
  assert.equal(h.$('more').hidden, true);
  assert.equal(h.$('more').disabled, true);
  assert.equal(h.$('catalog').getAttribute('aria-busy'), 'false');
  assert.equal(h.$('service-status').dataset.state, 'unavailable');
});
