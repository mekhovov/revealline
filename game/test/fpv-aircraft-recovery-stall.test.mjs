import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createFlightInput } from '../../optional-practice/civilian-fpv/input.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';

const source = await readFile(
  new URL('../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
  'utf8',
);
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
let callback;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'advanceFrame') callback = node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value?.type) visit(value);
  }
}
visit(ast);
assert.ok(callback, 'Test executes the production callback, not a copied timing policy');
const advance = new Function(
  'state',
  `with (state) { return (${source.slice(callback.start, callback.end)})(now); }`,
);
function frameFixture({
  status = 'paused',
  regional = true,
  preparing = false,
  execution = 420,
  frameTime = 420,
  flight,
} = {}) {
  const events = [];
  const state = {
    now: frameTime,
    win: { performance: { now: () => execution } },
    lastExecutionTime: 20,
    lastTime: 20,
    lastDemoTime: 20,
    demoHost: null,
    accumulator: 17,
    continuousPlay: { cancel() {} },
    current: { regional },
    regionalPreparing: preparing ? Promise.resolve() : null,
    flight: flight ?? { snapshot: () => ({ status }) },
    readFlightState: () => flight?.snapshot() ?? { status },
    $: (id) => {
      assert.equal(id, 'flight-dialog');
      return { open: true };
    },
    pauseFlight: () => {
      events.push('pause');
      flight?.pause();
    },
    pollGamepad: () => {
      throw new Error('A stalled callback must not poll input or advance flight');
    },
  };
  return { state, events };
}

test('World and Regional paused/disarmed callbacks discard both stale clocks without cancelling recovery', () => {
  for (const regional of [false, true])
    for (const preparing of [false, true])
      for (const status of ['paused', 'disarmed'])
        for (const clocks of [
          { execution: 420, frameTime: 40 },
          { execution: 40, frameTime: 420 },
        ]) {
          const { state, events } = frameFixture({ regional, preparing, status, ...clocks });
          advance(state);
          assert.deepEqual(events, []);
          assert.equal(state.lastTime, null);
          assert.equal(state.accumulator, 0);
          assert.equal(state.lastExecutionTime, clocks.execution);
        }
});

test('running World and Regional foreground stalls discard stale debt before fresh input without pausing', () => {
  for (const regional of [false, true])
    for (const clocks of [
      { execution: 420, frameTime: 40 },
      { execution: 40, frameTime: 420 },
    ]) {
      const { state, events } = frameFixture({ regional, status: 'active', ...clocks });
      const reached = new Error('Fresh input boundary reached');
      state.pollGamepad = () => {
        throw reached;
      };
      assert.throws(
        () => advance(state),
        (error) => error === reached,
      );
      assert.deepEqual(events, []);
      assert.equal(state.accumulator, 0);
      assert.equal(state.lastTime, clocks.frameTime - 20);
    }
});

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function recoveryFixture(t) {
  await initAdvancedRuntime();
  const terrain = (await createEnduranceFixture()).terrain;
  const selected = createPresetConfiguration('meteor75-analog-2022');
  const entered = deferred(),
    release = deferred();
  let active;
  const session = createAdvancedRegionalSession(
    {
      manifest: terrain.manifest,
      source: terrain.source,
      advanced: { aircraft: selected.aircraft, controller: selected.controller },
      response: selected.response,
      mode: 'acro',
    },
    {
      createClient() {
        let simulation,
          disposed = false;
        return {
          async initialize(options) {
            simulation = createAdvancedSimulation(options);
            active ??= simulation;
            return { telemetry: simulation.telemetry() };
          },
          async propose(sample) {
            simulation.enqueueInput(sample);
            return simulation.proposeMission();
          },
          async commit(decision) {
            return simulation.commitMission(decision);
          },
          async stageTerrainFrame(frame) {
            return simulation.stageTerrainFrame(frame);
          },
          async commitTerrainFrame(decision) {
            const result = simulation.commitTerrainFrame(decision);
            if (decision.accepted) active = simulation;
            return result;
          },
          async snapshot() {
            return simulation.snapshot();
          },
          async restore(saved) {
            entered.resolve();
            await release.promise;
            if (disposed) throw new DOMException('Recovery cancelled', 'AbortError');
            return simulation.restore(await verifyAdvancedRecovery(saved));
          },
          dispose() {
            disposed = true;
            simulation?.dispose();
          },
        };
      },
    },
  );
  t.after(async () => {
    release.resolve();
    await session.dispose();
  });
  await session.prepare();
  session.arm();
  for (let tick = 0; tick < 20; tick++)
    await session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.55 });
  session.pause();
  const saved = await session.captureRecovery();
  const before = active.stateHash();
  return { session, saved, before, entered, release, hash: () => active.stateHash() };
}

test('a real paused Meteor Regional recovery survives a delayed render callback and resumes the exact checkpoint', async (t) => {
  const h = await recoveryFixture(t);
  const restoring = h.session.restoreRecovery(h.saved);
  const completed = assert.doesNotReject(restoring);
  await h.entered.promise;
  const f = frameFixture({ flight: h.session });
  advance(f.state);
  assert.deepEqual(f.events, []);
  assert.equal(h.session.snapshot().status, 'paused');
  assert.equal(h.session.snapshot().ticks, 20);
  h.release.resolve();
  await completed;
  assert.equal(h.hash(), h.before);
  assert.equal(h.session.snapshot().status, 'paused', 'Recovery must never auto-arm');
  assert.equal(f.state.lastTime, null);
  assert.equal(f.state.accumulator, 0);
});

for (const cancellation of ['explicit cancel', 'blur', 'hidden'])
  test(`${cancellation} still cancels detached Regional recovery without changing the live flight`, async (t) => {
    const h = await recoveryFixture(t);
    const controller = new AbortController();
    const restoring = h.session.restoreRecovery(h.saved, { signal: controller.signal });
    const rejected = assert.rejects(restoring, { name: 'AbortError' });
    await h.entered.promise;
    if (cancellation === 'explicit cancel') controller.abort();
    else {
      const win = new EventTarget(),
        doc = new EventTarget();
      const input = createFlightInput({
        window: win,
        document: doc,
        onPause: () => h.session.pause(),
      });
      t.after(() => input.dispose());
      if (cancellation === 'blur') win.dispatchEvent(new Event('blur'));
      else {
        doc.hidden = true;
        doc.dispatchEvent(new Event('visibilitychange'));
      }
    }
    h.release.resolve();
    await rejected;
    assert.equal(h.hash(), h.before);
    assert.equal(h.session.snapshot().status, 'paused');
    assert.equal(h.session.snapshot().ticks, 20);
  });
