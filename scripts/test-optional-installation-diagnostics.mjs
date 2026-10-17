import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { installOptionalStatusDiagnostics } from './optional-installation-diagnostics.mjs';

function fixture() {
  const rows = [],
    calls = [],
    listeners = new Map();
  class Port {
    handlers = new Map();
    addEventListener(type, callback) {
      this.handlers.set(type, callback);
    }
    emit(type, data) {
      this.handlers.get(type)?.({ data });
    }
    start() {
      throw new Error('The diagnostic must not start a port.');
    }
  }
  class MessageChannel {
    port1 = new Port();
    port2 = new Port();
  }
  class ServiceWorker {
    scriptURL = 'https://test.invalid/practice/worker.js';
    state = 'activated';
    postMessage(...args) {
      calls.push({ self: this, args });
      if (this.failure) throw this.failure;
      return 'native-result';
    }
  }
  class ServiceWorkerContainer {
    getRegistration(...args) {
      calls.push({ self: this, args });
      return this.promise;
    }
  }
  const context = {
    MessageChannel,
    ServiceWorker,
    ServiceWorkerContainer,
    performance: { now: () => 123 },
    __optionalStatusDiagnostic: (row) => {
      rows.push(JSON.parse(JSON.stringify(row)));
      return Promise.resolve();
    },
    addEventListener: (type, callback) => listeners.set(type, callback),
  };
  runInNewContext(`(${installOptionalStatusDiagnostics})()`, context);
  return { context, rows, calls, listeners, MessageChannel };
}

test('diagnostics preserve channel construction, native post arguments and port lifetime', () => {
  const f = fixture();
  class DerivedChannel extends f.context.MessageChannel {}
  const channel = new DerivedChannel(),
    worker = new f.context.ServiceWorker(),
    payload = { type: 'practice-status' },
    ports = [channel.port2];
  assert(channel instanceof DerivedChannel);
  assert(channel instanceof f.MessageChannel);
  assert.equal(worker.postMessage(payload, ports), 'native-result');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].self, worker);
  assert.equal(f.calls[0].args[0], payload);
  assert.equal(f.calls[0].args[1], ports);
  channel.port1.emit('message', {
    type: 'practice-status',
    ready: false,
    status: 'unknown',
    scope: 'https://test.invalid/',
    privateData: 'must not be recorded',
  });
  assert.deepEqual(
    f.rows.map((row) => row.type),
    ['status-request', 'status-reply'],
  );
  assert.equal(f.rows[0].channelId, f.rows[1].channelId);
  assert.equal(f.rows[1].status, 'unknown');
  assert(!JSON.stringify(f.rows).includes('privateData'));
});

test('registration witness returns the exact original promise and records resolution/rejection', async () => {
  const f = fixture(),
    container = new f.context.ServiceWorkerContainer(),
    registration = { scope: 'https://test.invalid/', active: new f.context.ServiceWorker() };
  container.promise = Promise.resolve(registration);
  const result = container.getRegistration('https://test.invalid/');
  assert.equal(result, container.promise);
  assert.equal(await result, registration);
  assert.equal(f.rows[1].type, 'registration-result');
  assert.equal(f.rows[1].active.state, 'activated');
  const error = new Error('unrecorded private failure text');
  error.name = 'SecurityError';
  container.promise = Promise.reject(error);
  assert.equal(container.getRegistration('https://test.invalid/'), container.promise);
  await assert.rejects(container.promise, (observed) => observed === error);
  assert.equal(f.rows.at(-1).type, 'registration-error');
  assert.equal(f.rows.at(-1).errorName, 'SecurityError');
  assert(!JSON.stringify(f.rows).includes(error.message));
});

test('post exceptions are observed and rethrown unchanged; unrelated messages remain unrecorded', () => {
  const f = fixture(),
    worker = new f.context.ServiceWorker(),
    channel = new f.context.MessageChannel();
  worker.postMessage({ type: 'not-the-status-protocol', privateData: 'not recorded' });
  channel.port1.emit('message', { type: 'private-message', privateData: 'not recorded' });
  assert.equal(f.rows.length, 0);
  worker.failure = new Error('native throw');
  assert.throws(
    () => worker.postMessage({ type: 'practice-status' }, [channel.port2]),
    (error) => error === worker.failure,
  );
  assert.equal(f.rows.at(-1).type, 'status-post-error');
});

test('diagnostic failures and bounded event volume cannot alter native operations', () => {
  const f = fixture(),
    worker = new f.context.ServiceWorker();
  for (let index = 0; index < 600; index++) worker.postMessage({ type: 'practice-status' });
  assert.equal(f.rows.length, 513);
  assert.equal(f.rows.at(-1).type, 'diagnostic-events-dropped');
  assert.equal(f.calls.length, 600);
  const fresh = fixture();
  fresh.context.__optionalStatusDiagnostic = () => {
    throw new Error('observer unavailable');
  };
  assert.equal(
    new fresh.context.ServiceWorker().postMessage({ type: 'practice-status' }),
    'native-result',
  );
});
