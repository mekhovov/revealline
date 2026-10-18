import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDirector } from '../demo-director.mjs';
import { createDemoCaptions } from '../demo-experience.mjs';
import { createDemoPrefetch } from '../demo-prefetch.mjs';
import { createDemoRegistry } from '../demo-registry.mjs';
import { demoLoadingClock, settleDemoLoading } from './helpers/demo-loading-clock.mjs';

const player = (dispose = () => {}) => ({ play() {}, pause() {}, advance() {}, dispose });
test('a delayed optional catalog cannot starve available modes or freeze localization', async () => {
  const clock = demoLoadingClock();
  let title = 'English';
  const good = {
    enumerateSources: () => [
      {
        id: 'good',
        levelId: 'one',
        get title() {
          return title;
        },
      },
    ],
  };
  const registry = createDemoRegistry(
    {
      solo: good,
      snake: good,
      survival: good,
      sim: () => new Promise(() => {}),
    },
    { metadataLoading: { ...clock.options, timeoutMs: 12000 } },
  );
  const pending = registry.enumerateSources({ scope: 'all' });
  await settleDemoLoading();
  clock.advance(12000);
  const sources = await pending;
  assert.deepEqual(sources.map((source) => source.modeId).sort(), ['snake', 'solo', 'survival']);
  title = 'Українська';
  assert.ok(sources.every((source) => source.title === title));
  assert.equal(clock.pending, 0);
});
test('prefetch owns one immutable payload and cancels its predecessor without preparing scenes', async () => {
  const prefetch = createDemoPrefetch();
  let firstSignal;
  const first = {
    loadPayload: ({ signal }) => {
      firstSignal = signal;
      return new Promise(() => {});
    },
  };
  const payload = { actions: [{ tick: 1 }] };
  const second = { loadPayload: async () => payload };
  prefetch.start(first);
  prefetch.start(second);
  assert.equal(firstSignal.aborted, true);
  assert.equal(prefetch.source, second);
  assert.equal(await prefetch.take(first), undefined);
  assert.equal(await prefetch.take(second), payload);
  assert.equal(prefetch.source, null);
  assert.equal(Object.isFrozen(payload.actions[0]), true);
  prefetch.start(first);
  prefetch.clear();
  assert.equal(firstSignal.aborted, true);
});

test('the next prefetched recording is consumed once and never creates a second player early', async () => {
  let loads = 0,
    prepares = 0,
    live = 0;
  const sources = ['a', 'b'].map((id) => ({
    id,
    levelId: id,
    loadPayload: async () => {
      loads++;
      return { id };
    },
  }));
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async (source, { payload }) => {
      prepares++;
      assert.equal(live, 0);
      live++;
      if (prepares === 2) assert.equal(payload.id, 'b');
      return player(() => {
        live--;
      });
    },
  });
  await director.start();
  assert.equal(prepares, 1);
  assert.equal(loads, 1);
  await director.next();
  assert.equal(prepares, 2);
  assert.equal(loads, 2);
  await director.dispose();
  assert.equal(live, 0);
});
test('modes and level variants have equal performance weight despite duplicate recordings', async () => {
  const sources = [
    ...Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, modeId: 'a', levelId: 'a1' })),
    { id: 'other-a', modeId: 'a', levelId: 'a2' },
    ...['b1', 'b2', 'b3'].map((levelId) => ({ id: levelId, levelId, modeId: 'b' })),
    { id: 'c', levelId: 'c1', modeId: 'c' },
  ];
  const director = createDemoDirector({ sources, random: () => 0, prepare: async () => player() });
  const sequence = [];
  for (let i = 0; i < 36; i++) {
    await director.next();
    sequence.push(director.source);
  }
  for (let i = 0; i < sequence.length; i += 3)
    assert.equal(new Set(sequence.slice(i, i + 3).map((s) => s.modeId)).size, 3);
  for (const id of ['a', 'b']) {
    const levels = sequence.filter((s) => s.modeId === id).map((s) => s.levelId);
    const count = id === 'a' ? 2 : 3;
    for (let i = 0; i < levels.length; i += count)
      assert.equal(new Set(levels.slice(i, i + count)).size, count);
    assert.ok(levels.every((level, index) => !index || level !== levels[index - 1]));
  }
  director.dispose();
});

test('an unavailable graphics engine is attempted once, not once per authored level', async () => {
  const attempted = [];
  const sources = Array.from({ length: 200 }, (_, i) => ({
    id: `bad${i}`,
    levelId: `${i}`,
    modeId: 'bad',
  }));
  sources.push({ id: 'good', levelId: 'good', modeId: 'good' });
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async (source) => {
      attempted.push(source.id);
      if (source.modeId === 'bad')
        throw Object.assign(new Error('No WebGL'), { code: 'renderer-unavailable' });
      return player();
    },
  });
  await director.start();
  assert.deepEqual(attempted, ['bad0', 'good']);
  assert.deepEqual(director.suspendedModeIds, ['bad']);
  director.dispose();
});

test('a large corrupt catalog cannot keep healthy unvisited modes behind verified fallback', async () => {
  const attempted = [],
    shown = [];
  const sources = [
    { id: 'a', modeId: 'a', levelId: 'a' },
    ...Array.from({ length: 40 }, (_, i) => ({
      id: `bad-${i}`,
      modeId: 'b',
      levelId: `b-${i}`,
    })),
    { id: 'c', modeId: 'c', levelId: 'c' },
  ];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async (source) => {
      attempted.push(source.id);
      if (source.modeId === 'b') throw Error('Corrupt recording');
      return player();
    },
  });
  try {
    for (let i = 0; i < 12; i++) {
      assert.equal(await director.next(), true);
      shown.push(director.source.modeId);
    }
    assert.deepEqual(
      shown,
      Array.from({ length: 12 }, (_, i) => (i % 2 ? 'c' : 'a')),
    );
    assert.equal(attempted.filter((id) => id.startsWith('bad-')).length, 6);
    assert.deepEqual(director.suspendedModeIds, [], 'Content failures do not disable the mode.');
  } finally {
    await director.dispose();
  }
});

test('a deferred mode returns with its next recording while healthy mode cycles keep progressing', async () => {
  const attempted = [],
    shown = [];
  const sources = [
    { id: 'a', modeId: 'a', levelId: 'a' },
    { id: 'broken', modeId: 'b', levelId: 'b' },
    { id: 'healthy-alternate', modeId: 'b', levelId: 'b' },
    { id: 'c', modeId: 'c', levelId: 'c' },
  ];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async (source) => {
      attempted.push(source.id);
      if (source.id === 'broken') throw Error('Stale recording');
      return player();
    },
  });
  try {
    for (let i = 0; i < 8; i++) {
      await director.next();
      shown.push(director.source.modeId);
    }
    assert.deepEqual(shown, ['a', 'c', 'a', 'b', 'c', 'a', 'b', 'c']);
    assert.equal(attempted.filter((id) => id === 'broken').length, 1);
  } finally {
    await director.dispose();
  }
});

test('duplicate bad recordings cannot hold the next level behind repeated verified fallback', async () => {
  const attempted = [],
    shown = [];
  const sources = [
    { id: 'first', levelId: 'first' },
    ...Array.from({ length: 40 }, (_, i) => ({ id: `bad-${i}`, levelId: 'broken-level' })),
    { id: 'last', levelId: 'last' },
  ];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async (source) => {
      attempted.push(source.id);
      if (source.levelId === 'broken-level') throw Error('Corrupt recording');
      return player();
    },
  });
  try {
    for (let i = 0; i < 3; i++) {
      await director.next();
      shown.push(director.source.id);
    }
    assert.deepEqual(shown, ['first', 'first', 'last']);
    assert.deepEqual(attempted, ['first', 'bad-0', 'first', 'last']);
  } finally {
    await director.dispose();
  }
});

test('all fallback attempts together stop at thirty seconds', async () => {
  const clock = demoLoadingClock();
  let attempts = 0;
  const director = createDemoDirector({
    sources: Array.from({ length: 200 }, (_, i) => ({ id: `${i}`, levelId: `${i}` })),
    loading: clock.options,
    prepare: () => {
      attempts++;
      return new Promise(() => {});
    },
  });
  const done = director.start();
  clock.advance(15000);
  await settleDemoLoading();
  clock.advance(15000);
  assert.equal(await done, false);
  assert.equal(attempts, 2);
  assert.equal(director.phase, 'unavailable');
  assert.equal(clock.pending, 0);
  director.dispose();
});

test('replacement waits for asynchronous graphics disposal', async () => {
  let finish;
  let count = 0;
  const disposal = new Promise((resolve) => {
    finish = resolve;
  });
  const director = createDemoDirector({
    sources: [
      { id: 'a', levelId: 'a' },
      { id: 'b', levelId: 'b' },
    ],
    prepare: async () => {
      count++;
      return player(() => (count === 1 ? disposal : undefined));
    },
  });
  await director.start();
  const next = director.next();
  await settleDemoLoading();
  assert.equal(count, 1);
  finish();
  await next;
  assert.equal(count, 2);
  await director.dispose();
});

test('fallback waits for cleanup of a source rejected after preparation', async () => {
  let finish,
    count = 0;
  const disposal = new Promise((resolve) => {
    finish = resolve;
  });
  const director = createDemoDirector({
    sources: [
      { id: 'invalid', levelId: 'a' },
      { id: 'valid', levelId: 'b' },
    ],
    random: () => 0,
    prepare: async () => (++count === 1 ? { dispose: () => disposal } : player()),
  });
  const ready = director.start();
  await settleDemoLoading();
  assert.equal(count, 1);
  finish();
  assert.equal(await ready, true);
  assert.equal(count, 2);
  await director.dispose();
});

test('captions retain five explanations, stay six seconds, and discard stale warnings', () => {
  const captions = createDemoCaptions();
  captions.reset();
  captions.advance(0, [{ caption: 'Expired warning', expiresAfter: 1 }]);
  for (let i = 0; i < 24; i++) captions.advance(0.25);
  assert.equal(captions.history.includes('Expired warning'), false);
  for (let i = 0; i < 7; i++) {
    captions.advance(0, [{ caption: `Explanation ${i}` }]);
    for (let tick = 0; tick < 24; tick++) captions.advance(0.25);
  }
  assert.equal(captions.history.length, 5);
  assert.equal(captions.history.at(-1), 'Explanation 6');
});

test('caption history translates observed events without replaying or dropping their reading interval', () => {
  const captions = createDemoCaptions();
  let locale = 'en';
  captions.reset();
  const event = {
    captionKey: 'snake:caught',
    captionText: () => (locale === 'en' ? 'Caught' : 'Спіймано'),
  };
  captions.advance(0, [event]);
  for (let tick = 0; tick < 24; tick++) captions.advance(0.25);
  assert.equal(captions.current, 'Caught');
  locale = 'uk';
  assert.equal(captions.current, 'Спіймано');
  assert.equal(captions.history.at(-1), 'Спіймано');
  captions.advance(0.25, [event, { caption: 'Next event' }]);
  assert.equal(captions.current, 'Спіймано');
  assert.equal(captions.history.length, 2);
});

test('natural completion retains the last explanation and the recap for six seconds each', () => {
  const captions = createDemoCaptions();
  captions.reset('Observed mechanic');
  captions.advance(0.25);
  captions.complete('Actual result');
  for (let tick = 0; tick < 22; tick++) captions.advance(0.25);
  assert.equal(captions.current, 'Observed mechanic');
  assert.equal(captions.readyToLeave, false);
  captions.advance(0.25);
  assert.equal(captions.current, 'Actual result');
  for (let tick = 0; tick < 23; tick++) captions.advance(0.25);
  assert.equal(captions.readyToLeave, false);
  captions.advance(0.25);
  assert.equal(captions.readyToLeave, true);
});
