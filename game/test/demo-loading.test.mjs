import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { withDemoLoadingDeadline } from '../demo-loading.mjs';
import { loadDemoCatalog, loadDemoRecording } from '../demo-catalog.mjs';
import { demoLoadingClock, settleDemoLoading } from './helpers/demo-loading-clock.mjs';

const never = () => new Promise(() => {});
const catalogue = JSON.stringify({ format: 'revealline-demo-catalog.v1', clips: [] });

for (const stage of ['fetch', 'body'])
  test(`catalogue ${stage} which ignores abort still has a finite total loading deadline`, async () => {
    const clock = demoLoadingClock();
    let signal,
      cancellations = 0;
    const request = loadDemoCatalog({
      ...clock.options,
      fetch: async (_, options) => {
        signal = options.signal;
        if (stage === 'fetch') return never();
        return { ok: true, text: never, body: { cancel: () => cancellations++ } };
      },
    });
    const rejected = assert.rejects(request, { name: 'DemoLoadingTimeoutError' });
    await settleDemoLoading();
    clock.advance(14999);
    assert.equal(signal.aborted, false);
    clock.advance(1);
    await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(cancellations, stage === 'body' ? 1 : 0);
    assert.equal(clock.pending, 0);
  });

test('fetch and body share a budget; success retires timers and caller listeners', async () => {
  const clock = demoLoadingClock(),
    controller = new AbortController();
  let releaseFetch, childSignal, releaseBody;
  const request = loadDemoCatalog({
    ...clock.options,
    signal: controller.signal,
    fetch: (_, { signal }) => {
      childSignal = signal;
      return new Promise((resolve) => {
        releaseFetch = resolve;
      });
    },
  });
  clock.advance(10000);
  releaseFetch({
    ok: true,
    text: () =>
      new Promise((resolve) => {
        releaseBody = resolve;
      }),
  });
  await settleDemoLoading();
  clock.advance(4999);
  releaseBody(catalogue);
  assert.deepEqual(await request, { format: 'revealline-demo-catalog.v1', clips: [] });
  assert.equal(clock.pending, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  controller.abort();
  assert.equal(childSignal.aborted, false, 'Successful work no longer follows the caller signal.');
  clock.advance(1);
});

test('replay body timeout and parent cancellation settle before an uncooperative body returns', async () => {
  for (const cancel of [false, true]) {
    const clock = demoLoadingClock(),
      controller = new AbortController();
    let bodySignal,
      cancellations = 0,
      rejectBody;
    const request = loadDemoRecording(
      { source: 'curated', replayURL: './demo-data/first-signal-left.replay.json' },
      {
        ...clock.options,
        signal: controller.signal,
        fetch: async (_, { signal }) => {
          bodySignal = signal;
          return {
            ok: true,
            text: () =>
              new Promise((_, reject) => {
                rejectBody = reject;
              }),
            body: { cancel: () => cancellations++ },
          };
        },
      },
    );
    const rejected = assert.rejects(request, {
      name: cancel ? 'AbortError' : 'DemoLoadingTimeoutError',
    });
    await settleDemoLoading();
    if (cancel) controller.abort('selection changed');
    else clock.advance(15000);
    await rejected;
    assert.equal(bodySignal.aborted, true);
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(cancellations, 1);
    assert.equal(clock.pending, 0);
    rejectBody(new Error('Late body rejection'));
    await settleDemoLoading();
    assert.equal(cancellations, 1);
  }
});

test('cancelled late fetch cancels its body without starting text parsing', async () => {
  const clock = demoLoadingClock(),
    controller = new AbortController();
  let resolveFetch,
    cancelled = 0,
    reads = 0;
  const request = loadDemoCatalog({
    ...clock.options,
    signal: controller.signal,
    fetch: () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
  });
  const reason = new DOMException('Newer selection', 'AbortError');
  controller.abort(reason);
  await assert.rejects(request, (error) => error === reason);
  resolveFetch({
    ok: true,
    text: async () => {
      reads++;
      return catalogue;
    },
    body: { cancel: () => cancelled++ },
  });
  await settleDemoLoading();
  assert.equal(cancelled, 1);
  assert.equal(reads, 0);
  assert.equal(clock.pending, 0);
});

test('loading cleans up synchronous failure, early abort, late rejection and failing late disposal', async () => {
  const clock = demoLoadingClock(),
    controller = new AbortController();
  const failure = new Error('Synchronous failure');
  await assert.rejects(
    withDemoLoadingDeadline(() => {
      throw failure;
    }, clock.options),
    (error) => error === failure,
  );
  assert.equal(clock.pending, 0);
  controller.abort();
  let called = false;
  await assert.rejects(
    withDemoLoadingDeadline(
      () => {
        called = true;
      },
      { ...clock.options, signal: controller.signal },
    ),
    { name: 'AbortError' },
  );
  assert.equal(called, false);
  let resolve;
  const request = withDemoLoadingDeadline(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
    {
      ...clock.options,
      onLateResult: () => Promise.reject(new Error('Disposed late owner')),
    },
  );
  const rejected = assert.rejects(request, { name: 'DemoLoadingTimeoutError' });
  clock.advance(15000);
  await rejected;
  resolve({});
  await settleDemoLoading();
  assert.equal(clock.pending, 0);
});

test('slow fetch cannot restart the body deadline and all cancellation listeners are retired', async () => {
  const clock = demoLoadingClock(),
    controller = new AbortController();
  let releaseFetch,
    bodyStarted = false;
  const request = loadDemoCatalog({
    ...clock.options,
    signal: controller.signal,
    fetch: () =>
      new Promise((resolve) => {
        releaseFetch = resolve;
      }),
  });
  const rejected = assert.rejects(request, { name: 'DemoLoadingTimeoutError' });
  clock.advance(10000);
  releaseFetch({
    ok: true,
    text: () => {
      bodyStarted = true;
      return never();
    },
  });
  await settleDemoLoading();
  assert.equal(bodyStarted, true);
  clock.advance(5000);
  await rejected;
  assert.equal(clock.pending, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});
