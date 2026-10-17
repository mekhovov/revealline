import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvancedWorkerClient } from '../../optional-practice/civilian-fpv/advanced-worker-client.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import {
  ADVANCED_MAX_SECONDS,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import RAPIER from '../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import { createAdvancedTerrainFrame } from '../../optional-practice/civilian-fpv/advanced-terrain.mjs';

class FakeWorker {
  static instances = [];
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }
  removeEventListener(type) {
    this.listeners.delete(type);
  }
  postMessage(message) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data) {
    this.listeners.get('message')?.({ data });
  }
}

test('worker client ignores stale sessions, rejects requests on close, and owns worker lifetime', async () => {
  const client = createAdvancedWorkerClient({ Worker: FakeWorker });
  const worker = FakeWorker.instances.at(-1);
  const request = client.initialize({ rateProfile: createRateProfile() });
  const sent = worker.messages[0];
  assert.equal(worker.options.type, 'module');
  assert.match(worker.url.pathname, /advanced-worker.mjs$/);
  worker.reply({ id: sent.id, session: 'previous-flight', result: 'wrong' });
  worker.reply({ id: sent.id, session: sent.session, result: { ready: true } });
  assert.deepEqual(await request, { ready: true });
  const pending = client.step();
  const rejection = assert.rejects(pending, /closed/);
  client.dispose();
  await rejection;
  assert.equal(worker.terminated, true);
  assert.equal(worker.listeners.size, 0);
  await assert.rejects(client.step(), /closed/);
  client.dispose();
});

test('worker deadline rejects every outstanding request and terminates CPU owner', async () => {
  const client = createAdvancedWorkerClient({ Worker: FakeWorker, watchdogMs: 5 });
  const first = assert.rejects(client.telemetry(), /did not respond/);
  const second = assert.rejects(client.snapshot(), /did not respond/);
  await Promise.all([first, second]);
  assert.equal(FakeWorker.instances.at(-1).terminated, true);
});

test('worker client preserves only explicit flight-limit codes, never matching error text', async () => {
  const client = createAdvancedWorkerClient({ Worker: FakeWorker });
  const worker = FakeWorker.instances.at(-1);
  try {
    for (const code of [
      'ADVANCED_DURATION_LIMIT',
      'ADVANCED_RECORDING_LIMIT',
      undefined,
      'WORKER_FAILURE',
    ]) {
      const request = client.step();
      const rejected = assert.rejects(request, (error) => {
        assert.equal(error.code, code?.startsWith('ADVANCED_') ? code : undefined);
        return true;
      });
      worker.reply({
        ...worker.messages.at(-1),
        error: 'Advanced flight duration limit reached',
        code,
      });
      await rejected;
      assert.equal(worker.terminated, false);
    }
  } finally {
    client.dispose();
  }
});

test('complete recording verification has a bounded duration budget without weakening flight deadlines', async (t) => {
  const delays = [],
    realTimer = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    delays.push(delay);
    return realTimer(callback, delay, ...args);
  });
  const client = createAdvancedWorkerClient({ Worker: FakeWorker });
  try {
    const worker = FakeWorker.instances.at(-1);
    const pending = [client.initialize({}), client.verifyRecording({}), client.restore({})];
    assert.deepEqual(delays, [
      10000,
      (ADVANCED_MAX_SECONDS * 1000) / 2 + 60000,
      (ADVANCED_MAX_SECONDS * 1000) / 2 + 60000,
    ]);
    for (const message of worker.messages) worker.reply({ ...message, result: { accepted: true } });
    await Promise.all(pending);
    for (const value of [0, NaN, Infinity, 420001])
      assert.throws(
        () => createAdvancedWorkerClient({ Worker: FakeWorker, verificationWatchdogMs: value }),
        /verification deadline/,
      );
  } finally {
    client.dispose();
  }
});

test('cancelling recovery verification terminates its worker and rejects promptly', async () => {
  const client = createAdvancedWorkerClient({ Worker: FakeWorker });
  const pending = assert.rejects(client.restore({}), { name: 'AbortError' });
  client.dispose(new DOMException('Recovery cancelled', 'AbortError'));
  await pending;
  assert.equal(FakeWorker.instances.at(-1).terminated, true);
  assert.equal(FakeWorker.instances.at(-1).listeners.size, 0);
});

test('worker recovery verifies consumed dynamics before atomic adoption and preserves future input', async () => {
  let reply,
    id = 0;
  const handler = createAdvancedWorkerHandler((value) => (reply = value));
  const request = async (type, fields = {}) => {
    await handler.receive({ id: ++id, session: 'recovery', type, ...fields });
    return reply;
  };
  try {
    await request('init', {
      options: { floor: false, terrain: { format: 'AdvancedRegionalTerrain.v1' } },
    });
    const staged = await request('stage-terrain', {
      frame: createAdvancedTerrainFrame({
        sourceIdentity: '123456789abcdef0',
        colliders: [
          {
            id: 'floor',
            vertices: [-5, 0, -5, -5, 0, 5, 5, 0, 5, 5, 0, -5],
            indices: [0, 1, 2, 0, 2, 3],
          },
        ],
      }),
    });
    await request('commit-terrain', {
      decision: { transaction: staged.result.transaction, accepted: true },
    });
    const initial = (await request('snapshot')).result;
    const changedInitial = structuredClone(initial);
    changedInitial.state.motorSpeeds[0] = 0.2;
    assert.match(
      (await request('restore', { snapshot: changedInitial })).error,
      /replay verification/,
    );
    assert.deepEqual((await request('snapshot')).result, initial);
    for (let mission = 0; mission < 51; mission++)
      await request('step', {
        sample: {
          sequence: mission,
          timestampUs: mission * 20000,
          controls: { roll: 0.01, pitch: 0, yaw: 0, throttle: 0.2 },
        },
      });
    await request('input', {
      sample: {
        sequence: 51,
        timestampUs: 1100000,
        controls: { roll: 0, pitch: 0.02, yaw: 0, throttle: 0.3 },
      },
    });
    const original = (await request('snapshot')).result;
    for (const mutate of [
      (saved) => (saved.recording.inputs[0][0] = 1),
      (saved) => (saved.state.motorSpeeds[0] += 0.01),
      (saved) => (saved.controller.state.integral.roll += 0.001),
      (saved) => {
        const world = RAPIER.World.restoreSnapshot(Buffer.from(saved.world, 'base64'));
        const body = world.getRigidBody(saved.bodyHandle);
        body.setTranslation({ ...body.translation(), x: body.translation().x + 0.1 }, false);
        saved.world = Buffer.from(world.takeSnapshot()).toString('base64');
        world.free();
      },
    ]) {
      const changed = structuredClone(original);
      mutate(changed);
      assert.match(
        (await request('restore', { snapshot: changed })).error,
        /input consumption time|replay verification|recovery dynamics/,
      );
      assert.deepEqual((await request('snapshot')).result, original);
    }
    const legacy = structuredClone(original);
    delete legacy.recording.comparison;
    assert.equal((await request('restore', { snapshot: legacy })).result.missionTick, 51);
    assert.deepEqual((await request('snapshot')).result, original);
    for (let mission = 51; mission <= 55; mission++) await request('step');
    assert.equal((await request('telemetry')).result.consumedSequence, 51);
    assert.equal(
      (await replayAdvancedRecording((await request('recording')).result)).verified,
      true,
    );
  } finally {
    handler.dispose();
  }
});

test('worker protocol serializes initialization and supports transactional regional admission', async () => {
  const messages = [],
    handler = createAdvancedWorkerHandler((message) => messages.push(message));
  try {
    const initialize = handler.receive({
      id: 1,
      session: 'first',
      type: 'init',
      options: { rateProfile: createRateProfile() },
    });
    const propose = handler.receive({
      id: 2,
      session: 'first',
      type: 'propose',
      sample: {
        sequence: 0,
        timestampUs: 0,
        controls: { roll: 0.1, pitch: 0, yaw: 0, throttle: 0.5 },
      },
    });
    await Promise.all([initialize, propose]);
    assert.equal(messages[0].result.qualification.scored, false);
    assert.equal(messages[1].result.telemetry.missionTick, 1);
    await handler.receive({
      id: 3,
      session: 'first',
      type: 'commit',
      decision: { transaction: messages[1].result.transaction, accepted: false },
    });
    assert.equal(messages[2].result.telemetry.missionTick, 0);
    assert.equal(messages[2].result.telemetry.consumedSequence, -1);
    await handler.receive({ id: 4, session: 'old', type: 'step' });
    assert.match(messages[3].error, /Stale/);
    await handler.receive({ id: 5, session: 'first', type: 'step' });
    assert.equal(messages[4].result.telemetry.consumedSequence, 0);
    await handler.receive({ id: 6, session: 'first', type: 'reset' });
    assert.equal(messages[5].result.missionTick, 0);
  } finally {
    handler.dispose();
  }
});

test('arena comparison verifies its own frozen rates, rejects tampering and class changes, and leaves the reference worker unchanged', async () => {
  let reply,
    id = 0;
  const handler = createAdvancedWorkerHandler((value) => {
    reply = value;
  });
  const request = async (type, fields = {}) => {
    await handler.receive({ id: ++id, session: 'comparison', type, ...fields });
    return reply;
  };
  try {
    await request('init', {
      options: { rateProfile: createRateProfile({ axes: { roll: { rate: 80 } } }) },
    });
    for (let tick = 0; tick < 4; tick++)
      await request('step', {
        sample: {
          sequence: tick,
          timestampUs: tick * 20000,
          controls: { roll: 0.4, pitch: 0, yaw: 0, throttle: 0.1 },
        },
      });
    const candidate = (await request('recording')).result;
    const originalResult = await replayAdvancedRecording(candidate);
    const observed = [];
    const detachedResult = await replayAdvancedRecording(candidate, {
      onMissionTelemetry(sample) {
        observed.push(sample.missionTick);
        sample.position.x = 1e9;
        sample.orientation.w = 0;
      },
    });
    assert.deepEqual(observed, [0, 1, 2, 3, 4]);
    assert.deepEqual(detachedResult.telemetry, originalResult.telemetry);
    const initialized = (await request('init', { options: { rateProfile: createRateProfile() } }))
      .result;
    assert.notEqual(initialized.identity, candidate.identity);
    const verified = (await request('verify-recording', { recording: JSON.stringify(candidate) }))
      .result;
    assert.equal(verified.verified, true);
    assert.equal(verified.scored, false);
    assert.equal(verified.comparison.comparisonClass, initialized.comparison.comparisonClass);
    assert.equal(verified.path.length, 5);
    assert.deepEqual(verified.path[0], [0, 0, 2, 0, 0, 0, 0, 1]);
    assert.equal(verified.path[4][1], originalResult.telemetry.position.x);
    assert.deepEqual((await request('telemetry')).result, initialized.telemetry);
    const legacy = structuredClone(candidate);
    delete legacy.comparison;
    assert.deepEqual(
      (await request('verify-recording', { recording: legacy })).result.path,
      verified.path,
    );
    for (const malformed of [
      { ...candidate, finalHash: '00000000' },
      {
        ...candidate,
        comparison: { ...candidate.comparison, comparisonClass: '0000000000000000' },
      },
      { ...candidate, format: 'AdvancedRegionalRecording.v1' },
    ]) {
      const rejected = await request('verify-recording', { recording: malformed });
      assert.equal(typeof rejected.error, 'string');
      assert.equal(
        rejected.result,
        undefined,
        'a failed replay must not expose a provisional path',
      );
    }
    await request('init', {
      options: {
        rateProfile: createRateProfile({ throttle: { limitType: 'scale', limitPercent: 75 } }),
      },
    });
    assert.match(
      (await request('verify-recording', { recording: candidate })).error,
      /same aircraft, controller, throttle/,
    );
  } finally {
    handler.dispose();
  }
});
