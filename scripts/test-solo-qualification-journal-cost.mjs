import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import {
  JOURNAL_COST_LIMITS,
  qualificationJournalCostOptions,
  createBrowserJournalCostProbe,
  journalCostInitScript,
} from './solo-qualification-journal-cost.mjs';
import {
  createBrowserHitchJournal,
  hitchJournalInitScript,
} from './solo-qualification-hitch-journal.mjs';
import {
  createRafIntervalClock,
  frozenExternalCadence,
} from './solo-qualification-observation.mjs';

function fixture(options = {}) {
  let now = 0;
  const environment = { performance: { now: () => now, timeOrigin: 1000 } };
  const meter = createBrowserJournalCostProbe(options, environment);
  return {
    meter,
    environment,
    at(value) {
      now = value;
    },
    hook(kind, start, end) {
      now = start;
      meter.begin(kind);
      now = end;
      meter.end();
    },
    work(start, end) {
      now = start;
      meter.beginWork(start);
      now = end;
      meter.endWork(end);
    },
    finish(at = now) {
      now = at;
      meter.phase(3);
      return meter.export();
    },
  };
}

test('cost admission is opt-in, strict and restricted to the exact 30-second public route', async () => {
  const bytes = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
      import.meta.url,
    ),
  );
  const scenario = JSON.parse(bytes);
  assert.equal(qualificationJournalCostOptions([], scenario, bytes), null);
  assert.equal(
    qualificationJournalCostOptions(['--work-probe', '--journal-cost-probe'], scenario, bytes),
    JOURNAL_COST_LIMITS,
  );
  assert.equal(
    qualificationJournalCostOptions(
      ['--work-probe', '--hitch-journal', '--journal-cost-probe'],
      scenario,
      bytes,
    ),
    JOURNAL_COST_LIMITS,
  );
  for (const flags of [
    ['--journal-cost-probe'],
    ['--work-probe', '--journal-cost-probe=true'],
    ['--work-probe', '--journal-cost-probe', '--journal-cost-probe'],
    ...['--audio-proof', '--audio-proof-import-events', '--memory-profile', '--cpu-profile'].map(
      (flag) => ['--work-probe', '--journal-cost-probe', flag],
    ),
  ])
    assert.throws(() => qualificationJournalCostOptions(flags, scenario, bytes));
  assert.throws(() =>
    qualificationJournalCostOptions(
      ['--work-probe', '--journal-cost-probe'],
      scenario,
      Buffer.concat([bytes, Buffer.from(' ')]),
    ),
  );
  assert.throws(() =>
    qualificationJournalCostOptions(
      ['--work-probe', '--journal-cost-probe'],
      { ...scenario, timeoutMs: 2400000 },
      bytes,
    ),
  );
});

test('endpoint union includes initial, between-frame and final costs without double counting begin work', () => {
  const f = fixture(),
    m = f.meter;
  m.phase(2);
  f.hook(0, 1, 3);
  f.at(10);
  m.beginWork(10);
  f.hook(3, 11, 13);
  f.at(20);
  m.endWork(20);
  f.hook(4, 21, 23);
  f.hook(1, 24, 28);
  f.work(30, 40);
  f.hook(5, 41, 44);
  const result = f.finish();
  assert.equal(result.status, 'complete');
  assert.equal(result.appMs, 20);
  assert.equal(result.hookMs, 13);
  assert.equal(result.insideMs, 2);
  assert.equal(result.outsideMs, 11);
  assert.equal(result.combinedMs, 31);
  assert.deepEqual(result.rows, [10, 20, 2, 2, 10, 2, 2, 12, 30, 40, 2, 2, 10, 0, 6, 16]);
  assert.equal(result.initialByPhase[2], 2);
  assert.equal(result.unassignedTailByPhase[2], 3);
  assert.equal(result.maximumUnassignedTailMs, 3);
  assert.equal(result.envelopeRequiresTailAssessment, true);
  assert.equal(
    result.rows[7] + result.rows[15] + result.unassignedTailByPhase[2],
    result.combinedMs,
  );
  assert.equal(result.bufferBytes, 3145728);
  assert.throws(() => m.export(), /once/);
});

test('hooks crossing work endpoints intersect exactly, including two application windows', () => {
  const f = fixture(),
    m = f.meter;
  m.phase(2);
  f.at(1);
  m.begin(5);
  f.at(2);
  m.beginWork(2);
  f.at(4);
  m.endWork(4);
  f.at(6);
  m.beginWork(6);
  f.at(8);
  m.endWork(8);
  f.at(10);
  m.end();
  const result = f.finish();
  assert.equal(result.appMs, 4);
  assert.equal(result.insideMs, 4);
  assert.equal(result.outsideMs, 5);
  assert.equal(result.combinedMs, 9);
  assert.deepEqual(result.rows, [2, 4, 2, 2, 2, 2, 1, 3, 6, 8, 2, 2, 2, 2, 2, 4]);
  assert.equal(result.unassignedTailByPhase[2], 2);
});

test('endpoint intersection agrees with an independent discrete union oracle across staggered schedules', () => {
  for (let shift = 0; shift < 12; shift++) {
    const f = fixture(),
      events = [],
      app = new Set(),
      hook = new Set();
    f.meter.phase(2);
    for (let i = 0; i < 20; i++) {
      const start = 2 + i * 10,
        end = start + 5;
      events.push([start, 0], [end, 1]);
      for (let t = start; t < end; t++) app.add(t);
      const a = 1 + i * 10 + shift,
        b = a + 7;
      events.push([a, 2], [b, 3]);
      for (let t = a; t < b; t++) hook.add(t);
    }
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [at, kind] of events) {
      f.at(at);
      if (kind === 0) f.meter.beginWork(at);
      else if (kind === 1) f.meter.endWork(at);
      else if (kind === 2) f.meter.begin(5);
      else f.meter.end();
    }
    const result = f.finish();
    assert.equal(result.status, 'complete');
    assert.equal(result.combinedMs, new Set([...app, ...hook]).size);
    assert.equal(result.insideMs, [...hook].filter((t) => app.has(t)).length);
    assert.equal(
      result.rows.filter((_, i) => i % 8 === 7).reduce((a, b) => a + b, 0) +
        result.unassignedTailByPhase.reduce((a, b) => a + b, 0),
      result.combinedMs,
    );
  }
});

test('phase changes retain mixed spans and costs without assigning them to active windows', () => {
  const f = fixture(),
    m = f.meter;
  m.phase(1);
  f.hook(2, 1, 2);
  m.phase(2);
  f.work(3, 5);
  f.at(6);
  m.beginWork(6);
  f.at(7);
  m.phase(3);
  f.at(8);
  m.endWork(8);
  f.at(9);
  m.begin(2);
  m.phase(2);
  f.at(10);
  m.end();
  f.work(11, 13);
  const result = f.finish();
  assert.equal(result.status, 'complete');
  assert.equal(result.mixedWindows, 1);
  assert.equal(result.mixedHooks, 1);
  assert.equal(result.unassignedTailByPhase[1], 1);
  assert.equal(result.unassignedTailByPhase[6], 1);
  assert.equal(result.rows[7], 2);
  assert.equal(result.rows[23], 2);
  assert.equal(result.combinedMs, 8);
});

test('on/off controls use the same meter and preserve raw application spans', () => {
  const arm = (duration) => {
    const f = fixture();
    f.meter.phase(2);
    f.at(1);
    f.meter.beginWork(1);
    f.hook(3, 2, 2 + duration);
    f.at(10);
    f.meter.endWork(10);
    f.hook(4, 11, 11 + duration);
    return f.finish();
  };
  const off = arm(0),
    on = arm(2);
  assert.deepEqual(off.rows.slice(0, 5), on.rows.slice(0, 5));
  assert.equal(off.combinedMs, 9);
  assert.equal(on.combinedMs, 11);
  assert.equal(off.hooks, on.hooks);
  assert.equal(off.kindTotals[3 * 2], 1);
  assert.equal(on.kindTotals[4 * 2], 1);
});

test('nested, unclosed, malformed, retrograde and exhausted observations fail explicitly', () => {
  for (const mutate of [
    (f) => {
      f.at(1);
      f.meter.begin(0);
      f.meter.begin(1);
      f.at(2);
      f.meter.end();
    },
    (f) => {
      f.at(1);
      f.meter.begin(0);
    },
    (f) => {
      f.at(1);
      f.meter.beginWork(1);
    },
    (f) => {
      f.at(1);
      f.meter.end();
    },
    (f) => {
      f.at(1);
      f.meter.endWork(1);
    },
    (f) => {
      f.hook(0, 2, 1);
    },
    (f) => {
      f.meter.phase(8);
    },
    (f) => {
      f.hook(8, 1, 2);
    },
    (f) => {
      f.environment.performance.timeOrigin++;
    },
    (f) => {
      f.hook(0, 240001, 240002);
    },
  ]) {
    const f = fixture();
    f.meter.phase(2);
    mutate(f);
    const result = f.finish();
    assert.equal(result.status, 'incomplete');
    assert(result.errors > 0);
  }
  const f = fixture({ windows: 1, hooks: 1 });
  f.meter.phase(2);
  f.work(1, 2);
  f.work(3, 4);
  f.hook(0, 5, 6);
  f.hook(0, 7, 8);
  const result = f.finish();
  assert.equal(result.status, 'incomplete');
  assert(result.errors & 32);
  assert.equal(result.windows, 1);
  assert.equal(result.hooks, 1);
  assert.equal(result.bufferBytes, 72);
  for (const options of [{ windows: 16385 }, { hooks: 65537 }, { windows: 0 }, { hooks: -1 }])
    assert.throws(() => fixture(options));
});

test('zero active work cannot become complete and active serialization is prohibited', () => {
  const empty = fixture();
  assert.equal(empty.finish().status, 'incomplete');
  const f = fixture();
  f.meter.phase(2);
  f.work(1, 2);
  assert.throws(() => f.meter.export(), /non-running/);
  assert.equal(f.finish().status, 'complete');
});

test('initial missing, nonfinite and negative clock identity cannot produce complete evidence', () => {
  for (const [initial, origin] of [
    [NaN, 1],
    [-1, 1],
    [0, undefined],
    [0, NaN],
    [0, -1],
    [0, Infinity],
  ]) {
    let now = initial;
    const meter = createBrowserJournalCostProbe(
      {},
      { performance: { now: () => now, timeOrigin: origin } },
    );
    meter.phase(2);
    now = 1;
    meter.beginWork(1);
    now = 2;
    meter.endWork(2);
    meter.phase(3);
    const result = meter.export();
    assert.equal(result.status, 'incomplete');
    assert(result.errors & 1);
  }
});

test('native callback cost covers entry extraction and does not confuse older native timestamps', () => {
  const f = fixture();
  let callback;
  Object.assign(f.environment, {
    soloQualificationJournalCost: f.meter,
    document: { hidden: false, hasFocus: () => true, addEventListener() {} },
    addEventListener() {},
    PerformanceObserver: class {
      static supportedEntryTypes = ['longtask'];
      constructor(fn) {
        callback = fn;
      }
      observe() {}
    },
  });
  const journal = createBrowserHitchJournal({ costProbe: true }, f.environment);
  f.meter.phase(2);
  f.work(1, 2);
  f.at(100);
  callback(
    {
      getEntries: () => {
        f.at(103);
        return [{ startTime: 1, duration: 50 }];
      },
    },
    null,
    {},
  );
  const result = f.finish();
  assert.equal(result.status, 'complete');
  assert.equal(result.kindTotals[5 * 2 + 1], 3);
  assert.equal(result.unassignedTailByPhase[2], 3);
  assert.equal(journal.state().nativeDropped, null);
});

test('actual combined installer creates meter before journal and skips child frames; default remains original', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const first = source.indexOf('  function addQualificationProbe('),
    end = source.indexOf('  await addQualificationProbe(', first);
  const calls = [];
  const install = vm.runInNewContext('(' + source.slice(first, end).trim() + ')', {
    hitchStore: {},
    observationInitScript: 'window.ready = true;',
    hitchModule: { hitchJournalInitScript },
    journalCostModule: { journalCostInitScript },
    page: { addInitScript: (...args) => calls.push(args) },
  });
  install(
    function () {
      if (
        !globalThis.window.ready ||
        !globalThis.window.soloQualificationJournalCost ||
        !globalThis.window.soloQualificationHitchJournal
      )
        throw Error('Ordered dependencies missing');
      globalThis.window.installed = true;
    },
    { journalCost: true },
  );
  const env = {
    performance: { now: () => 0, timeOrigin: 1 },
    document: { hidden: false, hasFocus: () => true, addEventListener() {} },
    addEventListener() {},
  };
  env.window = env;
  env.top = env;
  vm.runInNewContext(calls[0][0], env);
  assert.equal(env.installed, true);
  const child = { top: {} };
  child.window = child;
  vm.runInNewContext(calls[0][0], child);
  assert.equal(child.installed, undefined);
  assert.equal(child.soloQualificationJournalCost, undefined);
  const plain = vm.runInNewContext('(' + source.slice(first, end).trim() + ')', {
    hitchStore: null,
    page: { addInitScript: (...args) => calls.push(args) },
  });
  const fn = () => {},
    options = { journalCost: false };
  plain(fn, options);
  assert.deepEqual(calls[1], [fn, options]);
});

test('actual collector keeps ordinary app counters byte-equivalent and meters 30 seconds at 144Hz', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const marker = '  await addQualificationProbe(\n',
    first = source.indexOf(marker) + marker.length;
  const end = source.indexOf('    {\n      bounds: FRAME_BOUNDS,', first);
  const factory = source.slice(first, end).trim().replace(/,$/, '');
  const run = (enabled, journalEnabled) => {
    const f = fixture();
    let next, onPhase;
    const events = new Map(),
      work = new Map();
    const env = f.environment;
    env.window = env;
    env.document = {
      body: { dataset: { flightState: 'briefing' } },
      hidden: false,
      hasFocus: () => true,
      addEventListener: (name, callback) => events.set(name, callback),
    };
    env.addEventListener = () => {};
    env.MutationObserver = class {
      constructor(fn) {
        onPhase = fn;
      }
      observe() {}
    };
    env.requestAnimationFrame = (fn) => {
      next = fn;
    };
    env.HTMLMediaElement = class {
      play() {
        return Promise.resolve();
      }
    };
    env.soloQualificationIntervalClock = (at) => createRafIntervalClock(at, env.performance.now);
    env.soloQualificationFrozenCadence = frozenExternalCadence;
    env.soloQualificationReadiness = () => ({});
    if (enabled) env.soloQualificationJournalCost = f.meter;
    if (journalEnabled)
      env.soloQualificationHitchJournal = createBrowserHitchJournal({ costProbe: enabled }, env);
    vm.runInNewContext(
      '(' + factory + ')',
      env,
    )({
      bounds: [33, 50, 100, 250, null],
      workProbe: true,
      externalCadenceCalibration: null,
      hitchJournal: journalEnabled,
      journalCost: enabled,
    });
    env.Phaser = {
      Game: class {
        constructor() {
          this.events = { on: (name, fn) => work.set(name, fn) };
        }
      },
      Core: { Events: { PRE_STEP: 'pre', POST_RENDER: 'post' } },
    };
    new env.Phaser.Game();
    events.get('DOMContentLoaded')();
    env.soloQualificationProbe.startApplicationProbe();
    next(0);
    env.document.body.dataset.flightState = 'running';
    onPhase();
    for (let i = 1; i <= 4320; i++) {
      const at = (i * 1000) / 144;
      f.at(at);
      work.get('pre')();
      f.at(at + 2.25);
      work.get('post')();
      next(at);
    }
    env.document.body.dataset.flightState = 'paused';
    onPhase();
    const snapshot = JSON.parse(JSON.stringify(env.soloQualificationProbe.export()));
    const cost = enabled ? f.meter.export() : null;
    return { snapshot, cost };
  };
  const normal = run(false, false),
    off = run(true, false),
    on = run(true, true);
  for (const result of [off, on]) {
    const { journalCost, hitchJournal, ...unchanged } = result.snapshot;
    assert(journalCost);
    assert.equal(Object.hasOwn(journalCost, 'rows'), false);
    assert.deepEqual(unchanged, normal.snapshot);
    assert.equal(result.cost.status, 'complete');
    assert.equal(result.cost.windows, 4320);
    assert.equal(result.cost.hooks, 12965);
    assert.equal(result.cost.activeWindows, 4320);
    assert.equal(result.cost.mixedHooks, 3);
    assert.equal(result.cost.appMs, 9720);
  }
  assert.equal(JSON.stringify(off.snapshot.work), JSON.stringify(normal.snapshot.work));
  assert.equal(JSON.stringify(on.snapshot.work), JSON.stringify(normal.snapshot.work));
});

test('actual final read preserves partial cost and invalidates missing or replaced documents', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('      if (journalCostOptions) {\n        report.journalCost =');
  const end = source.indexOf('      const probe = report.finalState.probe;', start);
  assert(start > 0 && end > start);
  for (const documents of [0, 1, 2]) {
    const report = {},
      partial = { status: 'complete', appMs: 10, outsideMs: 250, combinedMs: 260 };
    const run = vm.runInNewContext('(async () => {' + source.slice(start, end) + '})', {
      journalCostOptions: {},
      report,
      page: { evaluate: async () => partial },
      hitchStore: null,
      journalCostDocuments: documents,
    });
    await run();
    assert.equal(report.journalCost.status, documents === 1 ? 'complete' : 'incomplete');
    assert.equal(report.journalCost.combinedMs, 260);
    assert.equal(report.journalCost.documents, documents);
  }
});
