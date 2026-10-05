import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicTargetFacing } from '../snake/classic-target-art.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';

function run(tick = 0, x = 3, y = 3, extra = {}) {
  return {
    version: 'classic-snake.v1',
    levelIdentity: 'legacy-flee-layout',
    mode: 'solo',
    seed: 17,
    level: { width: 8, height: 6, wrap: false, walls: [] },
    tick,
    target: { id: 'humanoid-1', kind: 'humanoid', x, y },
    snakes: [],
    recentCatches: [],
    ...extra,
  };
}

test('historical targets face observed movement in all four directions without changing run data', () => {
  const observe = createClassicTargetFacing(),
    attempt = {};
  assert.equal(observe(run(), attempt).get('humanoid-1'), 'up');
  for (const [tick, x, y, expected] of [
    [3, 4, 3, 'right'],
    [6, 4, 4, 'down'],
    [9, 3, 4, 'left'],
    [12, 3, 3, 'up'],
  ]) {
    const state = run(tick, x, y),
      before = structuredClone(state);
    assert.equal(observe(state, attempt).get('humanoid-1'), expected);
    assert.deepEqual(state, before);
    assert.equal(observe(state, attempt).get('humanoid-1'), expected, 'repaint is stable');
    assert.equal(
      observe(run(tick + 1, x, y), attempt).get('humanoid-1'),
      expected,
      'blocked or paused targets keep their last visible direction',
    );
  }
});

test('historical target observations honor native wrap seams and do not guess skipped corners', () => {
  const observe = createClassicTargetFacing(),
    attempt = {},
    level = { width: 8, height: 6, wrap: true, walls: [] },
    state = (tick, x, y) => run(tick, x, y, { level });
  observe(state(0, 7, 5), attempt);
  assert.equal(observe(state(3, 0, 5), attempt).get('humanoid-1'), 'right');
  assert.equal(observe(state(6, 7, 5), attempt).get('humanoid-1'), 'left');
  assert.equal(observe(state(9, 7, 0), attempt).get('humanoid-1'), 'down');
  assert.equal(observe(state(12, 7, 5), attempt).get('humanoid-1'), 'up');
  assert.equal(observe(state(15, 0, 5), attempt).get('humanoid-1'), 'right');
  assert.equal(observe(state(30, 2, 3), attempt).get('humanoid-1'), 'right');
});

test('retries, recipes, seeds, rewinds and replacement targets clear historical facing', () => {
  const changes = [
    (state) => ({ state, attempt: {} }),
    (state, attempt) => ({ state: { ...state, levelIdentity: 'another-layout' }, attempt }),
    (state, attempt) => ({ state: { ...state, seed: 18 }, attempt }),
    (state, attempt) => ({ state: { ...state, tick: 0 }, attempt }),
    (state, attempt) => ({
      state: { ...state, target: { ...state.target, id: 'humanoid-2' } },
      attempt,
    }),
  ];
  for (const change of changes) {
    const observe = createClassicTargetFacing(),
      attempt = {};
    observe(run(), attempt);
    assert.equal(observe(run(3, 4, 3), attempt).get('humanoid-1'), 'right');
    const next = change(run(4, 4, 3), attempt);
    assert.equal(observe(next.state, next.attempt).get(next.state.target.id), 'up');
  }
  const observe = createClassicTargetFacing(),
    attempt = {};
  observe(run(), attempt);
  observe(run(3, 4, 3), attempt);
  assert.equal(observe(run(4, 4, 3, { target: null }), attempt).size, 0);
  assert.equal(observe(run(5, 4, 3), attempt).get('humanoid-1'), 'up');
});

test('accepted successor headings remain authoritative even while movement or warnings disagree', () => {
  const observe = createClassicTargetFacing(),
    attempt = {},
    state = run(0, 0, 0, {
      version: 'classic-snake.v3',
      targets: [
        { id: 'shield', x: 3, y: 3, heading: 'left', nextHeading: 'right' },
        { id: 'brace', x: 5, y: 3, heading: 'down', phase: 'warning' },
      ],
    });
  assert.deepEqual(
    [...observe(state, attempt)],
    [
      ['shield', 'left'],
      ['brace', 'down'],
    ],
  );
  state.tick = 1;
  state.targets[0].x++;
  state.targets[1].y--;
  const before = structuredClone(state);
  assert.deepEqual(
    [...observe(state, attempt)],
    [
      ['shield', 'left'],
      ['brace', 'down'],
    ],
  );
  assert.deepEqual(state, before);
});

function canvas() {
  const rotations = [],
    values = { globalAlpha: 1 };
  const ctx = new Proxy(values, {
    get: (object, key) =>
      key in object
        ? object[key]
        : (...args) => {
            if (key === 'rotate') rotations.push(...args);
          },
  });
  return { width: 0, height: 0, style: {}, getContext: () => ctx, rotations };
}

test('Classic board owns separate bounded facing observers per canvas and attempt', () => {
  const left = canvas(),
    right = canvas(),
    attempt = {},
    options = { attemptKey: attempt, reduced: true, showRemains: false };
  drawClassicBoard(left, run(), options);
  drawClassicBoard(right, run(), options);
  drawClassicBoard(left, run(3, 4, 3), options);
  drawClassicBoard(right, run(3, 3, 2), options);
  assert.equal(left.rotations.at(-1), Math.PI / 2);
  assert.equal(right.rotations.at(-1), 0);
  drawClassicBoard(left, run(3, 4, 3), { ...options, attemptKey: {} });
  assert.equal(left.rotations.at(-1), 0, 'review and retry do not inherit live facing');
});
