import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { createGameWakeLock } from '../ui/game-wake-lock.mjs';

test('a delayed wake lease is released if play backgrounds or ends before acquisition', async () => {
  const document = new EventTarget();
  document.hidden = false;
  let resolve,
    released = 0,
    requests = 0;
  const messages = [],
    channel = { postMessage: (message) => messages.push(message), close() {} };
  const manager = createGameWakeLock({
    document,
    channel,
    navigator: {
      wakeLock: {
        request() {
          requests++;
          return new Promise((done) => {
            resolve = done;
          });
        },
      },
    },
  });
  manager.setActive(true);
  manager.setActive(true);
  assert.equal(requests, 1);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  resolve({
    async release() {
      released++;
    },
  });
  await tick();
  assert.equal(released, 1);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(requests, 2);
  manager.dispose();
  manager.dispose();
  manager.setActive(true);
  resolve({
    async release() {
      released++;
    },
  });
  await tick();
  assert.equal(released, 2);
  assert.deepEqual(
    messages.map(({ active }) => active),
    [true, false, true, false],
  );
});

test('denied wake locks never block play or retry on every frame', async () => {
  const document = new EventTarget();
  document.hidden = false;
  let requests = 0;
  const manager = createGameWakeLock({
    document,
    channel: null,
    navigator: {
      wakeLock: {
        async request() {
          requests++;
          throw new Error('denied');
        },
      },
    },
  });
  manager.setActive(true);
  await tick();
  for (let frame = 0; frame < 100; frame++) manager.setActive(true);
  assert.equal(requests, 1);
  manager.dispose();
});
