import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachProfileRecoveryView } from '../ui/profile-recovery.mjs';

class Element {
  constructor(doc) {
    this.doc = doc;
    this.children = [];
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
  }
  append(child) {
    this.children.push(child);
  }
  replaceChildren() {
    this.children = [];
  }
  removeAttribute(name) {
    delete this[name];
  }
  focus() {
    this.doc.activeElement = this;
  }
}
function fixture(reader) {
  const doc = {
      activeElement: null,
      createElement() {
        return new Element(doc);
      },
    },
    elements = new Map();
  doc.getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(doc));
    return elements.get(id);
  };
  const urls = [],
    revoked = [];
  const view = attachProfileRecoveryView({
    document: doc,
    reader,
    createURL: (blob) => {
      urls.push(blob);
      return `blob:${urls.length}`;
    },
    revokeURL: (url) => revoked.push(url),
  });
  return { doc, view, urls, revoked, $: (id) => doc.getElementById(`profile-recovery-${id}`) };
}
const channel = { id: 'release-v0.39.0', version: 'v0.39.0', support: 'historical' };
const review = {
  channel,
  profile: { status: 'valid-structure', completedLevels: 2, pictures: 2, scores: 3 },
  saved: { status: 'stored-unverified' },
  diagnostics: [],
  recoveryPending: false,
};
test('view keeps media/flight limits visible and prepares a native explicit download link with a revocable URL', async () => {
  let closed = 0;
  const f = fixture({
    discover: async () => ({ channels: [channel], diagnostics: [] }),
    review: async () => review,
    exportStoredData: async () => ({
      blob: new Blob(['raw']),
      filename: 'stored.json',
      completeStoredSnapshot: true,
    }),
    close: async () => closed++,
  });
  await f.$('find').onclick();
  assert.equal(f.$('review').disabled, false);
  await f.$('review').onclick();
  assert.match(
    f.$('summary').textContent,
    /Media and original availability have not been inspected/,
  );
  assert.match(f.$('summary').textContent, /Flight inspection is unavailable/);
  await f.$('export').onclick();
  assert.equal(f.$('download').href, 'blob:1');
  assert.equal(f.doc.activeElement, f.$('download'));
  await f.view.close();
  assert.equal(closed, 1);
  assert.deepEqual(f.revoked, ['blob:1']);
  assert.equal(f.$('download').hidden, true);
});
test('late cancelled review and export cannot publish a result or download after Close', async () => {
  let resolveReview, resolveExport;
  const f = fixture({
    discover: async () => ({ channels: [channel], diagnostics: [] }),
    review: () =>
      new Promise((resolve) => {
        resolveReview = resolve;
      }),
    exportStoredData: () =>
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    close: async () => {},
  });
  await f.$('find').onclick();
  const pending = f.$('review').onclick();
  f.$('cancel').onclick();
  resolveReview(review);
  await pending;
  assert.equal(f.$('export').disabled, true);
  const accepted = f.$('review').onclick();
  resolveReview(review);
  await accepted;
  const exporting = f.$('export').onclick();
  await f.view.close();
  resolveExport({ blob: new Blob(['late']), filename: 'late.json', completeStoredSnapshot: true });
  await exporting;
  assert.deepEqual(f.urls, []);
  assert.equal(f.$('download').hidden, true);
});

test('cancelled discovery returns focus to enabled Find when no profile choice exists', async () => {
  let resolveDiscovery;
  const f = fixture({
    discover: () =>
      new Promise((resolve) => {
        resolveDiscovery = resolve;
      }),
    close: async () => {},
  });
  const finding = f.$('find').onclick();
  f.$('cancel').focus();
  f.$('cancel').onclick();
  resolveDiscovery({ channels: [], diagnostics: [] });
  await finding;
  assert.equal(f.$('review').disabled, true);
  assert.equal(f.$('find').disabled, false);
  assert.equal(f.doc.activeElement === f.$('find'), true);
  await f.view.close();
});

async function bootstrap(t, fetchResponse) {
  const doc = new EventTarget(),
    elements = new Map();
  doc.createElement = () => new Element(doc);
  doc.getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(doc));
    return elements.get(id);
  };
  const $ = (id) => doc.getElementById(`profile-recovery-${id}`);
  $('find').disabled = true;
  $('status').textContent = 'Loading release information…';
  const events = new EventTarget(),
    timers = new Map(),
    frames = new Map(),
    urls = [];
  let next = 0,
    storageCalls = 0;
  const values = {
    document: doc,
    window: events,
    location: { origin: 'https://example.test', assign: (url) => urls.push(url) },
    navigator: {
      locks: {
        request() {
          storageCalls++;
          throw new Error('No bootstrap locks.');
        },
      },
    },
    indexedDB: {
      open() {
        storageCalls++;
        throw new Error('No bootstrap assets.');
      },
    },
    localStorage: {
      get length() {
        storageCalls++;
        throw new Error('No bootstrap profiles.');
      },
    },
    fetch: fetchResponse,
    requestAnimationFrame(fn) {
      const id = ++next;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  const originalSet = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout;
  values.setTimeout = (fn, ms, ...args) => {
    if (ms !== 10000) return originalSet(fn, ms, ...args);
    const id = { deadline: true };
    timers.set(id, fn);
    return id;
  };
  values.clearTimeout = (id) => (timers.has(id) ? timers.delete(id) : originalClear(id));
  const descriptors = new Map(
    Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  t.after(async () => {
    events.dispatchEvent(new Event('pagehide'));
    await new Promise((resolve) => setImmediate(resolve));
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await import(new URL(`../profile-recovery.mjs?fixture=${t.name}`, import.meta.url));
  await new Promise((resolve) => setImmediate(resolve));
  return { $, events, timers, frames, urls, storageCalls: () => storageCalls };
}

test('bootstrap timeout remains visible and a late successful response cannot enable discovery', async (t) => {
  let resolve;
  const f = await bootstrap(
    t,
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  assert.equal(f.timers.size, 1);
  [...f.timers.values()][0]();
  assert.match(f.$('status').textContent, /timed out/);
  resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
  await new Promise((done) => setImmediate(done));
  assert.equal(f.$('find').disabled, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.storageCalls(), 0);
  f.$('back').onclick();
  assert.deepEqual(f.urls, ['./index.html']);
});

test('pagehide before late version response cannot bootstrap or inspect storage', async (t) => {
  let resolve;
  const f = await bootstrap(
    t,
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  f.events.dispatchEvent(new Event('pagehide'));
  resolve(new Response(JSON.stringify({ version: 'v0.40.0' })));
  await new Promise((done) => setImmediate(done));
  assert.equal(f.$('find').disabled, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.storageCalls(), 0);
});

test('successful built-version bootstrap only enables explicit discovery and closure stops its UI router', async (t) => {
  const f = await bootstrap(t, async (url) => {
    if (String(url).endsWith('/game/content/recovery-catalogs.json'))
      return new Response(
        await readFile(new URL('../content/recovery-catalogs.json', import.meta.url)),
      );
    assert.equal(String(url).endsWith('/game/build-info.json'), true);
    return new Response(JSON.stringify({ version: 'v0.40.0' }));
  });
  for (let i = 0; i < 100 && f.$('find').disabled; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(f.$('find').disabled, false);
  assert.match(
    f.$('catalog-status').textContent,
    /release-v0.39.0, release-0.39.0, release-v0.40.0, release-0.40.0/,
  );
  assert.doesNotMatch(f.$('catalog-status').textContent, /release-v0.41.0/);
  assert.equal(f.frames.size, 1);
  assert.equal(f.storageCalls(), 0);
  f.events.dispatchEvent(new Event('pagehide'));
  await new Promise((done) => setImmediate(done));
  assert.equal(f.frames.size, 0);
  assert.equal(f.$('find').disabled, true);
  assert.equal(f.storageCalls(), 0);
});

test('unavailable packaged registry keeps raw discovery usable and original authority unavailable', async (t) => {
  const f = await bootstrap(
    t,
    async (url) =>
      new Response(
        String(url).endsWith('build-info.json')
          ? JSON.stringify({ version: 'v0.40.0' })
          : 'unavailable',
        { status: String(url).endsWith('build-info.json') ? 200 : 404 },
      ),
  );
  assert.equal(f.$('find').disabled, false);
  assert.equal(f.$('originals-review').disabled, true);
  assert.match(f.$('catalog-status').textContent, /Raw profile diagnostics remain available/);
  assert.equal(f.storageCalls(), 0);
});

test('catalog timeout preserves raw discovery without late registry adoption', async (t) => {
  let finish;
  const f = await bootstrap(t, async (url) =>
    String(url).endsWith('build-info.json')
      ? new Response(JSON.stringify({ version: 'v0.40.0' }))
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  assert.equal(f.timers.size, 1);
  [...f.timers.values()][0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('find').disabled, false);
  assert.match(f.$('catalog-status').textContent, /timed out/);
  finish(
    new Response(await readFile(new URL('../content/recovery-catalogs.json', import.meta.url))),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(f.$('catalog-status').textContent, /timed out/);
  assert.equal(f.storageCalls(), 0);
});

test('pagehide during catalog fetch cannot attach a late view or poll controls', async (t) => {
  let finish;
  const f = await bootstrap(t, async (url) =>
    String(url).endsWith('build-info.json')
      ? new Response(JSON.stringify({ version: 'v0.40.0' }))
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  f.events.dispatchEvent(new Event('pagehide'));
  finish(
    new Response(await readFile(new URL('../content/recovery-catalogs.json', import.meta.url))),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('find').disabled, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.storageCalls(), 0);
});
