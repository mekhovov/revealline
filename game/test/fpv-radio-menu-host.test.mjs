import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  mountRadioMenuControls,
  createRadioStagedAction,
  radioFlightHelp,
} from '../../optional-practice/civilian-fpv/sim-presentation.mjs';
import { mountFlightPractice } from '../../optional-practice/civilian-fpv/flight-fullscreen.mjs';

test('radio setup help follows the adopted layout in both languages', () => {
  assert.match(radioFlightHelp(null), /hold yaw/);
  const layout = { layout: 'six-switch' };
  assert.match(radioFlightHelp(layout), /cycle Fire/);
  assert.doesNotMatch(radioFlightHelp(layout), /hold yaw|Assign Arm/);
  assert.match(radioFlightHelp(layout, 'uk'), /Fire/);
  assert.doesNotMatch(radioFlightHelp(layout, 'uk'), /утримайте рискання/);
});

test('paused playback offers combat speeds and removes them for historical lessons', () => {
  const doc = new Document(),
    container = doc.createElement('section'),
    accepted = [];
  doc.body.append(container);
  const state = {
    available: true,
    replay: true,
    title: 'Combat',
    rate: 1,
    rates: [0.25, 0.5, 1, 2, 4],
  };
  const view = mountFlightPractice({
    document: doc,
    container,
    read: () => state,
    rates: [0.25, 0.5, 1, 2, 4],
    setRate: (rate) => accepted.push(rate),
  });
  view.refresh();
  const speed = container.querySelector('[data-practice-rate]');
  const fast = speed.querySelectorAll('option').find((option) => option.value === '4');
  assert.equal(fast.disabled, false);
  speed.value = '4';
  speed.dispatchEvent({ type: 'change' });
  assert.deepEqual(accepted, [4]);
  state.rates = [0.25, 0.5, 1];
  view.refresh();
  assert.equal(fast.disabled, true);
  assert.equal(fast.hidden, true);
  speed.value = '4';
  speed.dispatchEvent({ type: 'change' });
  assert.deepEqual(accepted, [4]);
  view.dispose();
});

function fixture() {
  const doc = new Document();
  const root = doc.createElement('section');
  doc.body.append(root);
  let active = false,
    requested = false;
  const contexts = [],
    actions = [];
  const runtime = {
    controlLayout: () => ({ layout: 'six-switch' }),
    setContext: (value) => contexts.push(value),
    poll() {},
    status: () => ({ active }),
    consumeResumeRequest() {
      const value = requested;
      requested = false;
      return value;
    },
    menuPreview: () => ({
      verified: true,
      controls: { roll: 0, pitch: 0, yaw: 0, throttle: 0.5 },
      pickup: { roll: 0, pitch: 0, yaw: 0, throttle: 0.5 },
    }),
  };
  const view = mountRadioMenuControls({
    document: doc,
    window: doc.defaultView,
    runtime,
    onResume: () => actions.push('resume'),
    onCamera: () => actions.push('camera'),
    onRetry: () => actions.push('retry'),
    onSettings: () => actions.push('settings'),
  });
  const state = {
    context: { root, key: 'pause' },
    flightActive: false,
    flightAvailable: true,
    canResume: true,
    playback: false,
  };
  return {
    doc,
    root,
    view,
    state,
    actions,
    contexts,
    active(value) {
      active = value;
    },
    request() {
      requested = true;
    },
  };
}

test('six-switch host requires ready root and shows airborne pickup positions', async (t) => {
  const f = fixture();
  t.after(() => f.view.dispose());
  f.view.sync(f.state);
  assert.equal(f.contexts.at(-1).resumeAllowed, true);
  assert.match(f.root.textContent, /Throttle 50% → 50%/);
  f.active(true);
  f.view.sync({ ...f.state, canResume: false, context: { root: f.root, key: 'settings' } });
  await Promise.resolve();
  assert.deepEqual(f.actions, []);
  f.view.sync(f.state);
  await Promise.resolve();
  assert.deepEqual(f.actions, ['resume']);
});

test('paused View and Settings share switches; Retry needs a separate confirmation', (t) => {
  const f = fixture();
  t.after(() => f.view.dispose());
  f.view.sync(f.state);
  f.view.shortcut('camera', f.state.context);
  f.view.shortcut('settings', f.state.context);
  assert.deepEqual(f.actions, ['camera', 'settings']);
  f.view.shortcut('retry', f.state.context);
  assert.equal(f.view.context().radioResumeBlocked, true);
  assert.deepEqual(f.actions, ['camera', 'settings']);
  f.view.sync({ ...f.state, context: f.view.context() });
  assert.equal(f.contexts.at(-1).resumeAllowed, false);
  f.view.context().root.querySelectorAll('button')[1].click();
  assert.equal(f.view.context(), null);
  assert.deepEqual(f.actions, ['camera', 'settings', 'retry']);
});

test('capture cannot use menu shortcuts and playback resume has no live input owner', async (t) => {
  const f = fixture();
  t.after(() => f.view.dispose());
  f.view.sync(f.state);
  f.view.shortcut('retry', { ...f.state.context, blockDevices: true });
  f.view.shortcut('camera', { ...f.state.context, radioSetup: true });
  assert.equal(f.view.context(), null);
  assert.deepEqual(f.actions, []);
  f.view.sync({ ...f.state, flightActive: true, playback: true, canResume: false, context: null });
  assert.equal(f.contexts.at(-1).owner, 'playback');
  f.request();
  f.view.sync({ ...f.state, playback: true });
  await Promise.resolve();
  assert.deepEqual(f.actions, ['resume']);
});

test('queued radio resume is cancelled on disposal or a newer menu context', async () => {
  for (const dispose of [true, false]) {
    const f = fixture();
    f.active(true);
    f.view.sync(f.state);
    if (dispose) f.view.dispose();
    else f.view.sync({ ...f.state, canResume: false });
    await Promise.resolve();
    assert.deepEqual(f.actions, []);
    f.view.dispose();
  }
});

test('a menu-staged radio action needs fresh Fire and never also emits a shot', () => {
  const actions = [],
    attempt = {};
  const staged = createRadioStagedAction({ execute: (action) => actions.push(action) });
  for (const action of ['weapon', 'reload', 'payload', 'detonate']) {
    assert(staged.stage(action, attempt));
    assert.equal(staged.fire(true, attempt), false, 'held Fire cannot execute');
    assert.deepEqual(actions, []);
    assert.equal(staged.fire(false, attempt), false);
    assert.equal(staged.fire(true, attempt), false, 'execution is not a shot');
    assert.deepEqual(actions.splice(0), [action]);
    assert.equal(staged.fire(true, attempt), false, 'held execution cannot fire next step');
    staged.fire(false, attempt);
    assert.equal(staged.fire(true, attempt), true, 'fresh activation fires normally');
  }
});

test('staged radio actions are cancelled by direct input, attempt changes and input loss', () => {
  const actions = [],
    attempt = {};
  const staged = createRadioStagedAction({ execute: (action) => actions.push(action) });
  for (const cancel of [() => staged.direct(), () => staged.validate({}), () => staged.clear()]) {
    staged.stage('detonate', attempt);
    cancel();
    staged.fire(false, attempt);
    staged.fire(true, attempt);
    assert.equal(staged.pending(), null);
    assert.deepEqual(actions, []);
  }
  assert.equal(staged.stage('unknown', attempt), false);
});

test('an unavailable staged action waits for another deliberate Fire activation', () => {
  let available = false,
    calls = 0;
  const attempt = {},
    staged = createRadioStagedAction({
      execute: () => {
        calls++;
        return available;
      },
    });
  staged.stage('payload', attempt);
  staged.fire(false, attempt);
  assert.equal(staged.fire(true, attempt), false);
  assert.equal(staged.pending(), 'payload');
  available = true;
  staged.fire(true, attempt);
  assert.equal(calls, 1);
  staged.fire(false, attempt);
  staged.fire(true, attempt);
  assert.equal(calls, 2);
  assert.equal(staged.pending(), null);
});
