import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  createRequiredOriginalHold,
  createOptionalIcon404,
  requiredOriginal,
  optionalPageIcon,
  installRequiredOriginalRequestWitness,
  assertRequiredOriginalCancellation,
  assertRequiredOriginalAfterCancel,
  assertReadinessMediaTransport,
  assessReadinessMediaFault,
  MEDIA_FAULT_PILOTS,
  qualificationReadinessOptions,
  createBrowserReadinessProbe,
  captureOptionalIconFallback,
  assertOptionalIconFallback,
} from './solo-qualification-readiness.mjs';
const entry = 'https://fixture.invalid/deployment/game/index.html';
const bytes = {
  required: await readFile(new URL('../game/' + requiredOriginal.relativePath, import.meta.url)),
  optional: await readFile(new URL('../game/' + optionalPageIcon.relativePath, import.meta.url)),
};
const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};
function transport(kind = 'required', options = {}) {
  const spec = kind === 'required' ? requiredOriginal : optionalPageIcon,
    target = new URL(spec.relativePath, entry).href;
  const timers = new Map(),
    calls = [];
  let now = 0,
    id = 0;
  const wait = async (name) => {
    if (options.wait === name) await options.pending;
    if (options.reject === name) throw Error(name + ' failed');
  };
  const response = {
    url: () => options.redirect ?? target,
    status: () => options.status ?? 200,
    headers: () => ({
      'content-type': options.mime ?? 'image/png',
      'content-length': String(bytes[kind].length),
    }),
    body: async () => {
      await wait('body');
      return options.bytes ?? bytes[kind];
    },
    dispose: async () => {
      calls.push('dispose');
      await wait('dispose');
    },
  };
  const route = {
    request: () => ({
      url: () => options.url ?? target,
      method: () => options.method ?? 'GET',
      resourceType: () => options.type ?? 'fetch',
      headers: () => options.headers ?? {},
    }),
    fetch: async (args) => {
      calls.push('fetch');
      assert.deepEqual(args, { timeout: 10000, maxRedirects: 0, maxRetries: 0 });
      await wait('fetch');
      return response;
    },
    fulfill: async (args) => {
      calls.push('fulfill');
      assert.equal(kind, 'optional');
      assert.deepEqual(args, { status: 404, contentType: 'image/png', body: Buffer.alloc(0) });
      await wait('fulfill');
    },
    abort: async () => {
      calls.push('abort');
      await wait('abort');
    },
  };
  const owner = (kind === 'required' ? createRequiredOriginalHold : createOptionalIcon404)(entry, {
    now: () => now,
    setTimer: (fn, ms) => {
      timers.set(++id, { fn, at: now + ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  async function advance(ms) {
    const end = now + ms;
    await flush();
    for (;;) {
      const due = [...timers].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
      await flush();
    }
    now = end;
    await flush();
  }
  return { owner, route, calls, timers, advance };
}
function witness(count = 1) {
  const requestRows = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    atMs: 10,
    abortedAtMs: 100,
    settledAtMs: 101,
    settlement: 'rejected',
    errorName: 'AbortError',
    aborted: true,
  }));
  const state = {
    trusted: true,
    visible: true,
    focused: true,
    phase: 'briefing',
    openDialogs: 0,
    tick: 0,
    levelId: 'first-return',
    checkpoint: { hash: '0000000000000000' },
    runEvidence: 'submitted-board',
  };
  return {
    format: 'SoloRequiredOriginalCancellationWitnessV1',
    failure: null,
    targetPath: new URL(requiredOriginal.relativePath, entry).pathname,
    closed: false,
    requests: requestRows,
    boundaries: [
      {
        ...structuredClone(state),
        kind: 'cancel-back',
        atMs: 100,
        defaultPrevented: false,
        preparation: 'busy',
        requests: requestRows.map((r) => ({ id: r.id, aborted: false, settlement: 'pending' })),
      },
      {
        ...structuredClone(state),
        kind: 'cancel-complete',
        atMs: 100,
        defaultPrevented: true,
        preparation: 'cancelled',
        requests: requestRows.map((r) => ({ id: r.id, aborted: true, settlement: 'rejected' })),
      },
    ],
  };
}
test('one or two required requests hold exact bytes, require actual user-cancel witness, then abort/dispose without delivery', async () => {
  for (const count of [1, 2]) {
    const f = transport();
    const tasks = [f.owner.handle(f.route)];
    await flush();
    if (count === 2) {
      tasks.push(f.owner.handle(f.route));
      await flush();
    }
    await f.owner.waitUntilHeld();
    assert.deepEqual(f.calls, ['fetch']);
    await f.owner.cancelRequiredOriginal(witness(count));
    await Promise.all(tasks);
    await f.owner.close();
    const r = f.owner.snapshot();
    assert.equal(r.status, 'complete');
    assert(r.cancellationObserved && r.abortSettled && r.responseDisposed && r.closed);
    assert.equal(r.released, false);
    assert.equal(r.ownedRouteCount, 0);
    assert.deepEqual(r.pendingOperations, []);
    assert.equal(f.calls.filter((x) => x === 'abort').length, count);
    assert(!f.calls.includes('fulfill'));
    assert.equal(f.timers.size, 0);
  }
});
test('optional exact original is verified before single declared empty404, unrelated routes remain untouched', async () => {
  const f = transport('optional');
  await f.owner.handle(f.route);
  await f.owner.close();
  const r = f.owner.snapshot();
  assert.equal(r.status, 'complete');
  assert(r.injected404 && r.released && r.closed && r.responseDisposed);
  assert.equal(r.actualSHA256, optionalPageIcon.sha256);
  assert.deepEqual(f.calls, ['fetch', 'fulfill', 'dispose']);
  const other = transport('optional', {
    url: new URL(optionalPageIcon.relativePath, entry).href + '?other',
  });
  assert.equal(await other.owner.handle(other.route), false);
  assert.deepEqual(other.calls, []);
  await other.owner.close();
});
test('wrong original status/hash/type/redirect/request never earns a fault outcome', async () => {
  for (const kind of ['required', 'optional'])
    for (const options of [
      { status: 404 },
      { bytes: Buffer.from('wrong') },
      { mime: 'text/plain' },
      { redirect: entry },
      { method: 'POST' },
      { type: 'image' },
      { headers: { range: 'bytes=0-1' } },
    ]) {
      const f = transport(kind, options);
      await f.owner.handle(f.route);
      await f.owner.close();
      assert.equal(f.owner.snapshot().status, 'failed');
      assert(!f.calls.includes('fulfill'));
    }
});
test('timeout retired intent cannot become user cancellation; no shared-font release for image', async () => {
  const f = transport();
  const task = f.owner.handle(f.route);
  await flush();
  assert.throws(() => f.owner.releaseAfterPublicCancellation(), /Only shared fonts/);
  await f.advance(20000);
  await task;
  await assert.rejects(f.owner.cancelRequiredOriginal(witness()));
  await f.owner.close();
  assert.equal(f.owner.snapshot().status, 'failed');
  assert(!f.owner.snapshot().cancellationObserved);
});
test('unknown/changed checkpoint, untrusted, unconsumed, expired, incomplete and wrong-target witnesses never release', async () => {
  const changes = [
    (w) => (w.boundaries[0].trusted = false),
    (w) => (w.boundaries[1].checkpoint.hash = 'changed'),
    (w) => (w.boundaries[1].defaultPrevented = false),
    (w) => (w.boundaries[1].preparation = 'busy'),
    (w) => (w.boundaries[0].atMs = 10010),
    (w) => (w.requests[0].abortedAtMs = 99),
    (w) => (w.requests[0].errorName = 'TypeError'),
    (w) => (w.requests[0].settlement = 'pending'),
    (w) => (w.boundaries[0].requests[0].aborted = true),
    (w) => (w.targetPath = '/other'),
    (w) => w.requests.push({ ...w.requests[0], id: 2 }),
  ];
  for (const change of changes) {
    const f = transport();
    const task = f.owner.handle(f.route);
    await flush();
    const w = structuredClone(witness());
    change(w);
    await assert.rejects(f.owner.cancelRequiredOriginal(w));
    assert(!f.calls.includes('fulfill'));
    await f.owner.close();
    await task;
    assert.equal(f.owner.snapshot().status, 'failed');
  }
});
test('actual settlement owns late fetch and blocked abort/disposal, with no timeout success', async () => {
  for (const wait of ['fetch', 'abort', 'dispose']) {
    let resolve;
    const pending = new Promise((r) => (resolve = r));
    const f = transport('required', { wait, pending });
    const task = f.owner.handle(f.route);
    await flush();
    let cancel;
    if (wait !== 'fetch') {
      cancel = f.owner.cancelRequiredOriginal(witness());
      cancel.catch(() => {});
      await flush();
      await f.advance(2000);
    }
    await f.owner.close();
    await task;
    if (cancel) await assert.rejects(cancel);
    let r = f.owner.snapshot();
    assert.equal(r.status, 'failed');
    assert.equal(r.closed, false);
    assert(r.pendingOperations.length);
    resolve();
    await flush();
    r = f.owner.snapshot();
    assert.equal(r.status, 'failed');
    assert.equal(r.closed, wait !== 'abort', wait);
    if (wait === 'abort') assert.equal(r.ownedResponseCount, 1);
    assert.equal(f.timers.size, 0);
  }
});
test('duplicate after optional completion remains failed even though original404 settled', async () => {
  const f = transport('optional');
  await f.owner.handle(f.route);
  await f.owner.handle(f.route);
  await f.owner.close();
  assert.equal(f.owner.snapshot().status, 'failed');
  assert.equal(f.calls.filter((x) => x === 'fetch').length, 1);
});
function browser(options) {
  const handlers = new Map(),
    envHandlers = new Map(),
    calls = [];
  let now = 10;
  const run = { tick: 0, level: { id: 'first-return' }, x: 4 },
    scene = { lastPaint: { run } };
  let scenes = [scene];
  const status = { dataset: { state: 'busy' } },
    document = {
      baseURI: entry,
      body: { dataset: { flightState: 'briefing' } },
      hidden: false,
      hasFocus: () => true,
      querySelectorAll: () => [],
      getElementById: () => status,
      addEventListener: (name, fn) => handlers.set(name, fn),
      removeEventListener: (name, fn) => {
        if (handlers.get(name) === fn) handlers.delete(name);
      },
    };
  const original = function (...args) {
    const signal = args[1]?.signal;
    let reject;
    const promise = new Promise((resolve, r) => {
      reject = r;
      if (signal)
        signal.addEventListener('abort', () => r(new DOMException('cancelled', 'AbortError')), {
          once: true,
        });
    });
    promise.catch(() => {});
    calls.push({ thisArg: this, args, promise, reject });
    return promise;
  };
  const env = {
    document,
    fetch: original,
    URL,
    Request,
    AbortSignal,
    performance: { now: () => now },
    queueMicrotask,
    addEventListener: (name, fn) => envHandlers.set(name, fn),
    removeEventListener: (name, fn) => {
      if (envHandlers.get(name) === fn) envHandlers.delete(name);
    },
  };
  env.top = env;
  const install = new Function(
    'return (' + installRequiredOriginalRequestWitness.toString() + ')',
  )();
  const owner = install(
    () => scenes,
    (r) => ({ tick: r.tick, x: r.x }),
    entry,
    env,
    options,
  );
  function escape({
    trusted = true,
    consume = true,
    abort = true,
    replace = false,
    clearPaint = false,
    complete = true,
  } = {}) {
    now = 100;
    const event = { isTrusted: trusted, code: 'Escape', repeat: false, defaultPrevented: false };
    handlers.get('keydown')?.(event);
    if (consume) {
      event.defaultPrevented = true;
      status.dataset.state = 'cancelled';
    }
    if (replace) scene.lastPaint = { run: structuredClone(run) };
    if (clearPaint) scene.lastPaint = null;
    if (abort) for (const c of calls) c.args[1]?.controller?.abort();
    if (trusted && complete) {
      try {
        owner.completeCancellation();
      } catch {}
    }
    return event;
  }
  function fetch() {
    const controller = new AbortController(),
      options = { signal: controller.signal, controller };
    const result = env.fetch(new URL(requiredOriginal.relativePath, entry), options);
    assert.equal(result, calls.at(-1).promise);
    assert.equal(calls.at(-1).args[1], options);
    return { controller, result };
  }
  return {
    env,
    owner,
    scene,
    run,
    status,
    document,
    handlers,
    envHandlers,
    calls,
    original,
    fetch,
    escape,
    setNow: (v) => (now = v),
    setScenes: (v) => (scenes = v),
  };
}
test('serialized browser witness returns exact native promise/options and ties current busy Escape to real AbortSignals', async () => {
  for (const clearPaint of [false, true]) {
    const b = browser();
    b.fetch();
    b.fetch();
    b.escape({ clearPaint });
    await flush();
    const w = b.owner.snapshot();
    assert.equal(assertRequiredOriginalCancellation(w, 2).preparation, 'cancelled');
    assert.equal(
      w.boundaries[1].runEvidence,
      clearPaint ? 'retained-inactive-reference' : 'submitted-board',
    );
    b.owner.close();
    assert.equal(b.env.fetch, b.original);
    assert.equal(b.handlers.size, 0);
    assert.equal(b.envHandlers.size, 0);
    assert.equal(b.owner.snapshot().failure, null);
  }
});
test('browser witness rejects no user action, unconsumed Escape, replacement, ambiguity and route cap', async () => {
  for (const kind of [
    'untrusted',
    'unconsumed',
    'replacement',
    'ambiguity',
    'third',
    'already-aborted',
  ]) {
    const b = browser();
    b.fetch();
    if (kind === 'third') {
      b.fetch();
      b.fetch();
    }
    if (kind === 'ambiguity')
      b.setScenes([b.scene, { lastPaint: { run: structuredClone(b.run) } }]);
    if (kind === 'already-aborted') b.calls[0].args[1].controller.abort();
    b.escape({
      trusted: kind !== 'untrusted',
      consume: kind !== 'unconsumed',
      replace: kind === 'replacement',
    });
    await flush();
    assert.throws(() =>
      assertRequiredOriginalCancellation(b.owner.snapshot(), kind === 'third' ? 3 : 1),
    );
    b.owner.close();
  }
});
test('no active checkpoint reads, no native abort authority and no child-frame installer', async () => {
  const b = browser();
  b.fetch();
  b.document.body.dataset.flightState = 'running';
  b.escape({ abort: false });
  await flush();
  assert.match(b.owner.snapshot().failure, /inactive/);
  assert.equal(b.calls[0].args[1].signal.aborted, false);
  b.owner.close();
  assert.match(b.owner.snapshot().failure, /inactive/);
  const e = { top: {}, fetch: () => {} };
  assert.equal(
    installRequiredOriginalRequestWitness(
      () => {
        throw Error();
      },
      () => {},
      entry,
      e,
    ),
    null,
  );
});
test('close with live native fetch and foreign fetch replacement remain explicit failure', async () => {
  for (const foreign of [false, true]) {
    const b = browser();
    b.fetch();
    if (foreign) b.env.fetch = () => {};
    b.owner.close();
    const r = b.owner.snapshot();
    assert.match(r.failure, foreign ? /owner changed/ : /unsettled/);
    assert.equal(b.calls[0].args[1].signal.aborted, false);
    b.calls[0].reject(Error('closed externally'));
    await flush();
  }
});

test('exact held fault recipes admit only their source/protocol/hash and reject mixing', async () => {
  for (const [protocol, pilot] of Object.entries(MEDIA_FAULT_PILOTS)) {
    const bytes = await readFile(
        new URL(
          '../docs/performance/fixtures/solo-readiness-media/' +
            protocol +
            '.qualification.fixture',
          import.meta.url,
        ),
      ),
      scenario = JSON.parse(bytes);
    const flags = [
      '--readiness-probe=' + protocol,
      '--source-revision=' + pilot.sourceRevision,
      '--work-probe',
      '--hitch-journal',
      '--cadence=settled120',
      '--server-fixture-access',
    ];
    assert.equal(qualificationReadinessOptions(flags, scenario, bytes), pilot);
    for (const missing of [0, 1, 2, 3, 4, 5])
      assert.throws(() =>
        qualificationReadinessOptions(
          flags.filter((_, i) => i !== missing),
          scenario,
          bytes,
        ),
      );
    for (const extra of [
      '--density-comparison=x',
      '--readiness-geometry=phase-boundary-v1',
      '--visual-quality-observation=x',
      '--fixture-access',
    ])
      assert.throws(() => qualificationReadinessOptions([...flags, extra], scenario, bytes));
    assert.throws(() =>
      qualificationReadinessOptions(flags, scenario, Buffer.concat([bytes, Buffer.from(' ')])),
    );
    assert.throws(() =>
      qualificationReadinessOptions(
        flags.map((x) =>
          x.startsWith('--source-revision') ? '--source-revision=' + 'a'.repeat(40) : x,
        ),
        scenario,
        bytes,
      ),
    );
  }
});
async function requiredCompleted(retainStart = false) {
  const b = browser(retainStart ? { startRetention: 'trusted-initial-start-v1' } : undefined);
  b.scene.cadence = {
    snapshot: () => ({
      samples: 30,
      required: 30,
      baselineMs: 16,
      restartedSamples: 0,
      waiting: false,
      status: 'measured-before-play',
    }),
  };
  b.scene.prepared = () => true;
  b.scene.displayedBoardValid = true;
  b.scene.preparedState = { run: b.run };
  b.scene.submittedRun = b.run;
  const probe = createBrowserReadinessProbe(() => b.scene, b.env, 'required-original-cancel-v1');
  b.fetch();
  b.setNow(20);
  b.handlers.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
  if (retainStart) {
    directStart(b);
    b.scene.lastPaint = null;
  }
  b.escape();
  await flush();
  b.setNow(600);
  b.owner.captureAfterCancel();
  b.owner.close();
  const witness = b.owner.snapshot();
  assertRequiredOriginalAfterCancel(witness);
  b.setNow(700);
  if (retainStart) b.scene.lastPaint = { run: b.run };
  b.handlers.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
  b.setNow(800);
  b.document.body.dataset.flightState = 'running';
  probe.phase('running');
  b.setNow(2000);
  b.run.tick = 144;
  b.document.body.dataset.flightState = 'paused';
  probe.phase('paused');
  const f = transport();
  const task = f.owner.handle(f.route);
  await flush();
  await f.owner.cancelRequiredOriginal(witness);
  await task;
  await f.owner.close();
  return {
    protocol: 'required-original-cancel-v1',
    ...(retainStart ? { startRetention: 'trusted-initial-start-v1' } : {}),
    observation: probe.export(),
    application: { baselineMs: 16, cadenceCalibration: b.scene.cadence.snapshot() },
    documents: 1,
    transport: f.owner.snapshot(),
    witness,
  };
}
test('actual serialized fetch witness requires closed unchanged500ms inactive boundary before fresh Start', async () => {
  const row = await requiredCompleted();
  assert.equal(assessReadinessMediaFault(row).status, 'passed');
  for (const mutation of [
    (x) => (x.witness.closed = false),
    (x) => (x.witness.afterCancel.atMs = 599),
    (x) => x.witness.afterCancel.checkpoint.x++,
    (x) => (x.witness.afterCancel.phase = 'running'),
    (x) => (x.witness.afterCancel.requests[0].settlement = 'pending'),
    (x) => x.observation.records.splice(1, 1),
    (x) => (x.observation.records[1].atMs = 599),
    (x) => (x.observation.records[1].trusted = false),
    (x) => (x.observation.records[2].prepared = false),
    (x) => x.observation.records[3].run++,
    (x) => (x.observation.records[3].tick = 119),
    (x) => (x.transport.status = 'failed'),
    (x) => (x.transport.closed = false),
    (x) => (x.transport.ownedRouteCount = 1),
    (x) => (x.transport.routes[0].abortionSettled = false),
    (x) => (x.transport.actualSHA256 = 'a'.repeat(64)),
    (x) => (x.transport.targetPath = '/different/' + requiredOriginal.relativePath),
    (x) => (x.cleanupFailure = 'late failure'),
  ]) {
    const copy = structuredClone(row);
    mutation(copy);
    assert.equal(assessReadinessMediaFault(copy).status, 'failed');
  }
});
test('post-cancel capture refuses repetition, active reads, removed/replaced run and early close', async () => {
  for (const edge of ['repeat', 'active', 'removed', 'replaced', 'closed']) {
    const b = browser();
    b.fetch();
    b.escape();
    await flush();
    b.setNow(600);
    if (edge === 'repeat') b.owner.captureAfterCancel();
    if (edge === 'active') b.document.body.dataset.flightState = 'running';
    if (edge === 'removed') b.setScenes([]);
    if (edge === 'replaced') b.scene.lastPaint = { run: structuredClone(b.run) };
    if (edge === 'closed') b.owner.close();
    assert.throws(() => b.owner.captureAfterCancel());
    b.owner.close();
  }
});
test('verified optional404 plus exact localized inactive fallback preserves full readiness checks', async () => {
  const required = await requiredCompleted(),
    f = transport('optional');
  await f.owner.handle(f.route);
  await f.owner.close();
  const row = {
    ...required,
    protocol: 'optional-icon-missing-v1',
    transport: f.owner.snapshot(),
    witness: undefined,
    observation: {
      ...required.observation,
      protocol: 'optional-icon-missing-v1',
      records: required.observation.records.slice(1),
    },
    fallback: {
      format: 'SoloOptionalIconFallbackV1',
      atMs: 600,
      phase: 'briefing',
      visible: true,
      focused: true,
      hidden: false,
      text: 'Original warning. Optional artwork unavailable.',
      expected: 'Optional artwork unavailable.',
    },
  };
  assert.equal(assessReadinessMediaFault(row).status, 'passed');
  for (const mutate of [
    (x) => (x.fallback.atMs = 701),
    (x) => (x.fallback.hidden = true),
    (x) => (x.fallback.expected = null),
    (x) => (x.fallback.text = 'Other unrelated warning'),
    (x) => (x.transport.injected404 = false),
    (x) => (x.transport.pendingOperations = ['late-read']),
    (x) => (x.observation.records[1].cadence.samples = 29),
  ]) {
    const bad = structuredClone(row);
    mutate(bad);
    assert.equal(assessReadinessMediaFault(bad).status, 'failed');
  }
});
test('serialized fallback capture retains bounded localized text and fails unavailable or active values', () => {
  const make = new Function(
    'document',
    'window',
    'performance',
    'return (' +
      captureOptionalIconFallback.toString() +
      ')({document, RevealLineI18n:window.RevealLineI18n, performance})',
  );
  const warning = { hidden: false, textContent: 'Optional missing' };
  const document = {
    body: { dataset: { flightState: 'briefing' } },
    hidden: false,
    hasFocus: () => true,
    getElementById: () => warning,
  };
  const window = { RevealLineI18n: { t: () => 'Optional missing' } };
  assertOptionalIconFallback(make(document, window, { now: () => 1 }));
  warning.textContent = 'x'.repeat(2049);
  assert.throws(() => assertOptionalIconFallback(make(document, window, { now: () => 1 })));
  warning.textContent = 'Optional missing';
  document.body.dataset.flightState = 'running';
  assert.throws(() => assertOptionalIconFallback(make(document, window, { now: () => 1 })));
});

// Native dispatch may run microtasks between callbacks, unlike one JS dispatch.
// The post-key completion is an explicit operation after all UA callbacks return.
test('early native callback microtask cannot manufacture completion before the actual handler', async () => {
  const b = browser();
  b.fetch();
  const event = b.escape({ consume: false, abort: false, complete: false });
  await flush();
  assert.deepEqual(
    b.owner.snapshot().boundaries.map((r) => r.kind),
    ['cancel-back'],
  );
  assert.throws(() => assertRequiredOriginalCancellation(b.owner.snapshot(), 1));
  event.defaultPrevented = true;
  b.status.dataset.state = 'cancelled';
  b.calls[0].args[1].controller.abort();
  await flush();
  b.owner.completeCancellation();
  assertRequiredOriginalCancellation(b.owner.snapshot(), 1);
  assert.throws(() => b.owner.completeCancellation());
  b.owner.close();
});

test('actual qualifier action hook takes completion after native key, retains before validation, and stops on incomplete owner', async () => {
  const code = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const begin = code.indexOf('        if (mediaFaultOwner) {');
  assert(begin > 0);
  const end = code.indexOf("        if (record.status === 'running')", begin);
  assert(end > begin);
  const run = new (Object.getPrototypeOf(async function () {}).constructor)(
    'action',
    'page',
    'report',
    'mediaFaultOwner',
    'readinessModule',
    'readinessOptions',
    'save',
    code.slice(begin, end),
  );
  for (const bad of [false, true]) {
    const calls = [],
      report = {};
    const probe = {
      completeRequiredOriginalCancellation() {
        calls.push('after-native-key');
      },
      requiredOriginalWitness() {
        calls.push('snapshot');
        return { witness: true };
      },
    };
    const page = {
      evaluate: async (fn) =>
        new Function('window', 'return (' + fn.toString() + ')()')({
          soloQualificationProbe: probe,
        }),
    };
    const owner = {
      async cancelRequiredOriginal(value) {
        assert.equal(value, report.requiredOriginalWitness);
        calls.push('cancel');
      },
      async close() {
        calls.push('close');
      },
      snapshot() {
        calls.push('transport');
        return { closed: !bad };
      },
    };
    const module = {
      assertReadinessMediaTransport(value) {
        calls.push('validate');
        assert(value.closed);
      },
    };
    const args = [
      page,
      report,
      owner,
      module,
      { protocol: 'required-original-cancel-v1' },
      async () => {
        calls.push('save');
        assert.deepEqual(report.requiredOriginalWitness, { witness: true });
      },
    ];
    await run({ label: 'required-original-public-back' }, ...args);
    const completion = run({ label: 'required-original-public-cancelled' }, ...args);
    if (bad) await assert.rejects(completion);
    else await completion;
    assert.deepEqual(calls, [
      'after-native-key',
      'snapshot',
      'save',
      'cancel',
      'close',
      'transport',
      'validate',
    ]);
    assert.deepEqual(report.mediaFaultTransport, { closed: !bad });
  }
});

function directStart(b, extra = {}) {
  return b.owner.captureStart({
    isTrusted: true,
    target: { closest: () => ({ id: 'start-button' }) },
    ...extra,
  });
}
test('opt-in initial submitted Start survives painter invalidation until actual native Cancel completion', async () => {
  const b = browser({ startRetention: 'trusted-initial-start-v1' });
  assert.equal(directStart(b), true);
  const original = b.owner.snapshot().initialStart.checkpoint;
  b.run.x = 9;
  assert.equal(original.x, 4);
  b.run.x = 4;
  b.fetch();
  b.scene.lastPaint = null;
  b.escape();
  await flush();
  const r = b.owner.snapshot();
  assert.equal(r.format, 'SoloRequiredOriginalCancellationWitnessV2');
  assert.equal(r.initialStart.runEvidence, 'submitted-board');
  assert.equal(r.boundaries[0].runEvidence, 'retained-inactive-reference');
  assertRequiredOriginalCancellation(r, 1);
  b.setNow(700);
  b.owner.captureAfterCancel();
  b.owner.close();
  assertRequiredOriginalAfterCancel(b.owner.snapshot());
});
test('legacy required witness still rejects missing paint at first Cancel; opt-in requires earlier trusted submitted Start', async () => {
  for (const options of [undefined, { startRetention: 'trusted-initial-start-v1' }]) {
    const b = browser(options);
    b.fetch();
    b.scene.lastPaint = null;
    b.escape();
    await flush();
    assert.throws(() => assertRequiredOriginalCancellation(b.owner.snapshot(), 1));
    b.owner.close();
  }
});
test('initial latch rejects wrong control, untrusted, ambiguous, absent, active or hidden submission', () => {
  for (const kind of [
    'untrusted',
    'wrong-control',
    'ambiguous',
    'missing',
    'active',
    'hidden',
    'repeated',
  ]) {
    const b = browser({ startRetention: 'trusted-initial-start-v1' });
    if (kind === 'ambiguous')
      b.setScenes([b.scene, { lastPaint: { run: structuredClone(b.run) } }]);
    if (kind === 'missing') b.scene.lastPaint = null;
    if (kind === 'active') b.document.body.dataset.flightState = 'running';
    if (kind === 'hidden') b.document.hidden = true;
    if (kind === 'repeated') assert.equal(directStart(b), true);
    assert.equal(
      directStart(
        b,
        kind === 'untrusted'
          ? { isTrusted: false }
          : kind === 'wrong-control'
            ? { target: { closest: () => ({ id: 'shell-featured' }) } }
            : {},
      ),
      false,
      kind,
    );
    assert(b.owner.snapshot().failure, kind);
    b.owner.close();
  }
});
test('after initial latch, replacement or removed scene and changed checkpoint cannot become a cancellation proof', async () => {
  for (const kind of ['run', 'scene', 'removed', 'checkpoint']) {
    const b = browser({ startRetention: 'trusted-initial-start-v1' });
    directStart(b);
    b.fetch();
    if (kind === 'run') b.scene.lastPaint = { run: structuredClone(b.run) };
    if (kind === 'scene') b.setScenes([{ lastPaint: { run: b.run } }]);
    if (kind === 'removed') b.setScenes([]);
    if (kind === 'checkpoint') b.run.x++;
    b.escape();
    await flush();
    assert.throws(() => assertRequiredOriginalCancellation(b.owner.snapshot(), 1), kind);
    b.owner.close();
  }
});
test('V2 independent cancellation readback rejects missing/altered initial submitted witness and expired start boundary', async () => {
  const b = browser({ startRetention: 'trusted-initial-start-v1' });
  directStart(b);
  b.fetch();
  b.scene.lastPaint = null;
  b.escape();
  await flush();
  const raw = b.owner.snapshot();
  assertRequiredOriginalCancellation(raw, 1);
  for (const mutate of [
    (r) => delete r.initialStart,
    (r) => (r.initialStart.trusted = false),
    (r) => (r.initialStart.runEvidence = 'retained-inactive-reference'),
    (r) => (r.initialStart.tick = 1),
    (r) => r.initialStart.checkpoint.x++,
    (r) => (r.initialStart.atMs = 101),
    (r) => (r.boundaries[0].atMs = 10011),
  ]) {
    const r = structuredClone(raw);
    mutate(r);
    assert.throws(() => assertRequiredOriginalCancellation(r, 1), String(mutate));
  }
  b.owner.close();
});

test('V2 full fault assessment requires initial submitted identity and every fresh/rejoined submission', async () => {
  const row = await requiredCompleted(true);
  assert.equal(assessReadinessMediaFault(row).status, 'passed');
  for (const mutation of [
    (x) => delete x.startRetention,
    (x) => (x.startRetention = 'unknown'),
    (x) => x.observation.records[0].run++,
    (x) => x.observation.records[1].run++,
    (x) => x.observation.records[2].run++,
    (x) => x.observation.records[3].run++,
    ...[0, 1, 2, 3].map((i) => (x) => (x.observation.records[i].submittedRunMatches = false)),
    (x) => (x.witness.initialStart.atMs = x.observation.records[0].atMs - 1),
    (x) => (x.observation.records[0].atMs = x.witness.initialStart.atMs - 1001),
    (x) => x.witness.initialStart.checkpoint.x++,
    (x) => (x.cleanupFailure = 'late failure'),
  ]) {
    const altered = structuredClone(row);
    mutation(altered);
    assert.equal(assessReadinessMediaFault(altered).status, 'failed');
  }
});

test('new exact239 Start-retention admission preserves native actions and rejects cross-source, missing and mixed opt-ins', async () => {
  const data = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-readiness-media/required-original-cancel-start-v2.qualification.fixture',
      import.meta.url,
    ),
  );
  const scenario = JSON.parse(data);
  const prior = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-readiness-media/required-original-cancel-v1.qualification.fixture',
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(scenario.actions, prior.actions);
  assert.deepEqual(scenario.replayRequirements, prior.replayRequirements);
  assert.deepEqual(scenario.expectedReplayDefinition, prior.expectedReplayDefinition);
  assert.equal(scenario.timeoutMs, prior.timeoutMs);
  const flags = [
    '--readiness-probe=required-original-cancel-v1',
    '--readiness-required-start=trusted-initial-start-v1',
    '--source-revision=239c574ecddd5bb6d5896e621d9edc53e7f6a313',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--server-fixture-access',
  ];
  assert.equal(
    qualificationReadinessOptions(flags, scenario, data).requiredStartRetention,
    'trusted-initial-start-v1',
  );
  for (const changed of [
    flags.slice(1),
    flags.filter((x) => !x.startsWith('--readiness-required-start')),
    [...flags, flags[1]],
    flags.map((x) =>
      x.startsWith('--source-revision')
        ? '--source-revision=e1cc5dd7656bab349715cd1c3ce6e9f783508c17'
        : x,
    ),
    [...flags, '--readiness-geometry=phase-boundary-v1'],
    [...flags, '--readiness-cancel-boundary=post-command-v3'],
    flags.map((x) =>
      x.startsWith('--readiness-probe') ? '--readiness-probe=optional-icon-missing-v1' : x,
    ),
  ])
    assert.throws(() => qualificationReadinessOptions(changed, scenario, data));
  assert.throws(() =>
    qualificationReadinessOptions(flags, prior, Buffer.from(JSON.stringify(prior))),
  );
});

test('actual qualifier initializer wires the first original trusted direct Start before painter invalidation without extra listeners', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('      const readiness = readinessProbe');
  const end = source.indexOf('      const nextRouteRead', start);
  assert(start > 0 && end > start);
  const b = browser();
  b.owner.close();
  b.scene.cadence = {
    snapshot: () => ({
      samples: 0,
      required: 30,
      baselineMs: null,
      restartedSamples: 0,
      waiting: false,
      status: 'pending-quiet-preparation',
    }),
  };
  b.scene.prepared = () => false;
  b.scene.displayedBoardValid = true;
  b.scene.submittedRun = b.run;
  b.env.soloQualificationCreateReadinessProbe = createBrowserReadinessProbe;
  let captured = null,
    captureCalls = 0;
  b.env.soloQualificationInstallRequiredOriginalWitness = (...args) => {
    const owner = installRequiredOriginalRequestWitness(...args),
      original = owner.captureStart;
    owner.captureStart = (event) => {
      captured = event;
      captureCalls++;
      return original(event);
    };
    return owner;
  };
  const body =
    source.slice(start, end) +
    'requiredCheckpoint=(run)=>({tick:run.tick,x:run.x});return {readiness,requiredWitness};';
  const { readiness, requiredWitness } = new Function(
    'window',
    'observedGame',
    'readinessProbe',
    'readinessProtocol',
    'readinessGeometry',
    'readinessCancelBoundary',
    'requiredOriginal',
    'requiredStartRetention',
    'faultEntryURL',
    body,
  )(
    b.env,
    { scene: { scenes: [b.scene] } },
    true,
    'required-original-cancel-v1',
    false,
    false,
    true,
    'trusted-initial-start-v1',
    entry,
  );
  const event = { isTrusted: true, target: { closest: () => ({ id: 'start-button' }) } };
  b.handlers.get('click')(event);
  assert.equal(captured, event, 'original event identity, not a cloned scalar report');
  assert.equal(captureCalls, 1);
  assert.equal(readiness.export().records[0].submittedRunMatches, true);
  assert.equal(requiredWitness.snapshot().initialStart.runEvidence, 'submitted-board');
  const pending = b.fetch();
  b.scene.lastPaint = null;
  const escape = { isTrusted: true, code: 'Escape', repeat: false, defaultPrevented: false };
  b.setNow(100);
  b.handlers.get('keydown')(escape);
  escape.defaultPrevented = true;
  b.status.dataset.state = 'cancelled';
  pending.controller.abort();
  await flush();
  requiredWitness.completeCancellation();
  assertRequiredOriginalCancellation(requiredWitness.snapshot(), 1);
  b.scene.lastPaint = { run: b.run };
  b.handlers.get('click')(event);
  assert.equal(
    captureCalls,
    1,
    'fresh explicit Start does not replace the first retained identity',
  );
  requiredWitness.close();
  readiness.dispose();
  assert.equal(requiredWitness.snapshot().failure, null);
});
