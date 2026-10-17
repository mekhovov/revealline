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
import { emptyJourneyPerformance } from '../journey/performance.mjs';
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
