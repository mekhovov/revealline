import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import { createJourneyPerformanceController } from '../journey/performance-store.mjs';
import { createJourneyProfileStore, emptyJourneyProfile } from '../journey/profile.mjs';
import {
  emptyJourneyPerformance,
  verifyPerformanceRecord,
  performanceSummary,
} from '../journey/performance.mjs';
import { emptyJourneyPictures } from '../journey/pictures.mjs';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { readFile } from 'node:fs/promises';
const level = {
  version: 'xonix-level.v1',
  id: 'one',
  revision: '1',
  name: 'One',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'keeper', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
function record() {
  const options = { classId: 'scout', seed: 1, turnPolicy: 'immediate' },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (let i = 0; i < 2400; i++) {
    const input = { direction: null };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  for (let i = 0; i < 1500 && run.status === 'running'; i++) {
    const input = { direction: 'down' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'won');
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true);
  return {
    mode: 'solo',
    missionId: 'candidate/workshop/route/one',
    runId: 'prior-attempt',
    difficulty: 'standard',
    gameplayId: dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
    replay,
  };
}

const delay = () => new Promise((r) => setTimeout(r, 1));
async function until(condition) {
  const end = Date.now() + 2000;
  while (!condition() && Date.now() < end) await delay();
  assert(condition(), 'bounded state did not arrive');
}

test('optional initial replay construction waits for Pause and keeps its defensive validation', async (t) => {
  const replay = record().replay,
    media = createMediaPreparation();
  t.after(() => media.close());
  media.setPhase('playing');
  replay.options.seed = -1; // Only the real core constructor rejects this value.
  let settled = false;
  const pending = verifyReplayAsync(replay, {
    scheduleChunk: (work, options) => media.run('main', work, options),
  });
  const result = pending.then(
    () => {
      settled = true;
    },
    (error) => {
      settled = true;
      return error;
    },
  );
  await until(() => settled || media.snapshot().queued === 1);
  assert.equal(settled, false, 'constructing the initial replay must also wait during play');
  media.setPhase('paused');
  assert.match((await result).message, /seed must be a uint32/);
  assert.equal(media.snapshot().queued, 0);
  await assert.rejects(verifyReplayAsync(replay), /seed must be a uint32/);
});

test('initial replay admission owns its input before yielding and aborts without constructing it', async (t) => {
  const replay = record().replay,
    expected = verifyReplay(replay),
    media = createMediaPreparation();
  t.after(() => media.close());
  media.setPhase('playing');
  const options = { scheduleChunk: (work, request) => media.run('main', work, request) };
  const pending = verifyReplayAsync(replay, options);
  replay.options.seed = -1;
  replay.segments[0].input.direction = 'up';
  await until(() => media.snapshot().queued === 1);
  media.setPhase('paused');
  const result = await pending;
  assert.equal(result.match, true);
  assert.deepEqual(result.actual, expected.actual);
  media.setPhase('playing');
  const controller = new AbortController();
  const cancelled = verifyReplayAsync(replay, { ...options, signal: controller.signal });
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  await until(() => media.snapshot().queued === 1);
  controller.abort();
  await rejected;
  assert.equal(media.snapshot().queued, 0);
});

test('admitted replay strings keep the original document byte and field limits', async (t) => {
  const replay = record().replay,
    media = createMediaPreparation();
  t.after(() => media.close());
  // The document can exceed the individual-string budget; its fields cannot.
  replay.summary.extra = Array.from({ length: 140 }, () => 'x'.repeat(2048));
  const text = JSON.stringify(replay),
    expected = verifyReplay(text);
  assert(text.length > 262144);
  const result = await verifyReplayAsync(text, {
    scheduleChunk: (work, options) => media.run('main', work, options),
  });
  assert.equal(result.match, false);
  assert.deepEqual(result.diagnostics, expected.diagnostics);
  assert.deepEqual(result.actual, expected.actual);
});
function fixture(t, { route = 'capture', gate = true } = {}) {
  const input = record(),
    profile = emptyJourneyProfile();
  profile.clears.solo[input.missionId] = {
    runId: input.runId,
    gameplayId: input.gameplayId,
    difficulty: input.difficulty,
  };
  let state = {
      profile,
      performance: {
        ...emptyJourneyPerformance(),
        ...(route === 'observe' ? { records: [input] } : {}),
      },
    },
    writes = 0,
    admitted = 0;
  const media = createMediaPreparation();
  t.after(() => media.close());
  const scheduleChunk = (work, { signal }) =>
    media.run(
      'main',
      () => {
        admitted++;
        work();
        if (admitted === 1) media.setPhase('playing');
      },
      { signal },
    );
  const controller = createJourneyPerformanceController({
    backend: {
      readState: async () => structuredClone(state),
      commitState: async (events) => {
        writes++;
        assert.equal(events.length, 1);
        state = { ...state, performance: events[0].performance };
        return structuredClone(state);
      },
    },
    getProfile: () => profile,
    flushProfile: async () => true,
    acceptBinding: () => true,
    canWrite: () => true,
    ...(gate ? { scheduleChunk } : {}),
  });
  t.after(() => controller.dispose());
  return {
    input,
    profile,
    media,
    controller,
    get writes() {
      return writes;
    },
    get admitted() {
      return admitted;
    },
    get state() {
      return state;
    },
    scheduleChunk,
  };
}
for (const route of ['capture', 'observe'])
  test(`actual ${route} pauses remaining chunks during play then completes exact durable outcome`, async (t) => {
    const f = fixture(t, { route });
    let done = false,
      result;
    if (route === 'capture')
      result = f.controller.capture(f.input).then((v) => {
        done = true;
        return v;
      });
    else f.controller.observe(f.state);
    await until(() => f.media.snapshot().queued === 1);
    assert.equal(f.admitted, 1);
    assert.equal(f.writes, 0);
    assert.equal(f.controller.snapshot().records.length, 0);
    const before = structuredClone(f.input);
    f.input.replay.level.name = 'caller mutation after first yield';
    for (let i = 0; i < 4; i++) await delay();
    assert.equal(f.admitted, 1);
    assert.equal(done, false);
    assert.equal(f.media.snapshot().active.main, 0);
    f.media.setPhase('paused');
    if (route === 'capture') {
      assert.equal((await result).durable, true);
      assert.equal(f.writes, 1);
    } else {
      await until(() => f.controller.snapshot().records.length === 1);
      assert.equal(f.writes, 0);
    }
    assert(f.admitted > 4);
    assert.equal(f.controller.snapshot().records.length, 1);
    assert.equal(f.media.snapshot().queued, 0);
    assert.deepEqual(f.controller.backup().records[0].replay, before.replay);
  });
for (const kind of ['signal', 'dispose'])
  test(`pending verification ${kind} prevents work and durable writes`, async (t) => {
    const f = fixture(t),
      abort = new AbortController();
    let error;
    const result = f.controller.capture(f.input, { signal: abort.signal }).catch((e) => {
      error = e;
    });
    await until(() => f.media.snapshot().queued === 1);
    const admitted = f.admitted;
    if (kind === 'signal') abort.abort();
    else f.controller.dispose();
    await result;
    assert.equal(error.name, 'AbortError');
    f.media.setPhase('paused');
    await delay();
    assert.equal(f.admitted, admitted);
    assert.equal(f.writes, 0);
    assert.equal(f.controller.snapshot().records.length, 0);
    assert.equal(f.media.snapshot().queued, 0);
  });
test('default hosts keep exact asynchronous/synchronous replay and durable result without an owner', async (t) => {
  const f = fixture(t, { gate: false });
  f.media.setPhase('playing');
  const expected = verifyReplay(f.input.replay),
    actual = await verifyReplayAsync(f.input.replay);
  assert.deepEqual(actual, expected);
  assert.equal((await f.controller.capture(f.input)).durable, true);
  assert.equal(f.admitted, 0);
  assert.equal(f.writes, 1);
});
test('low-level chunk owner cannot omit, duplicate or invoke retired work', async () => {
  const input = record();
  let late;
  await assert.rejects(verifyReplayAsync(input.replay, { scheduleChunk: () => {} }), /did not run/);
  await assert.rejects(
    verifyReplayAsync(input.replay, {
      scheduleChunk: (work) => {
        late = work;
      },
    }),
    /did not run/,
  );
  assert.throws(() => late(), /exactly once/);
  await assert.rejects(
    verifyReplayAsync(input.replay, {
      scheduleChunk: (work) => {
        work();
        work();
      },
    }),
    /exactly once/,
  );
  await assert.rejects(verifyReplayAsync(input.replay, { scheduleChunk: 1 }), /function/);
  await assert.rejects(
    verifyReplayAsync(input.replay, {
      scheduleChunk: (work) => {
        work();
        try {
          work();
        } catch {}
      },
    }),
    /exactly once/,
  );
});
test('profile forwards admission and Main Solo bootstrap indirection has no early Soundscape reference', async (t) => {
  const f = fixture(t, { route: 'observe' }),
    store = createJourneyProfileStore({
      backend: {
        profileKey: 'admission-test',
        readState: async () => ({
          ...f.state,
          pictures: emptyJourneyPictures(),
        }),
      },
      profileKey: 'admission-test',
      acceptPerformanceBinding: () => true,
      schedulePerformanceChunk: f.scheduleChunk,
    });
  t.after(() => store.performance.dispose());
  await store.load();
  await until(() => f.media.snapshot().queued === 1);
  assert.equal(store.performance.snapshot().records.length, 0);
  f.media.setPhase('paused');
  await until(() => store.performance.snapshot().records.length === 1);
  store.performance.dispose();
  const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const a = source.indexOf('const scheduleOptionalReplayChunk = '),
    b = source.indexOf(';\n  const journeyProfile', a);
  assert(a > 0 && b > a);
  const expression = source.slice(a + 'const scheduleOptionalReplayChunk = '.length, b);
  const holder = { current: null };
  const run = new Function(
    'holder',
    `return ${expression.replaceAll('optionalVerificationPreparation', 'holder.current')};`,
  )(holder);
  let calls = 0;
  assert.equal(
    run(() => ++calls, {}),
    1,
  );
  assert.equal(calls, 1);
  holder.current = f.media;
  f.media.setPhase('playing');
  const result = run(() => ++calls, {});
  await until(() => f.media.snapshot().queued === 1);
  assert.equal(calls, 1);
  f.media.setPhase('paused');
  await result;
  assert.equal(calls, 2);
  const profileSource = await readFile(new URL('../journey/profile.mjs', import.meta.url), 'utf8');
  assert.match(profileSource, /scheduleChunk: schedulePerformanceChunk/);
  assert.match(source, /createDemoLibrary\(\{ scheduleChunk: scheduleOptionalReplayChunk \}\)/);
  assert.match(source, /createMasteryAwards\(\{\s*scheduleChunk: scheduleOptionalReplayChunk,/);
});

function inspectionFixture(t, schedule) {
  const input = record(),
    profile = emptyJourneyProfile(),
    media = createMediaPreparation();
  profile.clears.solo[input.missionId] = {
    runId: input.runId,
    gameplayId: input.gameplayId,
    difficulty: input.difficulty,
  };
  const envelope = { ...emptyJourneyPerformance(), records: [input] };
  const controller = createJourneyPerformanceController({
    backend: { commitState: () => assert.fail('inspection must not write durable records') },
    getProfile: () => profile,
    flushProfile: async () => true,
    acceptBinding: () => true,
    canWrite: () => true,
    scheduleChunk: schedule ?? ((work, options) => media.run('main', work, options)),
  });
  t.after(() => {
    controller.dispose();
    media.close();
  });
  return { input, profile, envelope, media, controller };
}

test('async performance inspection defers defensive construction until Pause', async (t) => {
  const f = inspectionFixture(t);
  f.input.replay.options.seed = -1;
  f.media.setPhase('playing');
  let settled = false;
  const pending = f.controller.inspect(f.envelope, f.profile).then(
    () => {
      settled = true;
    },
    (error) => {
      settled = true;
      return error;
    },
  );
  await until(() => settled || f.media.snapshot().queued === 1);
  assert.equal(settled, false, 'envelope validation must not construct a run during play');
  f.media.setPhase('paused');
  assert.match((await pending).message, /seed must be a uint32/);
  assert.equal(f.media.snapshot().queued, 0);
  assert.equal(f.controller.snapshot().records.length, 0);
});

test('queued performance inspection owns caller bytes and verifies the original replay', async (t) => {
  const f = inspectionFixture(t),
    expected = structuredClone(f.envelope);
  f.media.setPhase('playing');
  const pending = f.controller.inspect(f.envelope, f.profile);
  f.input.replay.options.seed = -1;
  f.input.replay.segments[0].input.direction = 'up';
  await until(() => f.media.snapshot().queued === 1);
  f.media.setPhase('paused');
  const checked = await pending;
  assert.deepEqual(checked.value, expected);
  assert.deepEqual(checked.rows[0].replay, expected.records[0].replay);
  assert.equal(f.media.snapshot().queued, 0);
});

test('performance inspection aborts before copying and before queued construction', async (t) => {
  const f = inspectionFixture(t),
    abort = new AbortController();
  f.input.replay.options.seed = -1;
  f.media.setPhase('playing');
  let settled = false;
  const pending = f.controller
    .inspect(f.envelope, f.profile, { signal: abort.signal })
    .catch((error) => {
      settled = true;
      return error;
    });
  await until(() => settled || f.media.snapshot().queued === 1);
  assert.equal(settled, false);
  abort.abort();
  assert.equal((await pending).name, 'AbortError');
  let reads = 0;
  const input = new Proxy(
    {},
    {
      ownKeys() {
        reads++;
        throw new Error('unexpected copy');
      },
    },
  );
  await assert.rejects(f.controller.inspect(input, f.profile, { signal: abort.signal }), {
    name: 'AbortError',
  });
  assert.equal(reads, 0);
  assert.equal(f.media.snapshot().queued, 0);
});

test('performance inspection admission rejects omitted, duplicate and retired work', async (t) => {
  let late;
  const omitted = inspectionFixture(t, (work) => {
    late = work;
  });
  await assert.rejects(
    omitted.controller.inspect(emptyJourneyPerformance(), omitted.profile),
    /did not run work/,
  );
  assert.throws(() => late(), /exactly once/);
  const twice = inspectionFixture(t, (work) => {
    work();
    try {
      work();
    } catch {}
  });
  await assert.rejects(
    twice.controller.inspect(emptyJourneyPerformance(), twice.profile),
    /exactly once/,
  );
  const swallowed = inspectionFixture(t, (work) => {
    try {
      work();
    } catch {}
  });
  swallowed.input.replay.options.seed = -1;
  await assert.rejects(
    swallowed.controller.inspect(swallowed.envelope, swallowed.profile),
    /seed must be a uint32/,
  );
});

test('observe reuses its actual validated envelope with one inspection and one publication', async (t) => {
  // Execute the complete source with one import wrapper to count the real
  // external validation boundary; no controller implementation is reproduced.
  const performanceURL = import.meta.resolve('../journey/performance.mjs');
  const encode = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  const wrapper = encode(
    `export * from ${JSON.stringify(performanceURL)};\nimport {inspectJourneyPerformance as inspect} from ${JSON.stringify(performanceURL)};\nexport let calls=0;\nexport function inspectJourneyPerformance(input){calls++;return inspect(input);}`,
  );
  const source = await readFile(
    new URL(import.meta.resolve('../journey/performance-store.mjs')),
    'utf8',
  );
  const controlled = source
    .replace("'./performance.mjs'", JSON.stringify(wrapper))
    .replace("'../data-json.mjs'", JSON.stringify(import.meta.resolve('../data-json.mjs')));
  assert.notEqual(source, controlled);
  const { createJourneyPerformanceController: create } = await import(encode(controlled));
  const counter = await import(wrapper),
    f = inspectionFixture(t);
  let publications = 0;
  const controller = create({
    backend: { commitState: () => assert.fail('observe cannot write') },
    getProfile: () => f.profile,
    flushProfile: async () => true,
    acceptBinding: () => true,
    canWrite: () => true,
    onChange: () => publications++,
  });
  t.after(() => controller.dispose());
  controller.observe({ profile: f.profile, performance: f.envelope });
  await until(() => controller.snapshot().records.length === 1);
  assert.equal(counter.calls, 1, 'observe must reuse its first owned validated envelope');
  assert.equal(publications, 1);
  assert.equal(controller.snapshot().records[0].runId, f.input.runId);
  controller.observe({ profile: f.profile, performance: structuredClone(f.envelope) });
  assert.equal(
    counter.calls,
    2,
    'unchanged caller input still receives synchronous defensive validation',
  );
  assert.equal(publications, 1);
});

test('capture admits post-I/O inspection and never overwrites a corrupted durable envelope', async (t) => {
  const f = inspectionFixture(t),
    stored = structuredClone(f.envelope);
  stored.records[0].replay.options.seed = -1;
  const original = structuredClone(stored);
  let reads = 0,
    writes = 0,
    settled = false;
  const controller = createJourneyPerformanceController({
    backend: {
      readState: async () => {
        reads++;
        f.media.setPhase('playing');
        return { profile: f.profile, performance: stored };
      },
      commitState: () => {
        writes++;
        assert.fail('corrupt durable history cannot be replaced');
      },
    },
    getProfile: () => f.profile,
    flushProfile: async () => true,
    acceptBinding: () => true,
    canWrite: () => true,
    scheduleChunk: (work, options) => f.media.run('main', work, options),
  });
  t.after(() => controller.dispose());
  const pending = controller.capture(f.input).then((value) => {
    settled = true;
    return value;
  });
  await until(() => settled || (reads === 1 && f.media.snapshot().queued === 1));
  assert.equal(reads, 1);
  assert.equal(
    settled,
    false,
    'readState completion must not start defensive construction while playing',
  );
  assert.equal(writes, 0);
  f.media.setPhase('paused');
  assert.equal((await pending).durable, false);
  assert.equal(writes, 0);
  assert.deepEqual(stored, original);
  assert.equal(controller.snapshot().records.length, 1, 'the actual new win remains session-only');
  assert.equal(controller.snapshot().records[0].durable, false);
  assert.match(controller.snapshot().error, /seed must be a uint32/);
});

test('performance inspection checks cancellation again after the admitted slot', async (t) => {
  const abort = new AbortController();
  let slots = 0;
  const f = inspectionFixture(t, (work) => {
    slots++;
    work();
    abort.abort();
  });
  await assert.rejects(
    f.controller.inspect(emptyJourneyPerformance(), f.profile, { signal: abort.signal }),
    { name: 'AbortError' },
  );
  assert.equal(slots, 1);
});

test('public performance record verification admits construction and keeps exact caller bytes', async (t) => {
  const f = inspectionFixture(t),
    original = structuredClone(f.input);
  f.media.setPhase('playing');
  const options = {
    profile: f.profile,
    acceptBinding: () => true,
    scheduleChunk: (work, request) => f.media.run('main', work, request),
  };
  const pending = verifyPerformanceRecord(f.input, options);
  f.input.replay.options.seed = -1;
  await until(() => f.media.snapshot().queued === 1);
  f.media.setPhase('paused');
  assert.deepEqual((await pending).replay, original.replay);
  f.media.setPhase('playing');
  let settled = false;
  const bad = verifyPerformanceRecord(f.input, options).catch((error) => {
    settled = true;
    return error;
  });
  await until(() => settled || f.media.snapshot().queued === 1);
  assert.equal(settled, false, 'public record constructor must wait during play');
  f.media.setPhase('paused');
  assert.match((await bad).message, /seed must be a uint32/);
  await assert.rejects(
    verifyPerformanceRecord(f.input, { profile: f.profile, acceptBinding: () => true }),
    /seed must be a uint32/,
  );
});

test('public performance record cancellation owns no late constructor or binding work', async (t) => {
  const f = inspectionFixture(t),
    abort = new AbortController();
  f.input.replay.options.seed = -1;
  f.media.setPhase('playing');
  let bindings = 0,
    settled = false;
  const options = {
    profile: f.profile,
    acceptBinding: () => {
      bindings++;
      return true;
    },
    scheduleChunk: (work, request) => f.media.run('main', work, request),
    signal: abort.signal,
  };
  const pending = verifyPerformanceRecord(f.input, options).catch((error) => {
    settled = true;
    return error;
  });
  await until(() => settled || f.media.snapshot().queued === 1);
  assert.equal(settled, false);
  abort.abort();
  assert.equal((await pending).name, 'AbortError');
  assert.equal(bindings, 0);
  f.media.setPhase('paused');
  await delay();
  assert.equal(bindings, 0);
  let reads = 0;
  const hostile = new Proxy(
    {},
    {
      ownKeys() {
        reads++;
        throw Error('unexpected copy');
      },
    },
  );
  await assert.rejects(verifyPerformanceRecord(hostile, options), { name: 'AbortError' });
  assert.equal(reads, 0);
});

test('public performance record admission rejects skipped, repeated, late and suppressed work', async (t) => {
  const f = inspectionFixture(t),
    options = { profile: f.profile, acceptBinding: () => true };
  let late;
  await assert.rejects(
    verifyPerformanceRecord(f.input, {
      ...options,
      scheduleChunk: (work) => {
        late = work;
      },
    }),
    /did not run work/,
  );
  assert.throws(() => late(), /exactly once/);
  await assert.rejects(
    verifyPerformanceRecord(f.input, {
      ...options,
      scheduleChunk: (work) => {
        work();
        try {
          work();
        } catch {}
      },
    }),
    /exactly once/,
  );
  f.input.replay.options.seed = -1;
  await assert.rejects(
    verifyPerformanceRecord(f.input, {
      ...options,
      scheduleChunk: (work) => {
        try {
          work();
        } catch {}
      },
    }),
    /seed must be a uint32/,
  );
});

test('actual next-record identity and constructor wait when prior binding resumes during play', async (t) => {
  const encode = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  // Wrap only the imported synchronous boundaries. Complete controller and
  // performance sources still execute their actual validation/verification.
  const trackerURL = encode(
    "export const marks=[];export let phase='paused';export function setPhase(value){phase=value;}",
  );
  const dataURL = import.meta.resolve('../data-json.mjs'),
    replayURL = import.meta.resolve('../replay.mjs');
  const dataWrapper = encode(
    `export * from ${JSON.stringify(dataURL)};import {canonicalJSON as actual} from ${JSON.stringify(dataURL)};import {marks,phase} from ${JSON.stringify(trackerURL)};export function canonicalJSON(value){marks.push({kind:'identity',phase});return actual(value);}`,
  );
  const replayWrapper = encode(
    `export * from ${JSON.stringify(replayURL)};import {snapshotReplay as actual} from ${JSON.stringify(replayURL)};import {marks,phase} from ${JSON.stringify(trackerURL)};export function snapshotReplay(value){marks.push({kind:'constructor',phase});return actual(value);}`,
  );
  const performanceSource = await readFile(
    new URL(import.meta.resolve('../journey/performance.mjs')),
    'utf8',
  );
  const performanceURL = encode(
    performanceSource
      .replace("'../data-json.mjs'", JSON.stringify(dataWrapper))
      .replace("'../replay.mjs'", JSON.stringify(replayWrapper))
      .replace(
        "'../content-design/catalogs.mjs'",
        JSON.stringify(import.meta.resolve('../content-design/catalogs.mjs')),
      ),
  );
  const storeSource = await readFile(
    new URL(import.meta.resolve('../journey/performance-store.mjs')),
    'utf8',
  );
  const storeURL = encode(
    storeSource
      .replace("'../data-json.mjs'", JSON.stringify(dataWrapper))
      .replace("'./performance.mjs'", JSON.stringify(performanceURL)),
  );
  const { createJourneyPerformanceController: create } = await import(storeURL),
    tracker = await import(trackerURL),
    f = inspectionFixture(t);
  const second = structuredClone(f.input);
  second.runId = 'second-accepted-history';
  const envelope = { ...emptyJourneyPerformance(), records: [f.input, second] };
  let bindings = 0,
    settled = false;
  const controller = create({
    backend: { commitState: () => assert.fail('inspection cannot write') },
    getProfile: () => f.profile,
    flushProfile: async () => true,
    canWrite: () => true,
    scheduleChunk: (work, request) => f.media.run('main', work, request),
    acceptBinding: async () => {
      if (++bindings === 1) {
        f.media.setPhase('playing');
        tracker.setPhase('playing');
        await delay();
      }
      return true;
    },
  });
  t.after(() => controller.dispose());
  const pending = controller.inspect(envelope, f.profile).then((value) => {
    settled = true;
    return value;
  });
  void pending.catch(() => {}); // A failed before-control still owns cancellation settlement.
  await until(() => bindings === 1 && f.media.snapshot().queued === 1);
  assert.equal(settled, false);
  assert.deepEqual(
    tracker.marks.filter((row) => row.phase === 'playing'),
    [],
    'next record prefix must be admitted after a real binding yield',
  );
  tracker.setPhase('paused');
  f.media.setPhase('paused');
  const result = await pending;
  assert.equal(bindings, 2);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.value, envelope);
  assert(tracker.marks.some((row) => row.kind === 'identity'));
  assert(tracker.marks.some((row) => row.kind === 'constructor'));
});

for (const action of ['pause', 'cancel'])
  test(`performance final comparison and publication waits after async binding until ${action}`, async (t) => {
    const f = inspectionFixture(t),
      abort = new AbortController();
    const expected = await verifyPerformanceRecord(f.input, {
      profile: f.profile,
      acceptBinding: () => true,
    });
    let bound = null,
      settled = false;
    const pending = verifyPerformanceRecord(f.input, {
      profile: f.profile,
      signal: abort.signal,
      scheduleChunk: (work, options) => f.media.run('main', work, options),
      acceptBinding: async (record) => {
        bound = record;
        f.media.setPhase('playing');
        await delay();
        return true;
      },
    }).then(
      (value) => {
        settled = true;
        return value;
      },
      (error) => {
        settled = true;
        return error;
      },
    );
    await until(() => settled || (bound && f.media.snapshot().queued === 1));
    assert.equal(settled, false, 'post-binding comparison and deep-freeze must also wait');
    assert.equal(
      Object.isFrozen(bound.replay),
      false,
      'binding reference has not been deeply frozen during play',
    );
    // Simulate a validator retaining its input. The pending owner must publish
    // the private bytes it captured before waiting, not these later edits.
    bound.missionId = 'late-callback-mutation';
    bound.replay.level.name = 'late-callback-mutation';
    if (action === 'cancel') abort.abort();
    else f.media.setPhase('paused');
    const result = await pending;
    if (action === 'cancel') {
      assert.equal(result.name, 'AbortError');
      f.media.setPhase('paused');
      await delay();
      assert.equal(Object.isFrozen(bound.replay), false);
    } else {
      assert.deepEqual(result, expected);
      assert.deepEqual(performanceSummary(result), performanceSummary(expected));
      assert(Object.isFrozen(result) && Object.isFrozen(result.replay.level));
    }
    assert.equal(f.media.snapshot().queued, 0);
  });

test('final record publication still requires its own admitted synchronous work', async (t) => {
  const f = inspectionFixture(t);
  let bound = false,
    late;
  await assert.rejects(
    verifyPerformanceRecord(f.input, {
      profile: f.profile,
      acceptBinding: async () => {
        await delay();
        bound = true;
        return true;
      },
      scheduleChunk: (work, request) => {
        if (bound) {
          late = work;
          return;
        }
        return f.media.run('main', work, request);
      },
    }),
    /did not run work/,
  );
  assert.throws(() => late(), /exactly once/);
});
