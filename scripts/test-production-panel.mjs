import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { Document } from '../game/test/helpers/couch-dom.mjs';
import { listProductionSlots, inspectProductionSlot } from '../authoring/production/model.mjs';
import { attachProductionPanel, filterProductionSlots } from '../authoring/production/panel.mjs';
import {
  loadProductionImage,
  sourceURL,
  readSourceBytes,
  PREVIEW_BYTES,
} from '../authoring/production/preview.mjs';

const seed = JSON.parse(
  await readFile(new URL('../authoring/production/register.json', import.meta.url)),
);
const rootURL = 'http://localhost:8962/';
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const text = (n) => [n.textContent, ...n.children.map(text)].join(' ');
const findButton = (root, name) => {
  const b = root.querySelectorAll('button').find((n) => n.textContent === name);
  assert(b, name);
  return b;
};
async function host(t, overrides = {}) {
  const doc = new Document(),
    root = doc.createElement('main');
  doc.body.append(root);
  let previews = 0;
  const api = attachProductionPanel({
    root,
    rootURL,
    loadRegister: async () => seed,
    loadPreview: async () => {
      previews++;
      throw new Error('No source loaded by this fixture');
    },
    ...overrides,
  });
  t.after(() => api.dispose());
  await settle();
  return { doc, root, api, previews: () => previews };
}
test('one pure inventory preserves exact inspection and filters missing Sentinel themes without inflating rigs', () => {
  const rows = listProductionSlots(seed);
  assert.equal(rows.length, 248);
  assert(Object.isFrozen(rows));
  assert.deepEqual(
    rows.find((r) => r.id === 'picture.pressure-orchard.fpv'),
    inspectProductionSlot(seed, 'picture.pressure-orchard.fpv'),
  );
  assert.equal(filterProductionSlots(rows, { domain: 'picture', missing: true }).length, 89);
  assert.equal(
    filterProductionSlots(rows, {
      domain: 'picture',
      theme: 'ukraine',
      search: 'sentinel',
      missing: true,
    }).length,
    3,
  );
  assert.equal(
    filterProductionSlots(rows, { domain: 'presentation', stage: 'produced' }).length,
    0,
  );
  assert.equal(
    filterProductionSlots(rows, { domain: 'presentation', stage: 'planned' }).length,
    56,
  );
});
test('actual panel uses metadata only; native filters and Back retain focus, source text stays inert', async (t) => {
  const input = structuredClone(seed);
  input.works[0].title = '<img src=x onerror=run()> ';
  const before = JSON.stringify(input);
  const h = await host(t, { loadRegister: async () => input });
  assert.equal(h.previews(), 0);
  assert.match(text(h.root), /27 unique pictures/);
  assert.match(text(h.root), /6 shared rigs for 56 handles/);
  const row = findButton(h.root, input.works[0].title);
  row.focus();
  row.click();
  const detail = h.root.querySelector('#production-detail');
  assert.equal(detail.hidden, false);
  assert.equal(h.doc.activeElement.tagName, 'H2');
  assert.equal(
    detail.querySelectorAll('img').length,
    0,
    'copy never becomes markup or eager image',
  );
  assert.match(text(detail), /No image has been loaded/);
  findButton(detail, 'Back to slots').click();
  assert.equal(h.doc.activeElement, row);
  const search = h.root.querySelector('input[aria-label="Find a slot or work"]');
  search.focus();
  search.value = 'sentinel';
  search.emit('input');
  assert.equal(h.doc.activeElement, search);
  assert.match(text(h.root), /12 matching slots/);
  search.emit('keydown', { key: 'Escape' });
  assert.equal(h.doc.activeElement, search, 'native text input owns Escape');
  assert.equal(JSON.stringify(input), before);
  assert.equal(h.previews(), 0);
});
test('explicit preview cancellation prevents late row completion, disposes URLs and never steals focus', async (t) => {
  const pending = deferred();
  let signal,
    released = 0,
    requests = 0;
  const h = await host(t, {
    loadPreview: (_entry, options) => {
      requests++;
      signal = options.signal;
      return pending.promise;
    },
  });
  const row = findButton(h.root, seed.works[0].title);
  row.click();
  findButton(h.root, 'Preview original').click();
  assert.equal(requests, 1);
  findButton(h.root, 'Back to slots').click();
  assert.equal(signal.aborted, true);
  assert.equal(h.doc.activeElement, row);
  const image = h.doc.createElement('img');
  pending.resolve({ image, dispose: () => released++ });
  await settle();
  assert.equal(released, 1);
  assert.equal(image.isConnected, false);
  assert.equal(h.doc.activeElement, row);
  assert.equal(h.root.querySelector('#production-detail').hidden, true);
});
test('preview failure is visible; filter, reload and lifecycle cancel current requests without approvals', async (t) => {
  let pending,
    signal,
    calls = 0;
  const h = await host(t, {
    loadPreview: (_entry, o) => {
      calls++;
      signal = o.signal;
      pending = deferred();
      return pending.promise;
    },
  });
  findButton(h.root, seed.works[0].title).click();
  findButton(h.root, 'Preview original').click();
  pending.reject(new Error('Source SHA-256 differs'));
  await settle();
  assert.match(text(h.root), /Preview unavailable: Source SHA-256 differs/);
  findButton(h.root, 'Preview original').click();
  h.api.cancel();
  assert(signal.aborted);
  pending.reject(new Error('aborted'));
  await settle();
  assert.match(text(h.root), /Preview cleared/);
  findButton(h.root, 'Preview original').click();
  const search = h.root.querySelector('input[aria-label="Find a slot or work"]');
  search.value = 'sentinel';
  search.emit('input');
  assert(signal.aborted);
  pending.reject(new Error('aborted'));
  await settle();
  search.value = '';
  search.emit('input');
  findButton(h.root, seed.works[0].title).click();
  findButton(h.root, 'Preview original').click();
  const loading = h.api.refresh();
  assert(signal.aborted);
  pending.reject(new Error('aborted'));
  await loading;
  assert.equal(calls, 4);
  assert.equal(seed.assessments.length, 0);
});
test('late reload and invalid register preserve the current valid view and active filter', async (t) => {
  let next = null;
  const h = await host(t, { loadRegister: () => next ?? Promise.resolve(seed) });
  const p = deferred();
  next = p.promise;
  const old = h.api.refresh();
  const bad = structuredClone(seed);
  bad.works[0].source.path = 'https://example.com/x.png';
  next = Promise.resolve(bad);
  await h.api.refresh();
  assert.match(text(h.root), /Register unavailable/);
  assert.match(text(h.root), /Previous view retained/);
  p.resolve({ bad: true });
  await old;
  assert.match(text(h.root), /27 unique pictures/);
});
test('preview source URL rejects unsafe or remote roots before any body fetch', async () => {
  for (const path of [
    '../x.png',
    '/game/a.png',
    'https://example.com/a.png',
    'authoring/%2e%2e/a.png',
    'authoring//a.png',
  ])
    assert.throws(() => sourceURL(path, rootURL));
  assert.throws(() => sourceURL('authoring/a.png', 'file:///tmp/'));
  assert.throws(() => sourceURL('authoring/a.png', 'https://name:password@example.com/'));
  assert.equal(
    sourceURL('authoring/a.png', 'https://example.com/repo/'),
    'https://example.com/repo/authoring/a.png',
  );
  let requests = 0;
  const entry = structuredClone(seed.works[0].files[0]);
  entry.file.bytes = PREVIEW_BYTES + 1;
  await assert.rejects(
    loadProductionImage(entry, {
      rootURL,
      fetchSource: () => {
        requests++;
      },
    }),
    /up to 8 MiB/,
  );
  assert.equal(requests, 0);
});
test('real PNG byte identity admits native decode once; mismatch and decode failure cannot leave a URL', async () => {
  const entry = seed.works[0].files[0];
  const bytes = await readFile(new URL('../' + entry.file.path, import.meta.url));
  let allocations = 0,
    revocations = 0,
    decodes = 0;
  const image = {
    naturalWidth: entry.width,
    naturalHeight: entry.height,
    removeAttribute() {
      delete this.src;
    },
    async decode() {
      decodes++;
    },
  };
  const options = {
    rootURL,
    cryptoSource: webcrypto,
    fetchSource: async () => new Response(bytes),
    urlAPI: {
      createObjectURL: () => {
        allocations++;
        return 'blob:owned';
      },
      revokeObjectURL: () => revocations++,
    },
    makeImage: () => image,
  };
  const result = await loadProductionImage(entry, options);
  assert.equal(allocations, 1);
  assert.equal(decodes, 1);
  assert.equal(revocations, 0);
  result.dispose();
  result.dispose();
  assert.equal(revocations, 1);
  assert.equal(image.src, undefined);
  const changed = new Uint8Array(bytes);
  changed[changed.length - 1] ^= 1;
  await assert.rejects(
    loadProductionImage(entry, { ...options, fetchSource: async () => new Response(changed) }),
    /SHA-256 differs/,
  );
  assert.equal(allocations, 1);
  await assert.rejects(
    loadProductionImage({ ...entry, width: entry.width + 1 }, options),
    /PNG dimensions differ/,
  );
  assert.equal(allocations, 1, 'declared/header mismatch refuses before image allocation');
  image.decode = async () => {
    throw new Error('Native decoder refused');
  };
  await assert.rejects(loadProductionImage(entry, options), /Native decoder refused/);
  assert.equal(allocations, 2);
  assert.equal(revocations, 2);
});
test('bounded reader rejects redirect/oversized stream and cancellation before decode disposes its URL', async () => {
  let cancelled = 0;
  const response = new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(5));
      },
      cancel() {
        cancelled++;
      },
    }),
  );
  await assert.rejects(
    readSourceBytes(rootURL, 4, { fetchSource: async () => response }),
    /exceeds/,
  );
  assert.equal(cancelled, 1);
  await assert.rejects(
    readSourceBytes(rootURL, 4, { fetchSource: async () => ({ ok: true, redirected: true }) }),
    /unavailable/,
  );
  const entry = seed.works[0].files[0],
    bytes = await readFile(new URL('../' + entry.file.path, import.meta.url)),
    controller = new AbortController(),
    decoding = deferred();
  let released = 0,
    allocated = 0;
  const promise = loadProductionImage(entry, {
    rootURL,
    signal: controller.signal,
    cryptoSource: webcrypto,
    fetchSource: async () => new Response(bytes),
    urlAPI: {
      createObjectURL: () => {
        allocated++;
        return 'blob:owned';
      },
      revokeObjectURL: () => released++,
    },
    makeImage: () => ({ removeAttribute() {}, decode: () => decoding.promise }),
  });
  while (!allocated) await settle();
  controller.abort();
  await assert.rejects(promise, /cancelled/);
  assert.equal(released, 1);
  decoding.resolve();
  await settle();
  assert.equal(released, 1);
});
test('shared project workflow reaches all thirteen skills without duplicating or executing intake templates', async () => {
  const { readdir } = await import('node:fs/promises');
  const names = await readdir(new URL('../authoring/skills/', import.meta.url));
  let count = 0;
  for (const name of names) {
    if (!name.startsWith('xonix-')) continue;
    const skill = await readFile(
      new URL(`../authoring/skills/${name}/SKILL.md`, import.meta.url),
      'utf8',
    );
    assert(skill.includes('../../../docs/feature-delivery-workflow.md'));
    count++;
  }
  assert.equal(count, 13);
  const workflow = await readFile(
    new URL('../docs/feature-delivery-workflow.md', import.meta.url),
    'utf8',
  );
  assert(workflow.includes('authoring/production/cli.mjs'));
  assert(workflow.includes('production-intake.md'));
});
test('inspected reserves use their terminal checklist and reused production pictures stay excluded from spare totals', async (t) => {
  const input = structuredClone(seed),
    work = input.works[0];
  input.bindings.push({
    slotId: 'reserve.1',
    revision: 1,
    workId: work.id,
    workRevision: work.revision,
    previous: null,
    handle: { kind: 'reserve' },
  });
  input.assessments = ['provenance', 'decode', 'visual-review', 'curation'].map((check) => ({
    id: `reserve-${check}`,
    slotId: 'reserve.1',
    bindingRevision: 1,
    workId: work.id,
    workRevision: work.revision,
    check,
    outcome: 'pass',
    reviewer: 'Synthetic UI reviewer',
    date: '2026-09-13',
    evidence: [input.deliveries[0].evidence],
    resolves: null,
  }));
  const h = await host(t, { loadRegister: async () => input });
  const reserveCard = h.root
    .querySelectorAll('article')
    .find((n) => text(n).includes('Reserves bound'));
  assert.match(text(reserveCard), /39 unbound · 1 inspected/);
  assert.match(text(h.root), /0 unique reserves · 1 selected-picture reuse excluded/);
  assert.match(text(h.root), /1 unique story/);
});
