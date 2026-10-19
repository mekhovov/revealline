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

test('initial catalog time does not shorten the next transition or its verified fallback', async () => {
  const clock = demoLoadingClock(),
    attempted = [];
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: { ...clock.options, initialRecoveryTimeoutMs: 1000 },
    prepare: (source) => {
      attempted.push(source.id);
      return source.id === 'slow-solo' ? new Promise(() => {}) : player();
    },
  });
  try {
    assert.equal(await director.start(), true);
    const next = director.next();
    await settleDemoLoading();
    clock.advance(1000);
    await settleDemoLoading();
    assert.equal(director.phase, 'loading', 'A new transition owns a fresh thirty-second budget.');
    clock.advance(14000);
    await settleDemoLoading();
    assert.equal(await next, true);
    assert.deepEqual(attempted, ['verified-snake', 'slow-solo', 'verified-snake']);
    assert.equal(director.source.id, 'verified-snake');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

test('the initial attempt still respects the catalog-subtracted startup remainder', async () => {
  const clock = demoLoadingClock();
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: { ...clock.options, initialRecoveryTimeoutMs: 1000 },
    prepare: () => new Promise(() => {}),
  });
  try {
    const initial = director.start();
    await settleDemoLoading();
    clock.advance(999);
    await settleDemoLoading();
    assert.equal(director.phase, 'loading');
    clock.advance(1);
    await settleDemoLoading();
    assert.equal(await initial, false);
    assert.equal(director.phase, 'unavailable');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

test('Retry after startup exhaustion receives a fresh budget without changing the source deadline', async () => {
  const clock = demoLoadingClock();
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: { ...clock.options, initialRecoveryTimeoutMs: 1000 },
    prepare: () => new Promise(() => {}),
  });
  try {
    const initial = director.start();
    await settleDemoLoading();
    clock.advance(1000);
    await settleDemoLoading();
    assert.equal(await initial, false);
    const retry = director.retry();
    await settleDemoLoading();
    clock.advance(1000);
    await settleDemoLoading();
    assert.equal(director.phase, 'loading', 'Retry does not inherit the old startup remainder.');
    clock.advance(14000);
    await settleDemoLoading();
    assert.equal(director.diagnostics.at(-1).code, 'demo-load-timeout');
    assert.equal(director.phase, 'loading');
    clock.advance(14999);
    await settleDemoLoading();
    assert.equal(director.phase, 'loading');
    clock.advance(1);
    await settleDemoLoading();
    assert.equal(await retry, false);
    assert.equal(director.phase, 'unavailable');
    assert.match(director.error, /30-second budget/);
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

test('a configured per-attempt cap still limits later transitions and Retry', async () => {
  const clock = demoLoadingClock();
  let first = true;
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: { ...clock.options, recoveryTimeoutMs: 1000, initialRecoveryTimeoutMs: 5000 },
    prepare: () => {
      if (first) {
        first = false;
        return player();
      }
      return new Promise(() => {});
    },
  });
  try {
    assert.equal(await director.start(), true);
    for (const begin of [() => director.next(), () => director.retry()]) {
      const attempt = begin();
      await settleDemoLoading();
      clock.advance(999);
      await settleDemoLoading();
      assert.equal(director.phase, 'loading');
      clock.advance(1);
      await settleDemoLoading();
      assert.equal(await attempt, false);
      assert.equal(director.phase, 'unavailable');
      assert.equal(clock.pending, 0);
    }
  } finally {
    await director.dispose();
  }
});

test('cancelling initial preparation does not restore its startup deduction on resume', async () => {
  const clock = demoLoadingClock(),
    finish = [];
  const director = createDemoDirector({
    sources: sources(),
    random: () => 0,
    loading: { ...clock.options, initialRecoveryTimeoutMs: 1000 },
    prepare: () => new Promise((resolve) => finish.push(resolve)),
  });
  try {
    const initial = director.start();
    await settleDemoLoading();
    clock.advance(500);
    director.suspend();
    await settleDemoLoading();
    assert.equal(await initial, false);
    finish[0](player());
    await settleDemoLoading();
    const resumed = director.play();
    await settleDemoLoading();
    clock.advance(1000);
    await settleDemoLoading();
    assert.equal(director.phase, 'loading');
    finish.at(-1)(player());
    assert.equal(await resumed, true);
    assert.equal(director.phase, 'playing');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

const verifiedEntry = (id, modeId, extra = {}) => ({
  id,
  modeId,
  levelId: id,
  kind: 'replay',
  ...extra,
});
const verifiedPlayer = (extra = {}) => ({
  play() {},
  pause() {},
  advance() {},
  dispose() {},
  ...extra,
});
const neverPrepared = () => new Promise(() => {});
const verifiedModes = () => [
  verifiedEntry('fast-snake', 'snake', { approachable: true }),
  verifiedEntry('recent-survival', 'survival'),
  verifiedEntry('unknown-solo', 'solo'),
  verifiedEntry('pending-sim', 'sim'),
];

test('timeout recovery prepares the quickest verified mode again without retaining another world', async () => {
  const clock = demoLoadingClock(),
    attempted = [],
    created = [];
  let active = 0,
    peak = 0;
  const director = createDemoDirector({
    sources: verifiedModes(),
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      attempted.push(source.id);
      if (source.id === 'unknown-solo') return neverPrepared();
      clock.elapse(source.modeId === 'survival' ? 5000 : 100);
      active++;
      peak = Math.max(peak, active);
      const result = verifiedPlayer({
        dispose() {
          active--;
        },
      });
      created.push(result);
      return result;
    },
  });
  try {
    await director.start();
    await director.next();
    assert.equal(director.source.id, 'recent-survival');
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.equal(await recovery, true);
    assert.deepEqual(attempted, ['fast-snake', 'recent-survival', 'unknown-solo', 'fast-snake']);
    assert.notEqual(created[0], director.player, 'Fallback is freshly prepared and verified.');
    assert.equal(peak, 1);
    assert.equal(active, 1);
    assert.equal(await director.next(), true);
    assert.equal(director.source.id, 'pending-sim', 'Recovery preserves the pending mode visit.');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
    assert.equal(active, 0);
  }
});

test('a retained source uses its latest successful cost after becoming slower', async () => {
  const clock = demoLoadingClock(),
    counts = new Map();
  const director = createDemoDirector({
    sources: verifiedModes(),
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      const count = (counts.get(source.id) ?? 0) + 1;
      counts.set(source.id, count);
      if (source.modeId === 'survival' && count === 2) return neverPrepared();
      clock.elapse(
        source.modeId === 'snake'
          ? count === 1
            ? 10
            : 5000
          : source.modeId === 'sim'
            ? 100
            : 1000,
      );
      return verifiedPlayer();
    },
  });
  try {
    await director.start();
    for (let visit = 0; visit < 4; visit++) await director.next();
    assert.equal(director.source.id, 'fast-snake');
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.equal(await recovery, true);
    assert.equal(director.source.id, 'pending-sim', 'The old ten-millisecond Snake cost is stale.');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

for (const secondCost of [50, 500]) {
  test(
    'each mode retains its quicker candidate when the second level costs ' + secondCost + 'ms',
    async () => {
      const clock = demoLoadingClock(),
        counts = new Map();
      const candidates = verifiedModes();
      candidates.splice(1, 0, verifiedEntry('second-snake', 'snake'));
      const director = createDemoDirector({
        sources: candidates,
        random: () => 0,
        loading: clock.options,
        prepare: (source) => {
          const count = (counts.get(source.id) ?? 0) + 1;
          counts.set(source.id, count);
          if (source.modeId === 'survival' && count === 2) return neverPrepared();
          clock.elapse(
            source.id === 'fast-snake' ? 100 : source.id === 'second-snake' ? secondCost : 1000,
          );
          return verifiedPlayer();
        },
      });
      try {
        await director.start();
        for (let visit = 0; visit < 4; visit++) await director.next();
        assert.equal(
          director.source.id,
          'second-snake',
          'Normal visits reach the other Snake level.',
        );
        const recovery = director.next();
        clock.advance(15000);
        await settleDemoLoading();
        assert.equal(await recovery, true);
        assert.equal(director.source.id, secondCost < 100 ? 'second-snake' : 'fast-snake');
        assert.equal(clock.pending, 0);
      } finally {
        await director.dispose();
      }
    },
  );
}

for (const code of ['demo-playback-failed', 'demo-renderer-unavailable']) {
  test('timeout ranking excludes the quickest source after ' + code, async () => {
    const clock = demoLoadingClock(),
      attempted = [];
    const director = createDemoDirector({
      sources: verifiedModes(),
      random: () => 0,
      loading: clock.options,
      prepare: (source) => {
        attempted.push(source.id);
        if (source.id === 'unknown-solo') return neverPrepared();
        clock.elapse(source.modeId === 'snake' ? 10 : 1000);
        return verifiedPlayer();
      },
    });
    try {
      await director.start();
      director.fail(
        Object.assign(new Error('Invalidated after successful preparation.'), { code }),
      );
      await settleDemoLoading();
      assert.equal(director.source.id, 'recent-survival');
      const recovery = director.next();
      clock.advance(15000);
      await settleDemoLoading();
      assert.equal(await recovery, true);
      assert.equal(director.source.id, 'recent-survival');
      assert.equal(attempted.filter((id) => id === 'fast-snake').length, 1);
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

test('timeout recovery after bot exhaustion keeps the required replay kind', async () => {
  const clock = demoLoadingClock(),
    attempted = [];
  const director = createDemoDirector({
    sources: [
      verifiedEntry('verified-replay', 'survival', { approachable: true }),
      verifiedEntry('quick-bot', 'snake', { kind: 'bot' }),
      verifiedEntry('slow-replay', 'solo'),
      verifiedEntry('pending-replay', 'sim'),
    ],
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      attempted.push(source.id);
      if (source.id === 'slow-replay') return neverPrepared();
      clock.elapse(source.kind === 'bot' ? 10 : 1000);
      return verifiedPlayer({
        advance: () => (source.kind === 'bot' ? { reason: 'no-safe-macro' } : {}),
      });
    },
  });
  try {
    await director.start();
    await director.next();
    assert.equal(director.source.id, 'quick-bot');
    assert.equal(director.advance(0.1).phase, 'complete');
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.equal(await recovery, true);
    assert.equal(director.source.id, 'verified-replay');
    assert.equal(attempted.filter((id) => id === 'quick-bot').length, 1);
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

test('equal measured costs choose the first retained mode consistently', async () => {
  const clock = demoLoadingClock();
  const director = createDemoDirector({
    sources: verifiedModes(),
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      if (source.id === 'unknown-solo') return neverPrepared();
      clock.elapse(100);
      return verifiedPlayer();
    },
  });
  try {
    await director.start();
    await director.next();
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.equal(await recovery, true);
    assert.equal(director.source.id, 'fast-snake');
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});

test('fastest recovery still enforces the individual and total loading deadlines', async () => {
  const clock = demoLoadingClock(),
    counts = new Map(),
    attempted = [];
  const director = createDemoDirector({
    sources: verifiedModes(),
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      attempted.push(source.id);
      const count = (counts.get(source.id) ?? 0) + 1;
      counts.set(source.id, count);
      if (source.id === 'unknown-solo' || (source.modeId === 'snake' && count > 1))
        return neverPrepared();
      clock.elapse(source.modeId === 'snake' ? 10 : 1000);
      return verifiedPlayer();
    },
  });
  try {
    await director.start();
    await director.next();
    const recovery = director.next();
    clock.advance(14999);
    await settleDemoLoading();
    assert.equal(attempted.at(-1), 'unknown-solo');
    clock.advance(1);
    await settleDemoLoading();
    assert.equal(attempted.at(-1), 'fast-snake');
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

test('quick verified sources do not bias ordinary mode/level rotation or its one-payload prefetch', async () => {
  const clock = demoLoadingClock(),
    visited = [],
    prefetched = [];
  let active = 0,
    peak = 0;
  const candidates = verifiedModes();
  candidates.splice(1, 0, verifiedEntry('second-snake', 'snake'));
  candidates.splice(
    2,
    0,
    verifiedEntry('duplicate-second-snake', 'snake', { levelId: 'second-snake' }),
  );
  for (const candidate of candidates) {
    candidate.loadPayload = async () => {
      prefetched.push(candidate.id);
      return { id: candidate.id };
    };
  }
  const director = createDemoDirector({
    sources: candidates,
    random: () => 0,
    loading: clock.options,
    prepare: (source, { payload }) => {
      if (visited.length) assert.deepEqual(payload, { id: source.id });
      clock.elapse(source.modeId === 'snake' ? 10 : 1000);
      visited.push({ id: source.id, mode: source.modeId, level: source.levelId });
      active++;
      peak = Math.max(peak, active);
      return verifiedPlayer({
        dispose() {
          active--;
        },
      });
    },
  });
  try {
    await director.start();
    for (let index = 1; index < 12; index++) await director.next();
    for (let index = 0; index < 12; index += 4) {
      assert.equal(new Set(visited.slice(index, index + 4).map((source) => source.mode)).size, 4);
      if (index) assert.notEqual(visited[index - 1].mode, visited[index].mode);
    }
    assert.deepEqual(
      visited.filter((source) => source.mode === 'snake').map((source) => source.level),
      ['fast-snake', 'second-snake', 'fast-snake'],
    );
    assert.equal(prefetched.length, visited.length, 'Only the next source payload is prefetched.');
    assert.deepEqual(
      prefetched.slice(0, -1),
      visited.slice(1).map((source) => source.id),
    );
    assert.equal(peak, 1);
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
    assert.equal(active, 0);
  }
});

test('a kind-ineligible quickest bot preserves the most recent verified replay fallback', async () => {
  const clock = demoLoadingClock(),
    counts = new Map(),
    attempted = [];
  const director = createDemoDirector({
    sources: [
      verifiedEntry('quick-solo-bot', 'solo', { kind: 'bot', approachable: true }),
      verifiedEntry('verified-solo-replay', 'solo'),
      verifiedEntry('slow-snake-bot', 'snake', { kind: 'bot' }),
      verifiedEntry('quick-sim-bot', 'sim', { kind: 'bot' }),
      verifiedEntry('unknown-sim-replay', 'sim'),
    ],
    random: () => 0,
    loading: clock.options,
    prepare: (source) => {
      attempted.push(source.id);
      const count = (counts.get(source.id) ?? 0) + 1;
      counts.set(source.id, count);
      if (source.id === 'slow-snake-bot' && count === 2) return neverPrepared();
      clock.elapse(source.kind === 'bot' ? 10 : 1000);
      return verifiedPlayer();
    },
  });
  try {
    await director.start();
    for (let visit = 0; visit < 3; visit++) await director.next();
    assert.equal(director.source.id, 'verified-solo-replay');
    const recovery = director.next();
    clock.advance(15000);
    await settleDemoLoading();
    assert.equal(await recovery, true);
    assert.equal(director.source.id, 'verified-solo-replay');
    assert.equal(attempted.includes('unknown-sim-replay'), false);
    assert.equal(clock.pending, 0);
  } finally {
    await director.dispose();
  }
});
