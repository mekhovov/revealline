import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import {
  createRafIntervalClock,
  frozenExternalCadence,
} from './solo-qualification-observation.mjs';
import {
  HITCH_LIMITS,
  qualificationHitchJournalOptions,
  createBrowserHitchJournal,
  hitchJournalInitScript,
  decodeHitchJournal,
  createHitchJournalStore,
  verifyHitchJournalFile,
} from './solo-qualification-hitch-journal.mjs';

function fixture({
  records = HITCH_LIMITS.records,
  native = false,
  configure = true,
  subscribe = true,
} = {}) {
  let now = 0,
    observer;
  const documentEvents = new Map(),
    events = new Map();
  const environment = {
    performance: { now: () => now, timeOrigin: 1700000000000 },
    location: { origin: 'https://solo.test', pathname: '/game/' },
    document: {
      hidden: false,
      hasFocus: () => true,
      addEventListener: (name, fn) => documentEvents.set(name, fn),
    },
    addEventListener: (name, fn) => events.set(name, fn),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  };
  if (native)
    environment.PerformanceObserver = class {
      static supportedEntryTypes = ['longtask'];
      pending = [];
      constructor(callback) {
        this.callback = callback;
        observer = this;
      }
      observe(options) {
        assert.deepEqual(options, { type: 'longtask', buffered: true });
      }
      takeRecords() {
        const result = this.pending;
        this.pending = [];
        return result;
      }
      disconnect() {
        this.disconnected = true;
      }
      emit(entries, dropped) {
        this.callback(
          { getEntries: () => entries },
          this,
          dropped === undefined ? {} : { droppedEntriesCount: dropped },
        );
      }
    };
  const journal = createBrowserHitchJournal({ records }, environment);
  journal.first(0, 0);
  if (configure) journal.configure({ id: 1, records, remainingMs: HITCH_LIMITS.durationMs });
  if (subscribe) journal.subscribe(0);
  return {
    journal,
    environment,
    events,
    documentEvents,
    get observer() {
      return observer;
    },
    at(value) {
      now = value;
    },
  };
}
const recordsOf = (result) => [...decodeHitchJournal(Buffer.from(result.base64, 'base64'))];
async function temporary(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-hitch-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('journal is strictly opt-in, requires work and never broadens the forty-minute limit', () => {
  assert.equal(qualificationHitchJournalOptions([], {}), null);
  assert.equal(
    qualificationHitchJournalOptions(['--hitch-journal', '--work-probe'], { timeoutMs: 2400000 }),
    HITCH_LIMITS,
  );
  for (const flags of [
    ['--hitch-journal'],
    ['--hitch-journal=no', '--work-probe'],
    ['--hitch-journal', '--hitch-journal', '--work-probe'],
  ])
    assert.throws(() => qualificationHitchJournalOptions(flags, { timeoutMs: 1 }));
  assert.throws(() =>
    qualificationHitchJournalOptions(['--hitch-journal', '--work-probe'], { timeoutMs: 2400001 }),
  );
  assert.throws(() => createBrowserHitchJournal({ records: 174001 }));
});

test('individual 33–50ms gaps survive beyond the old256-tail limit with Float64 endpoints', () => {
  const f = fixture();
  for (let i = 0; i < 1000; i++) f.journal.frame(i * 40, (i + 1) * 40, 2, 2);
  const start = 2050000.00000001,
    end = start + 33.123456789;
  f.journal.frame(start, end, 2, 3);
  f.at(end);
  const result = f.journal.seal('paused'),
    rows = recordsOf(result);
  assert.equal(rows.length, 1001);
  assert.equal(rows[0].startMs, 0);
  assert.equal(rows[999].endMs, 40000);
  assert.equal(rows.at(-1).startMs, start);
  assert.equal(rows.at(-1).endMs, end);
  assert.equal(rows.at(-1).durationMs, end - start);
  assert.deepEqual([rows.at(-1).before, rows.at(-1).after], [2, 3]);
  assert.equal(result.header.complete, true);
});

test('more than5000 long work windows retain timestamps, and scalar snapshots never include the payload', () => {
  const f = fixture();
  for (let i = 0; i < 7001; i++) {
    f.journal.beginWork(i * 51, 2);
    f.journal.endWork((i + 1) * 51, 2);
  }
  const state = f.journal.state();
  assert.equal(state.records, 7001);
  assert(Buffer.byteLength(JSON.stringify(state)) < 1600);
  assert(!Object.hasOwn(state, 'base64'));
  const rows = recordsOf(f.journal.seal('result'));
  assert.equal(rows.length, 7001);
  assert.deepEqual([rows[0].startMs, rows.at(-1).endMs], [0, 357051]);
  assert(rows.every((row) => row.kind === 2 && row.durationMs === 51));
});

test('thresholds, pause-crossing hitches and cached foreground boundaries remain exact', () => {
  const f = fixture();
  let at = 0;
  const expectedFrames = [];
  for (const duration of [33, 33.00001, 50, 100, 250, 500]) {
    f.journal.frame(at, at + duration, 2, 3);
    if (duration > 33) expectedFrames.push([at, at + duration]);
    at += duration;
  }
  f.at(at);
  f.events.get('blur')();
  const crossingAt = at;
  f.journal.frame(at, at + 40, 2, 3);
  expectedFrames.push([at, at + 40]);
  at += 40;
  for (const duration of [49.999, 50, 100, 250]) {
    f.journal.beginWork(at, 2);
    f.journal.endWork(at + duration, 3);
    at += duration;
  }
  const rows = recordsOf(f.journal.seal('paused'));
  assert.deepEqual(
    rows.filter((row) => row.kind === 1).map((row) => [row.startMs, row.endMs]),
    expectedFrames,
  );
  assert.deepEqual(
    rows.filter((row) => row.kind === 2).map((row) => row.durationMs),
    [50, 100, 250],
  );
  const crossing = rows.find((row) => row.kind === 1 && row.startMs === crossingAt);
  assert.equal((crossing.packed >>> 12) & 3, 3);
  assert.equal((crossing.packed >>> 14) & 3, 1);
});

test('normal30–144Hz schedules retain every >33ms interval without turning first callback into an interval', () => {
  for (const hz of [30, 40, 45, 60, 90, 120, 144]) {
    const f = fixture();
    f.journal.first(1, 2);
    let at = 1;
    for (let i = 0; i < 1440; i++) {
      f.journal.frame(at, at + 1000 / hz, 2, 2);
      at += 1000 / hz;
    }
    const result = f.journal.seal('paused');
    assert.equal(result.header.records, hz === 30 ? 1440 : 0);
    assert.equal(result.header.firstCallback.timestampMs, 0);
  }
});

test('append-only capacity retains the prefix, counts drops and refuses repeated or active export', () => {
  const f = fixture({ records: 2 });
  f.journal.frame(0, 40, 2, 2);
  f.journal.frame(40, 80, 2, 2);
  f.journal.frame(80, 120, 2, 3);
  assert.throws(() => f.journal.seal('running'));
  const result = f.journal.seal('paused');
  assert.equal(f.journal.state().bufferBytes, 0);
  assert.equal(result.header.complete, false);
  assert.equal(result.header.observed[1], 3);
  assert.equal(result.header.retained[1], 2);
  assert.equal(result.header.firstOverflowAt, 120);
  assert.deepEqual(
    recordsOf(result).map((row) => row.endMs),
    [40, 80],
  );
  assert.throws(() => f.journal.seal('paused'));
  f.journal.frame(120, 125, 2, 2);
  assert.equal(f.journal.state().postSealActive, true);
});

test('forty-minute, clock and unmatched-work failures are visible even without a qualifying hitch', () => {
  const atBoundary = fixture();
  atBoundary.at(2400000);
  assert.equal(atBoundary.journal.seal('paused').header.complete, true);
  const expired = fixture();
  expired.at(2400000.001);
  assert.equal(expired.journal.seal('paused').header.durationExceeded, true);
  for (const operation of [
    (j) => j.frame(5, 4, 2, 2),
    (j) => j.frame(NaN, 4, 2, 2),
    (j) => {
      j.beginWork(4, 2);
      j.endWork(3, 2);
    },
    (j) => {
      j.beginWork(0, 2);
      j.beginWork(1, 2);
      j.endWork(2, 2);
    },
  ]) {
    const f = fixture();
    operation(f.journal);
    assert.equal(f.journal.seal('paused').header.clockInvalid, true);
  }
  const partial = fixture();
  partial.journal.beginWork(17, 2);
  assert.equal(partial.journal.seal('paused').header.unmatchedWorkStart, 17);
});

test('native tasks are feature-detected, queued entries drain once and native drops invalidate completeness', () => {
  assert.equal(fixture().journal.seal('paused').header.nativeTasks, 'unobserved');
  const f = fixture({ native: true });
  f.observer.emit([{ startTime: 10, duration: 60 }], 0);
  f.observer.pending.push({ startTime: 80, duration: 75 });
  const result = f.journal.seal('paused');
  assert.deepEqual(
    recordsOf(result).map((row) => [row.startMs, row.endMs]),
    [
      [10, 70],
      [80, 155],
    ],
  );
  assert.equal(f.observer.disconnected, true);
  assert.equal(result.header.nativeDropped, 0);
  const dropped = fixture({ native: true });
  dropped.observer.emit([], 3);
  assert.equal(dropped.journal.seal('paused').header.complete, false);
  const unknown = fixture({ native: true });
  unknown.observer.emit([]);
  assert.equal(unknown.journal.seal('paused').header.nativeDropped, null);
});

test('serialized browser bootstrap has no imports, timers, animation loop or active transport', () => {
  const f = fixture();
  const environment = f.environment;
  environment.window = environment;
  environment.top = environment;
  vm.runInNewContext(hitchJournalInitScript(), environment);
  assert.equal(environment.soloQualificationHitchJournal.state().configured, false);
  const script = hitchJournalInitScript();
  for (const forbidden of [
    'requestAnimationFrame',
    'setTimeout',
    'setInterval',
    'fetch(',
    'console.',
    'querySelector',
  ])
    assert(!script.includes(forbidden));
});

test('writer preserves independent document binaries with one row-wide capacity and monotonic deadline', async (t) => {
  const dir = await temporary(t);
  let now = 0;
  const store = createHitchJournalStore(join(dir, 'report.json'), () => now);
  const one = fixture({ configure: false });
  one.journal.configure(store.beginDocument());
  one.journal.frame(0, 40, 2, 3);
  const first = await store.retain(one.journal.seal('paused'), 'before-declared-reload');
  now = 1000;
  const allocation = store.beginDocument();
  assert.equal(allocation.records, HITCH_LIMITS.records - 1);
  assert.equal(allocation.remainingMs, 2399000);
  const two = fixture({ configure: false });
  two.journal.configure(allocation);
  two.journal.beginWork(5, 2);
  two.journal.endWork(100, 2);
  two.journal.frame(0, 110, 2, 2);
  two.at(110);
  const second = await store.retain(two.journal.seal('result'), 'final');
  assert.notEqual(first.path, second.path);
  assert.equal((await readFile(first.path)).length, 24);
  assert.equal([...decodeHitchJournal(await readFile(second.path))][0].durationMs, 95);
  assert.equal(store.finish().status, 'complete');
  assert.equal(store.report.records, 3);
  assert.equal(store.report.bytes, 72);
  assert(Buffer.byteLength(JSON.stringify(store.report)) < HITCH_LIMITS.descriptorBytes);
});

test('forty-minute worst-density sizing fits the fixed binary buffer; a following document cannot renew it', async (t) => {
  const dir = await temporary(t),
    store = createHitchJournalStore(join(dir, 'report.json'), () => 0);
  const f = fixture({ configure: false });
  f.journal.configure(store.beginDocument());
  for (let i = 0; i < 72728; i++) f.journal.frame(i * 33.000001, (i + 1) * 33.000001, 2, 2);
  for (let i = 0; i < 48000; i++) {
    f.journal.beginWork(i * 50, 2);
    f.journal.endWork((i + 1) * 50, 2);
  }
  assert.equal(f.journal.state().records, 120728);
  // Fill the reserved remainder with sparse-boundary-format records to exercise
  // the exact hard ceiling independently of this workload's duration verdict.
  for (let i = 0; i < 53272; i++) f.journal.phase((i % 2) + 1, i);
  assert.equal(f.journal.state().records, HITCH_LIMITS.records);
  await store.retain(f.journal.seal('paused'), 'final-document-one');
  assert.equal(store.report.bytes, 4176000);
  const second = fixture({ configure: false });
  second.journal.configure(store.beginDocument());
  second.journal.frame(0, 40, 2, 3);
  const result = second.journal.seal('paused');
  assert.equal(result.header.capacity, 0);
  assert.equal(result.header.records, 0);
  assert.equal(result.header.observed[1], 1);
  await store.retain(result, 'final-document-two');
  assert.equal(store.finish().status, 'incomplete');
  assert.equal(store.report.bytes, 4176000);
});

test('unexpected replacement, missing final document and document cap never masquerade as complete', async (t) => {
  const store = createHitchJournalStore(join(await temporary(t), 'report.json'), () => 0);
  for (let i = 0; i < 64; i++) store.beginDocument();
  assert.throws(() => store.beginDocument(), /cap/);
  assert.equal(store.finish().status, 'incomplete');
  assert.equal(store.report.documents.length, 64);
  assert(store.report.documents.every((row) => row.status === 'lost'));
});

test('decoder and writer reject malformed lengths, clocks, sequences, payloads and existing files', async (t) => {
  const f = fixture();
  f.journal.frame(0, 40, 2, 3);
  const result = f.journal.seal('paused'),
    bytes = Buffer.from(result.base64, 'base64');
  assert.throws(() => [...decodeHitchJournal(bytes.subarray(1))]);
  for (const mutate of [
    (b) => b.writeDoubleLE(NaN, 0),
    (b) => b.writeDoubleLE(-1, 8),
    (b) => b.writeUInt32LE(19, 20),
    (b) => b.writeUInt32LE(15, 16),
  ]) {
    const changed = Buffer.from(bytes);
    mutate(changed);
    assert.throws(() => [...decodeHitchJournal(changed)]);
  }
  const dir = await temporary(t),
    store = createHitchJournalStore(join(dir, 'report.json'), () => 0);
  store.beginDocument();
  await assert.rejects(store.retain({ ...result, base64: result.base64 + '!' }, 'invalid'));
  await assert.rejects(
    store.retain({ ...result, header: { ...result.header, records: 2 } }, 'invalid'),
  );
  await writeFile(join(dir, 'report.json.hitches.d01.bin'), 'retain-me');
  await assert.rejects(store.retain(result, 'existing'), { code: 'EEXIST' });
  assert.equal(await readFile(join(dir, 'report.json.hitches.d01.bin'), 'utf8'), 'retain-me');
  assert.equal(store.finish().status, 'incomplete');
});

test('output aliases are rejected and boot observations survive configuring a smaller next-document allowance', async (t) => {
  const dir = await temporary(t);
  await symlink(dir, join(dir, 'alias'));
  const store = createHitchJournalStore(join(dir, 'alias', 'report.json'), () => 0);
  const f = fixture({ configure: false });
  f.journal.frame(0, 40, 0, 0);
  f.journal.frame(40, 80, 0, 1);
  const allocation = store.beginDocument();
  f.journal.configure({ ...allocation, records: 1 });
  const result = f.journal.seal('briefing');
  assert.equal(result.header.records, 1);
  assert.equal(result.header.observed[1], 2);
  assert.equal(result.header.complete, false);
  await assert.rejects(store.retain(result, 'aliased'), /alias/);
});

test('qualifier opts in dynamically, keeps snapshots scalar and uses only existing navigation/final boundaries', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  assert(source.includes("? await import('./solo-qualification-hitch-journal.mjs')"));
  assert(source.includes('await sealHitchDocument(`before-reload-${path}`)'));
  assert(source.includes('await sealHitchDocument(`before-follow-${path}`)'));
  assert(source.includes("await sealHitchDocument('final-existing-public-boundary')"));
  assert(source.includes('performanceGateStatusBeforeHitchJournal'));
  assert(!source.includes('hitchJournal: window.soloQualificationHitchJournal.seal'));
});

test('asynchronous native delivery may precede earlier appended frame/work timestamps', () => {
  const f = fixture({ native: true });
  f.journal.phase(2, 20);
  f.journal.frame(100, 140, 2, 2);
  f.journal.beginWork(120, 2);
  f.journal.endWork(180, 2);
  f.journal.phase(3, 200);
  f.observer.emit([
    { startTime: 30, duration: 65 },
    { startTime: 100, duration: 75 },
  ]);
  f.observer.pending.push({ startTime: 5, duration: 50 });
  f.at(220);
  const result = f.journal.seal('paused'),
    rows = recordsOf(result);
  assert.equal(result.header.complete, true);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.startMs]),
    [
      [4, 20],
      [1, 100],
      [2, 120],
      [4, 200],
      [3, 30],
      [3, 100],
      [3, 5],
    ],
  );
  assert.equal(result.header.nativeDropped, null);
  const bad = fixture({ native: true });
  bad.observer.emit([
    { startTime: 100, duration: 50 },
    { startTime: 10, duration: 50 },
  ]);
  assert.equal(bad.journal.seal('paused').header.clockInvalid, true);
  for (const kind of ['frame', 'work']) {
    const invalid = fixture();
    if (kind === 'frame') {
      invalid.journal.frame(100, 140, 2, 2);
      invalid.journal.frame(0, 40, 2, 2);
    } else {
      invalid.journal.beginWork(100, 2);
      invalid.journal.endWork(160, 2);
      invalid.journal.beginWork(0, 2);
      invalid.journal.endWork(60, 2);
    }
    assert.equal(invalid.journal.seal('paused').header.clockInvalid, true);
  }
});

test('writer rejects fabricated completeness and bounds metadata independently of binary capacity', async (t) => {
  const dir = await temporary(t),
    store = createHitchJournalStore(join(dir, 'report.json'), () => 0);
  store.beginDocument();
  const f = fixture({ records: 1 });
  f.journal.frame(0, 40, 2, 2);
  f.journal.frame(40, 80, 2, 3);
  const result = f.journal.seal('paused');
  await assert.rejects(
    store.retain({ ...result, header: { ...result.header, complete: true } }, 'falsified'),
  );
  await assert.rejects(
    store.retain(
      { ...result, header: { ...result.header, unknown: 'x'.repeat(65536) } },
      'oversized',
    ),
    /descriptor cap/,
  );
  store.fail('Rejected incomplete/fabricated document');
  for (let i = 0; i < 63; i++) {
    store.beginDocument();
    store.fail('x'.repeat(1000));
  }
  assert.equal(store.finish().status, 'incomplete');
  assert(Buffer.byteLength(JSON.stringify(store.report)) <= HITCH_LIMITS.descriptorBytes);
});

test('actual probe keeps default counters unchanged and adds a complete scalar-only journal when selected', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const marker = '  await addQualificationProbe(\n';
  const first = source.indexOf(marker) + marker.length;
  const end = source.indexOf('    {\n      bounds: FRAME_BOUNDS,', first);
  assert(first > marker.length && end > first);
  const factory = source.slice(first, end).trim().replace(/,$/, '');
  const run = (enabled) => {
    let now = 0,
      next,
      onPhase;
    const f = fixture(),
      environment = f.environment;
    environment.window = environment;
    environment.performance.now = () => now;
    environment.document.body = { dataset: { flightState: 'briefing' } };
    environment.MutationObserver = class {
      constructor(callback) {
        onPhase = callback;
      }
      observe() {}
    };
    environment.requestAnimationFrame = (callback) => {
      next = callback;
    };
    environment.HTMLMediaElement = class {
      play() {
        return Promise.resolve();
      }
    };
    environment.soloQualificationIntervalClock = (at) => createRafIntervalClock(at, () => now);
    environment.soloQualificationFrozenCadence = frozenExternalCadence;
    environment.soloQualificationReadiness = () => ({});
    if (enabled) environment.soloQualificationHitchJournal = f.journal;
    vm.runInNewContext(
      '(' + factory + ')',
      environment,
    )({
      bounds: [33, 50, 100, 250, null],
      workProbe: true,
      externalCadenceCalibration: null,
      hitchJournal: enabled,
    });
    const work = new Map();
    environment.Phaser = {
      Game: class {
        constructor() {
          this.events = { on: (name, callback) => work.set(name, callback) };
        }
      },
      Core: { Events: { PRE_STEP: 'pre', POST_RENDER: 'post' } },
    };
    new environment.Phaser.Game();
    f.documentEvents.get('DOMContentLoaded')();
    environment.soloQualificationProbe.startApplicationProbe();
    next(now);
    environment.document.body.dataset.flightState = 'running';
    onPhase();
    for (let i = 0; i < 7001; i++) {
      now += 1;
      work.get('pre')();
      now += 51;
      work.get('post')();
      next(now);
    }
    for (let i = 0; i < 1000; i++) {
      now += 40;
      next(now);
    }
    // Distinct cadence windows and fractional endpoints do not reset the journal.
    for (const hz of [120, 90, 40, 60, 30])
      for (let i = 0; i < 60; i++) {
        now += 1000 / hz;
        next(now);
      }
    environment.document.body.dataset.flightState = 'paused';
    onPhase();
    const snapshot = environment.soloQualificationProbe.export();
    const repeated = environment.soloQualificationProbe.export();
    assert.deepEqual(JSON.parse(JSON.stringify(repeated)), JSON.parse(JSON.stringify(snapshot)));
    let sealed;
    if (enabled) {
      assert(!Object.hasOwn(snapshot.hitchJournal, 'base64'));
      sealed = f.journal.seal('paused');
    }
    return { snapshot: JSON.parse(JSON.stringify(snapshot)), sealed };
  };
  const ordinary = run(false),
    enabled = run(true);
  const { hitchJournal, ...originalFields } = enabled.snapshot;
  assert.deepEqual(originalFields, ordinary.snapshot);
  assert.equal(ordinary.snapshot.work.omittedCount, 2001);
  assert.equal(ordinary.snapshot.tailCount, 7001);
  assert.equal(enabled.sealed.header.complete, true);
  assert.equal(hitchJournal.observed[1], 8061);
  assert.equal(hitchJournal.observed[2], 7001);
  const rows = recordsOf(enabled.sealed);
  assert.equal(rows.filter((row) => row.kind === 1).length, 8061);
  assert.equal(rows.filter((row) => row.kind === 2).length, 7001);
  assert.equal(rows.filter((row) => row.kind === 1).at(-1).endMs, enabled.snapshot.now);
});

test('disk readback requires exact retained bytes and SHA before a file can be trusted', async (t) => {
  const path = join(await temporary(t), 'journal.bin'),
    original = Buffer.alloc(24, 7);
  const hash = createHash('sha256').update(original).digest('hex');
  await writeFile(path, original);
  assert.deepEqual(await verifyHitchJournalFile(path, 24, hash), {
    bytes: 24,
    sha256: hash,
    readbackVerified: true,
  });
  await assert.rejects(verifyHitchJournalFile(path, 23, hash), /byte count/);
  await assert.rejects(verifyHitchJournalFile(path, HITCH_LIMITS.records * 24 + 1, hash));
  await writeFile(path, Buffer.alloc(24, 8));
  await assert.rejects(verifyHitchJournalFile(path, 24, hash), /hash/);
  await writeFile(path, original.subarray(0, 16));
  await assert.rejects(verifyHitchJournalFile(path, 24, hash), /byte count/);
});

test('actual opted-in installer orders helpers, journal and dependent probe in one script', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const first = source.indexOf('  function addQualificationProbe('),
    end = source.indexOf('  await addQualificationProbe(', first);
  assert(first > 0 && end > first);
  const f = fixture(),
    environment = f.environment;
  environment.window = environment;
  environment.top = environment;
  const scripts = [];
  const install = vm.runInNewContext('(' + source.slice(first, end).trim() + ')', {
    hitchStore: {},
    observationInitScript: 'window.observationReady = true;',
    hitchModule: { hitchJournalInitScript },
    page: {
      addInitScript: (script) => {
        scripts.push(script);
        vm.runInNewContext(script, environment);
      },
    },
  });
  install(
    function (options) {
      if (!globalThis.window.observationReady || !globalThis.window.soloQualificationHitchJournal)
        throw Error('Unordered init dependency');
      globalThis.window.probeOptionsReceived = options;
      globalThis.window.soloQualificationHitchJournal.first(1, 2);
    },
    { test: 'ordered' },
  );
  assert.equal(scripts.length, 1);
  assert.equal(environment.probeOptionsReceived.test, 'ordered');
  assert.equal(environment.soloQualificationHitchJournal.state().firstCallback.timestampMs, 1);
  const child = { top: {} };
  child.window = child;
  vm.runInNewContext(scripts[0], child);
  assert.equal(child.observationReady, undefined);
  assert.equal(child.soloQualificationHitchJournal, undefined);
  assert.equal(child.probeOptionsReceived, undefined);
  const ordinaryCalls = [];
  const ordinary = vm.runInNewContext('(' + source.slice(first, end).trim() + ')', {
    hitchStore: null,
    page: { addInitScript: (...args) => ordinaryCalls.push(args) },
  });
  const fn = () => {},
    options = { hitchJournal: false };
  ordinary(fn, options);
  assert.deepEqual(ordinaryCalls, [[fn, options]]);
});

test('encoded control characters and multibyte failure reasons fit the metadata reserve', async (t) => {
  const store = createHitchJournalStore(join(await temporary(t), 'report.json'), () => 0);
  store.beginDocument();
  const result = fixture().journal.seal('paused');
  result.header.extra = 'x'.repeat(41000);
  await store.retain(result, 'near-cap-descriptor');
  const reasons = [
    '\0'.repeat(256),
    '😀'.repeat(256),
    '\n\r\t\b\f\\"'.repeat(256),
    'é漢'.repeat(256),
  ];
  for (let i = 0; i < 64; i++) {
    store.fail(reasons[i % reasons.length]);
    if (i < 63) {
      try {
        store.beginDocument();
      } catch (error) {
        assert.match(error.message, /descriptor cap/);
      }
    }
  }
  assert.equal(store.finish().status, 'incomplete');
  assert.equal(store.report.failures.length, 64);
  assert(store.report.failures.every((reason) => Buffer.byteLength(JSON.stringify(reason)) <= 256));
  assert(Buffer.byteLength(JSON.stringify(store.report)) <= HITCH_LIMITS.descriptorBytes);
});

const anchoredURL = 'https://solo.test/game/';
const preparationOptions = { soloURL: anchoredURL, preparationPolicy: 'first-return-anchored-v1' };
function preparedDocument(allocation) {
  const f = fixture({ configure: false, subscribe: false });
  f.environment.location.pathname = '/game/playground/';
  f.journal.configure(allocation);
  f.journal.phase(6, 1);
  f.journal.frame(0, 40, 6, 6);
  f.at(40);
  return f;
}
function activeDocument(allocation) {
  const f = fixture({ configure: false });
  f.journal.configure(allocation);
  f.journal.phase(2, 0);
  f.journal.frame(0, 40, 2, 2);
  f.journal.beginWork(1, 2);
  f.journal.endWork(3, 2);
  f.journal.phase(3, 40);
  f.at(40);
  return f;
}

test('preparation opt-in admits only the exact anchored fixture and exact flag', async () => {
  const bytes = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-sustained/soak-first-return-anchored.qualification.fixture',
      import.meta.url,
    ),
  );
  const recipe = JSON.parse(bytes);
  const flags = [
    '--hitch-journal',
    '--work-probe',
    '--hitch-journal-preparation=first-return-anchored-v1',
  ];
  assert.equal(
    qualificationHitchJournalOptions(flags, recipe, bytes).preparationPolicy,
    'first-return-anchored-v1',
  );
  for (const selected of [
    flags.slice(2),
    [...flags, flags[2]],
    [...flags.slice(0, 2), '--hitch-journal-preparation=any'],
    [...flags.slice(0, 2), '--hitch-journal-preparation'],
  ])
    assert.throws(() => qualificationHitchJournalOptions(selected, recipe, bytes));
  assert.throws(() =>
    qualificationHitchJournalOptions(flags, recipe, Buffer.concat([bytes, Buffer.from(' ')])),
  );
  for (const recipeChange of [
    (r) => {
      r.id = 'other';
    },
    (r) => {
      r.entryPath = 'other/';
    },
    (r) => {
      r.actions[4].selector = '#different';
    },
    (r) => {
      r.actions[4].type = 'reload';
    },
  ]) {
    const changed = structuredClone(recipe);
    recipeChange(changed);
    assert.throws(() => qualificationHitchJournalOptions(flags, changed, bytes));
  }
});

test('declared preparation retains timing but only subsequent positive Solo work grants active coverage', async (t) => {
  const store = createHitchJournalStore(
    join(await temporary(t), 'report.json'),
    () => 0,
    preparationOptions,
  );
  const pre = preparedDocument(
    store.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' }),
  );
  const prepResult = pre.journal.seal(undefined);
  assert.equal(prepResult.header.workScope, 'unobserved-preparation');
  assert.equal(prepResult.header.complete, true);
  assert.equal(prepResult.header.activeFrames, 0);
  assert.equal(recordsOf(prepResult).filter((row) => row.kind === 1).length, 1);
  await store.retain(prepResult, 'before-follow-4');
  const game = activeDocument(
    store.beginDocument({ url: anchoredURL + '?preview=accepted', action: 'follow-4' }),
  );
  await store.retain(game.journal.seal('paused'), 'final');
  assert.equal(store.finish().status, 'complete');
  assert.equal(store.report.activePlayCoverage, 'observed-final-solo');
  assert.equal(store.report.documents.length, 2);
});

test('preparation-only, zero-active and unsubscribed final Solo cannot complete a row', async (t) => {
  for (const mode of [
    'preparation-only',
    'zero-active',
    'unsubscribed',
    'zero-duration',
    'retrograde',
  ]) {
    const store = createHitchJournalStore(
      join(await temporary(t), 'report.json'),
      () => 0,
      preparationOptions,
    );
    const pre = preparedDocument(
      store.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' }),
    );
    await store.retain(pre.journal.seal(undefined), 'before-follow-4');
    if (mode !== 'preparation-only') {
      const game = fixture({ configure: false, subscribe: mode !== 'unsubscribed' });
      game.journal.configure(store.beginDocument({ url: anchoredURL, action: 'follow-4' }));
      if (mode === 'zero-active') {
        game.journal.frame(0, 40, 3, 3);
        game.journal.beginWork(0, 3);
        game.journal.endWork(10, 3);
      } else if (mode === 'zero-duration') {
        game.journal.frame(0, 0, 2, 2);
        game.journal.beginWork(0, 2);
        game.journal.endWork(0, 2);
      } else {
        game.journal.frame(0, 40, 2, 2);
        game.journal.beginWork(0, 2);
        game.journal.endWork(10, 2);
        if (mode === 'retrograde') game.journal.frame(0, 10, 2, 2);
      }
      game.at(40);
      await store.retain(game.journal.seal('paused'), 'final');
    }
    assert.equal(store.finish().status, 'incomplete', mode);
    assert.equal(store.report.activePlayCoverage, 'incomplete', mode);
  }
});

test('wrong document role, location, action and undeclared missing phase are rejected', async (t) => {
  const file = join(await temporary(t), 'report.json');
  for (const request of [
    { url: 'https://other.test/game/playground/', action: 'initial' },
    { url: anchoredURL, action: 'initial' },
    { url: anchoredURL + 'playground/', action: 'follow-4' },
  ]) {
    const store = createHitchJournalStore(file, () => 0, preparationOptions);
    assert.throws(() => store.beginDocument(request));
  }
  const store = createHitchJournalStore(file, () => 0, preparationOptions);
  store.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' });
  assert.throws(() => store.beginDocument({ url: anchoredURL, action: 'follow-5' }));
  assert.throws(() => store.beginDocument({ url: anchoredURL + 'other/', action: 'follow-4' }));
  const f = fixture({ configure: false, subscribe: false });
  assert.throws(
    () =>
      f.journal.configure({
        id: 1,
        records: 1,
        remainingMs: 100,
        identity: {
          role: 'preparation',
          origin: 'https://solo.test',
          path: '/game/playground/',
          action: 'initial',
        },
      }),
    /location/,
  );
  assert.throws(() => fixture().journal.seal(undefined), /boundary/);
  assert.throws(() => fixture().journal.seal('declared-preparation'), /Undeclared/);
});

test('active or subscribed preparation and mismatched export identities cannot gain an exemption', async (t) => {
  for (const action of ['phase', 'frame', 'work', 'subscribe']) {
    const store = createHitchJournalStore(
      join(await temporary(t), 'report.json'),
      () => 0,
      preparationOptions,
    );
    const f = preparedDocument(
      store.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' }),
    );
    if (action === 'phase') {
      f.journal.phase(2, 41);
      f.journal.phase(6, 42);
    }
    if (action === 'frame') f.journal.frame(40, 80, 2, 2);
    if (action === 'work') {
      f.journal.beginWork(40, 2);
      f.journal.endWork(41, 2);
    }
    if (action === 'subscribe') f.journal.subscribe(40);
    assert.throws(() => f.journal.seal(undefined), /Preparation/);
  }
  const store = createHitchJournalStore(
    join(await temporary(t), 'report.json'),
    () => 0,
    preparationOptions,
  );
  const f = preparedDocument(
    store.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' }),
  );
  const result = f.journal.seal(undefined);
  await assert.rejects(store.retain(result, 'before-follow-5'));
  await assert.rejects(
    store.retain(
      {
        ...result,
        header: { ...result.header, identity: { ...result.header.identity, role: 'solo' } },
      },
      'before-follow-4',
    ),
  );
});

test('lost preparatory data and restored document IDs remain incomplete despite a valid final Solo', async (t) => {
  const store = createHitchJournalStore(
    join(await temporary(t), 'report.json'),
    () => 0,
    preparationOptions,
  );
  const old = preparedDocument(
    store.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' }),
  );
  const game = activeDocument(store.beginDocument({ url: anchoredURL, action: 'follow-4' }));
  await assert.rejects(store.retain(old.journal.seal(undefined), 'before-follow-4'), /Lost/);
  await store.retain(game.journal.seal('paused'), 'final');
  assert.equal(store.finish().status, 'incomplete');
  assert.equal(store.report.documents[0].status, 'lost');
  assert.throws(
    () => store.beginDocument({ url: anchoredURL, action: 'follow-4' }),
    /Only the declared/,
  );
});

test('export rejects relocated documents, unreported preparation work and impossible active timestamps', async (t) => {
  const store = createHitchJournalStore(join(await temporary(t), 'report.json'), () => 0, {
    soloURL: anchoredURL,
  });
  const game = activeDocument(store.beginDocument({ url: anchoredURL, action: 'initial' }));
  game.environment.location.pathname = '/unrelated/';
  assert.throws(() => game.journal.seal('paused'), /location changed/);
  game.environment.location.pathname = '/game/';
  const result = game.journal.seal('paused');
  await assert.rejects(
    store.retain(
      { ...result, header: { ...result.header, lastActiveAt: result.header.endedAt + 1 } },
      'final',
    ),
    /timestamps/,
  );
  await store.retain(result, 'final');
  assert.equal(store.finish().status, 'complete');
  const prepStore = createHitchJournalStore(
    join(await temporary(t), 'report.json'),
    () => 0,
    preparationOptions,
  );
  const prep = preparedDocument(
    prepStore.beginDocument({ url: anchoredURL + 'playground/', action: 'initial' }),
  );
  prep.journal.beginWork(41, 6);
  prep.journal.endWork(42, 6);
  assert.throws(() => prep.journal.seal(undefined), /Preparation/);
});

test('large document identities cannot exhaust the reserved serialized failure budget', async (t) => {
  const url = anchoredURL + 'x'.repeat(1000);
  const store = createHitchJournalStore(join(await temporary(t), 'report.json'), () => 0, {
    soloURL: url,
  });
  let rejected = 0;
  for (let i = 0; i < 64; i++) {
    try {
      store.beginDocument({ url, action: 'x'.repeat(128) });
    } catch (error) {
      assert.match(error.message, /descriptor cap/);
      rejected++;
    }
    store.fail('\0'.repeat(256));
  }
  assert(rejected > 0);
  assert.equal(store.finish().status, 'incomplete');
  assert(Buffer.byteLength(JSON.stringify(store.report)) <= HITCH_LIMITS.descriptorBytes);
});
