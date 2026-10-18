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
function host(t, { probe = async () => true, catalog, injected = false, publish, select } = {}) {
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
        return null;
      },
    }),
    createCommunityClient: () => ({}),
    createCreatorStore: () => ({ close() {} }),
    createCommunityStateStore: () => ({}),
    createCommunityDownloadStore: () => ({}),
    createTusBrowserUpload: () => ({}),
    createCommunityLibrary: () => ({
      catalog: async (args) => {
        calls.catalog++;
        return catalog?.(args) ?? { editions: [], nextCursor: null };
      },
      close() {},
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
