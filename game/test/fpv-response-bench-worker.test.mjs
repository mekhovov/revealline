import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponseBenchClient } from '../../optional-practice/civilian-fpv/response-bench-client.mjs';
import { createResponseBenchWorkerHandler } from '../../optional-practice/civilian-fpv/response-bench-worker.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

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
  postMessage(value) {
    this.messages.push(value);
  }
  terminate() {
    this.terminated = true;
  }
  reply(value) {
    this.listeners.get('message')?.({ data: value });
  }
}
const config = () => createPresetConfiguration('meteor75-analog-2022');
const request = () => ({ saved: config(), draft: config(), axis: 'roll' });

test('a comparison owns an immutable snapshot and frees its worker on success', async () => {
  const client = createResponseBenchClient({ Worker: FakeWorker });
  const input = request(),
    progress = [];
  const result = client.compare(input, { onProgress: (value) => progress.push(value) });
  const worker = FakeWorker.instances.at(-1),
    message = worker.messages[0];
  assert.match(worker.url.pathname, /response-bench-worker.mjs$/);
  assert.equal(worker.options.type, 'module');
  input.draft.controller.gains.roll.p = 1000;
  assert.notEqual(message.request.draft.controller.gains.roll.p, 1000);
  worker.reply({ id: 'another-job', result: 'stale' });
  assert.equal(client.busy(), true);
  worker.reply({ id: message.id, progress: { completed: 1 } });
  assert.deepEqual(progress, [{ completed: 1 }]);
  worker.reply({ id: message.id, result: { measured: true } });
  assert.deepEqual(await result, { measured: true });
  assert.equal(client.busy(), false);
  assert.equal(worker.terminated, true);
  assert.equal(worker.listeners.size, 0);
  client.dispose();
});

test('replacement terminates the previous CPU owner and ignores late completion', async () => {
  const client = createResponseBenchClient({ Worker: FakeWorker });
  const previous = client.compare(request());
  const oldWorker = FakeWorker.instances.at(-1),
    oldReceive = oldWorker.listeners.get('message');
  const rejected = assert.rejects(previous, { name: 'AbortError' });
  const next = client.suggest({ draft: config(), axis: 'yaw', inputReady: true });
  await rejected;
  assert.equal(oldWorker.terminated, true);
  const worker = FakeWorker.instances.at(-1),
    message = worker.messages[0];
  oldReceive({ data: { id: oldWorker.messages[0].id, result: 'old' } });
  assert.equal(client.busy(), true);
  worker.reply({ id: message.id, result: { status: 'no-clear-improvement' } });
  assert.deepEqual(await next, { status: 'no-clear-improvement' });
  client.dispose();
});

test('cancel, close, deadline, worker errors and message errors release listeners and workers', async () => {
  for (const action of ['cancel', 'dispose', 'timeout', 'error', 'messageerror']) {
    const client = createResponseBenchClient({
      Worker: FakeWorker,
      timeoutMs: action === 'timeout' ? 5 : 1000,
    });
    const result = client.compare(request()),
      worker = FakeWorker.instances.at(-1);
    const rejected = assert.rejects(result);
    if (action === 'cancel' || action === 'dispose') client[action]();
    else if (action !== 'timeout') worker.listeners.get(action)({ message: 'test failure' });
    await rejected;
    assert.equal(worker.terminated, true, action);
    assert.equal(worker.listeners.size, 0, action);
    assert.equal(client.busy(), false, action);
    client.dispose();
    await assert.rejects(client.compare(request()), /closed/);
  }
});

test('progress failures and postMessage failure cannot strand a worker', async () => {
  const client = createResponseBenchClient({ Worker: FakeWorker });
  const result = client.compare(request(), {
    onProgress: () => {
      throw new Error('host closed');
    },
  });
  const worker = FakeWorker.instances.at(-1),
    message = worker.messages[0];
  worker.reply({ id: message.id, progress: {} });
  await assert.rejects(result, /host closed/);
  assert.equal(worker.terminated, true);
  client.dispose();
  class BrokenWorker extends FakeWorker {
    postMessage() {
      throw new Error('cannot send');
    }
  }
  const broken = createResponseBenchClient({ Worker: BrokenWorker });
  await assert.rejects(broken.compare(request()), /cannot send/);
  assert.equal(FakeWorker.instances.at(-1).terminated, true);
  broken.dispose();
  assert.throws(() => createResponseBenchClient({ Worker: null }), /Web Workers/);
  assert.throws(
    () => createResponseBenchClient({ Worker: FakeWorker, timeoutMs: Infinity }),
    /deadline/,
  );
});

test('worker handler copies input, rejects reuse and does not post late results after disposal', async () => {
  const messages = [];
  let resolve, received;
  const handler = createResponseBenchWorkerHandler((value) => messages.push(value), {
    compare: (input, options) => {
      received = input;
      options.onProgress({ stage: 'working' });
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const original = request();
  const pending = handler.receive({ id: 'job-1', type: 'compare', request: original });
  original.axis = 'yaw';
  assert.equal(received.axis, 'roll');
  assert.equal(messages.length, 1);
  await handler.receive({ id: 'job-2', type: 'compare', request: request() });
  assert.match(messages.at(-1).error, /one immutable job/);
  handler.dispose();
  resolve({ finished: true });
  await pending;
  assert.equal(messages.length, 2);
});

test('worker handler production comparison returns bounded results and reports unsupported controllers', async () => {
  const messages = [];
  const handler = createResponseBenchWorkerHandler((message) => messages.push(message));
  await handler.receive({ id: 'real-job', type: 'compare', request: request() });
  const result = messages.at(-1).result;
  assert.equal(result.format, 'FpvResponseBench.v1');
  assert.equal(result.baseline.metrics.sampleCount, 1500);
  assert.equal(result.baseline.trace.length, 150);
  handler.dispose();
  const badMessages = [],
    bad = createResponseBenchWorkerHandler((message) => badMessages.push(message));
  await bad.receive({ id: 'invalid-job', type: 'compare', request: { saved: {}, draft: {} } });
  assert.equal(typeof badMessages.at(-1).error, 'string');
  bad.dispose();
});
