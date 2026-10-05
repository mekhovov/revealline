import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createContinuousPlayController,
  continuousPlayPreferences,
} from '../ui/continuous-play.mjs';

function setup(overrides = {}) {
  const data = new Map();
  const preferences = continuousPlayPreferences({
    storage: { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) },
    window: null,
  });
  const actions = [];
  const owner = {};
  const controller = createContinuousPlayController({
    preferences,
    onNext: (identity) => actions.push(['next', identity]),
    onRetry: (identity) => actions.push(['retry', identity]),
    ...overrides,
  });
  const advance = (ms) => {
    while (ms > 0) {
      const amount = Math.min(ms, 100);
      controller.advance(amount);
      ms -= amount;
    }
  };
  return { preferences, actions, owner, controller, advance };
}

test('victory retains a full celebration before one cancellable five-second auto-next', () => {
  const { controller, owner, actions, advance } = setup();
  controller.begin({ identity: owner, outcome: 'won', canAdvance: true });
  advance(3799);
  assert.equal(controller.snapshot().phase, 'celebration');
  advance(1);
  assert.equal(controller.snapshot().phase, 'countdown');
  advance(4999);
  assert.deepEqual(actions, []);
  advance(1);
  assert.deepEqual(actions, [['next', owner]]);
  advance(10000);
  assert.equal(actions.length, 1);
});

test('failure automatically replays then restarts exactly once, while replay preference skips only replay', () => {
  const state = setup();
  state.controller.begin({ identity: state.owner, outcome: 'lost', readyMs: 400 });
  state.advance(650);
  assert.equal(state.controller.snapshot().phase, 'replay');
  state.advance(1920);
  assert.equal(state.controller.snapshot().phase, 'ready');
  state.advance(400);
  assert.deepEqual(state.actions, [['retry', state.owner]]);
  state.preferences.set('autoReplay', false);
  state.controller.begin({ identity: state.owner, outcome: 'lost', readyMs: 400 });
  state.advance(650);
  assert.equal(state.controller.snapshot().phase, 'ready');
  state.advance(400);
  assert.equal(state.actions.length, 2);
});

test('backgrounding, interaction and successor ownership permanently cancel pending launch', () => {
  let active = true,
    current = true;
  const state = setup({ isActive: () => active, isCurrent: () => current });
  state.controller.begin({ identity: state.owner, outcome: 'won', canAdvance: true });
  state.advance(4000);
  active = false;
  state.advance(100);
  active = true;
  state.advance(10000);
  assert.deepEqual(state.actions, []);
  state.controller.begin({ identity: state.owner, outcome: 'won', canAdvance: true });
  state.controller.cancel('picture');
  state.advance(10000);
  assert.deepEqual(state.actions, []);
  state.controller.begin({ identity: state.owner, outcome: 'lost' });
  current = false;
  state.advance(10000);
  assert.deepEqual(state.actions, []);
});

test('explicit Next or Retry during celebration dispatches immediately and retires its timers', () => {
  const state = setup();
  state.controller.begin({ identity: state.owner, outcome: 'won', canAdvance: true });
  state.controller.activate('retry');
  assert.deepEqual(state.actions, [['retry', state.owner]]);
  state.advance(10000);
  assert.equal(state.actions.length, 1);
});

test('campaign ends and competitive results never schedule an invented successor', () => {
  const state = setup();
  state.controller.begin({ identity: state.owner, outcome: 'won', canAdvance: false });
  state.advance(10000);
  assert.deepEqual(state.actions, []);
  state.preferences.set('autoRetry', false);
  state.controller.begin({ identity: state.owner, outcome: 'lost' });
  state.advance(10000);
  assert.deepEqual(state.actions, []);
});

test('a result subscriber superseding dispatch cannot activate the retired owner', () => {
  let controller;
  const calls = [];
  controller = createContinuousPlayController({
    onNext: () => calls.push('next'),
    onChange: (state) => {
      if (state.phase === 'idle') controller.cancel('superseded');
    },
  });
  controller.begin({ identity: {}, outcome: 'won', canAdvance: true });
  controller.activate('next');
  assert.deepEqual(calls, []);
});
