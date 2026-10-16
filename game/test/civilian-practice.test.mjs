import test from 'node:test';
import assert from 'node:assert/strict';
import { CIVILIAN_PRACTICE_CATALOGUE } from '../../optional-practice/civilian-flight/catalogue.mjs';
import {
  createPractice,
  validatePracticeCatalogue,
  exportPracticeCatalogue,
  replayPractice,
  neutralPracticeInput,
} from '../../optional-practice/civilian-flight/model.mjs';
import { attachPracticeInput } from '../../optional-practice/civilian-flight/input.mjs';
import {
  removePracticeOffline,
  practiceCachePrefix,
} from '../../optional-practice/civilian-flight/offline.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const catalogue = CIVILIAN_PRACTICE_CATALOGUE;
const clamp = (value) => Math.max(-1, Math.min(1, value));
function route(drill) {
  const model = createPractice(catalogue, drill.id),
    commands = [];
  model.start();
  while (model.snapshot().status !== 'complete' && commands.length < 8000) {
    const state = model.snapshot(),
      target = state.target;
    const heading = target.heading ?? 0;
    const delta = ((heading - state.heading + 540) % 360) - 180;
    const angle = (state.heading * Math.PI) / 180;
    const dx = target.x - state.x,
      dz = target.z - state.z;
    const input =
      Math.abs(delta) > 0
        ? { ...neutralPracticeInput(), yaw: clamp(delta / 3) }
        : {
            yaw: 0,
            pitch: clamp((Math.sin(angle) * dx - Math.cos(angle) * dz) / 8),
            roll: clamp((Math.cos(angle) * dx + Math.sin(angle) * dz) / 8),
            throttle: clamp((target.altitude - state.altitude) / 5),
          };
    commands.push({ ticks: 1, input });
    model.step(input);
  }
  assert.equal(model.snapshot().status, 'complete', drill.id);
  return {
    format: 'revealline-practice-transcript.v1',
    catalogueIdentity: model.identity,
    drillId: drill.id,
    commands,
  };
}

test('all twelve authored civilian routes have ordered deterministic completion proofs', () => {
  assert.equal(catalogue.drills.length, 12);
  const shapes = new Set();
  for (const drill of catalogue.drills) {
    const trace = route(drill);
    const first = replayPractice(catalogue, trace);
    assert.deepEqual(replayPractice(catalogue, trace), first);
    assert.equal(first.checkpoint, drill.checkpoints.length);
    assert.equal(first.altitude, 0, drill.id);
    shapes.add(JSON.stringify(drill.checkpoints));
  }
  assert.equal(shapes.size, 12);
});
test('landing alone, partial dwell and claimed completion never skip ordered checkpoints', () => {
  const model = createPractice(catalogue, 'steady-hover');
  model.start();
  for (let i = 0; i < 100; i++) model.step(neutralPracticeInput());
  assert.equal(model.snapshot().checkpoint, 0);
  for (let i = 0; i < 20; i++) model.step({ ...neutralPracticeInput(), throttle: 1 });
  for (let i = 0; i < 20; i++) model.step(neutralPracticeInput());
  assert.equal(model.snapshot().checkpoint, 0);
  for (let i = 0; i < 20; i++) model.step({ ...neutralPracticeInput(), roll: 1 });
  assert.equal(model.snapshot().holdTicks, 0);
  const trace = route(catalogue.drills[0]);
  assert.throws(() => replayPractice(catalogue, { ...trace, completed: true }));
  assert.throws(() => replayPractice(catalogue, { ...trace, catalogueIdentity: 'different' }));
  assert.throws(() =>
    replayPractice(catalogue, {
      ...trace,
      commands: [...trace.commands, { ticks: 1, input: neutralPracticeInput() }],
    }),
  );
});
test('pause freezes model, reset clears it, and hostile fixtures never enter authoring', () => {
  const model = createPractice(catalogue, catalogue.drills[0].id);
  assert.deepEqual(validatePracticeCatalogue(exportPracticeCatalogue(catalogue)), catalogue);
  model.start();
  model.step({ ...neutralPracticeInput(), throttle: 1 });
  model.pause();
  const paused = model.snapshot();
  model.step({ ...neutralPracticeInput(), pitch: 1 });
  assert.deepEqual(model.snapshot(), paused);
  model.reset();
  assert.equal(model.snapshot().status, 'ready');
  assert.equal(model.snapshot().ticks, 0);
  for (const mutate of [
    (value) => {
      value.drills[0].checkpoints[0].x = -1;
    },
    (value) => {
      value.drills[0].spawn.altitude = 100;
    },
    (value) => {
      value.drills[0].checkpoints[0].landed = true;
    },
    (value) => {
      value.drills[0].checkpoints[0].radius = 10000;
    },
    (value) => {
      value.drills[0].completion = 'reward';
    },
    (value) => {
      delete value.drills[0].locales.uk;
    },
  ]) {
    const value = structuredClone(catalogue);
    mutate(value);
    assert.throws(() => validatePracticeCatalogue(value));
  }
});
function inputFixture(t) {
  const doc = new Document(),
    win = new Events(),
    arena = doc.createElement('div'),
    button = doc.createElement('button');
  arena.tabIndex = 0;
  button.dataset.axis = 'pitch';
  button.dataset.direction = '1';
  doc.body.append(arena, button);
  let active = true,
    pad = null;
  const statuses = [];
  win.navigator = { getGamepads: () => (pad ? [pad] : []) };
  const input = attachPracticeInput({
    document: doc,
    window: win,
    arena,
    buttons: [button],
    active: () => active,
    onPause: () => {
      active = false;
    },
    onStatus: (status) => statuses.push(status),
  });
  t.after(() => input.dispose());
  arena.focus();
  return {
    doc,
    win,
    arena,
    button,
    input,
    statuses,
    resume() {
      active = true;
      input.clear();
      arena.focus();
    },
    pad(value) {
      pad = value;
    },
    active: () => active,
  };
}
test('keyboard and touch have explicit input ownership and require fresh controls after pause', (t) => {
  const f = inputFixture(t);
  f.win.emit('keydown', { code: 'KeyW', key: 'w', repeat: false });
  assert.equal(f.input.sample().pitch, 1);
  f.win.emit('keydown', { code: 'Escape', key: 'Escape', repeat: false });
  assert.equal(f.active(), false);
  f.resume();
  f.win.emit('keydown', { code: 'KeyW', key: 'w', repeat: true });
  assert.equal(f.input.sample().pitch, 0);
  f.win.emit('keyup', { code: 'KeyW', key: 'w' });
  f.win.emit('keydown', { code: 'KeyW', key: 'w', repeat: false });
  assert.equal(f.input.sample().pitch, 1);
  f.win.emit('keyup', { code: 'KeyW', key: 'w' });
  f.button.emit('pointerdown', { pointerId: 4, button: 0 });
  assert.equal(f.input.sample().pitch, 1);
  f.button.emit('pointercancel', { pointerId: 4 });
  assert.equal(f.input.sample().pitch, 0);
  f.button.focus();
  f.win.emit('keydown', { code: 'KeyE', key: 'e', repeat: false });
  assert.equal(f.input.sample().yaw, 0);
});
test('standard gamepad is opt-in, neutral-gated, and disconnect/blur always pause with fallback', (t) => {
  const f = inputFixture(t);
  assert.equal(f.input.connect(), false);
  assert.equal(f.statuses.at(-1), 'unavailable');
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0.8, 0, 0, 0], buttons: [] };
  f.pad(pad);
  assert.equal(f.input.sample().yaw, 0, 'No automatic controller join');
  assert.equal(f.input.connect(), true);
  assert.equal(f.input.sample().yaw, 0);
  pad.axes[0] = 0;
  f.input.sample();
  pad.axes[0] = 0.8;
  assert.equal(f.input.sample().yaw, 0.8);
  f.win.emit('gamepaddisconnected', { gamepad: pad });
  assert.equal(f.active(), false);
  assert.deepEqual(f.input.sample(), neutralPracticeInput());
  f.resume();
  f.win.emit('keydown', { code: 'KeyR', key: 'r' });
  f.win.emit('blur');
  assert.equal(f.active(), false);
  assert.deepEqual(f.input.sample(), neutralPracticeInput());
});
test('optional removal unregisters only exact app scope and deletes only its own path-specific cache', async () => {
  const location = new URL('https://example.test/one/optional-practice/civilian-flight/');
  const other = new URL('https://example.test/two/optional-practice/civilian-flight/');
  const own = practiceCachePrefix(location) + 'revision',
    foreign = practiceCachePrefix(other) + 'revision';
  let unregisters = 0;
  const deleted = [];
  const cache = {
    keys: async () => [own, foreign, 'revealline-core:v1', 'edition-coupa:v1'],
    delete: async (name) => {
      deleted.push(name);
    },
  };
  await removePracticeOffline({
    location,
    caches: cache,
    navigator: {
      serviceWorker: {
        getRegistration: async () => ({
          scope: 'https://example.test/',
          unregister: () => {
            unregisters++;
          },
        }),
      },
    },
  });
  assert.equal(unregisters, 0);
  assert.deepEqual(deleted, [own]);
  await removePracticeOffline({
    location,
    caches: cache,
    navigator: {
      serviceWorker: {
        getRegistration: async () => ({
          scope: location.href,
          unregister: () => {
            unregisters++;
          },
        }),
      },
    },
  });
  assert.equal(unregisters, 1);
});
