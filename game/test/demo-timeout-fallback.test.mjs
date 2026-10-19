import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDirector } from '../demo-director.mjs';
import { demoLoadingClock, settleDemoLoading } from './helpers/demo-loading-clock.mjs';

const player = (dispose = () => {}) => ({ play() {}, pause() {}, advance() {}, dispose });
const sources = () => [
  { id: 'verified-snake', modeId: 'snake', levelId: 'snake', approachable: true },
  { id: 'slow-solo', modeId: 'solo', levelId: 'solo' },
  { id: 'pending-sim', modeId: 'sim', levelId: 'sim' },
];

test('a source timeout prefers verified Snake and preserves the unvisited mode for the next transition', async () => {
  const clock = demoLoadingClock(),
    attempted = [];
  let releaseSIM;
  const simReady = new Promise((resolve) => {
    releaseSIM = resolve;
  });
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      attempted.push(source.id);
      if (source.id === 'slow-solo') return new Promise(() => {});
      if (source.id === 'pending-sim') return simReady;
      return player();
    },
  });
  try {
    assert.equal(await director.start(), true);
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    // Before the fix this attempts pending-sim, which could consume all of the
    // remaining budget, instead of returning to the known fast Snake source.
    assert.deepEqual(attempted, ['verified-snake', 'slow-solo', 'verified-snake']);
    assert.equal(await recovery, true);
    assert.equal(director.source.id, 'verified-snake');
    assert.equal(director.phase, 'playing');
    assert.deepEqual(director.failedSourceIds, ['slow-solo']);
    const next = director.next();
    await settleDemoLoading();
    assert.equal(
      attempted.at(-1),
      'pending-sim',
      'Recovery does not consume another mode’s visit.',
    );
    releaseSIM(player());
    assert.equal(await next, true);
    assert.equal(director.source.id, 'pending-sim');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

test('a verified fallback still shares the original thirty-second recovery deadline', async () => {
  const clock = demoLoadingClock(),
    attempted = [];
  let first = true;
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      attempted.push(source.id);
      if (first) {
        first = false;
        return player();
      }
      return new Promise(() => {});
    },
  });
  try {
    await director.start();
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.deepEqual(attempted, ['verified-snake', 'slow-solo', 'verified-snake']);
    clock.advance(14999);
    await settleDemoLoading();
    assert.equal(director.phase, 'loading');
    clock.advance(1);
    assert.equal(await recovery, false);
    assert.equal(director.phase, 'unavailable');
    assert.match(director.error, /30-second budget/);
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

for (const code of ['demo-playback-failed', 'demo-renderer-unavailable']) {
  test(`timeout recovery cannot reuse a verified source after ${code}`, async () => {
    const clock = demoLoadingClock(),
      attempted = [];
    const candidates = sources();
    candidates.splice(1, 0, { id: 'another-snake', modeId: 'snake', levelId: 'another-snake' });
    const director = createDemoDirector({
      sources: candidates,
      random: () => 0,
      loading: clock.options,
      prepare: (source) => {
        attempted.push(source.id);
        return source.id === 'slow-solo' ? new Promise(() => {}) : player();
      },
    });
    try {
      await director.start();
      director.fail(Object.assign(new Error('The prior player is no longer valid.'), { code }));
      await settleDemoLoading();
      assert.equal(attempted.at(-1), 'slow-solo');
      clock.advance(15000);
      await settleDemoLoading();
      assert.deepEqual(attempted, ['verified-snake', 'slow-solo', 'pending-sim']);
      assert.equal(director.source.id, 'pending-sim');
      assert.equal(director.failedSourceIds.includes('verified-snake'), true);
      assert.deepEqual(
        director.suspendedModeIds,
        code === 'demo-renderer-unavailable' ? ['snake'] : [],
      );
      assert.equal(clock.pending, 0);
    } finally {
      await director.dispose();
    }
  });
}

test('cancelling a preferred verified fallback retires its late player without adoption', async () => {
  const clock = demoLoadingClock(),
    attempted = [];
  let resolveFallback,
    fallbackSignal,
    retired = 0;
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: clock.options,
    prepare: (source, { signal }) => {
      attempted.push(source.id);
      if (attempted.length === 1) return player();
      if (source.id === 'slow-solo') return new Promise(() => {});
      assert.equal(source.id, 'verified-snake');
      fallbackSignal = signal;
      return new Promise((resolve) => {
        resolveFallback = resolve;
      });
    },
  });
  try {
    await director.start();
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.equal(typeof resolveFallback, 'function');
    director.suspend();
    assert.equal(await recovery, false);
    assert.equal(fallbackSignal.aborted, true);
    resolveFallback(
      player(() => {
        retired++;
      }),
    );
    await settleDemoLoading();
    assert.equal(retired, 1);
    assert.equal(director.player, null);
    assert.equal(director.phase, 'paused');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});
