import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openWorldStore } from '../../optional-practice/civilian-fpv/world-store.mjs';
import { openRegionalLibrary } from '../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { worldImportErrorCopy } from '../../optional-practice/civilian-fpv/world-library.mjs';
import {
  mountRegionalLibrary,
  REGIONAL_LIBRARY_PINS,
} from '../../optional-practice/civilian-fpv/regional-library.mjs';
import { Document } from './helpers/couch-dom.mjs';

const { IDBFactory } = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
)('fake-indexeddb');
const MiB = 1024 * 1024;
const hash = (letter) => letter.repeat(64);
const project = (id = 'incoming') => ({ id, title: 'Capacity review' });
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
const full = (error) => error.code === 'world-library-full';
const request = (opening) =>
  new Promise((resolve, reject) => {
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
  });
async function seed(indexedDB, name, { retained = [], active = [], generation = 7 } = {}) {
  const db = await request(indexedDB.open(name));
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['revisions', 'projects', 'assets', 'meta'], 'readwrite');
    for (const row of retained) tx.objectStore('revisions').put(row);
    for (const row of active) {
      const { assets, ...record } = row;
      tx.objectStore('projects').put(record);
      for (const [path, blob] of assets)
        tx.objectStore('assets').put({ projectId: row.id, path, blob });
    }
    tx.objectStore('meta').put(generation, 'generation');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
function revision({ id = 'kept', sha256 = hash('a'), size = 1, content = 'keep' } = {}) {
  return {
    id,
    project: project(id),
    sha256,
    generation: 7,
    installedAt: '2026-10-15T12:00:00.000Z',
    assets: new Map([['proof.bin', new Blob([content])]]),
    bytes: size,
  };
}

// Large byte totals are isolated persisted-accounting fixtures, not giant Blob
// allocations or native browser quota/persistence acceptance.
test('Worldpacks keep 256 MiB while only the explicit regional store admits 512 MiB', async () => {
  const indexedDB = new IDBFactory(),
    worlds = await openWorldStore({ indexedDB, name: 'worlds-default' }),
    regions = await openRegionalLibrary({ indexedDB, name: 'regions-explicit' }),
    regionalStore = await openWorldStore({
      indexedDB,
      name: 'regions-explicit',
      maxRetainedBytes: 512 * MiB,
    }),
    kept = revision({ size: 300 * MiB });
  try {
    await seed(indexedDB, 'worlds-default', { retained: [kept], active: [kept] });
    await seed(indexedDB, 'regions-explicit', { retained: [kept], active: [kept] });
    const next = { project: project(), sha256: hash('b'), assetBytes: 1 };
    await assert.rejects(
      worlds.install({
        ...next,
        assets: new Map([['new.bin', new Blob(['x'])]]),
        expectedGeneration: 7,
      }),
      full,
    );
    await assert.rejects(worlds.checkInstallCapacity(next), full);
    assert.equal((await regionalStore.checkInstallCapacity(next)).limitBytes, 512 * MiB);
    await regionalStore.install({
      project: project(),
      sha256: hash('b'),
      assets: new Map([['new.bin', new Blob(['x'])]]),
      expectedGeneration: 7,
    });
    assert.equal((await regionalStore.list({ includeRevisions: true })).length, 2);
    assert.equal(await worlds.generation(), 7);
    assert.equal(await (await worlds.get('kept')).assets.get('proof.bin').text(), 'keep');
  } finally {
    worlds.close();
    regions.close();
    regionalStore.close();
  }
});

test('capacity preflight replaces an exact retained revision without double counting its old bytes', async () => {
  const indexedDB = new IDBFactory(),
    name = 'exact-accounting',
    store = await openWorldStore({ indexedDB, name }),
    kept = revision({ size: 256 * MiB - 10 }),
    old = revision({ id: 'incoming', sha256: hash('b'), size: 900, content: 'old' });
  try {
    await seed(indexedDB, name, { retained: [kept, old], active: [kept, old] });
    const incoming = { project: project(), sha256: hash('b'), assetBytes: 1 };
    await assert.rejects(store.checkInstallCapacity(incoming), full);
    kept.bytes -= bytes(project()) + 10;
    await seed(indexedDB, name, { retained: [kept] });
    const before = await store.get('incoming');
    const check = await store.checkInstallCapacity(incoming);
    assert.equal(check.retainedBytes, kept.bytes + bytes(project()) + 1);
    await store.install({
      ...incoming,
      assets: new Map([['proof.bin', new Blob(['x'])]]),
      expectedGeneration: 7,
    });
    assert.equal((await store.get('incoming')).sha256, before.sha256);
    const next = { project: project(), sha256: hash('c'), assetBytes: 1 };
    await assert.rejects(store.checkInstallCapacity(next), full);
    assert.equal(await (await store.get('kept')).assets.get('proof.bin').text(), 'keep');
  } finally {
    store.close();
  }
});

test('legacy active content is retained for a new hash but is not counted twice when replaced by its exact hash', async () => {
  const indexedDB = new IDBFactory(),
    name = 'legacy-accounting',
    store = await openWorldStore({ indexedDB, name }),
    kept = revision({ size: 256 * MiB - bytes(project()) - 1 }),
    old = revision({ id: 'incoming', sha256: hash('b'), content: 'old' });
  try {
    await seed(indexedDB, name, { retained: [kept], active: [kept, old] });
    const incoming = { project: project(), sha256: hash('b'), assetBytes: 1 };
    await assert.rejects(store.checkInstallCapacity({ ...incoming, sha256: hash('c') }), full);
    await assert.rejects(
      store.install({
        ...incoming,
        sha256: hash('c'),
        assets: new Map([['proof.bin', new Blob(['x'])]]),
        expectedGeneration: 7,
      }),
      full,
    );
    assert.equal(await store.generation(), 7);
    assert.equal(await (await store.get('incoming')).assets.get('proof.bin').text(), 'old');
    const exact = await store.checkInstallCapacity(incoming);
    assert.equal(exact.retainedBytes, 256 * MiB);
    await store.install({
      ...incoming,
      assets: new Map([['proof.bin', new Blob(['x'])]]),
      expectedGeneration: 7,
    });
    assert.equal(await store.generation(), 8);
    assert.equal(await (await store.get('incoming')).assets.get('proof.bin').text(), 'x');
    assert.equal(await (await store.get('kept')).assets.get('proof.bin').text(), 'keep');
  } finally {
    store.close();
  }
});

test('regional full preflight downloads only the verified descriptor and preserves all saved bytes', async () => {
  const indexedDB = new IDBFactory(),
    name = 'regions-preflight',
    library = await openRegionalLibrary({ indexedDB, name }),
    raw = await readFile(
      new URL(
        '../../authoring/fpv-worlds/regions/urban-bando/delivery-review-r1/delivery.json',
        import.meta.url,
      ),
    ),
    pin = {
      url: 'https://delivery.invalid/urban/delivery.json',
      bytes: raw.length,
      sha256: createHash('sha256').update(raw).digest('hex'),
    },
    kept = revision({ size: 512 * MiB - 1 }),
    calls = [];
  try {
    await seed(indexedDB, name, { retained: [kept], active: [kept] });
    await assert.rejects(
      library.install(pin, {
        pageURL: 'https://player.invalid/sim',
        fetchImpl: async (url) => {
          calls.push(url);
          assert.equal(url, pin.url, 'No terrain, scenery, or asset payload on known-full store');
          return new Response(raw);
        },
      }),
      full,
    );
    assert.deepEqual(calls, [pin.url]);
    const verify = await openWorldStore({ indexedDB, name, maxRetainedBytes: 512 * MiB });
    await assert.rejects(
      verify.install({
        project: project(),
        sha256: hash('b'),
        assets: new Map([['new.bin', new Blob(['x'])]]),
        expectedGeneration: 7,
      }),
      full,
      'The authoritative write transaction also enforces the regional 512 MiB ceiling',
    );
    assert.equal(await verify.generation(), 7);
    assert.equal((await verify.list({ includeRevisions: true })).length, 1);
    assert.equal(await (await verify.get('kept')).assets.get('proof.bin').text(), 'keep');
    verify.close();
    kept.bytes = 300 * MiB;
    await seed(indexedDB, name, { retained: [kept] });
    const payload = Object.assign(new Error('Stop before payload allocation'), {
      code: 'payload-reached',
    });
    let fetched = 0;
    await assert.rejects(
      library.install(pin, {
        pageURL: 'https://player.invalid/sim',
        fetchImpl: async () => {
          if (++fetched === 1) return new Response(raw);
          throw payload;
        },
      }),
      (error) => error === payload,
      'The regional API itself uses the approved 512 MiB limit, not the Worldpack default',
    );
    assert.ok(fetched > 1);
  } finally {
    library.close();
  }
});

test('a peer install after preflight cannot bypass the atomic limit or erase either saved revision', async () => {
  const indexedDB = new IDBFactory(),
    name = 'racing-capacity',
    a = await openWorldStore({ indexedDB, name }),
    b = await openWorldStore({ indexedDB, name }),
    kept = revision({ size: 256 * MiB - bytes(project()) - 2 });
  try {
    await seed(indexedDB, name, { retained: [kept], active: [kept] });
    await a.checkInstallCapacity({ project: project(), sha256: hash('b'), assetBytes: 1 });
    const peer = { id: 'p' };
    await b.install({
      project: peer,
      sha256: hash('c'),
      assets: new Map([['peer.bin', new Blob(['p'])]]),
      expectedGeneration: 7,
    });
    await assert.rejects(
      a.install({
        project: project(),
        sha256: hash('b'),
        assets: new Map([['next.bin', new Blob(['x'])]]),
        expectedGeneration: 8,
      }),
      full,
    );
    assert.equal(await a.generation(), 8);
    assert.equal(await a.get('incoming'), null);
    assert.equal(await (await a.get('p')).assets.get('peer.bin').text(), 'p');
    assert.equal(await (await a.get('kept')).assets.get('proof.bin').text(), 'keep');
  } finally {
    a.close();
    b.close();
  }
});

test('capacity copy distinguishes the retained limit from browser quota and network failures in EN/UK', () => {
  const copy = worldImportErrorCopy(
    Object.assign(new Error('full'), { code: 'world-library-full' }),
  );
  assert.equal(copy.length, 2);
  assert.match(copy[0], /full/i);
  assert.match(copy[0], /export|back up/i);
  assert.match(copy[1], /заповнен|місц/i);
  assert.equal(worldImportErrorCopy(new DOMException('device quota', 'QuotaExceededError')), null);
  assert.equal(worldImportErrorCopy(new TypeError('network failed')), null);
});

test('both byte limits retain the 256-revision ceiling and exact repair remains possible at that ceiling', async () => {
  for (const maxRetainedBytes of [256 * MiB, 512 * MiB]) {
    const indexedDB = new IDBFactory(),
      name = 'revision-ceiling',
      store = await openWorldStore({ indexedDB, name, maxRetainedBytes }),
      retained = Array.from({ length: 256 }, (_, i) => revision({ id: `kept-${i}` }));
    try {
      await seed(indexedDB, name, { retained, active: retained });
      await assert.rejects(
        store.checkInstallCapacity({ project: project(), sha256: hash('b'), assetBytes: 1 }),
        full,
      );
      await assert.rejects(
        store.install({
          project: project(),
          sha256: hash('b'),
          assets: new Map(),
          expectedGeneration: 7,
        }),
        full,
      );
      const kept = retained[0];
      assert.equal(
        (await store.checkInstallCapacity({ ...kept, assetBytes: 1 })).revisionCount,
        256,
      );
      await store.install({ ...kept, repair: true, expectedGeneration: 7 });
      assert.equal((await store.list({ includeRevisions: true })).length, 256);
      assert.equal(await (await store.get('kept-255')).assets.get('proof.bin').text(), 'keep');
    } finally {
      store.close();
    }
  }
});

test('regional capacity refusal keeps focused retry and saved Fly controls usable in EN/UK without removing anything', async () => {
  const doc = new Document(),
    parent = doc.createElement('div'),
    offered = REGIONAL_LIBRARY_PINS[0],
    saved = {
      id: 'retained-place',
      sha256: hash('f'),
      descriptor: {
        id: 'retained-place',
        revision: 'kept-r1',
        title: { en: 'My saved scenery', uk: 'Моя збережена місцевість' },
      },
      bytes: 1024,
    };
  doc.body.append(parent);
  let locale = 'en',
    attempts = 0;
  const store = {
    list: async () => [structuredClone(saved)],
    inspect: async () => ({ descriptor: { id: offered.id } }),
    install: async () => {
      attempts++;
      throw Object.assign(new Error('capacity'), { code: 'world-library-full' });
    },
    close() {},
  };
  const ui = mountRegionalLibrary({
    parent,
    pins: [offered],
    openLibrary: async () => store,
    txt: (en, uk) => (locale === 'uk' ? uk : en),
    window: { location: { href: 'https://player.invalid/sim' }, setTimeout, clearTimeout },
    fly: () => assert.fail('A failed download must never start flight'),
    el(tag, text, className) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    },
  });
  const settle = async () => {
    for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  try {
    ui.open();
    await settle();
    for (const lang of ['en', 'uk']) {
      locale = lang;
      ui.refresh();
      const button = doc.querySelector('[data-region-action="install"]');
      button.focus();
      button.click();
      await settle();
      const status = doc.querySelector('[role="status"]').textContent;
      assert.match(status, lang === 'en' ? /library is full/ : /бібліотеку.*заповнено/i);
      assert.match(status, lang === 'en' ? /saved places are kept/ : /збережені місця залишаться/i);
      assert.match(status, lang === 'en' ? /Remove this version/ : /Вилучити цю версію/);
      assert.equal(doc.activeElement.dataset.regionAction, 'install');
      assert.equal(doc.activeElement.disabled, false);
      assert.equal(doc.querySelector('[data-region-action="fly"]').disabled, false);
      assert.equal(doc.querySelector('[data-region-action="confirm-remove"]'), null);
    }
    assert.equal(attempts, 2);
    assert.equal((await store.list())[0].sha256, saved.sha256);
  } finally {
    ui.dispose();
  }
});

test('an out-of-policy byte-limit option is refused before opening or creating a database', async () => {
  for (const value of [0, -1, 512 * MiB + 1, Infinity, '512'])
    await assert.rejects(
      openWorldStore({
        indexedDB: { open: () => assert.fail('No database should open for invalid policy') },
        maxRetainedBytes: value,
      }),
      /Invalid retained world byte limit/,
    );
});
