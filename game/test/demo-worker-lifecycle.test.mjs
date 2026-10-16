import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareBotPlayer } from '../demo-bot-player.mjs';
import { planDemoMacro } from '../demo-bot.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
);
const level = applyGameplayTuning(pack.campaigns[0].levels[0], resolveGameplayTuning('standard'));
const options = {
  seed: 1,
  turnPolicy: 'immediate',
  classId: 'scout',
  classRecipes: pack.classRecipes,
};
class JoiningWorker {
  static instances = [];
  constructor() {
    this.callbacks = new Set();
    JoiningWorker.instances.push(this);
  }
  addEventListener(type, fn) {
    if (type === 'message') this.callbacks.add(fn);
  }
  removeEventListener(type, fn) {
    this.callbacks.delete(fn);
  }
  postMessage(data) {
    if (data.decision !== 0) return;
    const result = planDemoMacro(data.state, data);
    queueMicrotask(() => {
      for (const fn of this.callbacks) fn({ data: { id: data.id, result } });
    });
  }
  terminate() {
    if (!this.termination)
      this.termination = new Promise((resolve) => {
        this.release = resolve;
      });
    return this.termination;
  }
}

// A Node Worker adapter can acknowledge termination asynchronously. Browser
// Workers return void; production must support both without concurrent resets.
test('reset joins retiring Worker before creating its replacement', async () => {
  JoiningWorker.instances = [];
  const player = await prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
  });
  const first = JoiningWorker.instances[0];
  let pending;
  try {
    pending = player.reset();
    await Promise.resolve();
    assert.equal(JoiningWorker.instances.length, 1, 'The retiring thread must finish first.');
    first.release();
    await pending;
    assert.equal(JoiningWorker.instances.length, 2);
    assert.equal(player.phase, 'paused');
    assert.equal(player.state.tick, 0);
  } finally {
    first.release?.();
    await pending?.catch(() => {});
    player.dispose();
    for (const worker of JoiningWorker.instances) worker.release?.();
  }
});

test('disposing during an asynchronous reset cannot revive a Worker', async () => {
  JoiningWorker.instances = [];
  const player = await prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
  });
  const first = JoiningWorker.instances[0];
  const pending = player.reset();
  player.dispose();
  first.release();
  try {
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(JoiningWorker.instances.length, 1);
  } finally {
    player.dispose();
    for (const worker of JoiningWorker.instances) worker.release?.();
  }
});

test('only the newest overlapping reset may create a replacement Worker', async () => {
  JoiningWorker.instances = [];
  const player = await prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
  });
  const first = JoiningWorker.instances[0];
  const older = player.reset();
  const newer = player.reset();
  const settled = Promise.allSettled([older, newer]);
  first.release();
  try {
    const [oldResult, newResult] = await settled;
    assert.equal(oldResult.status, 'rejected');
    assert.equal(oldResult.reason.name, 'AbortError');
    assert.equal(newResult.status, 'fulfilled');
    assert.equal(JoiningWorker.instances.length, 2);
    assert.equal(player.phase, 'paused');
    assert.equal(player.state.tick, 0);
  } finally {
    player.dispose();
    for (const worker of JoiningWorker.instances) worker.release?.();
  }
});

test('a new scene joins the preceding player Worker retirement before creating another thread', async () => {
  JoiningWorker.instances = [];
  const firstPlayer = await prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
  });
  const first = JoiningWorker.instances[0];
  const retirement = firstPlayer.dispose();
  const opening = prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
  });
  let second;
  try {
    await Promise.resolve();
    assert.equal(
      JoiningWorker.instances.length,
      1,
      'A disposed owner can still have a retiring real thread.',
    );
    assert.equal(
      typeof retirement?.then,
      'function',
      'Expose an adapter termination acknowledgement.',
    );
    first.release();
    await retirement;
    second = await opening;
    assert.equal(JoiningWorker.instances.length, 2);
    assert.equal(second.state.tick, 0);
  } finally {
    first.release?.();
    second ??= await opening.catch(() => null);
    second?.dispose();
    for (const worker of JoiningWorker.instances) worker.release?.();
  }
});

test('cancelling a scene while it joins a retiring Worker cannot start another thread', async () => {
  JoiningWorker.instances = [];
  const player = await prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
  });
  const first = JoiningWorker.instances[0],
    controller = new AbortController();
  player.dispose();
  const opening = prepareBotPlayer(level, options, {
    WorkerClass: JoiningWorker,
    watchdogMs: 5000,
    signal: controller.signal,
  });
  controller.abort();
  first.release();
  try {
    await assert.rejects(opening, { name: 'AbortError' });
    assert.equal(JoiningWorker.instances.length, 1);
  } finally {
    for (const worker of JoiningWorker.instances) worker.release?.();
  }
});
