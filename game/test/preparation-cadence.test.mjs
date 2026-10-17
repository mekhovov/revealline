import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPreparationCadence,
  PREPARATION_CADENCE_TIMEOUT_MS,
  PreparationCadenceTimeoutError,
} from '../ui/preparation-cadence.mjs';
function fixture() {
  let time = 100,
    timer,
    current = true,
    cleared = 0;
  const accepted = [],
    controller = new AbortController();
  const cadence = createPreparationCadence({
    onReady: (value) => accepted.push(value),
    now: () => time,
    schedule: (callback, delay) => {
      timer = { callback, delay };
      return timer;
    },
    unschedule: (token) => {
      assert.equal(token, timer);
      cleared++;
    },
  });
  return {
    cadence,
    controller,
    accepted,
    wait: () => cadence.wait({ signal: controller.signal, current: () => current }),
    frame(ms, work = 0.5, eligible = true) {
      time += ms;
      cadence.observe(ms, work, eligible);
    },
    expire() {
      time += PREPARATION_CADENCE_TIMEOUT_MS;
      timer.callback();
    },
    invalidate() {
      current = false;
    },
    get timer() {
      return timer;
    },
    get cleared() {
      return cleared;
    },
  };
}
for (const hz of [30, 40, 45, 60, 90, 120, 144])
  test(`owned quiet preparation measures ${hz} Hz before release`, async () => {
    const f = fixture(),
      waiting = f.wait();
    let complete = false;
    waiting.then(() => (complete = true));
    for (let i = 0; i < 29; i++) f.frame(1000 / hz);
    await Promise.resolve();
    assert.equal(complete, false);
    assert.equal(f.cadence.ready, false);
    f.frame(1000 / hz);
    assert.equal(await waiting, 1000 / hz);
    assert.deepEqual(f.accepted, [1000 / hz]);
    assert.equal(f.cadence.waiting, false);
    assert.equal(f.cleared, 1);
    for (let i = 0; i < 100; i++) f.frame(40, 30, true);
    assert.equal(await f.wait(), 1000 / hz);
    assert.deepEqual(f.accepted, [1000 / hz]);
  });
test('owned readiness restarts incomplete idle samples instead of combining two cadences', async () => {
  const f = fixture();
  for (let i = 0; i < 20; i++) f.frame(1000 / 60);
  const waiting = f.wait();
  assert.equal(f.cadence.samples, 0);
  assert.equal(f.cadence.snapshot().restartedSamples, 20);
  for (let i = 0; i < 30; i++) f.frame(1000 / 90);
  assert.equal(await waiting, 1000 / 90);
});
test('completed quiet idle cadence is reused without a new collection or timer', async () => {
  const f = fixture();
  for (let i = 0; i < 30; i++) f.frame(1000 / 120);
  assert.equal(await f.wait(), 1000 / 120);
  assert.equal(f.timer, undefined);
  assert.deepEqual(f.accepted, [1000 / 120]);
});
test('nonquiet, hidden, unsupported and invalid samples cannot release readiness', async () => {
  const f = fixture(),
    waiting = f.wait();
  const rejected = assert.rejects(waiting, PreparationCadenceTimeoutError);
  for (let i = 0; i < 35; i++) {
    f.frame(16, 3);
    f.frame(16, 0.1, false);
    f.frame(3, 0.1);
    f.frame(51, 0.1);
  }
  for (const interval of [NaN, Infinity, -1, 0]) f.cadence.observe(interval, 0.1, true);
  assert.equal(f.cadence.samples, 0);
  f.expire();
  await rejected;
  assert.equal(f.cadence.ready, false);
  assert.equal(f.cadence.waiting, false);
  assert.deepEqual(f.accepted, []);
  assert.equal(f.cleared, 1);
});
test('timeout also wins at the callback boundary before a delayed timer is delivered', async () => {
  const f = fixture(),
    waiting = f.wait();
  const rejected = assert.rejects(waiting, PreparationCadenceTimeoutError);
  f.frame(PREPARATION_CADENCE_TIMEOUT_MS);
  await rejected;
  assert.equal(f.cadence.ready, false);
});
test('abort settles only its owner and the next explicit attempt can measure cadence', async () => {
  const f = fixture(),
    waiting = f.wait();
  const rejected = assert.rejects(waiting, { name: 'AbortError' });
  for (let i = 0; i < 9; i++) f.frame(16);
  f.controller.abort();
  await rejected;
  const next = new AbortController();
  const retry = f.cadence.wait({ signal: next.signal, current: () => true });
  for (let i = 0; i < 30; i++) f.frame(20);
  assert.equal(await retry, 20);
  assert.equal(f.cadence.snapshot().restartedSamples, 9);
});
for (const boundary of ['hidden', 'blur', 'renderer loss', 'run replacement', 'scene shutdown'])
  test(`${boundary} cannot release a stale preparation`, async () => {
    const f = fixture(),
      waiting = f.wait();
    const rejected = assert.rejects(waiting, { name: 'AbortError' });
    for (let i = 0; i < 29; i++) f.frame(16);
    if (boundary === 'scene shutdown') f.cadence.cancel();
    else {
      f.invalidate();
      f.frame(16);
    }
    await rejected;
    assert.deepEqual(f.accepted, []);
    assert.equal(f.cadence.ready, false);
  });
test('the same owner cannot be joined under a different signal', async () => {
  const f = fixture(),
    waiting = f.wait();
  const rejected = assert.rejects(waiting, { name: 'AbortError' });
  assert.throws(() => f.wait(), /already has an owner/);
  f.controller.abort();
  await rejected;
});
