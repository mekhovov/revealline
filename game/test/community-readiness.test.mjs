import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { createCommunityClient } from '../community/client.mjs';
import {
  attachCommunityReadiness,
  communityRequest,
  probeCommunityService,
} from '../community/readiness.mjs';
import { setLocale } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function page() {
  const document = new Document();
  for (const [id, tag] of [
    ['service-catalog-fields', 'fieldset'],
    ['service-account-fields', 'fieldset'],
    ['service-publish-fields', 'fieldset'],
    ['service-retry', 'button'],
    ['service-status', 'p'],
  ]) {
    const node = document.createElement(tag);
    node.id = id;
    document.body.append(node);
  }
  return document;
}

test('readiness verifies the configured endpoint without sending publishing credentials', async () => {
  const calls = [];
  await probeCommunityService({
    baseURL: 'https://service.example.test/prefix/',
    fetchImpl: async (url, init) => {
      calls.push([url, init]);
      return Response.json({ status: 'ready' });
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].href, 'https://service.example.test/prefix/ready');
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].headers, undefined);
  assert.equal(calls[0][1].body, undefined);
});

test('HTML fallbacks, unhealthy, malformed and oversized readiness responses do not qualify', async () => {
  for (const response of [
    new Response('<html>Static hosting</html>', { headers: { 'content-type': 'text/html' } }),
    Response.json({ status: 'ready' }, { status: 503 }),
    Response.json({ status: 'starting' }),
    new Response('{', { headers: { 'content-type': 'application/json' } }),
    Response.json({ status: 'ready', extra: 'x'.repeat(4_096) }),
  ])
    await assert.rejects(probeCommunityService({ fetchImpl: async () => response }));
});

test('hung transport and body time out and abort the transport signal', async () => {
  for (const body of [false, true]) {
    let signal;
    await assert.rejects(
      probeCommunityService({
        timeoutMs: 15,
        fetchImpl: async (_url, init) => {
          signal = init.signal;
          return body
            ? new Response(new ReadableStream({ start() {} }), {
                headers: { 'content-type': 'application/json' },
              })
            : new Promise(() => {});
        },
      }),
      /respond in time/u,
    );
    assert.equal(signal.aborted, true);
  }
});

test('already cancelled work never starts; cancellation bounds a non-cooperative adapter', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    communityRequest(
      () => {
        calls++;
      },
      { signal: controller.signal },
    ),
    /interrupted/u,
  );
  assert.equal(calls, 0);
  const active = new AbortController();
  const pending = communityRequest(() => new Promise(() => {}), { signal: active.signal });
  active.abort();
  await assert.rejects(pending, /interrupted/u);
});

test('setup is gated before readiness; retry preserves form values and action busy state', async () => {
  const document = page();
  const $ = (id) => document.getElementById(id);
  const name = document.createElement('input');
  name.value = 'Local draft';
  const upload = document.createElement('button');
  upload.disabled = true;
  $('service-publish-fields').append(name, upload);
  let works = false;
  let starts = 0;
  const owner = attachCommunityReadiness({
    document,
    probe: async () => {
      if (!works) throw new Error('unreachable');
    },
    onReady: () => {
      starts++;
    },
  });
  assert.equal($('service-account-fields').disabled, true);
  assert.equal(await owner.check(), false);
  assert.equal(starts, 0);
  assert.equal($('service-status').dataset.state, 'unavailable');
  assert.equal($('service-retry').disabled, false);
  works = true;
  await $('service-retry').onclick();
  assert.equal(owner.available(), true);
  assert.equal(starts, 1);
  assert.equal($('service-account-fields').disabled, false);
  assert.equal(
    upload.disabled,
    true,
    'service readiness cannot grant upload permission or clear busy',
  );
  assert.equal(name.value, 'Local draft');
  owner.unavailable();
  assert.equal(owner.available(), false);
  assert.equal($('service-publish-fields').disabled, true);
});

test('old success/failure and page exit cannot override a newer readiness result', async () => {
  const document = page();
  const checks = [];
  let starts = 0;
  const owner = attachCommunityReadiness({
    document,
    probe: (signal) => {
      const work = deferred();
      checks.push({ ...work, signal });
      return work.promise;
    },
    onReady: () => {
      starts++;
    },
  });
  const first = owner.check();
  const second = owner.check();
  assert.equal(checks[0].signal.aborted, true);
  checks[1].resolve();
  await second;
  checks[0].reject(new Error('old failure'));
  await first;
  assert.equal(owner.available(), true);
  const third = owner.check();
  owner.cancel();
  checks[2].resolve();
  await third;
  assert.equal(starts, 1, 'page exit discards late setup');
});

test('readiness status is localized and unavailable state does not leak transport details', async () => {
  const document = page();
  const owner = attachCommunityReadiness({
    document,
    probe: async () => {
      throw new Error('private URL');
    },
  });
  setLocale('uk');
  await owner.check();
  const status = document.getElementById('service-status').textContent;
  assert.match(status, /недоступне/u);
  assert.doesNotMatch(status, /private URL|interface:/u);
  setLocale('en');
  assert.match(document.getElementById('service-status').textContent, /unavailable/u);
});

test('actual store markup gates account and package setup but keeps local links and retry outside', async () => {
  const html = parse(await readFile(new URL('../community/store.html', import.meta.url), 'utf8'));
  const nodes = [];
  const walk = (node, ancestors = []) => {
    nodes.push({ node, ancestors });
    for (const child of node.childNodes ?? []) walk(child, [...ancestors, node]);
  };
  walk(html);
  const attr = (node, key) => node.attrs?.find((item) => item.name === key)?.value;
  for (const id of [
    'account-name',
    'account-email',
    'account-password',
    'account-sign-in',
    'publish-file',
    'publish',
  ]) {
    const entry = nodes.find(({ node }) => attr(node, 'id') === id);
    assert.ok(
      entry.ancestors.some((node) => node.tagName === 'fieldset' && attr(node, 'disabled') === ''),
      id,
    );
  }
  for (const key of ['service.retry', 'service.localPlay', 'service.localCreate']) {
    const entry = nodes.find(
      ({ node }) => attr(node, 'data-i18n') === `interface:community.${key}`,
    );
    assert.ok(entry);
    assert.equal(
      entry.ancestors.some((node) => node.tagName === 'fieldset'),
      false,
    );
  }
});

test('catalog transport receives the cancellation signal', async () => {
  const controller = new AbortController();
  const client = createCommunityClient({
    fetchImpl: async (_url, init) => {
      assert.equal(init.signal, controller.signal);
      return Response.json({ editions: [], nextCursor: null });
    },
  });
  assert.deepEqual(await client.catalog({ signal: controller.signal }), {
    editions: [],
    nextCursor: null,
  });
});

test('Retry restores keyboard focus only while it still owns it', async () => {
  const document = page(),
    pending = [];
  const owner = attachCommunityReadiness({
    document,
    probe: () => {
      const work = deferred();
      pending.push(work);
      return work.promise;
    },
  });
  const retry = document.getElementById('service-retry');
  retry.focus();
  const first = owner.check();
  document.body.focus(); // Browser blur when the pending button is disabled.
  pending[0].reject(new Error('offline'));
  await first;
  assert.equal(document.activeElement, retry);
  const next = owner.check();
  const link = document.createElement('a');
  document.body.append(link);
  link.focus();
  pending[1].resolve();
  await next;
  assert.equal(document.activeElement, link, 'a later local navigation choice owns focus');
});
