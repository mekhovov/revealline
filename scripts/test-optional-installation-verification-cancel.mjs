import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  installFinalVerificationGate,
  validateVerificationTarget,
  selectFinalVerificationCancel,
  assertFinalVerificationCancellation,
  observeFinalVerificationCancel,
  assertVerificationOwnership,
} from './optional-installation-verification-cancel.mjs';

const expected = {
  id: 'civilian-fpv',
  scope:
    'http://127.0.0.1:123/revealline/practice/civilian-fpv/releases/v0.0.1/site/optional-practice/civilian-fpv/',
  revision: 'a'.repeat(64),
};
expected.scriptURL = expected.scope + 'worker.js';
const reply = {
  type: 'practice-status',
  scope: expected.scope,
  revision: expected.revision,
  ready: true,
  status: 'ready',
  total: 1234,
  unchanged: 'native-payload',
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const calls = [],
    ports = [],
    timers = new Map(),
    listeners = new Map();
  let now = 0,
    nextTimer = 0;
  const view = { shown: true, text: 'Verifying · 100%' };
  const node = (extra = {}) => ({
    getBoundingClientRect: () => ({ width: view.shown ? 100 : 0, height: 40 }),
    ...extra,
  });
  const button = node({ textContent: 'Cancel download', disabled: false });
  const status = node({
    get textContent() {
      return view.text;
    },
  });
  // Preserve accessor rather than spreading its initial value.
  Object.defineProperty(status, 'textContent', { get: () => view.text });
  const panel = node({ querySelector: (selector) => (selector === 'button' ? button : status) });
  class Port {
    closed = false;
    postMessage(data) {
      if (!this.closed && !this.peer.closed) queueMicrotask(() => this.peer.onmessage?.({ data }));
    }
    close() {
      this.closed = true;
    }
  }
  class MessageChannel {
    constructor() {
      this.port1 = new Port();
      this.port2 = new Port();
      this.port1.peer = this.port2;
      this.port2.peer = this.port1;
      ports.push(this.port1, this.port2);
    }
  }
  class ServiceWorker {
    scriptURL = expected.scriptURL;
    state = 'activated';
    postMessage(...args) {
      calls.push({ receiver: this, args });
      if (this.error) throw this.error;
      return 'native-result';
    }
  }
  const native = ServiceWorker.prototype.postMessage;
  const context = {
    ServiceWorker,
    MessageChannel,
    URL,
    structuredClone,
    location: {
      origin: new URL(expected.scope).origin,
      pathname: new URL(expected.scope).pathname + 'index.html',
    },
    performance: { now: () => now },
    document: {
      querySelector: () => panel,
      addEventListener: (type, callback) => listeners.set(type, callback),
      removeEventListener: (type, callback) => {
        if (listeners.get(type) === callback) listeners.delete(type);
      },
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
    setTimeout: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback, when: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const evaluate = async (fn, arg) => {
    context.__argument = arg;
    return runInNewContext(`(${fn.toString()})(__argument)`, context);
  };
  const gate = () => context.__practiceVerificationReplyGate;
  const arm = () => evaluate(installFinalVerificationGate, { expected, owner: 'f'.repeat(32) });
  const request = (worker = new ServiceWorker(), data = { type: 'practice-status' }) => {
    const channel = new MessageChannel(),
      received = [];
    channel.port1.onmessage = ({ data }) => received.push(data);
    const result = worker.postMessage(data, [channel.port2]);
    return { worker, channel, received, data, result };
  };
  const respond = async (data = reply) => {
    calls.at(-1).args[1][0].postMessage(data);
    await flush();
  };
  const click = (trusted = true) =>
    listeners.get('click')?.({ target: button, isTrusted: trusted });
  const tick = (amount) => {
    now += amount;
    for (const [id, row] of timers)
      if (row.when <= now) {
        timers.delete(id);
        row.callback();
      }
  };
  return {
    context,
    calls,
    ports,
    timers,
    listeners,
    view,
    button,
    native,
    evaluate,
    gate,
    arm,
    request,
    respond,
    click,
    tick,
    ServiceWorker,
  };
}

test('strict opt-in/targets reject mixed lanes and arbitrary origins/routes; omitted mode unchanged', () => {
  assert.equal(selectFinalVerificationCancel(undefined, {}), false);
  assert.equal(selectFinalVerificationCancel('all', { worldSeed: true }), true);
  for (const key of [
    'download',
    'quota',
    'quotaPackages',
    'migration',
    'activeSession',
    'activeWindow',
    'importedWorld',
  ])
    for (const value of ['', '0', 'all'])
      assert.throws(() => selectFinalVerificationCancel('all', { worldSeed: true, [key]: value }));
  assert.throws(() => selectFinalVerificationCancel('all', { worldSeed: false }));
  assert.throws(() => selectFinalVerificationCancel('one', { worldSeed: true }));
  validateVerificationTarget(expected);
  for (const mutation of [
    { scope: expected.scope.replace('127.0.0.1', 'example.com') },
    { revision: 'bad' },
    { scriptURL: expected.scriptURL + '?x' },
    { id: 'other' },
    { scope: expected.scope.replace('v0.0.1', 'v0.0.2') },
  ])
    assert.throws(() => validateVerificationTarget({ ...expected, ...mutation }));
});
test('one exact final ready reply is held and forwarded unchanged; native receiver/request and return survive', async () => {
  const f = fixture();
  await f.arm();
  const request = f.request();
  assert.equal(request.result, 'native-result');
  assert.equal(f.calls[0].receiver, request.worker);
  assert.equal(f.calls[0].args[0], request.data);
  assert.notEqual(f.calls[0].args[1][0], request.channel.port2);
  await f.respond();
  assert.deepEqual(request.received, []);
  f.click();
  const state = f.gate().close();
  await flush();
  assert.equal(state.matched, 1);
  assert.equal(state.clicks, 1);
  assert.equal(state.forwarded, true);
  // A real structured-clone transport preserves fields; the fake additionally witnesses object identity.
  assert.equal(request.received[0], reply);
  assert.equal(f.ServiceWorker.prototype.postMessage, f.native);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  assert(f.ports.slice(1).every((port) => port.closed));
});
for (const kind of [
  'download',
  'hidden',
  'disabled',
  'other-worker',
  'initial-check',
  'progress',
  'extra-key',
])
  test(`nonmatching ${kind} request is forwarded without interception`, async () => {
    const f = fixture();
    await f.arm();
    const worker = new f.ServiceWorker();
    let data = { type: 'practice-status' };
    if (kind === 'download') f.view.text = 'Downloading · 100%';
    if (kind === 'initial-check') f.view.text = 'Checking offline files…';
    if (kind === 'hidden') f.view.shown = false;
    if (kind === 'disabled') f.button.disabled = true;
    if (kind === 'other-worker')
      worker.scriptURL = expected.scriptURL.replace('civilian-fpv/', 'fpv-worlds/');
    if (kind === 'progress') data.type = 'practice-progress';
    if (kind === 'extra-key') data.other = true;
    const request = f.request(worker, data);
    assert.equal(f.calls[0].args[1][0], request.channel.port2);
    assert.equal(f.gate().snapshot().matched, 0);
    f.gate().close();
  });
test('second exact request is not intercepted and prevents a one-request claim', async () => {
  const f = fixture();
  await f.arm();
  f.request();
  await f.respond();
  const second = f.request();
  assert.equal(f.calls.at(-1).args[1][0], second.channel.port2);
  assert.equal(f.gate().snapshot().targetRequests, 2);
  f.gate().close();
});
for (const mismatch of ['revision', 'scope', 'ready', 'status'])
  test(`invalid original ${mismatch} is forwarded unchanged but cannot qualify`, async () => {
    const f = fixture();
    await f.arm();
    const request = f.request();
    const value = { ...reply, [mismatch]: mismatch === 'ready' ? false : 'invalid' };
    await f.respond(value);
    await flush();
    assert.equal(request.received[0], value);
    assert.equal(f.gate().snapshot().closed, true);
    assert(f.gate().snapshot().cleanupErrors.length > 0);
  });
test('untrusted/hidden-phase clicks cannot count as cancellation', async () => {
  const f = fixture();
  await f.arm();
  f.request();
  await f.respond();
  f.click(false);
  f.view.text = 'Downloading · 100%';
  f.click();
  assert.equal(f.gate().snapshot().clicks, 0);
  f.gate().close();
});
for (const failure of [
  'before-match',
  'before-reply',
  'held-reply',
  'pagehide',
  'post-error',
  'messageerror',
  'ownership-change',
  'descriptor-change',
])
  test(`gate cleanup stays bounded on ${failure}`, async () => {
    const f = fixture();
    await f.arm();
    if (failure === 'post-error') {
      const worker = new f.ServiceWorker();
      worker.error = new Error('original-error');
      assert.throws(() => f.request(worker), /original-error/);
    } else if (failure !== 'before-match') {
      f.request();
      if (
        failure === 'held-reply' ||
        failure === 'ownership-change' ||
        failure === 'descriptor-change'
      )
        await f.respond();
      if (failure === 'messageerror') f.ports[2].onmessageerror();
      if (failure === 'pagehide') f.listeners.get('pagehide')();
      if (failure === 'ownership-change') {
        const replacement = () => {};
        f.ServiceWorker.prototype.postMessage = replacement;
        f.gate().close();
        assert.equal(f.ServiceWorker.prototype.postMessage, replacement);
      }
      if (failure === 'descriptor-change') {
        Object.defineProperty(f.ServiceWorker.prototype, 'postMessage', { configurable: false });
        f.gate().close();
        assert.equal(
          Object.getOwnPropertyDescriptor(f.ServiceWorker.prototype, 'postMessage').configurable,
          false,
        );
        assert(f.ports.slice(1).every((port) => port.closed));
      }
    }
    if (failure === 'before-match') f.tick(30000);
    if (failure === 'before-reply' || failure === 'held-reply') f.tick(10000);
    const state = f.gate().snapshot();
    assert.equal(state.closed, true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
    assert(state.expired || state.cleanupErrors.length > 0);
    const before = plain(state);
    if (f.calls.length) await f.respond();
    assert.deepEqual(
      plain(f.gate().snapshot()),
      before,
      'Late callbacks cannot mutate a closed receipt.',
    );
  });

function successfulReceipt() {
  return {
    gate: {
      matched: 1,
      targetRequests: 1,
      clicks: 1,
      expired: false,
      closed: true,
      forwarded: true,
      cleanupErrors: [],
      events: [
        'final-verification-request',
        'native-ready-reply-held',
        'ordinary-cancel-click',
        'original-reply-forwarded',
      ].map((kind, index) => ({ kind, elapsedMs: index * 10 })),
    },
    gateInstalled: true,
    operationSettled: true,
    cancelAction: 'one ordinary pointer click on visible Cancel download',
    visibleStatus: 'Verifying · 100%',
    status: 'Offline download cancelled.',
    cancelLatencyMs: 25,
    screenshot: { sha256: 'a'.repeat(64) },
  };
}
for (const boundary of ['match', 'reply', 'click', 'snapshot', 'close'])
  test(`delayed timer dispatch cannot bypass the absolute ${boundary} deadline`, async () => {
    const f = fixture();
    await f.arm();
    if (boundary !== 'match') f.request();
    if (!['match', 'reply'].includes(boundary)) await f.respond();
    if (boundary === 'snapshot' || boundary === 'close') f.click();
    // Advance only the monotonic clock, deliberately leave timer callbacks queued.
    f.context.performance.now = () => (boundary === 'match' ? 30001 : 11001);
    if (boundary === 'match') f.request();
    if (boundary === 'reply') await f.respond();
    if (boundary === 'click') f.click();
    if (boundary === 'snapshot') f.gate().snapshot();
    if (boundary === 'close') f.gate().close();
    const state = plain(f.gate().snapshot());
    assert.equal(state.expired, true);
    assert.equal(state.closed, true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.ServiceWorker.prototype.postMessage, f.native);
    if (boundary === 'match') assert.equal(state.matched, 0);
    if (boundary === 'reply') assert.equal(state.reply, null);
    if (boundary === 'click') assert.equal(state.clicks, 0);
    assert.throws(() =>
      assertFinalVerificationCancellation({ ...successfulReceipt(), gate: state }),
    );
  });
test('receipt timing independently rejects late click/forward, late match and nonmonotonic events', () => {
  for (const defect of [
    'late-click',
    'late-forward',
    'late-match',
    'nonmonotonic',
    'missing-time',
  ]) {
    const receipt = successfulReceipt(),
      events = receipt.gate.events;
    if (defect === 'late-click') {
      events[2].elapsedMs = 11001;
      events[3].elapsedMs = 11001;
    }
    if (defect === 'late-forward') events[3].elapsedMs = 10000;
    if (defect === 'late-match')
      events.forEach((row) => {
        row.elapsedMs += 30001;
      });
    if (defect === 'nonmonotonic') events[1].elapsedMs = -1;
    if (defect === 'missing-time') delete events[2].elapsedMs;
    // Even forged expired:false cannot erase event-bound deadline evidence.
    assert.equal(receipt.gate.expired, false);
    assert.throws(() => assertFinalVerificationCancellation(receipt), defect);
  }
});
test('receipt validator rejects download cancellation, timeout, success, unsafe cleanup and pending work', () => {
  assertFinalVerificationCancellation(successfulReceipt());
  for (const change of [
    { visibleStatus: 'Downloading ·100%' },
    { status: 'Ready offline' },
    { status: 'Cancelled after stalled timeout' },
    { operationSettled: false },
    { cancelLatencyMs: 5000 },
  ])
    assert.throws(() => assertFinalVerificationCancellation({ ...successfulReceipt(), ...change }));
  for (const change of [
    { expired: true },
    { targetRequests: 2 },
    { clicks: 0 },
    { forwarded: false },
    { cleanupErrors: ['failure'] },
  ])
    assert.throws(() =>
      assertFinalVerificationCancellation({
        ...successfulReceipt(),
        gate: { ...successfulReceipt().gate, ...change },
      }),
    );
});

for (const outcome of [
  'success',
  'capture-error',
  'wrong-phase',
  'hidden-cancel',
  'expired',
  'unexpected-success',
])
  test(`public UI adapter ${outcome} preserves one-click/cleanup constraints`, async () => {
    const f = fixture();
    let completed,
      terminal = '',
      waits = 0,
      clicks = 0;
    const done = new Promise((resolve) => {
      completed = resolve;
    });
    const page = {
      evaluate: async (fn, arg) => {
        if (fn.toString().includes('__optionalInstallationWitness')) return;
        const value = await f.evaluate(fn, arg);
        return value === undefined ? undefined : plain(value);
      },
      waitForFunction: async () => {
        if (++waits === 2) {
          if (outcome === 'unexpected-success')
            throw new Error('Unexpected offline action result: Ready offline.');
          await done;
        }
      },
      locator(selector) {
        const loc = {
          waitFor: async () => {},
          press: async () => {
            f.request();
            await f.respond();
          },
          innerText: async () => (outcome === 'wrong-phase' ? 'Downloading · 100%' : f.view.text),
          textContent: async () => terminal,
          isVisible: async () => (outcome === 'hidden-cancel' ? false : f.view.shown),
          isEnabled: async () => !f.button.disabled,
          click: async () => {
            clicks++;
            f.click();
            terminal = 'Offline download cancelled.';
            f.view.shown = false;
            completed();
          },
          locator: () => loc,
          getByRole: () => loc,
        };
        assert(typeof selector === 'string');
        return loc;
      },
    };
    const receipt = {};
    const operation = observeFinalVerificationCancel({
      page,
      expectedWorker: expected,
      receipt,
      capture: async () => {
        assert.equal(f.gate().snapshot().held, true);
        if (outcome === 'capture-error') throw new Error('capture failed');
        if (outcome === 'expired') f.tick(10000);
        return { path: '/tmp/fixture.png', bytes: 1, sha256: 'b'.repeat(64) };
      },
    });
    if (outcome === 'success') {
      await operation;
      assert.equal(clicks, 1);
      assert.equal(receipt.passed, true);
    } else {
      await assert.rejects(operation);
      assert.equal(clicks, 0);
      assert.equal(receipt.passed, false);
      completed();
    }
    assert.equal(f.ServiceWorker.prototype.postMessage, f.native);
    assert.equal(f.timers.size, 0);
  });

test('complete unrecorded target is the only extra permitted scope; pointers/sibling workers/caches remain exact', () => {
  const baseline = {
    keys: { old: 'exact' },
    caches: ['old-cache', 'sibling-cache'],
    workers: [{ scope: 'http://127.0.0.1:123/old/', active: 'activated' }],
  };
  const cache = `revealline.optional.package.v1:${new URL(expected.scope).pathname}:${expected.revision}`;
  const after = {
    keys: { ...baseline.keys },
    caches: [...baseline.caches, cache].sort(),
    workers: [...baseline.workers, { scope: expected.scope, active: 'activated' }].sort((a, b) =>
      a.scope.localeCompare(b.scope),
    ),
  };
  assertVerificationOwnership(after, baseline, expected, true);
  assertVerificationOwnership(baseline, baseline, expected);
  assert.throws(() => assertVerificationOwnership(after, baseline, expected));
  for (const defect of ['pointer', 'old-cache', 'orphan', 'worker', 'inactive']) {
    const bad = structuredClone(after);
    if (defect === 'pointer') bad.keys.new = 'adopted';
    if (defect === 'old-cache') bad.caches = bad.caches.filter((name) => name !== 'old-cache');
    if (defect === 'orphan') bad.caches.push('staging');
    if (defect === 'worker') bad.workers.pop();
    if (defect === 'inactive') bad.workers[0].active = 'installing';
    assert.throws(() => assertVerificationOwnership(bad, baseline, expected, true), defect);
  }
});
test('refused pre-existing gate is never closed by another observer invocation cleanup', async () => {
  const f = fixture();
  await f.arm();
  const foreign = f.gate();
  const page = { evaluate: f.evaluate };
  const receipt = {};
  await assert.rejects(
    observeFinalVerificationCancel({
      page,
      expectedWorker: expected,
      receipt,
      capture: async () => {
        throw new Error('not reached');
      },
    }),
    /already owned/,
  );
  assert.equal(f.gate(), foreign);
  assert.equal(foreign.snapshot().closed, false);
  assert.equal(receipt.passed, false);
  assert.equal(receipt.gate, null);
  foreign.close();
  assert.equal(f.timers.size, 0);
});
