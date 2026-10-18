import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'parse5';
import * as i18n from '../i18n/index.mjs';
import { attachCommunityReadiness, communityRequest } from '../community/readiness.mjs';
import { confirmCommunityRemoval } from '../community/removal-review.mjs';
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
  {
    probe = async () => true,
    catalog,
    injected = false,
    publish,
    select,
    session,
    signOut,
    removal = {},
  } = {},
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
    confirmCommunityRemoval,
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
      ...removal,
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

for (const kind of ['offload', 'download'])
  test(`actual page ${kind} removal requires visible confirmation and a fresh reviewed capability`, async (t) => {
    const reviewed = [],
      commits = [],
      prepare = async () => {
        const value = { detachableBytes: 42 };
        reviewed.push(value);
        return value;
      },
      commit = async (edition, review) => {
        commits.push({ edition, review });
        return { journalComplete: true };
      },
      h = host(t, {
        catalog: async () => ({
          editions: [
            {
              editionId: 'local',
              title: 'Local',
              version: 1,
              installed: true,
              packageRetained: true,
              playHref: './play',
              publishedAt: '2026-10-18T12:00:00Z',
              packageSize: 42,
            },
          ],
          nextCursor: null,
        }),
        removal: {
          reviewInstalledOffload: prepare,
          offloadInstalled: commit,
          reviewDownloadRemoval: prepare,
          removeDownload: commit,
        },
      });
    await settle();
    const find = () =>
      h
        .$('catalog')
        .querySelectorAll('button')
        .find(
          (node) =>
            node.textContent ===
            (kind === 'offload' ? 'Offload installed media' : 'Remove recovery download'),
        );
    const first = find().onclick();
    await settle();
    assert.equal(commits.length, 0);
    assert.equal(h.$('community-removal-dialog').open, true);
    assert.equal(
      h.$('community-removal-keep').ownerDocument.activeElement,
      h.$('community-removal-keep'),
    );
    h.$('community-removal-keep').click();
    await first;
    assert.equal(commits.length, 0);
    const second = find().onclick();
    await settle();
    h.$('community-removal-confirm').click();
    await second;
    assert.equal(reviewed.length, 2);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].review, reviewed[1]);
    assert.equal(commits[0].edition.editionId, 'local');
    assert.equal(h.$('community-removal-dialog'), null);
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
test('obsolete removal preparation cannot open a confirmation or overwrite a newer query error', async (t) => {
  const held = deferred();
  let rejectQuery = false;
  const h = host(t, {
    catalog: async () => {
      if (rejectQuery) throw new Error('new query error');
      return {
        editions: [
          {
            ...catalogEdition('local'),
            installed: true,
            packageRetained: true,
            playHref: './play',
          },
        ],
        nextCursor: null,
      };
    },
    removal: { reviewInstalledOffload: () => held.promise },
  });
  await settle();
  const opener = h
    .$('catalog')
    .querySelectorAll('button')
    .find((node) => node.textContent === 'Offload installed media');
  const pending = opener.onclick();
  rejectQuery = true;
  h.$('search').value = 'new';
  await h.$('search').oninput();
  held.reject(new Error('obsolete removal error'));
  await pending;
  assert.equal(h.$('community-removal-dialog'), null);
  assert.match(h.$('status').textContent, /new query error/);
  assert.doesNotMatch(h.$('status').textContent, /obsolete removal error/);
});

for (const kind of ['offload', 'download'])
  for (const outcome of ['saved', 'unconfirmed'])
    test(`late ${kind} ${outcome} cannot replace a newer query or its status`, async (t) => {
      const held = deferred();
      const h = host(t, {
        catalog: async ({ query }) => {
          if (query) throw new Error('new query error');
          return {
            editions: [
              {
                ...catalogEdition('local'),
                installed: true,
                packageRetained: true,
                playHref: './play',
              },
            ],
            nextCursor: null,
          };
        },
        removal: {
          reviewInstalledOffload: async () => ({ detachableBytes: 80 }),
          reviewDownloadRemoval: async () => ({}),
          offloadInstalled: () => held.promise,
          removeDownload: () => held.promise,
        },
      });
      await settle();
      const opener = h
        .$('catalog')
        .querySelectorAll('button')
        .find(
          (node) =>
            node.textContent ===
            (kind === 'offload' ? 'Offload installed media' : 'Remove recovery download'),
        );
      const pending = opener.onclick();
      await settle();
      h.$('community-removal-confirm').click();
      await settle();
      h.$('search').value = 'new';
      h.$('search').focus();
      await h.$('search').oninput();
      if (outcome === 'saved') held.resolve({ journalComplete: true });
      else held.reject(new Error('obsolete removal error'));
      await pending;
      assert.equal(h.calls.catalog, 2, 'a finished old removal must not replace the newer query');
      assert.match(h.$('status').textContent, /new query error/);
      assert.equal(h.$('search').ownerDocument.activeElement, h.$('search'));
    });

test('offload reports an unconfirmed commit and a partial journal without claiming content was kept', async (t) => {
  let attempt = 0;
  const h = host(t, {
    catalog: async () => ({
      editions: [
        { ...catalogEdition('local'), installed: true, packageRetained: true, playHref: './play' },
      ],
      nextCursor: null,
    }),
    removal: {
      reviewInstalledOffload: async () => ({ detachableBytes: 80 }),
      offloadInstalled: async () => {
        if (++attempt === 1) throw new Error('storage changed');
        return { journalComplete: false };
      },
    },
  });
  await settle();
  const run = async () => {
    const opener = h
        .$('catalog')
        .querySelectorAll('button')
        .find((node) => node.textContent === 'Offload installed media'),
      pending = opener.onclick();
    await settle();
    h.$('community-removal-confirm').click();
    await pending;
  };
  await run();
  assert.match(h.$('status').textContent, /did not confirm a final result/);
  assert.match(h.$('status').textContent, /storage changed/);
  await run();
  assert.match(
    h.$('status').textContent,
    /media was offloaded.*local record update did not finish/,
  );
  assert.equal(attempt, 2);
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
  h.$('search').focus();
  await h.$('search').oninput();
  assert.deepEqual(shownTitles(h), []);
  assert.equal(h.$('more').hidden, true);
  assert.equal(h.$('more').disabled, true);
  assert.equal(h.$('catalog').getAttribute('aria-busy'), 'false');
  assert.equal(h.$('service-status').dataset.state, 'ready');
  assert.equal(h.$('service-catalog-fields').disabled, false, 'a failed query remains editable');
  assert.equal(h.$('search').ownerDocument.activeElement, h.$('search'));
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

test('pagination preserves existing cards and a newer keyboard focus choice', async (t) => {
  const pending = deferred();
  const h = host(t, {
    catalog: async ({ cursor }) =>
      cursor
        ? pending.promise
        : {
            editions: [catalogEdition('first')],
            nextCursor: 'second-page',
          },
  });
  await settle();
  const existingAction = h.$('catalog').querySelector('button');
  h.$('more').focus();
  const more = h.$('more').onclick();
  await settle();
  existingAction.focus();
  pending.resolve({ editions: [catalogEdition('second')], nextCursor: null });
  await more;
  assert.equal(
    h.$('catalog').querySelector('button'),
    existingAction,
    'existing cards and loaded previews are retained',
  );
  assert.equal(
    existingAction.ownerDocument.activeElement,
    existingAction,
    'newer focus is never reassigned to the new heading',
  );
  assert.deepEqual(shownTitles(h), ['Edition first', 'Edition second']);
});

test('empty filtered pages retain pagination without stale or duplicated empty messages', async (t) => {
  let page = 0;
  const h = host(t, {
    catalog: async () => {
      page++;
      return {
        editions: page < 3 ? [] : [catalogEdition('match')],
        nextCursor: page < 3 ? `cursor-${page}` : null,
      };
    },
  });
  await settle();
  assert.deepEqual(shownTitles(h), []);
  assert.equal(h.$('catalog').children.length, 0, 'more pages may still contain matches');
  assert.equal(h.$('more').hidden, false);
  await h.$('more').onclick();
  assert.equal(h.$('catalog').children.length, 0);
  await h.$('more').onclick();
  assert.deepEqual(shownTitles(h), ['Edition match']);
  assert.equal(h.$('catalog').children.length, 1, 'only the matching card is shown');
});

test('Installed remains reachable during an outage without unlocking accounts or publishing', async (t) => {
  const requests = [];
  const h = host(t, {
    probe: async () => {
      throw new Error('offline');
    },
    catalog: async (args) => {
      requests.push(args);
      return {
        editions: [
          {
            ...catalogEdition('local'),
            installed: true,
            local: true,
            managementAvailable: false,
            publishedAt: undefined,
            playHref: '../creator/player.html?edition=local',
          },
        ],
        nextCursor: null,
      };
    },
  });
  await settle();
  assert.equal(h.calls.catalog, 0);
  await h.$('open-installed').onclick();
  assert.equal(requests[0].installed, 'installed');
  assert.equal(h.$('service-catalog-fields').disabled, false);
  assert.equal(h.$('service-account-fields').disabled, true);
  assert.equal(h.$('service-publish-fields').disabled, true);
  assert.deepEqual(shownTitles(h), ['Edition local']);
  assert.equal(h.$('catalog').querySelector('a').href, '../creator/player.html?edition=local');
  assert.equal(
    h.$('catalog').querySelectorAll('button').length,
    0,
    'missing metadata cannot unlock destructive or online actions',
  );
  assert.doesNotMatch(h.$('catalog').textContent, /NaN|Invalid Date/u);
  assert.equal(h.$('filter').ownerDocument.activeElement, h.$('filter'));
  h.$('search').value = 'local';
  await h.$('search').oninput();
  assert.equal(requests.at(-1).query, 'local');
  await h.$('refresh').onclick();
  assert.equal(h.calls.session, 0);
  h.$('filter').value = 'all';
  await h.$('filter').onchange();
  assert.equal(h.$('service-catalog-fields').disabled, true);
  assert.deepEqual(shownTitles(h), [], 'local rows cannot masquerade as remote results');
  await h.$('open-installed').onclick();
  assert.deepEqual(shownTitles(h), ['Edition local']);
});

test('a pending service probe never blocks or cancels local Installed results', async (t) => {
  const probe = deferred();
  const local = deferred();
  const h = host(t, { probe: () => probe.promise, catalog: () => local.promise });
  await settle();
  const browsing = h.$('open-installed').onclick();
  await settle();
  assert.equal(h.calls.catalog, 1);
  probe.resolve();
  await settle();
  assert.equal(h.calls.catalog, 1, 'readiness success does not restart local browsing');
  local.resolve({ editions: [catalogEdition('local')], nextCursor: null });
  await browsing;
  assert.deepEqual(shownTitles(h), ['Edition local']);
});

test('switching to Installed cancels a remote request and rejects its late result', async (t) => {
  const remote = deferred();
  let remoteSignal;
  const h = host(t, {
    catalog: (args) => {
      if (args.installed === 'installed')
        return { editions: [catalogEdition('local')], nextCursor: null };
      remoteSignal = args.signal;
      return remote.promise;
    },
  });
  await settle();
  await h.$('open-installed').onclick();
  assert.equal(remoteSignal.aborted, true);
  remote.resolve({ editions: [catalogEdition('remote')], nextCursor: 'remote-next' });
  await settle();
  assert.deepEqual(shownTitles(h), ['Edition local']);
  assert.equal(h.$('more').hidden, true);
  h.window.dispatchEvent(new Event('offline'));
  await settle();
  assert.equal(h.$('service-catalog-fields').disabled, false);
  assert.deepEqual(shownTitles(h), ['Edition local']);
});

test('an unavailable local edition has no Play or install action and leaves healthy games usable', async (t) => {
  const h = host(t, {
    probe: async () => {
      throw new Error('offline');
    },
    catalog: async () => ({
      editions: [
        {
          ...catalogEdition('unavailable'),
          local: true,
          localUnavailable: true,
          installed: false,
          publishedAt: undefined,
        },
        {
          ...catalogEdition('healthy'),
          local: true,
          installed: true,
          managementAvailable: false,
          playHref: '../creator/player.html?edition=healthy',
        },
      ],
      nextCursor: null,
    }),
  });
  await settle();
  await h.$('open-installed').onclick();
  const cards = h.$('catalog').querySelectorAll('article');
  assert.equal(cards[0].querySelectorAll('button').length, 0);
  assert.equal(cards[0].querySelectorAll('a').length, 0);
  assert.match(cards[0].textContent, /could not be checked/u);
  assert.equal(cards[1].querySelector('a').href, '../creator/player.html?edition=healthy');
});
