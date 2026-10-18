import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createOwnedRecorder,
  recordInput,
  exportReplay,
  exportReplayAsync,
  verifyReplay,
} from '../replay.mjs';
import { JOURNEY_PERFORMANCE_LIMITS, emptyJourneyPerformance } from '../journey/performance.mjs';
import { createJourneyPerformanceController } from '../journey/performance-store.mjs';
import { emptyJourneyProfile } from '../journey/profile.mjs';
import { dataIdentity } from '../data-json.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const nodes = [];
function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.type === 'string') nodes.push(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(visit);
    else if (child && typeof child === 'object') visit(child);
  }
}
visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
const callers = nodes.filter(
  (node) =>
    node.type === 'IfStatement' &&
    source.slice(node.test.start, node.test.end).replace(/\s+/g, '') ===
      'candidateHost?.owns(activeEntry)&&recorder&&!recordingStopped&&!recoverGameplayTuning(run.level)?.adminOverride',
);
assert.equal(callers.length, 1, 'Exercise the actual optional WIN caller.');
const helpers = nodes.filter(
  (node) =>
    node.type === 'FunctionDeclaration' && node.id?.name === 'captureJourneyPerformanceLater',
);
assert(helpers.length <= 1);
// The old inline caller also runs in this harness, so the task-boundary control
// detects its real synchronous export rather than failing on a missing helper.
const bindCaller = new Function(
  'env',
  'with (env) {' +
    (helpers[0] ? source.slice(helpers[0].start, helpers[0].end) : '') +
    'return () => {' +
    source.slice(callers[0].start, callers[0].end) +
    '}; }',
);
const level = {
  version: 'xonix-level.v1',
  id: 'terminal-owner',
  revision: '1',
  name: 'Terminal owner',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'keeper', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
const terminalRun = createRun(level),
  terminalRecorder = createOwnedRecorder(level);
for (let i = 0; i < 1500 && terminalRun.status === 'running'; i++) {
  const input = { direction: 'down' };
  stepRun(terminalRun, input, FIXED_DT);
  recordInput(terminalRecorder, input);
}
assert.equal(terminalRun.status, 'won');
const expected = exportReplay(terminalRecorder, terminalRun);
assert.equal(verifyReplay(expected).match, true);
const microtasks = async () => {
  for (let i = 0; i < 80; i++) await Promise.resolve();
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function fixture(t, options = {}) {
  const owner = createMediaPreparation(),
    tasks = new Map(),
    captures = [],
    publications = [],
    exports = [];
  let taskId = 0,
    admissions = 0,
    writes = 0;
  const profile = emptyJourneyProfile();
  const clear = {
    runId: 'accepted',
    gameplayId: dataIdentity({
      ruleset: terminalRun.ruleset,
      level: terminalRun.level,
      classes: terminalRun.classRecipes,
    }),
    difficulty: 'standard',
  };
  profile.clears.solo.mission = clear;
  let state = { profile, performance: emptyJourneyPerformance() };
  const store = createJourneyPerformanceController({
    backend: {
      readState: async () => structuredClone(state),
      commitState: async (events) => {
        writes++;
        assert.equal(events.length, 1);
        assert.equal(events[0].type, 'performance');
        state = { ...state, performance: events[0].performance };
        return structuredClone(state);
      },
    },
    getProfile: () => profile,
    flushProfile: async () => true,
    acceptBinding: () => true,
    canWrite: () => true,
    scheduleChunk: (work, request) => owner.run('main', work, request),
  });
  const env = {
    run: terminalRun,
    recorder: terminalRecorder,
    runId: 'accepted',
    journeyPerformanceActive: true,
    paused: true,
    recordingStopped: false,
    activeEntry: {},
    levelIndex: 0,
    journeyBestResult: null,
    missionId: 'mission',
    candidateHost: { owns: () => true, progressMission: () => ({ id: env.missionId }) },
    recoverGameplayTuning: () => null,
    JOURNEY_PERFORMANCE_LIMITS,
    DOMException,
    setTimeout(callback, delay) {
      assert.equal(delay, 0);
      const id = ++taskId;
      tasks.set(id, callback);
      return id;
    },
    scheduleOptionalReplayChunk(work, request) {
      admissions++;
      if (options.rejectAdmission === admissions) return Promise.reject(new Error('owner refused'));
      return owner.run('main', work, request);
    },
    exportReplayAsync(recorder, run, request) {
      exports.push({ recorder, run, request, active: owner.snapshot().active.main });
      return options.export
        ? options.export(recorder, run, request, env)
        : exportReplayAsync(recorder, run, request);
    },
    journeyProfile: {
      snapshot: () => structuredClone(profile),
      performance: {
        capture(input) {
          captures.push(input);
          return options.capture
            ? options.capture(input, env)
            : options.realStore
              ? store.capture(input)
              : Promise.resolve({ durable: true });
        },
      },
    },
    refreshJourneyBest() {
      publications.push(env.journeyBestResult);
    },
  };
  owner.setPhase(options.phase ?? 'playing');
  const invoke = bindCaller(env);
  const dispose = () => {
    env.journeyPerformanceActive = false;
    store.dispose();
  };
  t.after(() => {
    dispose();
    owner.close();
  });
  return {
    env,
    owner,
    tasks,
    captures,
    publications,
    exports,
    invoke,
    dispose,
    profile,
    clear,
    store,
    get writes() {
      return writes;
    },
    task() {
      assert.equal(tasks.size, 1);
      const [id, callback] = tasks.entries().next().value;
      tasks.delete(id);
      callback();
    },
    tasksAll() {
      const callbacks = [...tasks.values()];
      tasks.clear();
      for (const callback of callbacks) callback();
    },
    async ready() {
      owner.setPhase('paused');
      await microtasks();
      assert.equal(tasks.size, 1);
    },
  };
}
async function settleWork(condition) {
  for (let i = 0; i < 200 && !condition(); i++)
    await new Promise((resolve) => setImmediate(resolve));
  assert(condition(), 'Bounded owned work did not settle.');
}
test('actual WIN optional snapshot waits for safe admission and then a real task', async (t) => {
  const f = fixture(t);
  f.invoke();
  assert.equal(f.exports.length, 0, 'No initial projection in the winning update.');
  await microtasks();
  assert.equal(f.exports.length, 0);
  assert.equal(f.tasks.size, 0);
  await f.ready();
  assert.equal(f.owner.snapshot().active.main, 0, 'Admission releases before the task.');
  assert.equal(f.exports.length, 0, 'Microtask draining is not the task yield.');
  f.task();
  await settleWork(() => f.publications.length === 1);
  assert.equal(f.exports.length, 1);
  assert.equal(f.exports[0].active, 1);
  assert.equal(f.exports[0].recorder, terminalRecorder);
  assert.equal(f.exports[0].run, terminalRun);
  assert.equal(f.captures.length, 1);
  assert.deepEqual(f.captures[0].replay, expected);
  assert.equal(verifyReplay(f.captures[0].replay).match, true);
  await microtasks();
  assert.equal(f.owner.snapshot().active.main, 0);
  assert.equal(f.owner.snapshot().queued, 0);
});
test('Next preserves the old accepted durable best while a new active flight holds work', async (t) => {
  const f = fixture(t, { realStore: true });
  f.invoke();
  await f.ready();
  const next = createRun(level),
    nextRecorder = createOwnedRecorder(level);
  f.env.run = next;
  f.env.recorder = nextRecorder;
  f.env.runId = 'next';
  f.owner.setPhase('playing');
  f.task();
  await microtasks();
  assert.equal(f.exports.length, 0);
  assert.equal(f.owner.snapshot().queued, 1);
  assert.equal(f.writes, 0);
  assert.deepEqual(
    exportReplay(nextRecorder, next),
    exportReplay(createOwnedRecorder(level), createRun(level)),
    'Required public export remains synchronous and independent.',
  );
  f.owner.setPhase('paused');
  await settleWork(() => f.writes === 1 && f.owner.snapshot().active.main === 0);
  assert.equal(f.captures.length, 1);
  assert.deepEqual(f.captures[0].replay, expected);
  assert.equal(f.store.snapshot().records[0].durable, true);
  assert.deepEqual(f.store.backup().records[0].replay, expected);
  assert.equal(f.publications.length, 0, 'Old best must not paint the new attempt.');
});
for (const when of ['queued', 'after-admission', 'task'])
  test('page disposal ' + when + ' prevents deferred export without new work', async (t) => {
    const f = fixture(t);
    f.invoke();
    if (when === 'after-admission') {
      f.owner.setPhase('paused');
      await Promise.resolve();
    } else if (when === 'task') await f.ready();
    f.dispose();
    f.owner.setPhase('paused');
    await microtasks();
    f.tasksAll();
    await microtasks();
    assert.equal(f.exports.length, 0);
    assert.equal(f.captures.length, 0);
    assert.equal(f.publications.length, 0);
    assert.equal(f.owner.snapshot().queued, 0);
    assert.equal(f.owner.snapshot().active.main, 0);
  });
for (const field of ['runId', 'gameplayId', 'difficulty'])
  test('replaced accepted clear ' + field + ' is refused before copying the old run', async (t) => {
    const f = fixture(t);
    f.invoke();
    await f.ready();
    f.profile.clears.solo.mission[field] = 'replacement';
    f.task();
    await microtasks();
    assert.equal(f.exports.length, 0);
    assert.equal(f.captures.length, 0);
    assert.equal(f.writes, 0);
  });
test('nested export releases the main slot and later disposal forbids its remaining work', async (t) => {
  const held = deferred();
  const f = fixture(t, {
    export: (recorder, run, request) =>
      exportReplayAsync(recorder, run, {
        ...request,
        scheduleChunk: async (work, options) => {
          await held.promise;
          return request.scheduleChunk(work, options);
        },
      }),
  });
  f.invoke();
  await f.ready();
  f.task();
  await microtasks();
  assert.equal(f.exports.length, 1);
  assert.equal(f.owner.snapshot().active.main, 0);
  f.dispose();
  held.resolve();
  await microtasks();
  assert.equal(f.captures.length, 0);
  assert.equal(f.publications.length, 0);
  assert.equal(f.owner.snapshot().queued, 0);
});
test('reentrant disposal inside export is observed before inner work or capture', async (t) => {
  const f = fixture(t, {
    export(recorder, run, request, env) {
      env.journeyPerformanceActive = false;
      return exportReplayAsync(recorder, run, request);
    },
  });
  f.invoke();
  await f.ready();
  f.task();
  await microtasks();
  assert.equal(f.exports.length, 1);
  assert.equal(f.captures.length, 0);
  assert.equal(f.publications.length, 0);
  assert.equal(f.owner.snapshot().active.main, 0);
  assert.equal(f.owner.snapshot().queued, 0);
});
test('disposal after export completion is checked before optional capture', async (t) => {
  const done = deferred(),
    f = fixture(t, { export: () => done.promise });
  f.invoke();
  await f.ready();
  f.task();
  await microtasks();
  done.resolve(expected);
  f.dispose();
  await microtasks();
  assert.equal(f.captures.length, 0);
  assert.equal(f.publications.length, 0);
});
test('replaced clear after projection cannot persist through the actual capture controller', async (t) => {
  const done = deferred(),
    f = fixture(t, { realStore: true, export: () => done.promise });
  f.invoke();
  await f.ready();
  f.task();
  await microtasks();
  f.profile.clears.solo.mission.runId = 'new-clear';
  done.resolve(expected);
  await microtasks();
  assert.equal(f.captures.length, 1);
  assert.equal(f.writes, 0);
  assert.equal(f.store.snapshot().records.length, 0);
});
test('valid capture finishing after replacement retains its result without painting the new run', async (t) => {
  const done = deferred(),
    f = fixture(t, { capture: () => done.promise });
  f.invoke();
  await f.ready();
  f.task();
  await microtasks();
  assert.equal(f.captures.length, 1);
  f.env.run = createRun(level);
  f.env.recorder = createOwnedRecorder(level);
  f.env.runId = 'next';
  done.resolve({ durable: true });
  await microtasks();
  assert.equal(f.publications.length, 0);
});
for (const cause of ['export', 'owner'])
  test(cause + ' rejection settles without a nested main-owner deadlock', async (t) => {
    const f = fixture(
      t,
      cause === 'export'
        ? { export: () => Promise.reject(new Error('export refused')) }
        : { rejectAdmission: 2 },
    );
    f.invoke();
    await f.ready();
    f.task();
    await microtasks();
    assert.equal(f.captures.length, 0);
    assert.equal(f.publications.length, 1);
    assert.deepEqual(f.publications[0].result, { error: 'unavailable' });
    assert.equal(f.owner.snapshot().active.main, 0);
  });
test('twenty accepted terminal references queue once each without dropping old results', async (t) => {
  const f = fixture(t);
  for (let i = 0; i < 20; i++) {
    f.env.missionId = 'mission-' + i;
    f.env.runId = 'win-' + i;
    f.profile.clears.solo[f.env.missionId] = { ...f.clear, runId: f.env.runId };
    f.invoke();
  }
  assert.equal(f.owner.snapshot().queued, 20);
  assert.equal(f.exports.length, 0);
  assert.equal(f.tasks.size, 0);
  f.env.run = createRun(level);
  f.env.recorder = createOwnedRecorder(level);
  f.env.runId = 'active-next';
  f.owner.setPhase('paused');
  await microtasks();
  assert.equal(f.tasks.size, 20);
  assert.equal(f.exports.length, 0);
  f.tasksAll();
  await settleWork(() => f.captures.length === 20 && f.owner.snapshot().active.main === 0);
  assert.equal(f.owner.snapshot().queued, 0);
  assert.equal(f.publications.length, 0);
  assert.deepEqual(
    f.captures.map((x) => x.runId).sort(),
    Array.from({ length: 20 }, (_, i) => 'win-' + i).sort(),
  );
  for (const input of f.captures) assert.deepEqual(input.replay, expected);
});
