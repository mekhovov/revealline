import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';
import { dataIdentity } from '../data-json.mjs';
import { emptyJourneyProfile, createJourneyBackend } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { emptyJourneyPerformance } from '../journey/performance.mjs';
import { emptyJourneyPictures } from '../journey/pictures.mjs';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
const root = new URL(`${pathToFileURL(process.cwd()).href}/`);
const url = (path) => new URL(path, root).href;
const encode = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let unique = 0;
const level = {
  version: 'xonix-level.v1',
  id: 'one',
  revision: '1',
  name: 'One',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
  enemies: [{ id: 'keeper', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
};
const options = { classId: 'scout', seed: 1, turnPolicy: 'immediate' };
const run = createRun(level, options),
  recorder = createRecorder(level, options);
for (let i = 0; i < 1500 && run.status === 'running'; i++) {
  const input = { direction: 'down' };
  stepRun(run, input, FIXED_DT);
  recordInput(recorder, input);
}
assert.equal(run.status, 'won');
const original = {
  mode: 'solo',
  missionId: 'candidate/workshop/route/one',
  runId: 'prior-attempt',
  difficulty: 'standard',
  gameplayId: dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
  replay: exportReplay(recorder, run),
};
const delay = () => new Promise((resolve) => setTimeout(resolve, 1));
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate() && Date.now() < deadline) await delay();
  assert(predicate(), 'expected owned state within existing finite wait');
}
function stateFor(runId = original.runId, generation = 0) {
  const record = { ...structuredClone(original), runId },
    profile = emptyJourneyProfile();
  profile.clears.solo[record.missionId] = {
    runId,
    gameplayId: record.gameplayId,
    difficulty: record.difficulty,
  };
  return {
    profile,
    pictures: emptyJourneyPictures(),
    performance: { ...emptyJourneyPerformance(), generation, records: [record] },
  };
}
async function instrumented(t, config = {}) {
  const trackerURL = encode(
    `export const marks=[],copies=[];export let phase='paused';export const id=${++unique};export function setPhase(value){phase=value;}`,
  );
  const tracker = await import(trackerURL),
    media = createMediaPreparation();
  const phase = (value) => {
    tracker.setPhase(value);
    media.setPhase(value);
  };
  const data = url('game/data-json.mjs'),
    performance = url('game/journey/performance.mjs');
  const dataWrapper = encode(
    `export * from ${JSON.stringify(data)};import {canonicalJSON as actual} from ${JSON.stringify(data)};import {marks,phase} from ${JSON.stringify(trackerURL)};export function canonicalJSON(value){marks.push({kind:'identity',phase});return actual(value);}`,
  );
  const performanceWrapper = encode(
    `export * from ${JSON.stringify(performance)};import {inspectJourneyPerformance as actual,snapshotJourneyPerformanceSource as snapshot} from ${JSON.stringify(performance)};import {marks,copies,phase} from ${JSON.stringify(trackerURL)};export function inspectJourneyPerformance(value){marks.push({kind:'inspection',phase});return actual(value);}export function snapshotJourneyPerformanceSource(value){copies.push(phase);return snapshot(value);}`,
  );
  const sourceURL = process.env.OBSERVE_SOURCE
    ? pathToFileURL(process.env.OBSERVE_SOURCE)
    : new URL('../journey/performance-store.mjs', import.meta.url);
  const source = await readFile(sourceURL, 'utf8');
  const storeURL = encode(
    source
      .replace("'./performance.mjs'", JSON.stringify(performanceWrapper))
      .replace("'../data-json.mjs'", JSON.stringify(dataWrapper)),
  );
  const { createJourneyPerformanceController } = await import(storeURL);
  const profileSource = await readFile(
    process.env.OBSERVE_SOURCE
      ? new URL('game/journey/profile.mjs', root)
      : new URL('../journey/profile.mjs', import.meta.url),
    'utf8',
  );
  const profileURL = encode(
    profileSource
      .replace("'./performance-store.mjs'", JSON.stringify(storeURL))
      .replace("'./performance.mjs'", JSON.stringify(performanceWrapper))
      .replace("'../data-json.mjs'", JSON.stringify(dataWrapper))
      .replace(
        /from (['"])(\.\.?\/[^'"]+)\1/g,
        (_, quote, relative) =>
          `from ${JSON.stringify(new URL(relative, new URL('game/journey/profile.mjs', root)).href)}`,
      ),
  );
  const { createJourneyProfileStore } = await import(profileURL);
  let state = stateFor(),
    writes = 0,
    publications = 0;
  const backend = {
    readState: async () => structuredClone(state),
    commitState: async (events) => {
      writes++;
      assert.equal(events.length, 1);
      state = { ...state, performance: events[0].performance };
      const saved = structuredClone(state);
      if (config.commit) await config.commit({ phase, saved });
      return saved;
    },
  };
  const scheduleChunk = (work, request) => media.run('main', work, request);
  const controller = createJourneyPerformanceController({
    backend,
    getProfile: () => state.profile,
    flushProfile: async () => true,
    acceptBinding: config.acceptBinding ?? (() => true),
    canWrite: () => true,
    ...(config.ungated ? {} : { scheduleChunk }),
    onChange: () => {
      publications++;
      config.onChange?.();
    },
  });
  t.after(() => {
    controller.dispose();
    media.close();
  });
  return {
    controller,
    createJourneyProfileStore,
    backend,
    phase,
    media,
    tracker,
    scheduleChunk,
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
    get writes() {
      return writes;
    },
    get publications() {
      return publications;
    },
  };
}

test('actual online-style profile flush completes progress while optional envelope work waits for Pause', async (t) => {
  const f = await instrumented(t);
  const profile = f.createJourneyProfileStore({
    backend: f.backend,
    canWrite: () => true,
    acceptPerformanceBinding: () => true,
    schedulePerformanceChunk: f.scheduleChunk,
  });
  t.after(() => profile.performance.dispose());
  f.phase('playing');
  assert.equal(await profile.flush(), true);
  assert.equal(profile.status().durable, true);
  assert.deepEqual(
    f.tracker.marks,
    [],
    'required flush must not run optional inspection/hash while playing',
  );
  assert.equal(profile.performance.snapshot().records.length, 0);
  await until(() => f.media.snapshot().queued === 1);
  f.phase('paused');
  await until(() => profile.performance.snapshot().records.length === 1);
  assert(f.tracker.marks.some((m) => m.kind === 'inspection'));
  assert(f.tracker.marks.every((m) => m.phase === 'paused'));
  assert.equal(f.writes, 0);
});

test('unchanged observation still validates defensively, but only inside admission', async (t) => {
  const f = await instrumented(t);
  f.controller.observe(f.state);
  await until(
    () => f.controller.snapshot().records.length === 1 && f.media.snapshot().queued === 0,
  );
  const published = f.publications;
  f.tracker.marks.length = 0;
  f.phase('playing');
  f.controller.observe(structuredClone(f.state));
  assert.deepEqual(f.tracker.marks, []);
  f.phase('paused');
  await until(() => f.tracker.marks.some((m) => m.kind === 'inspection'));
  assert.equal(f.publications, published);
  assert(f.tracker.marks.every((m) => m.phase === 'paused'));
});

test('latest pending observation owns one queued envelope and caller mutation cannot replace it', async (t) => {
  const f = await instrumented(t);
  f.phase('playing');
  for (let i = 0; i < 20; i++) {
    const state = stateFor(`attempt-${i}`, i);
    f.controller.observe(state);
    state.performance.records[0].replay.options.seed = -1;
    await delay();
    assert.equal(f.media.snapshot().queued, 1);
  }
  assert.deepEqual(f.tracker.marks, []);
  f.phase('paused');
  await until(() => f.controller.snapshot().records.length === 1);
  assert.equal(f.controller.snapshot().records[0].runId, 'attempt-19');
  assert.equal(f.publications, 1);
  assert.equal(f.controller.backup().records[0].replay.options.seed, 1);
});

test('disposal retires queued observation before validation or publication', async (t) => {
  const f = await instrumented(t);
  f.phase('playing');
  f.controller.observe(f.state);
  await until(() => f.media.snapshot().queued === 1);
  f.controller.dispose();
  f.phase('paused');
  await delay();
  await delay();
  assert.deepEqual(f.tracker.marks, []);
  assert.equal(f.publications, 0);
  assert.equal(f.media.snapshot().queued, 0);
});

test('bounded ownership rejects cyclic, accessor and oversized objects without invoking user code', async (t) => {
  const f = await instrumented(t);
  f.phase('playing');
  let reads = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'records', {
    enumerable: true,
    get() {
      reads++;
      return [];
    },
  });
  const cycle = {};
  cycle.self = cycle;
  const oversized = { value: 'x'.repeat(4097) };
  for (const invalid of [accessor, cycle, oversized]) {
    f.controller.observe(f.state);
    f.controller.observe({ ...f.state, performance: invalid });
    assert(f.controller.snapshot().error);
    await delay();
    assert.equal(f.media.snapshot().queued, 0);
  }
  assert.equal(reads, 0);
  assert.deepEqual(f.tracker.marks, []);
});

test('optional committed result validation and publication wait if storage resolves during play', async (t) => {
  const f = await instrumented(t, {
    commit: async ({ phase }) => {
      phase('playing');
    },
  });
  let settled = false;
  const result = f.controller.capture(f.state.performance.records[0]).finally(() => {
    settled = true;
  });
  await until(() => f.writes === 1);
  await delay();
  assert.equal(settled, false, 'the write can commit, but optional confirmation must wait');
  assert.equal(f.tracker.marks.filter((m) => m.phase === 'playing').length, 0);
  f.phase('paused');
  assert.equal((await result).durable, true);
  assert.equal(f.writes, 1);
  assert.equal(f.controller.backup().records[0].runId, original.runId);
});

test('changed post-commit data cannot publish while blocked and fails after admission', async (t) => {
  const f = await instrumented(t, {
    commit: async ({ phase, saved }) => {
      saved.performance.generation++;
      phase('playing');
    },
  });
  let settled = false;
  const result = f.controller.capture(f.state.performance.records[0]).finally(() => {
    settled = true;
  });
  await until(() => f.writes === 1);
  await delay();
  assert.equal(settled, false);
  assert.equal(f.tracker.marks.filter((m) => m.phase === 'playing').length, 0);
  f.phase('paused');
  assert.match((await result).error, /changed while saving/);
  assert.equal(f.writes, 1);
});

test('cancellation after an actual optional commit prevents late publication without claiming rollback', async (t) => {
  const f = await instrumented(t, {
    commit: async ({ phase }) => {
      phase('playing');
    },
  });
  const abort = new AbortController();
  const result = f.controller.capture(f.state.performance.records[0], { signal: abort.signal });
  let settled = false;
  const outcome = result.then(
    (value) => {
      settled = true;
      return { value };
    },
    (error) => {
      settled = true;
      return { error };
    },
  );
  await until(() => settled || (f.writes === 1 && f.media.snapshot().queued === 1));
  assert.equal(settled, false);
  const rejected = assert.rejects(result, { name: 'AbortError' });
  await Promise.resolve();
  const publications = f.publications;
  abort.abort();
  await rejected;
  assert.equal((await outcome).error.name, 'AbortError');
  f.phase('paused');
  await delay();
  assert.equal(f.writes, 1, 'confirmed transaction is not undone');
  assert.equal(f.publications, publications);
});

test('ungated public observe retains immediate full inspection and identical synchronous error semantics', async (t) => {
  const f = await instrumented(t, { ungated: true });
  f.phase('playing');
  f.controller.observe(f.state);
  assert.deepEqual(
    f.tracker.marks.slice(0, 2).map((m) => m.kind),
    ['inspection', 'identity'],
  );
  await until(() => f.controller.snapshot().records.length === 1);
  const cycle = {};
  cycle.self = cycle;
  f.controller.observe({ ...f.state, performance: cycle });
  assert(f.controller.snapshot().error);
  assert.equal(f.controller.snapshot().records.length, 1);
  assert.equal(f.controller.snapshot().records[0].durable, false);
});

test('a retired observation cannot publish or clear a newer accepted identity after binding settles late', async (t) => {
  let release,
    bindingCalls = 0;
  const f = await instrumented(t, {
    acceptBinding: async () => {
      bindingCalls++;
      if (bindingCalls === 1)
        await new Promise((resolve) => {
          release = resolve;
        });
      return true;
    },
  });
  f.controller.observe(f.state);
  await until(() => release);
  f.controller.observe(stateFor('newer', 1));
  await until(() => f.controller.snapshot().records[0]?.runId === 'newer');
  const before = f.controller.snapshot();
  release();
  await delay();
  await delay();
  assert.equal(f.controller.snapshot(), before);
  assert.equal(f.controller.snapshot().error, null);
  assert.equal(f.controller.backup().records[0].runId, 'newer');
});

test('post-I/O ownership protects accepted backend data from mutation during the publication wait', async (t) => {
  let backendResult;
  const f = await instrumented(t, {
    commit: async ({ phase, saved }) => {
      backendResult = saved;
      phase('playing');
    },
  });
  const result = f.controller.capture(f.state.performance.records[0]);
  await until(() => f.writes === 1 && f.media.snapshot().queued === 1);
  const acceptedGeneration = backendResult.performance.generation;
  backendResult.performance.generation++;
  backendResult.performance.records[0].replay.options.seed = -1;
  f.phase('paused');
  assert.equal((await result).durable, true);
  assert.equal(f.controller.backup().generation, acceptedGeneration);
  assert.equal(f.controller.backup().records[0].replay.options.seed, 1);
});

test('snapshot failure notification cannot retire a reentrant newer observation', async (t) => {
  let f,
    restarted = false;
  f = await instrumented(t, {
    onChange: () => {
      if (!restarted && f.controller.snapshot().error) {
        restarted = true;
        f.controller.observe(stateFor('reentrant', 1));
      }
    },
  });
  f.phase('playing');
  const invalid = {};
  invalid.cycle = invalid;
  f.controller.observe({ ...f.state, performance: invalid });
  assert.equal(restarted, true);
  await until(() => f.media.snapshot().queued === 1);
  f.phase('paused');
  await until(() => f.controller.snapshot().records[0]?.runId === 'reentrant');
  assert.equal(f.controller.snapshot().error, null);
});

async function privatelyOwnedProfile(t, f, config = {}) {
  const model = managedIndexedDB(),
    requests = [],
    events = [];
  const indexedDB = {
    open(...args) {
      const request = model.indexedDB.open(...args);
      let success;
      Object.defineProperty(request, 'onsuccess', {
        set(fn) {
          success = fn;
        },
        get() {
          return () => {
            const db = request.result,
              transaction = db.transaction.bind(db);
            db.transaction = (...args) => {
              const tx = transaction(...args),
                objectStore = tx.objectStore.bind(tx),
                mode = args[1] ?? 'readonly';
              events.push({ kind: 'transaction', mode });
              const abort = tx.abort.bind(tx);
              tx.abort = () => {
                events.push({ kind: 'abort-request', mode });
                config.onAbortRequest?.({ tx, mode, events });
                return abort();
              };
              let onabort;
              Object.defineProperty(tx, 'onabort', {
                set(fn) {
                  onabort = fn;
                },
                get() {
                  return () => {
                    events.push({ kind: 'abort-confirmed', mode });
                    onabort?.();
                  };
                },
              });
              tx.objectStore = (...args) => {
                const store = objectStore(...args),
                  get = store.get.bind(store);
                store.get = (key) => {
                  requests.push({ key, mode, phase: f.tracker.phase });
                  const req = get(key);
                  let fn;
                  Object.defineProperty(req, 'onsuccess', {
                    set(value) {
                      fn = value;
                    },
                    get() {
                      return () => {
                        config.beforeGet?.({ key, mode, tx, events });
                        fn?.();
                      };
                    },
                  });
                  return req;
                };
                return store;
              };
              return tx;
            };
            success?.();
          };
        },
      });
      return request;
    },
  };
  const old = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
  t.after(() => {
    if (old) Object.defineProperty(globalThis, 'indexedDB', old);
    else delete globalThis.indexedDB;
  });
  const backend = createJourneyBackend({ indexedDB });
  const { replay, ...completion } = f.state.performance.records[0];
  await backend.commitState([
    { type: 'complete', ...completion },
    {
      type: 'performance',
      previous: 'null',
      performance: { ...f.state.performance, generation: 1 },
    },
  ]);
  const store = f.createJourneyProfileStore({
    canWrite: () => true,
    acceptPerformanceBinding: () => true,
    schedulePerformanceChunk: config.schedule ?? f.scheduleChunk,
    canRunPerformanceWork: () => !['playing', 'suspended'].includes(f.tracker.phase),
    operationTimeoutMs: config.timeout ?? 1500,
  });
  requests.length = 0;
  events.length = 0;
  t.after(() => store.performance.dispose());
  return { store, backend, indexedDB, model, requests, events };
}

test('the privately constructed backend receipt avoids every optional snapshot during active read/commit completion', async (t) => {
  const f = await instrumented(t),
    { store, backend } = await privatelyOwnedProfile(t, f);
  f.phase('playing');
  assert.equal(await store.flush(), true);
  assert.deepEqual(f.tracker.marks, []);
  assert.deepEqual(f.tracker.copies, []);
  store.record({ type: 'select', mode: 'solo', missionId: original.missionId });
  assert.equal(await store.flush(), true);
  assert.deepEqual(f.tracker.marks, []);
  assert.deepEqual(f.tracker.copies, []);
  assert.equal(store.snapshot().cursors.solo, original.missionId);
  assert.equal(Object.hasOwn(store.snapshot(), 'performance'), false);
  store.snapshot().clears.solo[original.missionId].runId = 'external mutation';
  // A different read gets its own IndexedDB clone; it cannot amend the queued receipt.
  const external = await backend.readState();
  external.performance.records[0].replay.options.seed = -1;
  f.phase('paused');
  await until(() => store.performance.snapshot().records.length === 1);
  assert.equal(store.performance.backup().records[0].replay.options.seed, 1);
  assert.equal(store.performance.snapshot().records[0].runId, original.runId);
});

test('public observations and injected backends cannot forge the private read receipt', async (t) => {
  const f = await instrumented(t),
    { store } = await privatelyOwnedProfile(t, f);
  f.phase('playing');
  const publicState = { ...f.state, owned: true, receipt: Object.freeze({}) };
  store.performance.observe(publicState);
  assert.equal(f.tracker.copies.length, 1);
  publicState.performance.records[0].replay.options.seed = -1;
  f.phase('paused');
  await until(() => store.performance.snapshot().records.length === 1);
  assert.equal(store.performance.backup().records[0].replay.options.seed, 1);
  f.phase('playing');
  f.tracker.copies.length = 0;
  const injected = f.createJourneyProfileStore({
    backend: f.backend,
    canWrite: () => true,
    acceptPerformanceBinding: () => true,
    schedulePerformanceChunk: f.scheduleChunk,
  });
  t.after(() => injected.performance.dispose());
  await injected.flush();
  assert.equal(f.tracker.copies.length, 1, 'caller-owned backend remains defensive');
});

test('disposing a private receipt before admission neither inspects it nor publishes optional history', async (t) => {
  const f = await instrumented(t),
    { store } = await privatelyOwnedProfile(t, f);
  f.phase('playing');
  await store.flush();
  await until(() => f.media.snapshot().queued === 1);
  store.performance.dispose();
  f.phase('paused');
  await delay();
  await delay();
  assert.deepEqual(f.tracker.marks, []);
  assert.deepEqual(f.tracker.copies, []);
  assert.equal(store.performance.snapshot().records.length, 0);
});

test('default progress transactions omit the sidecar; unread never publishes empty history', async (t) => {
  const f = await instrumented(t),
    { store, requests } = await privatelyOwnedProfile(t, f);
  await store.load();
  await until(() => store.performance.snapshot().records.length === 1);
  const accepted = store.performance.snapshot();
  f.phase('playing');
  requests.length = 0;
  f.tracker.marks.length = 0;
  f.tracker.copies.length = 0;
  await store.flush();
  store.record({ type: 'select', mode: 'solo', missionId: original.missionId });
  await store.flush();
  assert(requests.length > 0);
  assert(requests.every(({ key }) => !key.endsWith(':performance.v1')));
  assert.equal(store.performance.snapshot(), accepted);
  assert.deepEqual(f.tracker.marks, []);
  assert.deepEqual(f.tracker.copies, []);
  f.phase('paused');
  await until(() => requests.some(({ key }) => key.endsWith(':performance.v1')));
  await until(() => f.media.snapshot().active.main === 0 && f.media.snapshot().queued === 0);
  assert.equal(store.performance.snapshot().records[0].runId, original.runId);
});

test('actual default-IDB delayed read aborts before optional validation and resumes after Pause', async (t) => {
  const f = await instrumented(t);
  let interrupt = true;
  const { store, events, requests } = await privatelyOwnedProfile(t, f, {
    beforeGet({ key, mode }) {
      if (interrupt && mode === 'readonly' && key.endsWith(':performance.v1')) {
        interrupt = false;
        f.phase('playing');
      }
    },
  });
  await store.flush();
  await until(() => events.some((e) => e.kind === 'abort-confirmed'));
  assert.equal(store.status().durable, true);
  assert.equal(store.performance.snapshot().records.length, 0);
  assert.deepEqual(f.tracker.marks, []);
  assert.equal(f.media.snapshot().active.main, 0, 'native I/O holds no main slot');
  f.phase('paused');
  await until(() => store.performance.snapshot().records.length === 1);
  assert.equal(requests.filter(({ key }) => key.endsWith(':performance.v1')).length, 2);
  assert(f.tracker.marks.every((m) => m.phase === 'paused'));
});

test('optional write crossing into play preserves required saves and retries only after confirmed abort', async (t) => {
  const f = await instrumented(t);
  let armed = false,
    crossed = false;
  const { store, events, model } = await privatelyOwnedProfile(t, f, {
    beforeGet({ key, mode }) {
      if (armed && !crossed && mode === 'readwrite' && key.endsWith(':performance.v1')) {
        crossed = true;
        f.phase('playing');
      }
    },
    onAbortRequest({ tx, mode, events }) {
      if (armed && mode === 'readwrite') {
        events.push({ kind: 'bubbling-error', mode });
        tx.onerror?.();
        assert.equal(
          events.filter((e) => e.kind === 'transaction' && e.mode === 'readwrite').length,
          1,
          'request error is not a retry receipt',
        );
      }
    },
  });
  await store.load();
  await until(() => store.performance.snapshot().records.length === 1);
  armed = true;
  events.length = 0;
  f.tracker.marks.length = 0;
  const result = store.performance.capture(f.state.performance.records[0]);
  await until(() => events.some((e) => e.kind === 'abort-confirmed'));
  assert.equal(model.contents().get('profiles').get('journey:performance.v1').generation, 1);
  store.record({ type: 'select', mode: 'solo', missionId: original.missionId });
  assert.equal(await store.flush(), true, 'required progress is not queued behind optional work');
  assert.equal(f.media.snapshot().active.main, 0);
  f.phase('paused');
  assert.equal((await result).durable, true);
  assert.equal(model.contents().get('profiles').get('journey:performance.v1').generation, 2);
  assert(f.tracker.marks.every((m) => m.phase === 'paused'));
  const aborted = events.findIndex((e) => e.kind === 'abort-confirmed');
  assert(events.slice(aborted + 1).some((e) => e.kind === 'transaction' && e.mode === 'readwrite'));
});

test('phase deferral consumes one write deadline and never claims timeout rolled back a save', async (t) => {
  const f = await instrumented(t);
  let armed = false;
  const { store, events, model } = await privatelyOwnedProfile(t, f, {
    timeout: 40,
    beforeGet({ key, mode }) {
      if (armed && mode === 'readwrite' && key.endsWith(':performance.v1')) f.phase('playing');
    },
  });
  await store.load();
  await until(() => store.performance.snapshot().records.length === 1);
  armed = true;
  events.length = 0;
  const result = await store.performance.capture(f.state.performance.records[0]);
  assert.equal(result.durable, false);
  assert.equal(result.saveUnconfirmed, true);
  assert.equal(model.contents().get('profiles').get('journey:performance.v1').generation, 1);
  const attempts = events.filter((e) => e.kind === 'transaction' && e.mode === 'readwrite').length;
  assert.equal(attempts, 1);
  f.phase('paused');
  await delay();
  await delay();
  assert.equal(
    events.filter((e) => e.kind === 'transaction' && e.mode === 'readwrite').length,
    attempts,
  );
});

test('cancellation after native commit preserves stored data and never retries or publishes it', async (t) => {
  const f = await instrumented(t),
    { store, model, events } = await privatelyOwnedProfile(t, f);
  await store.load();
  await until(() => store.performance.snapshot().records.length === 1);
  const abort = new AbortController(),
    before = store.performance.snapshot();
  model.afterAnyCommit = () => {
    if (model.contents().get('profiles').get('journey:performance.v1').generation === 2) {
      f.phase('playing');
      abort.abort();
    }
  };
  const result = store.performance.capture(f.state.performance.records[0], {
    signal: abort.signal,
  });
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(model.contents().get('profiles').get('journey:performance.v1').generation, 2);
  const attempts = events.filter((e) => e.kind === 'transaction' && e.mode === 'readwrite').length;
  f.phase('paused');
  await delay();
  await delay();
  assert.equal(
    events.filter((e) => e.kind === 'transaction' && e.mode === 'readwrite').length,
    attempts,
  );
  assert.equal(store.performance.snapshot().records[0].runId, before.records[0].runId);
});

test('private storage admission rejects duplicate, skipped and retired callbacks without extra I/O', async (t) => {
  for (const kind of ['duplicate', 'skipped', 'retired', 'unsettled'])
    await t.test(kind, async (t) => {
      const f = await instrumented(t);
      let late;
      const { store, requests } = await privatelyOwnedProfile(t, f, {
        timeout: 40,
        schedule(work) {
          if (kind === 'skipped') return;
          if (kind === 'retired') {
            late = work;
            return;
          }
          work();
          if (kind === 'duplicate') {
            try {
              work();
            } catch {}
          }
          if (kind === 'unsettled') return new Promise(() => {});
        },
      });
      await store.flush();
      await until(() => store.performance.snapshot().error);
      const before = requests.length;
      if (late) assert.throws(late, /exactly once/);
      await delay();
      assert.equal(requests.length, before);
      assert.equal(store.performance.snapshot().records.length, 0);
    });
});

test('throwing top-level observation getters are contained and retire the new lifetime', async (t) => {
  const f = await instrumented(t);
  f.phase('playing');
  for (const key of ['performance', 'profile']) {
    const value = { ...f.state };
    Object.defineProperty(value, key, {
      get() {
        throw new Error(`blocked ${key}`);
      },
    });
    assert.doesNotThrow(() => f.controller.observe(value));
    assert.match(f.controller.snapshot().error, new RegExp(`blocked ${key}`));
    assert.equal(f.media.snapshot().queued, 0);
  }
  f.controller.observe(f.state);
  f.phase('paused');
  await until(() => f.controller.snapshot().records.length === 1);
  assert.equal(f.controller.snapshot().error, null);
});

test('unscheduled and injected backends preserve their original capture-time profile refresh', async (t) => {
  for (const scheduled of [false, true]) {
    const f = await instrumented(t);
    let reads = 0;
    const backend = {
      ...f.backend,
      async readState() {
        reads++;
        return f.backend.readState();
      },
    };
    const store = f.createJourneyProfileStore({
      backend,
      acceptPerformanceBinding: () => true,
      ...(scheduled ? { schedulePerformanceChunk: f.scheduleChunk } : {}),
    });
    t.after(() => store.performance.dispose());
    await store.load();
    await until(() => store.performance.snapshot().records.length === 1);
    reads = 0;
    assert.equal((await store.performance.capture(f.state.performance.records[0])).durable, true);
    assert.equal(reads, 2, 'original profile refresh plus independent performance/CAS read');
  }
});
