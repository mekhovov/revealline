import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'parse5';
import {
  createObservationCheckpointStore,
  mountObserver,
  OBSERVATION_DATABASE,
  OBSERVATION_LIMITS,
} from './browser/demo-watch.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const HTML = await readFile(new URL('./browser/demo-watch.html', import.meta.url), 'utf8');
const MODULE_URL = 'https://observer.test/game/test/browser/demo-watch.mjs';
const HASH = 'a'.repeat(64);
const inventory = (hash = HASH) => ({
  files: [{ path: 'game/app.mjs', bytes: 123, sha256: hash }],
  totalBytes: 123,
  scope: 'Test fixture inventory; no production coverage claim.',
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.ok(predicate(), 'Mounted observer did not reach the expected state.');
}
function clock() {
  let now = 0,
    id = 0;
  const timers = new Map();
  return {
    timers,
    performance: { now: () => now },
    Date: { now: () => Date.UTC(2026, 8, 29) + now },
    setTimeout(fn, ms) {
      const key = ++id;
      timers.set(key, { fn, at: now + ms });
      return key;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers]
          .filter(([, item]) => item.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await tick();
      }
      now = end;
      await tick();
    },
  };
}
function database() {
  const model = managedIndexedDB(),
    opens = [];
  return {
    model,
    opens,
    indexedDB: {
      open(name, version) {
        opens.push({ name, version });
        assert.equal(name, OBSERVATION_DATABASE, 'Only the dedicated observer database may open.');
        return model.indexedDB.open(name, version);
      },
    },
  };
}
function fixture({
  db = database(),
  readInventory = async () => inventory(),
  checkpointStore,
} = {}) {
  const doc = new Document(),
    child = new Document(),
    window = new Events(),
    time = clock();
  const nodes = new Map(),
    downloads = [],
    observers = [];
  function mount(node) {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (attrs.id) {
      const el = doc.createElement(node.tagName);
      el.setAttribute('id', attrs.id);
      el.disabled = 'disabled' in attrs;
      el.value =
        attrs.id === 'observation-duration'
          ? '30'
          : attrs.id === 'observation-recovered-kind'
            ? 'checkpoint'
            : '';
      doc.body.append(el);
      nodes.set(attrs.id, el);
    }
    for (const next of node.childNodes ?? []) mount(next);
  }
  mount(parse(HTML));
  const $ = (id) => nodes.get(id);
  let gameActions = 0;
  for (const id of [
    'demo-dialog',
    'demo-watch-pause',
    'demo-level',
    'demo-source',
    'demo-actions',
    'demo-canvas',
  ]) {
    const el = child.createElement(id === 'demo-dialog' ? 'dialog' : 'button');
    el.setAttribute('id', id);
    el.click = () => {
      gameActions++;
    };
    child.body.append(el);
  }
  child.getElementById('demo-dialog').open = true;
  child.getElementById('demo-level').textContent = 'First Signal';
  child.getElementById('demo-source').textContent = 'Reviewed replay';
  child.documentElement.dataset.bootState = 'ready';
  child.visibilityState = doc.visibilityState = 'visible';
  child.defaultView.Node = Events;
  child.defaultView.location = { origin: 'https://observer.test' };
  child.defaultView.navigator = {};
  const secretKey = 'private-profile-key',
    secretValue = 'private-profile-value';
  child.defaultView.localStorage = {
    length: 1,
    key: () => secretKey,
    getItem: () => secretValue,
    setItem() {
      assert.fail('Observer must not write game storage.');
    },
    removeItem() {
      assert.fail('Observer must not remove game storage.');
    },
  };
  const frame = $('observed-game');
  frame.contentWindow = child.defaultView;
  frame.contentDocument = child;
  frame.getBoundingClientRect = () => ({ top: 0, bottom: 500, left: 0, right: 800 });
  window.innerHeight = 1000;
  window.innerWidth = 1000;
  class Observer {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      observers.push(this);
    }
    observe(node) {
      this.targets.push(node);
    }
    disconnect() {
      this.targets = [];
    }
  }
  child.defaultView.MutationObserver = Observer;
  const environment = {
    document: doc,
    location: { origin: 'https://observer.test' },
    window,
    navigator: { userAgent: 'Node modeled browser boundary', language: 'en' },
    ...time,
    indexedDB: db.indexedDB,
    MutationObserver: Observer,
    URL: {
      createObjectURL(blob) {
        downloads.push(blob);
        return 'blob:observer-export';
      },
      revokeObjectURL() {},
    },
  };
  const owner = mountObserver({
    environment,
    moduleURL: MODULE_URL,
    readInventory,
    checkpointStore,
  });
  return {
    $,
    doc,
    child,
    window,
    owner,
    db,
    time,
    downloads,
    observers,
    gameActions: () => gameActions,
    async start() {
      await owner.ready;
      $('observation-start').click();
      await until(
        () =>
          $('observation-report').value !== '' ||
          $('observer-status').textContent.startsWith('Observation did not start'),
      );
    },
    current: () => JSON.parse($('observation-report').value),
    recovered: () => JSON.parse($('observation-recovered-report').value),
  };
}

test('mounted observer exports bounded incomplete checkpoints with hashes and recovers without starting or steering', async () => {
  const first = fixture();
  await first.start();
  await first.time.advance(15000);
  await first.owner.flush();
  const checkpoint = first.current();
  assert.equal(checkpoint.status, 'incomplete');
  assert.equal(checkpoint.observationComplete, false);
  assert.equal(checkpoint.observationValidForPinnedSources, false);
  assert.equal(checkpoint.sourceInventoryStable, null);
  assert.deepEqual(checkpoint.terminalChecks, { sourceInventory: 'pending', storage: 'pending' });
  assert.equal(checkpoint.timing.elapsedSeconds, 15);
  assert.equal(checkpoint.samples.length, 4);
  assert.equal(checkpoint.initialInventory.files[0].sha256, HASH);
  assert.match(checkpoint.initialStorage.entries[0].keyHash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(checkpoint), /private-profile-(?:key|value)/);
  assert.equal(
    first.db.model.allPuts.length,
    2,
    '15-second writes coalesce five-second DOM exports.',
  );
  first.$('observation-download').click();
  assert.equal(JSON.parse(await first.downloads[0].text()).status, 'incomplete');
  await first.owner.dispose();
  assert.ok(first.observers.every((observer) => observer.targets.length === 0));
  assert.equal(first.window.listeners.get('pagehide').size, 0);
  assert.equal(first.child.defaultView.listeners.get('error').size, 0);
  const second = fixture({ db: first.db });
  await second.owner.ready;
  assert.equal(second.recovered().status, 'incomplete');
  assert.equal(second.recovered().timing.elapsedSeconds, 15);
  assert.match(second.$('observation-recovered-status').textContent, /Previous run.*INCOMPLETE/);
  assert.equal(second.$('observation-report').value, '');
  assert.equal(second.$('observation-stop').disabled, true);
  assert.equal(second.time.timers.size, 0, 'Recovery does not schedule an observation.');
  second.$('observation-recovered-download').click();
  assert.equal(JSON.parse(await second.downloads[0].text()).observationComplete, false);
  assert.equal(first.gameActions() + second.gameActions(), 0);
  await second.owner.dispose();
});

test('finalization detects changed sources and stores the finalized report separately from its preliminary checkpoint', async () => {
  let reads = 0;
  const page = fixture({ readInventory: async () => inventory(reads++ ? 'b'.repeat(64) : HASH) });
  await page.start();
  await page.time.advance(30000);
  await until(() => page.$('observation-clear-saved').disabled === false);
  await page.owner.flush();
  const report = page.current();
  assert.equal(report.status, 'finalized');
  assert.equal(report.requestedDurationReached, true);
  assert.equal(report.sourceInventoryStable, false);
  assert.equal(report.observationComplete, false);
  assert.equal(report.observationValidForPinnedSources, false);
  assert.deepEqual(report.sourceChanges.changed, ['game/app.mjs']);
  assert.equal(report.terminalChecks.sourceInventory, 'changed');
  assert.equal(report.terminalChecks.storage, 'complete');
  assert.deepEqual([...page.db.model.contents().get('reports').keys()].sort(), [
    'checkpoint',
    'final',
  ]);
  await page.owner.dispose();
  const reloaded = fixture({ db: page.db });
  await reloaded.owner.ready;
  assert.equal(reloaded.recovered().status, 'incomplete');
  reloaded.$('observation-recovered-kind').value = 'final';
  reloaded.$('observation-recovered-kind').emit('change');
  assert.equal(reloaded.recovered().status, 'finalized');
  assert.equal(reloaded.recovered().sourceInventoryStable, false);
  reloaded.$('observation-clear-saved').click();
  await until(() => !reloaded.$('observation-clear-saved').disabled);
  assert.equal(page.db.model.contents().get('reports').size, 0);
  assert.equal(reloaded.$('observation-recovered-report').value, '');
  assert.equal(reloaded.gameActions(), 0);
  await reloaded.owner.dispose();
});

test('cancelling source preparation aborts ownership without creating or replacing saved evidence', async () => {
  let signal;
  const page = fixture({
    readInventory: async (_root, _paths, nextSignal) => {
      signal = nextSignal;
      return new Promise((_resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        ),
      );
    },
  });
  await page.owner.ready;
  page.$('observation-start').click();
  assert.equal(page.$('observation-stop').disabled, false);
  page.$('observation-stop').click();
  await until(() => !page.$('observation-start').disabled);
  assert.equal(signal.aborted, true);
  assert.equal(page.db.model.allPuts.length, 0);
  assert.equal(page.$('observation-report').value, '');
  assert.equal(page.time.timers.size, 0);
  await page.owner.dispose();
  assert.equal(page.gameActions(), 0);
});

test('quota failure is bounded and leaves current DOM/download observation available', async () => {
  const db = database();
  db.model.failAnyPutAt = 1;
  const page = fixture({ db });
  await page.start();
  await page.owner.flush();
  await page.time.advance(20000);
  const report = page.current();
  assert.equal(report.timing.elapsedSeconds, 20);
  assert.equal(
    report.diagnostics.filter((d) => d.type === 'checkpoint-storage-unavailable').length,
    1,
  );
  assert.match(
    page.$('observation-checkpoint-status').textContent,
    /Automatic recovery unavailable/,
  );
  assert.equal(db.model.allPuts.length, 1, 'No unbounded failing write retries.');
  page.$('observation-download').click();
  assert.equal(JSON.parse(await page.downloads[0].text()).timing.elapsedSeconds, 20);
  assert.equal(db.model.contents().get('reports').size, 0);
  await page.owner.dispose();
});

test('disabled IndexedDB and a failed terminal inventory never prevent export or imply completion', async () => {
  let reads = 0;
  const page = fixture({
    db: { indexedDB: null },
    readInventory: async () => {
      if (reads++) throw new Error('Server unavailable');
      return inventory();
    },
  });
  await page.start();
  await page.time.advance(30000);
  await until(() => page.$('observation-clear-saved').disabled === false);
  const report = page.current();
  assert.equal(report.status, 'finalized');
  assert.equal(report.observationComplete, false);
  assert.equal(report.terminalChecks.sourceInventory, 'failed');
  assert.equal(report.finalInventoryError, 'Server unavailable');
  assert.equal(page.$('observation-download').disabled, false);
  await page.owner.dispose();
});

test('store enforces serialized byte budget before opening and closes late opens after timeout', async () => {
  const db = database(),
    store = createObservationCheckpointStore({ indexedDB: db.indexedDB });
  await assert.rejects(
    store.write('checkpoint', 'x'.repeat(OBSERVATION_LIMITS.checkpointBytes + 1)),
    /byte limit/,
  );
  assert.equal(db.opens.length, 0);
  store.close();
  const time = clock();
  let request,
    closed = 0;
  const stuck = createObservationCheckpointStore({
    ...time,
    indexedDB: {
      open() {
        request = {};
        return request;
      },
    },
  });
  const pending = assert.rejects(stuck.read(), /timed out/);
  await time.advance(OBSERVATION_LIMITS.storageTimeoutMs);
  await pending;
  request.result = {
    close() {
      closed++;
    },
  };
  request.onsuccess();
  assert.equal(closed, 1, 'Late successful opens cannot leak an observer connection.');
  assert.equal(time.timers.size, 0);
  stuck.close();
});

test('disposal during preparation aborts the source request and detaches listeners without a late start', async () => {
  let release;
  const page = fixture({
    readInventory: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  await page.owner.ready;
  page.$('observation-start').click();
  await page.owner.dispose();
  release(inventory());
  await tick();
  assert.equal(page.$('observation-report').value, '');
  assert.equal(page.$('observation-start').disabled, true);
  assert.equal(page.time.timers.size, 0);
  assert.equal(page.db.model.allPuts.length, 0);
  assert.equal(page.gameActions(), 0);
});

test('a slow checkpoint cannot drop the queued final report, and pending clear cannot erase a newly started run', async () => {
  const db = database(),
    real = createObservationCheckpointStore({ indexedDB: db.indexedDB });
  let releaseWrite,
    releaseClear,
    writes = 0,
    reads = 0;
  const writeGate = new Promise((resolve) => {
    releaseWrite = resolve;
  });
  const clearGate = new Promise((resolve) => {
    releaseClear = resolve;
  });
  const page = fixture({
    db,
    readInventory: async () => {
      reads++;
      return inventory();
    },
    checkpointStore: {
      read: () => real.read(),
      async write(...args) {
        if (!writes++) await writeGate;
        return real.write(...args);
      },
      async clear() {
        await clearGate;
        return real.clear();
      },
      close: () => real.close(),
    },
  });
  await page.start();
  await page.time.advance(30000);
  await until(() => page.$('observation-report').value.includes('"status": "finalized"'));
  assert.equal(page.$('observation-start').disabled, true, 'Final persistence retains ownership.');
  page.$('observation-start').click();
  assert.equal(reads, 2, 'A new observation cannot overwrite the queued final.');
  releaseWrite();
  await page.owner.flush();
  await until(() => !page.$('observation-start').disabled);
  const saved = await real.read();
  assert.equal(saved.final.status, 'finalized');
  assert.equal(saved.final.observationComplete, true);
  assert.equal(saved.checkpoint.status, 'incomplete');
  assert.equal(writes, 2, 'Only the first checkpoint and newest queued final are committed.');
  page.$('observation-clear-saved').click();
  assert.equal(page.$('observation-start').disabled, true);
  page.$('observation-start').click();
  assert.equal(reads, 2, 'Clear retains ownership until the old evidence is removed.');
  releaseClear();
  await until(() => !page.$('observation-clear-saved').disabled);
  assert.equal(db.model.contents().get('reports').size, 0);
  await page.owner.dispose();
});
