import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  releaseInputs,
  getSummary,
  CLASSES,
  FIXED_DT,
} from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  verifyReplayAsync,
  authoritativeCheckpoint,
  MAX_REPLAY_TICKS,
  MAX_REPLAY_BYTES,
  ReplayValidationError,
} from '../replay.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'replay-test',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.8 },
  enemies: [{ id: 'e', type: 'bouncer', x: 38.5, y: 25.5, vx: 0, vy: 0 }],
  objectives: [{ id: 'o', x: 8.5, y: 12.5, hidden: true }],
  supplies: [{ id: 'home', x: 24.5, y: 0.5, radius: 2 }],
};
function fixture(options = {}, source = level) {
  const state = createRun(source, options),
    recorder = createRecorder(source, options, 'test-build');
  return {
    state,
    recorder,
    tick(input = {}) {
      stepRun(state, input, FIXED_DT);
      recordInput(recorder, input);
    },
    release() {
      releaseInputs(state);
      recordRelease(recorder);
    },
    export() {
      return exportReplay(recorder, state);
    },
  };
}
const parsed = (value) => JSON.parse(JSON.stringify(value));

test('RLE merges identical canonical commands, copies input and preserves caller options', () => {
  const recipes = structuredClone(CLASSES);
  recipes[0].cooldown = 3;
  const f = fixture({ seed: 42, turnPolicy: 'grid-center', classRecipes: recipes });
  const input = { direction: 'right' };
  f.tick(input);
  input.direction = 'left';
  f.tick({ direction: 'right', boost: false, action: false, pickup: false });
  assert.equal(f.recorder.segments.length, 1);
  assert.equal(f.recorder.segments[0].ticks, 2);
  assert.equal(f.recorder.segments[0].input.direction, 'right');
  recipes[0].cooldown = 50;
  assert.equal(f.export().options.classRecipes[0].cooldown, 3);
  assert.equal(verifyReplay(parsed(f.export())).match, true);
});

test('release re-arms a held Scout action even when the resulting summary is identical', () => {
  const f = fixture();
  for (let i = 0; i < 721; i++) f.tick({ action: true });
  f.release();
  f.tick({ action: true });
  const replay = f.export();
  assert.equal(replay.segments.length, 2);
  assert.equal(replay.segments[1].releaseBefore, true);
  const correct = verifyReplay(replay);
  assert.equal(correct.match, true);
  assert.deepEqual(correct.actual.summary, getSummary(f.state));
  const missing = parsed(replay);
  missing.segments[1].releaseBefore = false;
  const divergent = verifyReplay(missing);
  assert.deepEqual(divergent.actual.summary, replay.summary);
  assert.equal(divergent.match, false);
  assert.ok(divergent.diagnostics.some((d) => d.section === 'ability'));
  assert.notEqual(divergent.state.ability.cooldownUntil, f.state.ability.cooldownUntil);
});

test('a trailing pause records speed, queue and latch release without adding a tick', () => {
  const f = fixture({ turnPolicy: 'grid-center' });
  f.tick({ direction: 'right', action: true });
  f.tick({ direction: 'down' });
  assert.equal(f.state.player.queuedDirection, 'down');
  f.release();
  f.release();
  const data = f.export();
  assert.equal(data.ticks, 2);
  assert.equal(data.releaseAfter, true);
  assert.equal(verifyReplay(data).match, true);
  const missing = parsed(data);
  missing.releaseAfter = false;
  const result = verifyReplay(missing);
  assert.equal(result.match, false);
  assert.ok(result.diagnostics.some((d) => d.section === 'player' || d.section === 'continuation'));
});

test('initial and repeated releases are idempotent and export snapshots remain independent', () => {
  const f = fixture();
  f.release();
  f.release();
  assert.equal(verifyReplay(f.export()).match, true);
  f.tick({});
  assert.equal(f.recorder.segments[0].releaseBefore, true);
  const exported = f.export();
  f.tick({ direction: 'right' });
  assert.equal(exported.ticks, 1);
  assert.equal(exported.segments.length, 1);
  assert.equal(verifyReplay(exported).match, true);
});

test('every authoritative section is checksummed while decorative data and events are excluded', () => {
  const state = createRun(level),
    original = authoritativeCheckpoint(state);
  const mutations = {
    board: (s) => (s.cells[49] = 1),
    player: (s) => (s.player.x += 0.1),
    trail: (s) => s.trail.push({ x: 2, y: 2, index: 98 }),
    enemies: (s) => (s.enemies[0].stunnedUntil = 1),
    objectives: (s) => (s.objectives[0].captured = true),
    supplies: (s) => (s.supplies[0].radius = 3),
    ability: (s) =>
      s.ability.fields.push({
        id: 'f',
        kind: 'stun-field',
        x: 5,
        y: 5,
        radius: 2,
        until: 4,
        slowFactor: 1,
      }),
    clock: (s) => (s.status = 'respawning'),
    continuation: (s) => (s._input.action = true),
    result: (s) => (s.result = getSummary(s)),
    configuration: (s) => (s.level.goal.coverage = 0.5),
    identity: (s) => (s.seed = 7),
  };
  for (const [section, mutate] of Object.entries(mutations)) {
    const copy = structuredClone(state);
    mutate(copy);
    const altered = authoritativeCheckpoint(copy);
    assert.notEqual(altered.sections[section], original.sections[section], section);
    assert.notEqual(altered.hash, original.hash);
  }
  state.player.heading = 240;
  state.body = 'cosmetic.png';
  state.events.push({ type: 'presentation-only' });
  state.classRecipe.label = 'Different theme';
  assert.deepEqual(authoritativeCheckpoint(state), original);
});

test('complete win and its final shell release verify; appended terminal commands are rejected', () => {
  const f = fixture({}, { ...level, goal: { coverage: 0.4 } });
  while (f.state.status === 'running') f.tick({ direction: 'down' });
  f.release();
  const data = f.export();
  assert.equal(data.summary.status, 'won');
  assert.equal(verifyReplay(data).match, true);
  const appended = parsed(data);
  appended.segments.push({
    ticks: 1,
    input: { direction: null, boost: false, action: false, pickup: false, switchClass: null },
    releaseBefore: false,
  });
  appended.ticks++;
  assert.throws(
    () => verifyReplay(appended),
    (error) => error.code === 'commands-after-terminal',
  );
});

test('modified command and forged summary are diagnosed independently of checkpoint metadata', () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) f.tick({ direction: 'right' });
  const data = f.export();
  const movement = parsed(data);
  movement.segments[0].input.direction = 'left';
  const different = verifyReplay(movement);
  assert.equal(different.match, false);
  assert.ok(different.diagnostics.some((d) => d.section === 'player'));
  assert.deepEqual(different.actual.summary, data.summary);
  const summary = parsed(data);
  summary.summary.score = 123;
  const result = verifyReplay(summary);
  assert.equal(result.match, false);
  assert.ok(result.diagnostics.some((d) => d.code === 'summary-mismatch'));
});

test('export rejects missing tick records, identity mismatch and unrecorded partial core time', () => {
  const f = fixture();
  stepRun(f.state, {});
  assert.throws(
    () => f.export(),
    (error) => error.code === 'recording-mismatch',
  );
  const g = fixture();
  g.state.seed = 2;
  assert.throws(
    () => g.export(),
    (error) => error.code === 'recording-mismatch',
  );
  const h = fixture();
  stepRun(h.state, {}, FIXED_DT / 2);
  assert.throws(
    () => h.export(),
    (error) => error.code === 'recording-mismatch',
  );
});

test('legacy format, malformed segments, unsupported primitives and inconsistent totals fail validation', () => {
  const f = fixture();
  f.tick({});
  const data = f.export();
  const changes = [
    (r) => (r.version = 'xonix-replay.v1'),
    (r) => (r.segments[0].ticks = 0),
    (r) => (r.ticks = 2),
    (r) => (r.segments[0].input.direction = 'diagonal'),
    (r) => (r.segments[0].releaseBefore = 'true'),
    (r) => (r.options.classRecipes[0].primitive = 'unimplemented'),
    (r) => (r.extra = 'ignored?'),
    (r) => (r.checkpoint.hash = '0000000000000000'),
  ];
  for (const change of changes) {
    const bad = parsed(data);
    change(bad);
    assert.throws(() => verifyReplay(bad));
  }
  assert.throws(() => verifyReplay('not json'), ReplayValidationError);
});

test('bounded JSON rejects prototype keys, accessors, cycles, nonfinite values and excessive nesting', () => {
  const f = fixture(),
    data = f.export();
  const prototype = parsed(data);
  prototype.level.metadata = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => verifyReplay(prototype), /Forbidden/);
  assert.equal({}.polluted, undefined);
  let reads = 0;
  const getter = parsed(data);
  Object.defineProperty(getter, 'extra', {
    enumerable: true,
    get() {
      reads++;
      return 1;
    },
  });
  assert.throws(() => verifyReplay(getter), /accessors/);
  assert.equal(reads, 0);
  const cyclic = parsed(data);
  cyclic.level.cycle = cyclic;
  assert.throws(() => verifyReplay(cyclic), /cycles/);
  const infinite = parsed(data);
  infinite.summary.score = Infinity;
  assert.throws(() => verifyReplay(infinite), /finite/);
  const deep = parsed(data);
  let cursor = deep.level;
  for (let i = 0; i < 30; i++) cursor = cursor.nested = {};
  assert.throws(() => verifyReplay(deep), /structural budget/);
  assert.throws(() => createRecorder({ ...level, metadata: new Date() }), /prototypes/);
});

test('recording and verification reject more than 30 minutes before replaying', () => {
  const f = fixture();
  f.recorder.ticks = MAX_REPLAY_TICKS;
  assert.throws(
    () => recordInput(f.recorder, {}),
    (error) => error.code === 'tick-budget',
  );
  const g = fixture();
  g.tick({});
  const data = g.export();
  data.ticks = MAX_REPLAY_TICKS + 1;
  data.segments[0].ticks = data.ticks;
  assert.throws(
    () => verifyReplay(data),
    (error) => error.code === 'tick-budget',
  );
  assert.equal(MAX_REPLAY_BYTES, 32 * 1024 * 1024);
});

test('asynchronous verification yields, reports bounded progress and matches synchronous verification', async () => {
  const f = fixture();
  for (let i = 0; i < 2500; i++) f.tick({ action: i % 800 < 400 });
  f.release();
  const data = f.export(),
    progress = [];
  let timerRan = false;
  setTimeout(() => {
    timerRan = true;
  }, 0);
  const result = await verifyReplayAsync(data, {
    chunkTicks: 120,
    onProgress: (value) => progress.push(value),
  });
  assert.equal(timerRan, true);
  assert.equal(result.match, true);
  assert.deepEqual(result.actual, verifyReplay(data).actual);
  assert.ok(progress.length > 20);
  assert.equal(progress[0].ticks, 0);
  assert.equal(progress.at(-1).ticks, 2500);
  for (let i = 1; i < progress.length; i++)
    assert.ok(progress[i].ticks - progress[i - 1].ticks <= 120);
});

test('asynchronous verification can be cancelled without modifying source data or an existing run', async () => {
  const f = fixture();
  for (let i = 0; i < 1000; i++) f.tick({});
  const data = f.export(),
    copy = parsed(data),
    before = authoritativeCheckpoint(f.state),
    controller = new AbortController();
  await assert.rejects(
    verifyReplayAsync(data, {
      chunkTicks: 100,
      signal: controller.signal,
      onProgress: ({ ticks }) => {
        if (ticks >= 200) controller.abort();
      },
    }),
    (error) => error.name === 'AbortError',
  );
  assert.deepEqual(data, copy);
  assert.deepEqual(authoritativeCheckpoint(f.state), before);
  await assert.rejects(verifyReplayAsync(data, { chunkTicks: 0 }), ReplayValidationError);
});

test('a full 216000-tick stationary recording remains compact and verifies asynchronously', async () => {
  const f = fixture({}, { ...level, enemies: [], objectives: [] });
  for (let i = 0; i < MAX_REPLAY_TICKS; i++) f.tick({});
  f.release();
  const data = f.export();
  assert.equal(data.segments.length, 1);
  assert.equal(data.ticks, 216000);
  assert.ok(JSON.stringify(data).length < 20000);
  const result = await verifyReplayAsync(data);
  assert.equal(result.match, true);
  assert.equal(result.state.tick, 216000);
});
