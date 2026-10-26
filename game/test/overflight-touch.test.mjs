import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createOverflightTouch } from '../overflight/touch.mjs';
import { createOverflightInputGate } from '../overflight/host-loop.mjs';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  pauseOverflightHunt,
  resumeOverflightHunt,
} from '../overflight/raid-core.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';

function fixture(
  t,
  {
    mode = 'stick',
    coarse = true,
    deniedStorage = false,
    visibility = false,
    actionLabel = () => 'Boost',
    actionName = null,
    touchStorage = null,
  } = {},
) {
  const doc = new Document(),
    win = new Events(),
    values = new Map();
  doc.parentNode = win;
  win.matchMedia = () => ({ matches: coarse });
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (touchStorage?.mode !== 'silent') values.set(key, value);
    },
  };
  values.set(
    TOUCH_PREFERENCES_KEY,
    JSON.stringify({ mode, side: 'right', size: 'regular', opacity: 0.55 }),
  );
  Object.defineProperty(win, 'localStorage', {
    get() {
      if (deniedStorage) throw Error('Storage denied');
      return storage;
    },
  });
  const arena = doc.createElement('div'),
    mount = doc.createElement('section'),
    settingsMount = doc.createElement('section');
  doc.body.append(arena, mount, settingsMount);
  let active = true,
    interrupts = 0,
    layouts = 0,
    input;
  input = createOverflightTouch({
    document: doc,
    window: win,
    arena,
    mount,
    settingsMount,
    active: () => active,
    actionLabel,
    actionName,
    onLayoutChange: () => layouts++,
    visibilitySettings: visibility ? { help: () => 'For this visit.' } : null,
    onInterrupt: () => {
      interrupts++;
      active = false;
      input.clear();
    },
  });
  t.after(() => input.dispose());
  const $ = (id) => doc.getElementById(id);
  const surface = $('overflight-touch-surface'),
    pad = $('overflight-touch-pad'),
    boost = $('overflight-touch-action');
  surface._rect = pad._rect = { x: 0, y: 0, width: 156, height: 156 };
  const pointer = (target, type, x = 100, y = 100, id = 1, extra = {}) =>
    target.emit(type, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: 'touch',
      button: 0,
      ...extra,
    });
  return {
    doc,
    win,
    input,
    arena,
    mount,
    settingsMount,
    surface,
    pad,
    boost,
    pointer,
    $,
    storage,
    values,
    interrupts: () => interrupts,
    layouts: () => layouts,
    active: (next) => {
      active = next;
      input.refresh();
    },
  };
}
const neutral = { x: 0, y: 0, boost: false, neutral: true };

test('compact action text has one full current accessible command and readiness', (t) => {
  let visible = 'Ривок';
  const f = fixture(t, { actionLabel: () => visible, actionName: () => 'Прискорення' });
  f.input.updateBoost({ cooldown: 0, readyLabel: 'Готово' });
  assert.equal(f.boost.textContent, 'Ривок\nГотово');
  assert.equal(f.boost.getAttribute('aria-label'), 'Ривок · Прискорення · Готово');
  f.input.updateBoost({ cooldown: 1.21, readyLabel: 'Готово' });
  assert.equal(f.boost.getAttribute('aria-label'), 'Ривок · Прискорення · 1.3s');
  visible = 'Прискорення';
  f.input.refreshCopy();
  f.input.updateBoost({ cooldown: 0, readyLabel: 'Готово' });
  assert.equal(f.boost.getAttribute('aria-label'), null);
  assert.equal(f.boost.textContent, 'Прискорення\nГотово');
  assert.deepEqual(f.input.sample(), neutral);
});

test('optional visit visibility supports mouse Always, keyboard Auto and Off without writing shared settings', (t) => {
  const original = fixture(t, { coarse: false });
  assert.equal(original.$('overflight-touch-visibility'), null);
  const f = fixture(t, { coarse: false, visibility: true }),
    control = f.$('overflight-touch-visibility'),
    root = f.$('overflight-touch-controls'),
    stored = [...f.values];
  const choose = (value) => {
    control.value = value;
    control.emit('change');
  };
  assert.equal(control.value, 'auto');
  assert.equal(root.hidden, true);
  choose('always');
  assert.equal(root.hidden, false);
  assert.throws(() => choose('invalid'), /auto, always or off/);
  f.input.refreshCopy();
  assert.equal(control.value, 'always');
  f.pointer(f.arena, 'pointerdown', 30, 30, 1, { pointerType: 'mouse' });
  f.doc.emit('keydown', { key: 'a', code: 'KeyA', target: f.arena });
  assert.equal(root.hidden, false);
  f.active(false);
  assert.equal(root.hidden, true);
  assert.equal(
    f.mount.classList.contains('has-touch-layout'),
    true,
    'The paused reader retains the selected touch presentation.',
  );
  f.active(true);
  assert.equal(root.hidden, false);
  choose('off');
  f.pointer(f.surface, 'pointerdown', 78, 78, 2);
  f.pointer(f.surface, 'pointermove', 140, 78, 2);
  f.boost.emit('click', { detail: 0 });
  assert.deepEqual(f.input.sample(), neutral);
  assert.equal(root.hidden, true);
  choose('auto');
  f.doc.emit('keydown', { key: 'a', code: 'KeyA', target: f.arena });
  assert.equal(root.hidden, true);
  f.pointer(f.arena, 'pointerdown', 30, 30, 3);
  assert.equal(root.hidden, false);
  assert.deepEqual([...f.values], stored);
  const nextVisit = fixture(t, { coarse: false, visibility: true });
  assert.equal(nextVisit.$('overflight-touch-visibility').value, 'auto');
});

test('Off then Always cannot rearm Boost held through the native inactive boundary', (t) => {
  const f = fixture(t, { visibility: true }),
    gate = createOverflightInputGate(),
    control = f.$('overflight-touch-visibility');
  const choose = (value) => {
    control.value = value;
    control.emit('change');
  };
  const sample = () =>
    gate.sample({ ...f.input.sample(), actionsNeutral: f.input.actionsNeutral() });
  choose('always');
  sample();
  f.pointer(f.boost, 'pointerdown', 20, 20, 1);
  assert.equal(sample().boost, true);
  f.active(false);
  gate.release();
  choose('off');
  choose('always');
  f.active(true);
  assert.equal(f.input.actionsNeutral(), false);
  assert.equal(sample().boost, false);
  f.pointer(f.win, 'pointerup', 20, 20, 1);
  sample();
  f.pointer(f.boost, 'pointerdown', 20, 20, 2);
  assert.equal(sample().boost, true);
});

test('caption layout notification follows actual control visibility rather than adding a polling owner', (t) => {
  const f = fixture(t),
    initial = f.layouts();
  for (let n = 0; n < 20; n++) assert.deepEqual(f.input.sample(), neutral);
  assert.equal(f.layouts(), initial);
  f.active(false);
  assert.equal(f.layouts(), initial + 1);
  f.input.refresh();
  assert.equal(f.layouts(), initial + 1);
  f.active(true);
  assert.equal(f.layouts(), initial + 2);
  assert.deepEqual(f.input.sample(), neutral);
  assert.equal(f.interrupts(), 0);
});

test('Overflight stick preserves proportional diagonal movement and its central dead zone', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.input.sample(), neutral);
  f.pointer(f.surface, 'pointerdown');
  f.pointer(f.surface, 'pointermove', 106, 108);
  assert.deepEqual(f.input.sample(), { ...neutral, neutral: false });
  f.pointer(f.surface, 'pointermove', 128, 128);
  assert.deepEqual(f.input.sample(), { x: 0.5, y: 0.5, boost: false, neutral: false });
  f.pointer(f.surface, 'pointermove', 156, 156);
  const diagonal = f.input.sample();
  assert.equal(diagonal.x, diagonal.y);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  f.pointer(f.surface, 'pointerup');
  assert.deepEqual(f.input.sample(), neutral);
});

for (const mode of ['swipe', 'dpad']) {
  test(`Overflight ${mode} uses main-game turn interpretation and releases cleanly`, (t) => {
    const f = fixture(t, { mode });
    const target = mode === 'dpad' ? f.pad : f.surface;
    f.pointer(target, 'pointerdown', mode === 'dpad' ? 145 : 78, 78);
    if (mode === 'swipe') f.pointer(target, 'pointermove', 125, 78);
    assert.deepEqual(f.input.sample(), { x: 1, y: 0, boost: false, neutral: false });
    if (mode === 'swipe') {
      f.pointer(target, 'pointermove', 123, 79);
      assert.equal(f.input.sample().x, 1, 'Small jitter retains the swipe heading.');
      f.pointer(target, 'pointermove', 125, 115);
    } else f.pointer(target, 'pointermove', 78, 145);
    assert.deepEqual(f.input.sample(), { x: 0, y: 1, boost: false, neutral: false });
    f.pointer(target, 'pointerup');
    assert.deepEqual(f.input.sample(), neutral);
  });
}

test('one finger steers while another boosts; foreign and steering releases cannot cancel Boost', (t) => {
  const f = fixture(t);
  f.pointer(f.surface, 'pointerdown', 100, 100, 1);
  f.pointer(f.surface, 'pointermove', 156, 100, 1);
  f.pointer(f.boost, 'pointerdown', 20, 20, 2);
  assert.deepEqual(f.input.sample(), { x: 1, y: 0, boost: true, neutral: false });
  f.pointer(f.win, 'pointerup', 0, 0, 99);
  assert.equal(f.input.sample().boost, true);
  f.pointer(f.surface, 'pointerup', 156, 100, 1);
  assert.deepEqual(f.input.sample(), { x: 0, y: 0, boost: true, neutral: false });
  f.pointer(f.win, 'pointerup', 0, 0, 2);
  assert.deepEqual(f.input.sample(), neutral);
  assert.equal(f.interrupts(), 0);
});

test('pause and upgrade clearing cannot rearm a finger held through the menu', (t) => {
  const f = fixture(t),
    gate = createOverflightInputGate();
  gate.sample(f.input.sample());
  f.pointer(f.surface, 'pointerdown', 100, 100, 1);
  f.pointer(f.surface, 'pointermove', 156, 100, 1);
  f.pointer(f.boost, 'pointerdown', 20, 20, 2);
  assert.equal(gate.sample(f.input.sample()).boost, true);
  f.active(false);
  gate.release();
  assert.equal(f.surface.hasPointerCapture(1), false);
  assert.equal(f.boost.hasPointerCapture(2), false);
  f.active(true);
  f.pointer(f.surface, 'pointermove', 100, 156, 1);
  assert.deepEqual(f.input.sample(), { ...neutral, neutral: false });
  assert.deepEqual(gate.sample(f.input.sample()), { x: 0, y: 0, boost: false });
  f.pointer(f.win, 'pointerup', 0, 0, 1);
  gate.sample(f.input.sample());
  assert.equal(gate.blocked(), true, 'The independent Boost finger still holds the gate.');
  f.pointer(f.win, 'pointerup', 0, 0, 2);
  gate.sample(f.input.sample());
  assert.equal(gate.blocked(), false);
  f.pointer(f.surface, 'pointerdown', 100, 100, 3);
  f.pointer(f.surface, 'pointermove', 100, 156, 3);
  assert.equal(gate.sample(f.input.sample()).y, 1);
});

for (const control of ['surface', 'boost']) {
  for (const event of ['pointercancel', 'lostpointercapture']) {
    test(`${control} ${event} interrupts once and stale notifications cannot pause a new gesture`, (t) => {
      const f = fixture(t),
        target = f[control];
      f.pointer(target, 'pointerdown', 100, 100, 7);
      if (control === 'surface') f.pointer(target, 'pointermove', 156, 100, 7);
      f.pointer(target, event, 100, 100, 7);
      assert.equal(f.interrupts(), 1);
      assert.deepEqual(f.input.sample(), { ...neutral, neutral: event !== 'lostpointercapture' });
      f.pointer(f.win, 'pointerup', 0, 0, 7);
      f.active(true);
      f.pointer(target, 'pointerdown', 100, 100, 8);
      if (control === 'surface') f.pointer(target, 'pointermove', 156, 100, 8);
      f.pointer(target, event, 100, 100, 7);
      assert.equal(f.interrupts(), 1);
      assert.equal(
        f.input.sample()[control === 'surface' ? 'x' : 'boost'],
        control === 'surface' ? 1 : true,
      );
    });
  }
}

test('failed pointer capture still observes outside release before stopped propagation', (t) => {
  const f = fixture(t);
  f.surface.setPointerCapture = f.boost.setPointerCapture = () => {
    throw Error('Unavailable');
  };
  f.pointer(f.surface, 'pointerdown');
  f.pointer(f.surface, 'pointermove', 156, 100);
  f.pointer(f.boost, 'pointerdown', 20, 20, 2);
  f.settingsMount.addEventListener('pointerup', (event) => event.stopPropagation());
  f.pointer(f.settingsMount, 'pointerup', 200, 200, 1);
  f.pointer(f.settingsMount, 'pointerup', 200, 200, 2);
  assert.deepEqual(f.input.sample(), neutral);
  f.pointer(f.surface, 'pointerdown', 100, 100, 3);
  f.pointer(f.surface, 'pointermove', 100, 156, 3);
  assert.equal(f.input.sample().y, 1);
});

test('resize pauses an owned gesture while idle resize is harmless; blur forgets missed releases', (t) => {
  const f = fixture(t);
  f.win.emit('resize');
  assert.equal(f.interrupts(), 0);
  f.pointer(f.surface, 'pointerdown');
  f.pointer(f.surface, 'pointermove', 156, 100);
  f.pointer(f.boost, 'pointerdown', 20, 20, 2);
  f.win.emit('resize');
  assert.equal(f.interrupts(), 1);
  assert.deepEqual(f.input.sample(), neutral);
  f.pointer(f.surface, 'pointermove', 100, 156);
  assert.deepEqual(f.input.sample(), neutral);
  f.active(true);
  f.pointer(f.boost, 'pointerdown', 20, 20, 3);
  f.win.emit('blur');
  assert.deepEqual(f.input.sample(), neutral);
});

test('keyboard controls wait for physical key release across a menu and ignore trailing pointer clicks', (t) => {
  const f = fixture(t, { mode: 'dpad' }),
    gate = createOverflightInputGate();
  gate.sample(f.input.sample());
  const up = f.pad.querySelector('[data-direction="up"]');
  up.emit('keydown', { code: 'Enter', key: 'Enter', repeat: false });
  assert.equal(gate.sample(f.input.sample()).y, -1);
  f.active(false);
  gate.release();
  f.active(true);
  assert.equal(f.input.sample().neutral, false);
  assert.deepEqual(gate.sample(f.input.sample()), { x: 0, y: 0, boost: false });
  up.emit('keyup', { code: 'Enter', key: 'Enter' });
  gate.sample(f.input.sample());
  f.boost.emit('keydown', { code: 'Space', key: ' ', repeat: false });
  assert.equal(gate.sample(f.input.sample()).boost, true);
  f.boost.emit('keyup', { code: 'Space', key: ' ' });
  assert.equal(f.input.sample().boost, false);
  f.boost.emit('click', { detail: 1 });
  assert.equal(f.input.sample().boost, false);
});

test('click-only assistive controls toggle intent and modified activation cannot change flight', (t) => {
  const f = fixture(t, { mode: 'dpad' });
  const right = f.pad.querySelector('[data-direction="right"]');
  right.emit('click', { detail: 0 });
  assert.deepEqual(f.input.sample(), { x: 1, y: 0, boost: false, neutral: false });
  right.emit('click', { detail: 0 });
  assert.deepEqual(f.input.sample(), neutral);
  f.boost.emit('click', { detail: 0 });
  assert.deepEqual(f.input.sample(), { x: 0, y: 0, boost: true, neutral: false });
  f.boost.emit('click', { detail: 0 });
  assert.deepEqual(f.input.sample(), neutral);
  right.emit('keydown', { code: 'Enter', key: 'Enter', ctrlKey: true, repeat: false });
  assert.deepEqual(f.input.sample(), neutral);
});

for (const event of ['visibilitychange', 'pagehide']) {
  test(`${event} drops logical actions and physical captures before the page can resume`, (t) => {
    const f = fixture(t);
    f.pointer(f.surface, 'pointerdown');
    f.pointer(f.surface, 'pointermove', 156, 100);
    f.pointer(f.boost, 'pointerdown', 20, 20, 2);
    if (event === 'visibilitychange') {
      f.doc.hidden = true;
      f.doc.emit(event);
    } else f.win.emit(event);
    assert.deepEqual(f.input.sample(), neutral);
    assert.equal(f.surface.hasPointerCapture(1), false);
    assert.equal(f.boost.hasPointerCapture(2), false);
    f.pointer(f.surface, 'pointermove', 100, 156);
    assert.deepEqual(f.input.sample(), neutral);
  });
}

test('shared settings restore unchanged and changes cancel current input without writing a game profile', (t) => {
  const f = fixture(t);
  const shared = createTouchPreferences({ storage: f.storage, eventTarget: f.win });
  t.after(() => shared.destroy());
  const expected = { mode: 'dpad', side: 'left', size: 'large', opacity: 0.2 };
  shared.set(expected);
  f.pointer(f.surface, 'pointerdown');
  f.pointer(f.surface, 'pointermove', 156, 100);
  f.win.emit('storage', { key: TOUCH_PREFERENCES_KEY, storageArea: f.storage });
  assert.deepEqual(f.input.sample(), { ...neutral, neutral: false });
  assert.equal(f.surface.hidden, true);
  assert.equal(f.pad.hidden, false);
  assert.equal(f.$('overflight-touch-controls').dataset.touchSide, 'left');
  assert.equal(f.$('overflight-touch-controls').style.getPropertyValue('--touch-opacity'), '0.2');
  const setting = f.$('overflight-touch-mode');
  setting.value = 'swipe';
  setting.emit('change');
  assert.deepEqual(JSON.parse(f.values.get(TOUCH_PREFERENCES_KEY)), { ...expected, mode: 'swipe' });
  assert.deepEqual([...f.values.keys()], [TOUCH_PREFERENCES_KEY]);
});

test('denied storage keeps controls playable and announces a session-only settings change', (t) => {
  const f = fixture(t, { deniedStorage: true });
  const setting = f.$('overflight-touch-mode');
  setting.value = 'dpad';
  setting.emit('change');
  assert.match(f.settingsMount.querySelector('[role="status"]').textContent, /for this visit/);
  f.pointer(f.pad, 'pointerdown', 145, 78);
  assert.equal(f.input.sample().x, 1);
});

test('touch shows controls on a hybrid device, keyboard hides them, and disposal removes listeners', (t) => {
  const f = fixture(t, { coarse: false });
  assert.equal(f.$('overflight-touch-controls').hidden, true);
  f.pointer(f.arena, 'pointerdown');
  assert.equal(f.$('overflight-touch-controls').hidden, false);
  f.pointer(f.arena, 'pointermove', 156, 100);
  assert.equal(f.input.sample().x, 1);
  f.pointer(f.arena, 'pointerup');
  f.doc.body.emit('keydown', { code: 'KeyW', key: 'w' });
  assert.equal(f.$('overflight-touch-controls').hidden, true);
  f.input.dispose();
  assert.equal(f.$('overflight-touch-controls'), null);
  for (const target of [f.doc, f.win, f.surface, f.pad, f.boost])
    for (const map of [target.listeners, target.captureListeners])
      for (const listeners of map.values()) assert.equal(listeners.size, 0);
  assert.deepEqual(f.input.sample(), neutral);
});

for (const [name, project, compile, create, start, step, pause, resume] of [
  [
    'Survivor',
    createOverflightProject,
    compileOverflightProject,
    createOverflightRun,
    startOverflight,
    stepOverflight,
    pauseOverflight,
    resumeOverflight,
  ],
  [
    'Raid',
    createOverflightHuntProject,
    compileOverflightHuntProject,
    createOverflightHuntRun,
    startOverflightHunt,
    stepOverflightHunt,
    pauseOverflightHunt,
    resumeOverflightHunt,
  ],
]) {
  test(`${name}: actual flight core accepts touch steering and exactly one Boost per fresh press`, (t) => {
    const f = fixture(t),
      source = structuredClone(compile(project())),
      gate = createOverflightInputGate();
    source.encounters = [];
    const run = create(source);
    start(run);
    const tick = () => step(run, gate.sample(f.input.sample()));
    tick();
    const origin = { x: run.player.x, y: run.player.y };
    f.pointer(f.surface, 'pointerdown');
    f.pointer(f.surface, 'pointermove', 156, 156);
    for (let i = 0; i < 20; i++) tick();
    assert.ok(run.player.x > origin.x && run.player.y > origin.y);
    f.pointer(f.boost, 'pointerdown', 20, 20, 2);
    for (let i = 0; i < 200; i++) tick();
    assert.equal(run.stats.boostsUsed, 1, 'Holding Boost beyond cooldown does not repeat.');
    pause(run);
    f.active(false);
    gate.release();
    resume(run);
    f.active(true);
    tick();
    assert.equal(run.stats.boostsUsed, 1);
    f.pointer(f.win, 'pointerup', 0, 0, 1);
    f.pointer(f.win, 'pointerup', 0, 0, 2);
    tick();
    f.pointer(f.boost, 'pointerdown', 20, 20, 3);
    tick();
    assert.equal(run.stats.boostsUsed, 2);
  });
  test(`${name}: touch save recovery keeps the paused native state and held-action boundary`, (t) => {
    const touchStorage = { mode: 'silent' },
      f = fixture(t, { touchStorage });
    const source = structuredClone(compile(project())),
      gate = createOverflightInputGate();
    source.encounters = [];
    const run = create(source);
    start(run);
    step(run, gate.sample(f.input.sample()));
    f.pointer(f.surface, 'pointerdown', 100, 100, 1);
    f.pointer(f.surface, 'pointermove', 156, 100, 1);
    f.pointer(f.boost, 'pointerdown', 20, 20, 2);
    step(run, gate.sample(f.input.sample()));
    assert.equal(run.stats.boostsUsed, 1);
    pause(run);
    f.active(false);
    gate.release();
    const paused = JSON.stringify(run),
      saved = f.values.get(TOUCH_PREFERENCES_KEY);
    const field = f.$('overflight-touch-mode'),
      retry = f.$('overflight-touch-save-retry');
    field.focus();
    field.value = 'swipe';
    field.emit('change');
    assert.equal(f.values.get(TOUCH_PREFERENCES_KEY), saved);
    assert.match(f.$('overflight-touch-save-status').textContent, /Session only.*did not confirm/);
    f.win.emit('pageshow', { persisted: true });
    assert.equal(field.value, 'swipe');
    assert.equal(
      f.input.actionsNeutral(),
      false,
      'A settings retry cannot release a physically held Boost.',
    );
    touchStorage.mode = 'working';
    retry.focus();
    retry.click();
    assert.equal(f.doc.activeElement, field);
    assert.equal(retry.hidden, true);
    assert.equal(JSON.parse(f.values.get(TOUCH_PREFERENCES_KEY)).mode, 'swipe');
    assert.equal(JSON.stringify(run), paused);
    assert.deepEqual([...f.values.keys()], [TOUCH_PREFERENCES_KEY]);
    f.pointer(f.win, 'pointerup', 0, 0, 1);
    f.pointer(f.win, 'pointerup', 0, 0, 2);
    assert.equal(f.input.actionsNeutral(), true);
  });
}

test('the native action gate allows immediate touch steering without requiring the movement finger to release', (t) => {
  const f = fixture(t),
    gate = createOverflightInputGate();
  const sample = () =>
    gate.sample({ ...f.input.sample(), actionsNeutral: f.input.actionsNeutral() });
  f.pointer(f.surface, 'pointerdown', 100, 100, 1);
  f.pointer(f.surface, 'pointermove', 156, 100, 1);
  assert.equal(sample().x, 1);
  assert.equal(gate.blocked(), false);
  f.pointer(f.boost, 'pointerdown', 20, 20, 2);
  assert.equal(sample().boost, true);
  f.active(false);
  gate.release();
  f.active(true);
  assert.equal(f.input.actionsNeutral(), false, 'Clearing logical input is not releasing Boost.');
  f.pointer(f.surface, 'pointerdown', 100, 100, 3);
  f.pointer(f.surface, 'pointermove', 156, 100, 3);
  assert.equal(sample().x, 1, 'A new steering gesture works while the old action is still held.');
  assert.equal(gate.blocked(), true);
  f.pointer(f.win, 'pointerup', 0, 0, 2);
  assert.equal(sample().boost, false);
  assert.equal(gate.blocked(), false, 'Only the Boost finger needed to release.');
  f.pointer(f.boost, 'pointerdown', 20, 20, 4);
  assert.equal(sample().boost, true);
});
