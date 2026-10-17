import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext, createContext, runInContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createSelectedFontSettlementProbe,
  createSelectedFontSettlementOwner,
  assertSelectedFontSettlementEvidence,
  assertSelectedFontSettlementCancelled,
  assessSelectedFontSettlementReadiness,
  createBrowserReadinessProbe,
  selectedFont,
  qualificationReadinessOptions,
  SELECTED_FONT_SETTLEMENT_PILOT,
  SELECTED_FONT_SOURCE_BINDING,
} from './solo-qualification-readiness.mjs';
const target = "600 16px 'Field Kit Display', 'Handjet', sans-serif";
const sample = 'Workshop Майстерня 012345';
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function face(status = 'unloaded') {
  const d = deferred();
  const value = {
    family: 'Field Kit Display',
    weight: '600',
    style: 'normal',
    stretch: 'normal',
    unicodeRange: 'U+0-10FFFF',
    display: 'swap',
    status,
    loaded: d.promise,
    load() {
      throw Error('Diagnostic must not invoke extra face load');
    },
  };
  return { value, ...d };
}
function harness({ serialized = false, entries = [], original } = {}) {
  let clock = 0,
    count = 0;
  const native = deferred(),
    listeners = new Map(),
    windows = new Map();
  const nativeLoad =
    original ??
    function (...args) {
      count++;
      assert.equal(this, fonts);
      assert.deepEqual(args, [target, sample]);
      return native.promise;
    };
  const fonts = {
    load: nativeLoad,
    [Symbol.iterator]: () => entries.map((f) => f.value)[Symbol.iterator](),
    addEventListener: (n, f) => listeners.set(n, f),
    removeEventListener: (n, f) => {
      if (listeners.get(n) === f) listeners.delete(n);
    },
  };
  const env = {
    document: {
      fonts,
      body: { dataset: { flightState: 'briefing' } },
      baseURI: 'https://example.test/game/',
      styleSheets: [
        {
          href: 'https://example.test/game/ui/field-kit-fonts.css',
          cssRules: [
            {
              type: 5,
              style: {
                getPropertyValue: (key) =>
                  ({
                    'font-family': "'Field Kit Display'",
                    'font-weight': '600',
                    'font-style': 'normal',
                    'font-display': 'swap',
                    src: "url('./fonts/field-kit/handjet-display-600.woff2') format('woff2')",
                  })[key],
              },
            },
          ],
        },
      ],
    },
    performance: { now: () => clock },
    addEventListener: (n, f) => windows.set(n, f),
    removeEventListener: (n, f) => {
      if (windows.get(n) === f) windows.delete(n);
    },
  };
  const make = serialized
    ? runInNewContext(`(${createSelectedFontSettlementProbe.toString()})`, { TextEncoder, URL })
    : createSelectedFontSettlementProbe;
  const probe = make(env);
  return {
    probe,
    env,
    fonts,
    entries,
    native,
    listeners,
    windows,
    nativeLoad,
    setClock: (v) => {
      clock = v;
    },
    count: () => count,
    emit: (n) => listeners.get(n)?.({ type: n }),
  };
}
test('actual serialized observer distinguishes unused duplicate from swap-error pending demand with original promise identity', async () => {
  for (const serialized of [false, true]) {
    const unused = face(),
      requested = face('error'),
      h = harness({ serialized, entries: [unused, requested] });
    assert.equal(h.count(), 0);
    h.probe.boundary('before-selection');
    assert.equal(h.fonts.load(target, sample), h.native.promise);
    assert.equal(h.count(), 1);
    h.setClock(10);
    h.probe.boundary('cancel-command-complete');
    let out = h.probe.export();
    assert.equal(out.faces[0].id, 1);
    assert.equal(out.faces[1].id, 2);
    assert.equal(out.boundaries[1].faces[1].status, 'error');
    assert.equal(out.faces[1].settlement, 'unsettled-observed');
    requested.value.status = 'loaded';
    requested.resolve(requested.value);
    h.native.resolve([requested.value]);
    await flush();
    h.setClock(20);
    h.probe.boundary('after-original-release');
    out = h.probe.export();
    assert.equal(out.faces[0].settlement, 'unsettled-observed');
    assert.equal(out.faces[1].settlement, 'fulfilled');
    assert.deepEqual([...out.calls[0].faces], [2]);
    assert.equal(out.calls[0].settlement, 'fulfilled');
    assert.equal(out.invalid, false);
    assert.equal(out.overflow, false);
    assert.equal(h.count(), 1);
    h.probe.dispose();
    assert.equal(h.fonts.load, h.nativeLoad);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.windows.size, 0);
  }
});
test('early native face and original-demand rejection are retained separately from public error status', async () => {
  const f = face('error'),
    h = harness({ entries: [f] });
  h.probe.boundary('before-selection');
  const p = h.fonts.load(target, sample);
  const error = new DOMException('font network rejected', 'NetworkError');
  f.reject(error);
  h.native.reject(error);
  await assert.rejects(p, (e) => e === error);
  await flush();
  h.probe.boundary('cancel-command-complete');
  const out = h.probe.export();
  assert.equal(out.faces[0].settlement, 'rejected');
  assert.equal(out.faces[0].error.name, 'NetworkError');
  assert.equal(out.calls[0].settlement, 'rejected');
  h.probe.dispose();
});
test('late discovered face uses stable object identity across reorder/removal and cannot impersonate replacement', async () => {
  const a = face('loading'),
    h = harness();
  h.entries.push(a);
  h.emit('loading');
  h.probe.boundary('before-selection');
  const b = face('loading');
  h.entries.splice(0, 1, b);
  h.emit('loading');
  h.fonts.load(target, sample);
  h.probe.boundary('cancel-command-complete');
  b.resolve(b.value);
  h.native.resolve([b.value]);
  await flush();
  const out = h.probe.export();
  assert.deepEqual(
    out.faces.map((x) => x.id),
    [1, 2],
  );
  assert.deepEqual(out.calls[0].faces, [2]);
  h.probe.dispose();
});
test('unrelated native requests preserve receiver, arguments, return and errors without extra observation', () => {
  let args, receiver;
  const result = {};
  const original = function (...a) {
    args = a;
    receiver = this;
    return result;
  };
  const h = harness({ original });
  const other = {};
  assert.equal(h.fonts.load.call(other, '400 12px unrelated', 'x'), result);
  assert.equal(receiver, other);
  assert.deepEqual(args, ['400 12px unrelated', 'x']);
  assert.equal(h.probe.export().calls.length, 0);
  h.probe.dispose();
  const error = Error('original synchronous error');
  const j = harness({
    original() {
      throw error;
    },
  });
  assert.throws(
    () => j.fonts.load(target, sample),
    (e) => e === error,
  );
  assert.equal(j.probe.export().calls[0].settlement, 'threw');
  j.probe.dispose();
});
test('observer clock/read errors never suppress original font demand', () => {
  const f = face(),
    h = harness({ entries: [f] });
  h.setClock(NaN);
  assert.equal(h.fonts.load(target, sample), h.native.promise);
  assert.equal(h.count(), 1);
  assert.equal(h.probe.export().invalid, true);
  h.probe.dispose();
  const hostile = face();
  Object.defineProperty(hostile.value, 'loaded', {
    get() {
      throw Error('unavailable');
    },
  });
  const j = harness({ entries: [hostile] });
  assert.equal(j.probe.export().invalid, true);
  assert.equal(j.fonts.load(target, sample), j.native.promise);
  j.probe.dispose();
});
test('bounded inventories/calls/events fail closed without stopping application demand', () => {
  const h = harness({ entries: Array.from({ length: 9 }, () => face()) });
  assert.equal(h.probe.export().overflow, true);
  for (let i = 0; i < 12; i++) h.fonts.load(target, sample);
  assert.equal(h.count(), 12);
  assert.equal(h.probe.export().calls.length, 8);
  for (let i = 0; i < 50; i++) h.emit('loading');
  assert.equal(h.probe.export().events.length, 32);
  assert.equal(h.probe.export().overflow, true);
  h.probe.dispose();
});
test('disposal restores only owned wrapper and makes late rejection harmless and evidence immutable', async () => {
  const f = face('error'),
    h = harness({ entries: [f] });
  const p = h.fonts.load(target, sample);
  h.probe.dispose();
  const before = h.probe.export();
  f.reject(Error('late'));
  h.native.reject(Error('late request'));
  await assert.rejects(p);
  await flush();
  assert.deepEqual(h.probe.export(), before);
  const j = harness();
  const replacement = () => Promise.resolve([]);
  j.fonts.load = replacement;
  j.probe.dispose();
  assert.equal(j.fonts.load, replacement);
  assert.equal(j.probe.export().invalid, true);
});
test('no active sampling or invalid boundary order, exported evidence owns its data', () => {
  const h = harness({ entries: [face()] });
  assert.throws(() => h.probe.boundary('cancel-command-complete'));
  h.probe.boundary('before-selection');
  assert.throws(() => h.probe.boundary('before-selection'));
  const out = h.probe.export();
  out.faces[0].descriptors.family = 'mutated';
  assert.equal(h.probe.export().faces[0].descriptors.family, 'Field Kit Display');
  h.env.document.body.dataset.flightState = 'running';
  assert.throws(() => h.probe.boundary('cancel-command-complete'));
  assert.throws(() => h.probe.export());
  h.probe.dispose();
});
test('copied exact theme resource preparation makes only its original three load calls and exact display request is observed', async () => {
  const source = await readFile(
    new URL('../game/presentation/theme-host.mjs', import.meta.url),
    'utf8',
  );
  const start = source.indexOf('  const prepareResources = async (resolved) => {'),
    end = source.indexOf('\n  const accept =', start);
  assert(start >= 0 && end > start);
  const body = source
    .slice(start, end)
    .replace('  const prepareResources =', 'const prepareResources =');
  const f = face('error');
  let calls = 0;
  const promise = Promise.resolve([f.value]);
  const h = harness({
    entries: [f],
    original() {
      calls++;
      return promise;
    },
  });
  const prepare = new Function(
    'doc',
    'prepareStyles',
    `let styles; ${body}; return prepareResources;`,
  )(h.env.document, () => Promise.resolve());
  h.probe.boundary('before-selection');
  await prepare({
    interfaceId: 'dnipro-porcelain',
    revision: 'r1',
    fonts: {
      display: "'Field Kit Display', 'Handjet', sans-serif",
      ui: "'Field Kit UI', sans-serif",
      mono: "'Field Kit Mono', monospace",
    },
  });
  await flush();
  assert.equal(calls, 3);
  assert.equal(h.probe.export().calls.length, 1);
  assert.equal(h.probe.export().calls[0].settlement, 'fulfilled');
  h.probe.dispose();
});

test('loaded promise observation precedes selection and late CSS faces retain separate enrollment', () => {
  const initial = face();
  let reads = 0;
  Object.defineProperty(initial.value, 'loaded', {
    get() {
      reads++;
      return initial.promise;
    },
  });
  const h = harness({ entries: [initial] });
  assert.equal(reads, 1);
  assert.equal(h.count(), 0);
  h.probe.boundary('before-selection');
  const late = face();
  h.entries.push(late);
  h.emit('loading');
  const out = h.probe.export();
  assert.equal(out.faces[0].firstSeenBoundaryCount, 0);
  assert.equal(out.faces[1].firstSeenBoundaryCount, 1);
  assert.equal(reads, 1);
  h.probe.dispose();
});

test('backward clock invalidates evidence without suppressing original demand', () => {
  const h = harness({ entries: [face()] });
  h.setClock(10);
  h.probe.boundary('before-selection');
  h.setClock(9);
  assert.equal(h.fonts.load(target, sample), h.native.promise);
  assert.equal(h.count(), 1);
  assert.equal(h.probe.export().invalid, true);
  h.probe.dispose();
});

test('partial observer installation restores the exact original method and removes established listeners', () => {
  const native = () => Promise.resolve([]),
    listeners = new Map();
  let adds = 0;
  const fonts = {
    load: native,
    [Symbol.iterator]: function* () {},
    addEventListener(n, f) {
      if (++adds === 2) throw Error('listener unavailable');
      listeners.set(n, f);
    },
    removeEventListener(n) {
      listeners.delete(n);
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(fonts, 'load');
  assert.throws(
    () => createSelectedFontSettlementProbe({ document: { fonts }, performance: { now: () => 0 } }),
    /listener unavailable/,
  );
  assert.deepEqual(Object.getOwnPropertyDescriptor(fonts, 'load'), descriptor);
  assert.equal(listeners.size, 0);
  const frozen = { ...fonts };
  Object.defineProperty(frozen, 'load', { value: native, configurable: false, writable: false });
  assert.throws(() =>
    createSelectedFontSettlementProbe({
      document: { fonts: frozen },
      performance: { now: () => 0 },
    }),
  );
  assert.equal(frozen.load, native);
  assert.equal(listeners.size, 0);
});

function ownerHarness() {
  const unused = face(),
    requested = face('error'),
    h = harness({ entries: [unused, requested] });
  h.probe.dispose();
  const context = createContext({ ...h.env, TextEncoder, URL });
  context.window = context;
  const calls = [],
    timers = new Map();
  let clock = 0,
    serial = 0,
    interceptor = null;
  const evaluate = (body, arg) => {
    calls.push(
      typeof body === 'string'
        ? 'install'
        : String(body).includes('probe.dispose()')
          ? 'close'
          : 'boundary',
    );
    if (interceptor) return interceptor(body, arg);
    return Promise.resolve(
      JSON.parse(
        JSON.stringify(
          runInContext(
            typeof body === 'string' ? body : `(${body.toString()})(${JSON.stringify(arg)})`,
            context,
          ),
        ),
      ),
    );
  };
  const owner = createSelectedFontSettlementOwner({
    page: { evaluate },
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = ++serial;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    ...h,
    unused,
    requested,
    owner,
    context,
    calls,
    timers,
    setOwnerClock(v) {
      clock = v;
    },
    setIntercept(fn) {
      interceptor = fn;
    },
    expire() {
      const timer = [...timers.values()].at(-1);
      assert(timer);
      clock += timer.ms;
      timer.fn();
    },
  };
}
async function completedOwner() {
  const h = ownerHarness();
  await h.owner.install();
  assert.equal(h.fonts.load(target, sample), h.native.promise);
  h.setClock(100);
  await h.owner.boundary('cancel-command-complete');
  h.setClock(500);
  h.requested.value.status = 'loaded';
  h.requested.resolve(h.requested.value);
  h.native.resolve([h.requested.value]);
  await flush();
  h.setClock(525);
  await h.owner.boundary('after-original-release');
  await h.owner.close();
  return h;
}
test('bounded actual serialized setup and paused readback retain requested identity and dispose the original wrapper', async () => {
  const h = await completedOwner(),
    out = h.owner.snapshot();
  assert.equal(out.closed, true);
  assert.equal(out.stopped, false);
  assert.equal(h.fonts.load, h.nativeLoad);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.calls, ['install', 'boundary', 'boundary', 'close']);
  assertSelectedFontSettlementEvidence(out.evidence, 3);
  assert.deepEqual(out.evidence.calls[0].faces, [2]);
  assert.equal(out.evidence.faces[0].settlement, 'unsettled-observed');
  assert.equal(out.evidence.faces[1].settlement, 'fulfilled');
});
test('stalled install is retained as unsettled, blocks boundary and never races cleanup; late rejection is handled', async () => {
  const h = ownerHarness(),
    pending = deferred();
  h.setIntercept(() => pending.promise);
  const installing = h.owner.install();
  await flush();
  h.expire();
  await assert.rejects(installing, /timeout/);
  await h.owner.close();
  await assert.rejects(h.owner.boundary('cancel-command-complete'));
  assert.deepEqual(h.calls, ['install']);
  assert.equal(h.owner.snapshot().closed, false);
  assert.equal(h.owner.snapshot().operations[0].settled, false);
  pending.reject(Error('late install failure'));
  await flush();
  assert.equal(h.owner.snapshot().operations[0].settled, true);
  assert.equal(h.owner.snapshot().stopped, true);
  assert.equal(h.timers.size, 0);
});
test('late readback, pre-invocation clock jump, invalid clock, failed cleanup and no deadline renewal fail closed', async () => {
  for (const variant of ['late', 'pre', 'invalid', 'cleanup', 'global']) {
    const h = ownerHarness();
    if (variant === 'pre' || variant === 'invalid') {
      const installing = h.owner.install();
      h.setOwnerClock(variant === 'pre' ? 3000 : NaN);
      await assert.rejects(installing);
      assert.equal(h.calls.length, 0);
    } else {
      await h.owner.install();
      if (variant === 'cleanup') {
        h.setIntercept(() => Promise.reject(Error('dispose failed')));
        await assert.rejects(h.owner.close(), /dispose failed/);
        assert.equal(h.owner.snapshot().closed, false);
      } else if (variant === 'global') {
        h.setOwnerClock(60000);
        await assert.rejects(h.owner.boundary('cancel-command-complete'), /deadline/);
        assert.deepEqual(h.calls, ['install']);
      } else {
        const pending = deferred();
        h.setIntercept(() => pending.promise);
        const reading = h.owner.boundary('cancel-command-complete');
        await flush();
        h.setOwnerClock(2001);
        pending.resolve({});
        await assert.rejects(reading, /Late/);
      }
    }
    assert.equal(h.owner.snapshot().stopped, true);
    assert.equal(h.timers.size, 0);
  }
});
test('direct source rule observation rejects changed path, weight, display, duplicate and oversized rule lists', () => {
  for (const mutate of [
    (h) => (h.env.document.styleSheets[0].href = 'https://other.test/game/ui/field-kit-fonts.css'),
    (h) => h.env.document.styleSheets.push(h.env.document.styleSheets[0]),
    (h) => (h.env.document.styleSheets[0].cssRules = Array(9).fill({})),
    (h) => {
      const original = h.env.document.styleSheets[0].cssRules[0].style.getPropertyValue;
      h.env.document.styleSheets[0].cssRules[0].style.getPropertyValue = (k) =>
        k === 'font-weight' ? '400' : original(k);
    },
    (h) => {
      const original = h.env.document.styleSheets[0].cssRules[0].style.getPropertyValue;
      h.env.document.styleSheets[0].cssRules[0].style.getPropertyValue = (k) =>
        k === 'font-display' ? 'block' : original(k);
    },
  ]) {
    const h = harness({ entries: [face()] });
    mutate(h);
    assert.throws(() => {
      h.probe.boundary('before-selection');
      assertSelectedFontSettlementEvidence(h.probe.export(), 1);
    });
    h.probe.dispose();
  }
});

test('exact source, fixture and opt-in remain separate from immutable V3 and retain every public action', async () => {
  const fixture = new URL(
    '../docs/performance/fixtures/solo-readiness-font/selected-font-request-settlement-v4.qualification.fixture',
    import.meta.url,
  );
  const bytes = await readFile(fixture),
    scenario = JSON.parse(bytes);
  const flags = [
    '--readiness-probe=selected-font-request-settlement-v4',
    '--readiness-cancel-boundary=post-command-v3',
    '--source-revision=' + SELECTED_FONT_SETTLEMENT_PILOT.sourceRevision,
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--server-fixture-access',
  ];
  assert.deepEqual(
    qualificationReadinessOptions(flags, scenario, bytes),
    SELECTED_FONT_SETTLEMENT_PILOT,
  );
  const old = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-readiness-font/selected-font-cancel-post-command-v3.qualification.fixture',
        import.meta.url,
      ),
    ),
  );
  for (const key of ['actions', 'expectedReplayDefinition', 'replayRequirements', 'timeoutMs'])
    assert.deepEqual(scenario[key], old[key]);
  for (const change of [
    (f) => f.slice(1),
    (f) => [...f, f[0]],
    (f) => f.filter((v) => !v.startsWith('--readiness-cancel')),
    (f) =>
      f.map((v) =>
        v.startsWith('--source-revision')
          ? '--source-revision=239c574ecddd5bb6d5896e621d9edc53e7f6a313'
          : v,
      ),
    (f) => [...f, '--readiness-geometry=phase-boundary-v1'],
    (f) => [...f, '--cpu-profile'],
  ])
    assert.throws(() => qualificationReadinessOptions(change(flags), scenario, bytes));
  for (const [ref, path] of [
    [SELECTED_FONT_SOURCE_BINDING.css, 'game/ui/field-kit-fonts.css'],
    [SELECTED_FONT_SOURCE_BINDING.themeHost, 'game/presentation/theme-host.mjs'],
  ]) {
    const source = await readFile(new URL('../' + path, import.meta.url));
    assert.equal(source.length, ref.bytes);
    assert.equal(createHash('sha256').update(source).digest('hex'), ref.sha256);
  }
});

const priorModelSource = await readFile(
  new URL('./test-solo-selected-font-post-command.mjs', import.meta.url),
  'utf8',
);
const actualModel = priorModelSource.slice(
  priorModelSource.indexOf('function model('),
  priorModelSource.indexOf("\ntest('V3 serialized"),
);
function readinessModel(protocol = 'selected-font-cancel-post-command-v3') {
  // Reuse the original actual serialized collector fixture; no independent readiness model.
  return runInNewContext(`(${actualModel})(false, ${JSON.stringify(protocol)})`, {
    assert,
    TextEncoder,
    structuredClone,
    runInNewContext,
    createBrowserReadinessProbe,
    selectedFont,
    clone: (v) => JSON.parse(JSON.stringify(v)),
    assertSelectedFontPostCommandCancelled: (v) => assert.equal(v.records.length, 4),
  });
}
test('V4 actual collector and assessment accept fulfilled requested swap-error face while leaving unrelated unloaded face unpromoted', async () => {
  const h = await completedOwner(),
    raw = readinessModel('selected-font-request-settlement-v4'),
    m = JSON.parse(
      JSON.stringify({ observation: raw.observation, app: raw.app, transport: raw.transport }),
    );
  const out = assessSelectedFontSettlementReadiness(
    m.observation,
    m.app,
    1,
    m.transport,
    h.owner.snapshot(),
  );
  assert.equal(out.status, 'passed', out.failures.join('; '));
  assert.deepEqual(out.attribution.requestedErrorThenFulfilled, [2]);
  assert.deepEqual(out.attribution.unmatchedUnloadedFaces, [1]);
  assert.equal(m.observation.records.length, 8);
  for (const mutate of [
    (o) => (o.evidence.calls[0].settlement = 'rejected'),
    (o) => (o.evidence.calls[0].faces = [1]),
    (o) => (o.evidence.boundaries[1].calls[0].settlement = 'fulfilled'),
    (o) => (o.evidence.faces[1].settlement = 'rejected'),
    (o) => o.evidence.boundaries[1].faces.splice(1, 1),
    (o) => (o.evidence.css.weight = '400'),
    (o) => (o.sourceBinding.css.sha256 = '0'.repeat(64)),
    (o) => (o.closed = false),
    (o) => (o.evidence.boundaries[2].atMs = 540),
    (o) => (o.operations[0].settled = false),
    (o) => (o.operations[1].timedOut = true),
  ]) {
    const owner = JSON.parse(JSON.stringify(h.owner.snapshot()));
    mutate(owner);
    assert.equal(
      assessSelectedFontSettlementReadiness(m.observation, m.app, 1, m.transport, owner).status,
      'failed',
    );
  }
  const bad = JSON.parse(JSON.stringify(m.observation));
  bad.records[3].font.preparation = 'busy';
  assert.throws(() =>
    assertSelectedFontSettlementCancelled(
      { ...bad, records: bad.records.slice(0, 4) },
      {
        ...h.owner.snapshot().evidence,
        boundaries: h.owner.snapshot().evidence.boundaries.slice(0, 2),
      },
    ),
  );
});

test('actual qualifier hooks install before selection, read after awaited Cancel, release only after proof and dispose before later Start', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const installStart = source.indexOf(
    "if (selectedFontSettlement && action.label === 'selected-theme')",
  );
  const installEnd = source.indexOf('if (requiredOriginalReadiness', installStart);
  assert(installStart > source.indexOf('async function execute('));
  assert(installEnd < source.indexOf("} else if (action.type === 'click')", installStart));
  const order = [],
    owner = {
      install: async () => order.push('install'),
      snapshot: () => ({ evidence: { marker: 'owned' } }),
      boundary: async (label) => order.push(label),
      close: async () => order.push('closed'),
    };
  const setup = new Function(
    'selectedFontSettlement',
    'action',
    'readinessModule',
    'page',
    'report',
    'return (async()=>{let selectedFontSettlementOwner;' +
      source.slice(installStart, installEnd) +
      'return selectedFontSettlementOwner;})()',
  );
  const report = {};
  assert.equal(
    await setup(
      true,
      { label: 'selected-theme' },
      { createSelectedFontSettlementOwner: () => owner },
      {},
      report,
    ),
    owner,
  );
  assert.equal(await setup(false, { label: 'selected-theme' }, {}, {}, {}), undefined);
  const start = source.indexOf(
    "if (selectedFontPostCommand && action.label === 'public-cancel-back')",
  );
  const end = source.indexOf('\n        if (mediaFaultOwner)', start);
  const body = source.slice(start, end).trim();
  assert(body.endsWith('}'));
  // The trailing brace belongs to the enclosing selectedFontHold block.
  const hooks = body.slice(0, -1);
  const page = {
    evaluate: async (fn) =>
      runInNewContext('(' + fn.toString() + ')()', {
        window: {
          soloQualificationProbe: {
            completeSelectedFontCancellation: () => order.push('native-command-complete'),
            export: () => ({ readiness: { marker: 'raw' } }),
            readinessBoundary: (label) => order.push(label),
          },
        },
      }),
  };
  const run = new Function(
    'action',
    'page',
    'selectedFontPostCommand',
    'selectedFontSettlement',
    'selectedFontSettlementOwner',
    'selectedFontHold',
    'report',
    'readinessModule',
    'save',
    'return (async()=>{' + hooks + '})()',
  );
  const module = {
    assertSelectedFontSettlementCancelled: (raw, evidence) => {
      assert.equal(raw.marker, 'raw');
      assert.equal(evidence.marker, 'owned');
      order.push('proof');
    },
  };
  const hold = { releaseAfterPublicCancellation: () => order.push('release') };
  await run(
    { label: 'public-cancel-back' },
    page,
    true,
    true,
    owner,
    hold,
    report,
    module,
    async () => order.push('save'),
  );
  await run(
    { label: 'public-cancelled' },
    page,
    true,
    true,
    owner,
    hold,
    report,
    module,
    async () => {},
  );
  await run(
    { label: 'no-automatic-start-after-release' },
    page,
    true,
    true,
    owner,
    hold,
    report,
    module,
    async () => {},
  );
  assert.deepEqual(order, [
    'install',
    'native-command-complete',
    'cancel-command-complete',
    'save',
    'proof',
    'release',
    'font-release-no-start',
    'after-original-release',
    'closed',
  ]);
  const failedModule = {
    assertSelectedFontSettlementCancelled: () => {
      throw Error('no exact pending demand');
    },
  };
  await assert.rejects(
    run(
      { label: 'public-cancelled' },
      page,
      true,
      true,
      owner,
      hold,
      report,
      failedModule,
      async () => {},
    ),
    /no exact pending/,
  );
  assert.equal(order.filter((item) => item === 'release').length, 1);
});
