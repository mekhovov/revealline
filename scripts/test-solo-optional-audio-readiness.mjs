import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createOptionalStartAudio404,
  createBrowserReadinessProbe,
  optionalStartAudio,
  assertReadinessMediaTransport,
  assertOptionalAudioFallback,
  observeOptionalAudioSettlement,
  assessReadinessMediaFault,
  qualificationReadinessOptions,
  MEDIA_FAULT_PILOTS,
} from './solo-qualification-readiness.mjs';
const entry = 'https://fixture.invalid/deployment/game/index.html';
const bytes = await readFile(new URL('../game/audio/effects/start.wav', import.meta.url));
const protocol = 'optional-audio-start-missing-v1';
const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setImmediate(resolve));
};
function transport(options = {}) {
  const spec = optionalStartAudio,
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
      'content-type': options.mime ?? 'audio/wav',
      'content-length': String(bytes.length),
    }),
    body: async () => {
      await wait('body');
      return options.bytes ?? bytes;
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
      assert.deepEqual(args, { status: 404, contentType: 'audio/wav', body: Buffer.alloc(0) });
      await wait('fulfill');
    },
    abort: async () => {
      calls.push('abort');
      await wait('abort');
    },
  };
  const owner = createOptionalStartAudio404(entry, {
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

test('actual shipped sample metadata, exact source/recipe and independent opt-in are required', async () => {
  assert.equal(bytes.length, optionalStartAudio.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), optionalStartAudio.sha256);
  const raw = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-readiness-media/optional-audio-start-missing-v1.qualification.fixture',
      import.meta.url,
    ),
  );
  const fixture = JSON.parse(raw),
    pilot = MEDIA_FAULT_PILOTS[protocol];
  const flags = [
    '--readiness-probe=' + protocol,
    '--source-revision=' + pilot.sourceRevision,
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--server-fixture-access',
  ];
  assert.equal(qualificationReadinessOptions(flags, fixture, raw), pilot);
  for (let i = 0; i < flags.length; i++)
    assert.throws(() =>
      qualificationReadinessOptions(
        flags.filter((_, j) => i !== j),
        fixture,
        raw,
      ),
    );
  assert.throws(() =>
    qualificationReadinessOptions(flags, fixture, Buffer.concat([raw, Buffer.from(' ')])),
  );
  assert.throws(() =>
    qualificationReadinessOptions(
      flags.map((x) =>
        x.startsWith('--source-revision') ? '--source-revision=' + 'a'.repeat(40) : x,
      ),
      fixture,
      raw,
    ),
  );
  for (const flag of [
    '--audio-proof',
    '--readiness-geometry=phase-boundary-v1',
    '--memory-profile',
    '--visual-quality-observation=x',
  ])
    assert.throws(() => qualificationReadinessOptions([...flags, flag], fixture, raw));
  assert.deepEqual(fixture.expectAudio, { unmuted: true, nativeStartsAtLeast: 1 });
  assert.equal(fixture.actions[3].selector, '#shell-sound[aria-pressed="false"]');
  assert.equal(fixture.actions[4].selector, '#shell-sound');
  assert.equal(fixture.actions[5].selector, '#shell-sound[aria-pressed="true"]');
});
test('verified original becomes exactly one empty404 with settled native route and response', async () => {
  const f = transport();
  await f.owner.handle(f.route);
  await f.owner.close();
  assertReadinessMediaTransport(f.owner.snapshot(), protocol);
  assert.deepEqual(f.calls, ['fetch', 'fulfill', 'dispose']);
  assert.equal(f.timers.size, 0);
  await f.owner.handle(f.route);
  assert.throws(() => assertReadinessMediaTransport(f.owner.snapshot(), protocol));
  assert.equal(f.owner.snapshot().status, 'failed');
});
test('unobserved, altered original, wrong request, and native cleanup failures never pass', async () => {
  const absent = transport();
  await absent.owner.close();
  assert.throws(() => assertReadinessMediaTransport(absent.owner.snapshot(), protocol));
  for (const options of [
    { redirect: 'https://other.invalid/start.wav' },
    { status: 404 },
    { mime: 'image/png' },
    { bytes: Buffer.alloc(bytes.length) },
    { method: 'POST' },
    { type: 'media' },
    { headers: { range: 'bytes=0-8' } },
    { reject: 'fulfill' },
    { reject: 'dispose' },
  ]) {
    const f = transport(options);
    await f.owner.handle(f.route);
    await f.owner.close();
    assert.throws(() => assertReadinessMediaTransport(f.owner.snapshot(), protocol));
  }
  const other = transport({ url: entry + '/unrelated.wav' });
  assert.equal(await other.owner.handle(other.route), false);
  assert.equal(other.calls.length, 0);
  await other.owner.close();
});
test('an unresolved native fulfillment remains failed and owned through the fixed deadline', async () => {
  let release;
  const pending = new Promise((r) => (release = r)),
    f = transport({ wait: 'fulfill', pending });
  const task = f.owner.handle(f.route);
  await flush();
  await f.advance(20001);
  await task;
  await f.owner.close();
  assert.throws(() => assertReadinessMediaTransport(f.owner.snapshot(), protocol));
  assert(f.owner.snapshot().timedOutOperations.length);
  release();
  await flush();
  assert.equal(f.owner.snapshot().status, 'failed');
});
function evidence() {
  const cadence = {
    samples: 30,
    required: 30,
    baselineMs: 16,
    status: 'measured-before-play',
    waiting: false,
  };
  const application = {
    audio: { muted: false, volume: 0.8, revision: 1 },
    baselineMs: 16,
    cadenceCalibration: cadence,
    resources: {
      pcm: { effects: { loading: 0 } },
      media: {
        queued: 0,
        active: { fetch: 0, decode: 0, inspect: 0, main: 0 },
        reservedDecodeBytes: 0,
      },
    },
  };
  return {
    application,
    audioCheck: {
      master: { ...application.audio },
      requirement: { unmuted: true, nativeStartsAtLeast: 1 },
      observed: {
        sourceStarts: 1,
        oscillatorStarts: 0,
        sourceStartFailures: 0,
        mediaPlayRequests: 0,
        mediaPlayResolved: 0,
        mediaPlayRejected: 0,
      },
    },
    observation: {
      format: 'SoloFirstRunningReadinessV1',
      protocol,
      capacity: 8,
      maximumBytes: 16384,
      dropped: 0,
      errors: 0,
      records: [
        {
          kind: 'start-click',
          trusted: true,
          atMs: 10,
          phase: 'briefing',
          visible: true,
          focused: true,
        },
        {
          kind: 'first-running',
          actorStyle: 'campaign',
          atMs: 20,
          phase: 'running',
          visible: true,
          focused: true,
          tick: 0,
          levelId: 'first-return',
          run: 1,
          prepared: true,
          displayedBoardValid: true,
          preparedRunMatches: true,
          submittedRunMatches: true,
          cadence,
        },
        {
          kind: 'after-running',
          actorStyle: 'campaign',
          atMs: 1300,
          phase: 'paused',
          visible: true,
          focused: true,
          tick: 144,
          run: 1,
        },
      ],
    },
    protocol,
    documents: 1,
  };
}
test('nonblocking fallback needs observed unmuted audio operations and idle retained owners', async () => {
  const f = transport();
  await f.owner.handle(f.route);
  await f.owner.close();
  const row = { ...evidence(), transport: f.owner.snapshot() };
  assert.equal(assessReadinessMediaFault(row).status, 'passed');
  for (const mutate of [
    (x) => (x.application.audio.muted = true),
    (x) => (x.application.audio.volume = 0),
    (x) => x.audioCheck.master.revision++,
    (x) => (x.observation.records[1].actorStyle = 'fpv'),
    (x) => delete x.observation.records[2].actorStyle,
    (x) => (x.audioCheck.observed.sourceStarts = 0),
    (x) => (x.audioCheck.observed.mediaPlayRejected = 1),
    (x) => (x.audioCheck.observed.sourceStartFailures = 1),
    (x) => delete x.audioCheck.observed.oscillatorStarts,
    (x) => (x.application.resources.pcm.effects.loading = 1),
    (x) => (x.application.resources.media.queued = 1),
    (x) => (x.application.resources.media.active.decode = 1),
    (x) => (x.application.resources.media.reservedDecodeBytes = 4),
    (x) => (x.transport.claimed = 0),
    (x) => (x.transport.injected404 = false),
    (x) => (x.transport.pendingOperations = ['dispose']),
    (x) => (x.cleanupFailure = 'late cleanup'),
    (x) => (x.observation.records[0].trusted = false),
    (x) => (x.observation.records[1].prepared = false),
    (x) => (x.observation.records[2].run = 2),
    (x) => (x.observation.records[2].tick = 119),
    (x) => (x.documents = 2),
  ]) {
    const v = structuredClone(row);
    mutate(v);
    assert.equal(assessReadinessMediaFault(v).status, 'failed');
  }
  assert.match(
    assertOptionalAudioFallback(row.application, row.audioCheck).scope,
    /no specific replacement tone/,
  );
});
test('actual qualifier selects audio owner only for exact new protocol and forwards existing audio check', async () => {
  const code = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const start = code.indexOf('  if (mediaFaultReadiness)\n    mediaFaultOwner = ('),
    end = code.indexOf('  if (mirrored ||', start);
  assert(start > 0 && end > start);
  const select = new Function(
    'mediaFaultReadiness',
    'requiredOriginalReadiness',
    'optionalAudioReadiness',
    'readinessModule',
    'url',
    'let mediaFaultOwner;' + code.slice(start, end) + ';return mediaFaultOwner;',
  );
  const mod = {
    createRequiredOriginalHold: () => 'required',
    createOptionalIcon404: () => 'icon',
    createOptionalStartAudio404: () => 'audio',
  };
  assert.equal(select(true, false, true, mod, { href: entry }), 'audio');
  assert.equal(select(true, false, false, mod, { href: entry }), 'icon');
  assert.equal(select(true, true, false, mod, { href: entry }), 'required');
  assert.equal(select(false, false, true, mod, { href: entry }), undefined);
  assert.match(code, /audioCheck: report.audioCheck/);
});

test('actual serialized paused settlement refuses unavailable/busy owners and never reads during play', (t) => {
  let reads = 0;
  const resources = {
    pcm: { effects: { loading: 0 } },
    media: {
      queued: 0,
      reservedDecodeBytes: 0,
      active: { fetch: 0, decode: 0, inspect: 0, main: 0 },
    },
  };
  const document = { body: { dataset: { flightState: 'paused' } } };
  const window = {
    RevealLineSoloPerformance: {
      export() {
        reads++;
        return { resources };
      },
    },
  };
  const capture = new Function(
    'globalThis',
    `return (${observeOptionalAudioSettlement.toString()});`,
  )({
    document,
    get RevealLineSoloPerformance() {
      return window.RevealLineSoloPerformance;
    },
  });
  assert.equal(capture(true).idle, true);
  assert(capture(false));
  for (const change of [
    () => {
      resources.pcm.effects.loading = 1;
    },
    () => {
      resources.media.queued = 1;
    },
    () => {
      resources.media.active.fetch = 1;
    },
    () => {
      resources.media.reservedDecodeBytes = 1;
    },
    () => {
      delete resources.media.active.main;
    },
  ]) {
    const before = structuredClone(resources);
    change();
    assert.equal(capture(false), false);
    assert.equal(capture(true).idle, false);
    Object.assign(resources, before);
  }
  const count = reads;
  document.body.dataset.flightState = 'running';
  assert.throws(() => capture(true), /public Pause/);
  assert.equal(reads, count);
  document.body.dataset.flightState = 'briefing';
  assert.throws(() => capture(false), /public Pause/);
  document.body.dataset.flightState = 'paused';
  delete window.RevealLineSoloPerformance;
  assert.equal(capture(false), false);
});

test('actual serialized collector retains submitted campaign identity only for the audio opt-in', () => {
  const run = { tick: 0, level: { id: 'first-return' } },
    scene = {
      lastPaint: { run, actorAppearance: { style: 'campaign' } },
      cadence: { snapshot: () => ({}) },
    };
  const env = {
    performance: { now: () => 0 },
    document: {
      body: { dataset: { flightState: 'running' } },
      hidden: false,
      hasFocus: () => true,
      addEventListener() {},
      removeEventListener() {},
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const make = new Function(`return (${createBrowserReadinessProbe.toString()});`)();
  for (const kind of [protocol, 'first-running-v1']) {
    const p = make(() => scene, env, kind);
    p.phase('running');
    env.document.body.dataset.flightState = 'paused';
    const record = p.export().records[0];
    if (kind === protocol) assert.equal(record.actorStyle, 'campaign');
    else assert.equal(Object.hasOwn(record, 'actorStyle'), false);
    p.dispose();
  }
});

test('actual qualifier retains one bounded settlement and stops late native continuations', async () => {
  const code = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const begin = code.indexOf(
    "          if (optionalAudioReadiness && action.group === 'after-media-fault') {",
  );
  const end = code.indexOf('          const snapshot = await page.evaluate', begin);
  assert(begin > 0 && end > begin);
  const run = new Function(
    'optionalAudioReadiness',
    'action',
    'record',
    'page',
    'readinessModule',
    'save',
    'timeout',
    'deadline',
    'Date',
    'assert',
    'setTimeout',
    'clearTimeout',
    `return (async()=>{${code.slice(begin, end)}})();`,
  );
  for (const mode of [
    'pass',
    'native-failure',
    'expired-save',
    'late-wait',
    'stalled-read',
    'stalled-wait',
  ]) {
    let now = 0,
      timer,
      resolveRead,
      resolveWait;
    const calls = [],
      record = {},
      timers = new Set(),
      failure = Error('native failed');
    const page = {
      async evaluate(fn, flag) {
        assert.equal(fn, observeOptionalAudioSettlement);
        assert.equal(flag, true);
        calls.push('read');
        if (mode === 'stalled-read') return new Promise((r) => (resolveRead = r));
        return { idle: false, effectsLoading: 2 };
      },
      async waitForFunction(fn, flag, options) {
        assert.equal(fn, observeOptionalAudioSettlement);
        assert.equal(flag, false);
        assert.deepEqual(options, { timeout: 1000, polling: 100 });
        calls.push('wait');
        if (mode === 'native-failure') throw failure;
        if (mode === 'late-wait') now = 1234;
        if (mode === 'stalled-wait') return new Promise((r) => (resolveWait = r));
      },
    };
    const invoke = (on = true, group = 'after-media-fault') =>
      run(
        on,
        { group },
        record,
        page,
        { observeOptionalAudioSettlement },
        async () => {
          calls.push('save');
          now = mode === 'expired-save' ? 1235 : 234;
        },
        30000,
        1234,
        { now: () => now },
        assert,
        (fn, ms) => {
          assert.equal(ms, 1234);
          timer = fn;
          timers.add(fn);
          return fn;
        },
        (fn) => timers.delete(fn),
      );
    const result = invoke();
    const outcome = result.then(
      () => null,
      (e) => e,
    );
    await flush();
    if (mode.startsWith('stalled')) {
      now = 1234;
      timer();
    }
    const error = await outcome;
    if (mode === 'pass') assert.equal(error, null);
    else if (mode === 'native-failure') assert.equal(error, failure);
    else assert.match(error.message, /deadline expired/);
    if (mode === 'stalled-read') {
      assert.equal(record.optionalAudioBeforeSettlement, undefined);
      resolveRead({ idle: true });
      await flush();
      assert.deepEqual(calls, ['read']);
    } else {
      assert.equal(record.optionalAudioBeforeSettlement.effectsLoading, 2);
      if (mode === 'stalled-wait') {
        resolveWait();
        await flush();
      }
    }
    assert.equal(timers.size, 0);
    calls.length = 0;
    await invoke(false);
    await invoke(true, 'before-start');
    assert.deepEqual(calls, []);
  }
});
