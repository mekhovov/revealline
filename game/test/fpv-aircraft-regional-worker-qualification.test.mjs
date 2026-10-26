import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import { createAdvancedWorkerClient } from '../../optional-practice/civilian-fpv/advanced-worker-client.mjs';
import {
  REGIONAL_CASES,
  runRegionalProtocolCase,
  directRegionalClient,
  regionalProtocolOptions,
} from './helpers/fpv-aircraft-regional-worker-qualification.mjs';

// Structured-clone protocol test, not evidence of a native browser worker.
class HandlerWorker {
  static instances = [];
  constructor() {
    this.listeners = new Map();
    this.terminated = false;
    this.pending = 0;
    this.peak = 0;
    this.handler = createAdvancedWorkerHandler((message) => {
      if (!this.terminated) this.listeners.get('message')?.({ data: structuredClone(message) });
    });
    HandlerWorker.instances.push(this);
  }
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type) {
    this.listeners.delete(type);
  }
  postMessage(message) {
    this.pending++;
    this.peak = Math.max(this.peak, this.pending);
    this.last = this.handler.receive(structuredClone(message)).finally(() => {
      this.pending--;
      if (this.terminated) this.handler.dispose();
    });
  }
  terminate() {
    this.terminated = true;
    this.handler.dispose();
  }
}
const client = () => createAdvancedWorkerClient({ Worker: HandlerWorker });
for (const item of REGIONAL_CASES)
  test(`current Regional ${item.preset}/${item.mode} worker handler matches direct transitions and recovery`, async () => {
    const before = HandlerWorker.instances.length;
    const direct = await runRegionalProtocolCase(item),
      worker = await runRegionalProtocolCase(item, { createClient: client });
    assert.deepEqual(worker, direct);
    assert.equal(worker.acceptedSequence, 95);
    assert.equal(worker.consumedSequence, 95);
    assert.equal(worker.consumedTimestampUs, 1900000);
    assert.equal(worker.backend, 'civilian-quad-aircraft-regional.v3');
    assert.equal(worker.frequency, 1000);
    assert.ok(worker.boundaries.some(([tick]) => tick === worker.rollbackAt));
    assert.ok(worker.boundaries.length >= 2);
    assert.equal(worker.maxRetained, 3);
    assert.equal(worker.owners, 2);
    assert.equal(worker.peakPending, 1);
    assert.equal(worker.maxObservedInputPending, 1);
    const owners = HandlerWorker.instances.slice(before);
    await Promise.all(owners.map((owner) => owner.last));
    assert.equal(owners.length, 2);
    assert.ok(
      owners.every((owner) => owner.terminated && owner.listeners.size === 0 && owner.peak <= 2),
    );
    // Message delivery resolves before the handler's final bookkeeping microtask;
    // the client itself still has just one outstanding request, asserted above.
    assert.equal(worker.scored, false);
    assert.equal(worker.defaultEligible, false);
  });

test('Regional qualification rejects an already cancelled run without constructing an owner', async () => {
  const abort = new AbortController();
  abort.abort();
  let opened = false;
  await assert.rejects(
    runRegionalProtocolCase(REGIONAL_CASES[0], {
      signal: abort.signal,
      createClient() {
        opened = true;
        return client();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(opened, false);
});

test('Regional qualification cancels its owned worker while paused and ignores continuation', async () => {
  const abort = new AbortController(),
    before = HandlerWorker.instances.length;
  let phases = 0;
  await assert.rejects(
    runRegionalProtocolCase(REGIONAL_CASES[0], {
      createClient: client,
      signal: abort.signal,
      onProgress() {
        phases++;
      },
      pause() {
        abort.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.ok(phases > 0);
  assert.equal(HandlerWorker.instances.length, before + 1);
  assert.equal(HandlerWorker.instances.at(-1).terminated, true);
});

test('Regional qualification disposes on progress failure and starts a clean subsequent run', async () => {
  const before = HandlerWorker.instances.length;
  await assert.rejects(
    runRegionalProtocolCase(REGIONAL_CASES[0], {
      createClient: client,
      onProgress() {
        throw new Error('observer failed');
      },
    }),
    /observer failed/,
  );
  assert.equal(HandlerWorker.instances[before].terminated, true);
  const result = await runRegionalProtocolCase(REGIONAL_CASES[0], { createClient: client });
  assert.equal(result.checks.newOwnerRecovery, true);
});

test('Regional qualification rejects the wrong timing and detects changed rollback state', async () => {
  let closed = 0;
  await assert.rejects(
    runRegionalProtocolCase(REGIONAL_CASES[0], {
      createClient() {
        const direct = directRegionalClient();
        return {
          ...direct,
          initialize: (options) => direct.initialize({ ...options, frequency: 500 }),
          dispose() {
            closed++;
            direct.dispose();
          },
        };
      },
    }),
    /current Regional v3 at 1000 Hz/,
  );
  assert.equal(closed, 1);
  await assert.rejects(
    runRegionalProtocolCase(REGIONAL_CASES[0], {
      createClient() {
        const direct = directRegionalClient();
        let rejected = false;
        return {
          ...direct,
          async commitTerrainFrame(decision) {
            const result = await direct.commitTerrainFrame(decision);
            rejected ||= !decision.accepted;
            return result;
          },
          async snapshot() {
            const result = await direct.snapshot();
            if (rejected) result.hash = 'tampered';
            return result;
          },
        };
      },
    }),
    /Rejected terrain changed/,
  );
});

test('Regional qualification aborts an in-flight request and ignores its late handler reply', async () => {
  const abort = new AbortController();
  let delivered = 0;
  class InterruptedWorker extends HandlerWorker {
    postMessage(message) {
      if (message.type === 'step') {
        abort.abort();
        delivered++;
        super.postMessage(message);
      } else super.postMessage(message);
    }
  }
  const before = HandlerWorker.instances.length;
  await assert.rejects(
    runRegionalProtocolCase(REGIONAL_CASES[0], {
      signal: abort.signal,
      createClient: () => createAdvancedWorkerClient({ Worker: InterruptedWorker }),
    }),
    { name: 'AbortError' },
  );
  const owner = HandlerWorker.instances[before];
  await owner.last;
  assert.equal(delivered, 1);
  assert.equal(owner.terminated, true);
  assert.equal(owner.listeners.size, 0);
  assert.equal(HandlerWorker.instances.length, before + 1);
});

test('direct fixture disposal during initialization cannot create a late simulation owner', async () => {
  const direct = directRegionalClient();
  const initializing = direct.initialize(regionalProtocolOptions(REGIONAL_CASES[0]));
  direct.dispose();
  await assert.rejects(initializing, /owner is closed/);
  await assert.rejects(
    direct.initialize(regionalProtocolOptions(REGIONAL_CASES[0])),
    /owner is closed/,
  );
  await assert.rejects(direct.snapshot());
  direct.dispose();
});
