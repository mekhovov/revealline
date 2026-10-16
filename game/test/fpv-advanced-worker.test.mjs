import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvancedWorkerClient } from '../../optional-practice/civilian-fpv/advanced-worker-client.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';

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
