import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCouchInput } from '../couch/couch-input.mjs';
import { createDuel, stepDuel, resumeDuel, pauseDuel, neutralCommand } from '../multiplayer.mjs';
import { releaseInputs, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

class Target {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = new Map();
    this.captures = new Set();
    this.classes = new Set();
    this.classList = {
      toggle: (key, on) => (on ? this.classes.add(key) : this.classes.delete(key)),
    };
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type, values = {}) {
    const event = {
      type,
      target: this,
      code: '',
      key: '',
      repeat: false,
      detail: 0,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...values,
    };
    this.dispatch(event);
    return event;
  }
  dispatch(event) {
    for (const fn of this.listeners.get(event.type) || []) fn(event);
    if (!['blur', 'lostpointercapture'].includes(event.type)) this.parent?.dispatch(event);
  }
  closest(selector) {
    return this.interactive && selector.includes(this.tag || 'button')
      ? this
      : this.parent?.closest?.(selector) || null;
  }
  focus() {
    this.focused = true;
  }
  hasAttribute(key) {
    return this.attributes.has(key);
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  getAttribute(key) {
    return this.attributes.get(key);
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.emit('lostpointercapture', { pointerId: id });
  }
}
const makePad = (index) => ({
  index,
  connected: true,
  mapping: 'standard',
  axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
});
function fixture(t, { tap = false, onStop = () => {}, onPause = () => {} } = {}) {
  const win = new Target(),
    doc = new Target(win),
    arena = new Target(win),
    buttons = [],
    padEls = [];
  for (let player = 0; player < 2; player++) {
    const pad = new Target(win),
      map = {};
    pad.dataset.player = String(player);
    for (const kind of ['up', 'left', 'stop', 'right', 'down', 'action', 'pickup', 'boost']) {
      const b = new Target(win);
      b.interactive = true;
      if (['action', 'pickup', 'boost'].includes(kind)) b.dataset.action = kind;
      else b.dataset.direction = kind;
      if (kind === 'boost') b.attributes.set('aria-pressed', 'false');
      map[kind] = b;
    }
    pad.querySelectorAll = () => Object.values(map);
    padEls.push(pad);
    buttons.push(map);
  }
  doc.querySelectorAll = () => padEls;
  doc.hidden = false;
  let pads = [],
    active = true,
    pauseCount = 0,
    slots = [];
  const input = attachCouchInput({
    window: win,
    document: doc,
    arena,
    getGamepads: () => pads,
    active: () => active,
    tapMode: () => tap,
    onPause: () => {
      active = false;
      pauseCount++;
      onPause();
    },
    onStop,
    onPads: (_count, next) => {
      slots = next;
    },
  });
  t.after(() => input.destroy());
  return {
    input,
    win,
    doc,
    arena,
    buttons,
    get pauses() {
      return pauseCount;
    },
    get slots() {
      return slots;
    },
    setPads: (value) => (pads = value),
    setActive: (value) => (active = value),
    setTap: (value) => (tap = value),
    key: (code, more = {}) =>
      arena.emit('keydown', {
        code,
        key: code === 'Enter' ? 'Enter' : code === 'Escape' ? 'Escape' : code,
        ...more,
      }),
    up: (code) => arena.emit('keyup', { code }),
    resume: () => {
      active = true;
      input.clear();
      input.focus();
    },
    down: (player, kind, id) =>
      buttons[player][kind].emit('pointerdown', { pointerId: id, button: 0 }),
    lift: (player, kind, id) => buttons[player][kind].emit('pointerup', { pointerId: id }),
  };
}
const neutralPair = () => [neutralCommand(), neutralCommand()];

test('simultaneous keyboard, held touch and controllers remain scoped to their player', (t) => {
  const f = fixture(t),
    pads = [makePad(0), makePad(1)];
  f.setPads(pads);
  f.input.poll();
  f.key('KeyW');
  f.down(1, 'right', 12);
  pads[0].buttons[5].pressed = true;
  pads[1].buttons[2].pressed = true;
  assert.deepEqual(f.input.poll(), [
    { ...neutralCommand(), direction: 'up', boost: true },
    { ...neutralCommand(), direction: 'right', pickup: true },
  ]);
  assert.equal(f.buttons[0].boost.getAttribute('aria-pressed'), 'true');
  f.key('KeyD');
  assert.equal(f.input.poll()[0].direction, 'right');
  f.up('KeyD');
  assert.equal(f.input.poll()[0].direction, 'up');
  f.lift(1, 'right', 12);
  assert.equal(f.input.poll()[0].direction, 'up');
  assert.equal(f.input.poll()[1].direction, null);
});
test('Stop blocks only that player held controller and keyboard until fresh input', (t) => {
  const stopped = [],
    f = fixture(t, { onStop: (p) => stopped.push(p) }),
    pads = [makePad(0), makePad(1)];
  f.setPads(pads);
  f.input.poll();
  pads[0].axes[0] = 1;
  pads[0].buttons[5].pressed = true;
  pads[1].axes[1] = 1;
  f.key('KeyW');
  f.input.poll();
  f.down(0, 'stop', 3);
  assert.deepEqual(f.input.poll(), [neutralCommand(), { ...neutralCommand(), direction: 'down' }]);
  f.key('KeyW', { repeat: true });
  assert.deepEqual(f.input.consume()[0], neutralCommand());
  assert.deepEqual(stopped, [0]);
  pads[0].axes[0] = 0;
  pads[0].buttons[5].pressed = false;
  f.input.poll();
  pads[0].axes[0] = -1;
  assert.equal(f.input.poll()[0].direction, 'left');
  assert.equal(f.input.poll()[1].direction, 'down');
});
test('two independent direction and boost pointers release separately', (t) => {
  const f = fixture(t);
  f.down(0, 'right', 1);
  f.down(0, 'boost', 2);
  f.down(1, 'up', 3);
  f.down(1, 'boost', 4);
  assert.ok(f.input.poll().every((c) => c.boost));
  f.lift(0, 'boost', 2);
  assert.deepEqual(f.input.poll(), [
    { ...neutralCommand(), direction: 'right' },
    { ...neutralCommand(), direction: 'up', boost: true },
  ]);
  assert.equal(f.buttons[0].boost.getAttribute('aria-pressed'), 'false');
  assert.equal(f.buttons[1].boost.getAttribute('aria-pressed'), 'true');
});
test('outside pointer release also works when pointer capture is unavailable', (t) => {
  const f = fixture(t);
  f.buttons[0].right.setPointerCapture = () => {
    throw new Error('capture unavailable');
  };
  f.down(0, 'right', 4);
  assert.equal(f.input.poll()[0].direction, 'right');
  f.win.emit('pointerup', { pointerId: 4 });
  assert.deepEqual(f.input.poll(), neutralPair());
  assert.equal(f.pauses, 0);
  f.down(0, 'right', 5);
  f.win.emit('pointercancel', { pointerId: 5 });
  assert.equal(f.pauses, 1);
  assert.deepEqual(f.input.poll(), neutralPair());
});
test('tap toggles ignore native pointer clicks, while unaccompanied assistive clicks work', (t) => {
  const f = fixture(t, { tap: true });
  f.down(1, 'left', 4);
  f.lift(1, 'left', 4);
  f.buttons[1].left.emit('click', { detail: 1 });
  f.down(1, 'boost', 5);
  f.lift(1, 'boost', 5);
  f.buttons[1].boost.emit('click', { detail: 1 });
  assert.deepEqual(f.input.poll()[1], { ...neutralCommand(), direction: 'left', boost: true });
  f.buttons[1].boost.emit('click');
  assert.equal(f.input.poll()[1].boost, false);
  f.buttons[1].stop.emit('click');
  assert.deepEqual(f.input.poll(), neutralPair());
  f.setTap(false);
  f.buttons[0].right.emit('click');
  assert.equal(f.input.poll()[0].direction, 'right');
});
test('held button keyboard activation follows hold mode, release and blur', (t) => {
  const f = fixture(t),
    b = f.buttons[0].boost;
  b.emit('keydown', { key: ' ', code: 'Space' });
  assert.equal(f.input.poll()[0].boost, true);
  b.emit('keyup', { key: ' ', code: 'Space' });
  b.emit('click');
  assert.equal(f.input.poll()[0].boost, false);
  f.buttons[1].up.emit('keydown', { key: 'Enter', code: 'Enter' });
  assert.equal(f.input.poll()[1].direction, 'up');
  f.buttons[1].up.emit('blur');
  assert.equal(f.input.poll()[1].direction, null);
});
test('Enter repeat and native key clicks cannot toggle twice or trigger the other player', async (t) => {
  const f = fixture(t, { tap: true }),
    b = f.buttons[0].right;
  b.emit('keydown', { key: 'Enter', code: 'Enter' });
  b.emit('click');
  b.emit('keydown', { key: 'Enter', code: 'Enter', repeat: true });
  b.emit('click');
  b.emit('keyup', { key: 'Enter', code: 'Enter' });
  b.emit('click');
  assert.deepEqual(f.input.consume(), [
    { ...neutralCommand(), direction: 'right' },
    neutralCommand(),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  b.emit('click');
  assert.deepEqual(f.input.poll(), neutralPair());
});
test('queued keyboard and touch actions survive zero ticks and consume once per fixed tick', (t) => {
  const f = fixture(t);
  f.key('KeyQ');
  f.down(1, 'pickup', 7);
  f.lift(1, 'pickup', 7);
  for (let i = 0; i < 10; i++)
    assert.deepEqual(
      f.input.poll().map((c) => [c.action, c.pickup]),
      [
        [true, false],
        [false, true],
      ],
    );
  assert.deepEqual(
    f.input.consume().map((c) => [c.action, c.pickup]),
    [
      [true, false],
      [false, true],
    ],
  );
  assert.deepEqual(f.input.consume(), neutralPair());
  f.key('KeyQ', { repeat: true });
  assert.deepEqual(f.input.consume(), neutralPair());
  f.up('KeyQ');
  f.key('KeyQ');
  assert.equal(f.input.consume()[0].action, true);
  f.up('KeyQ');
  f.key('KeyQ');
  assert.equal(f.input.consume()[0].action, false, 'release tick before a distinct rapid press');
  assert.equal(f.input.consume()[0].action, true);
  assert.equal(f.input.consume()[0].action, false);
});
test('controller actions remain held for core edge detection without clearing local pending actions', (t) => {
  const f = fixture(t),
    pad = makePad(2);
  f.setPads([pad]);
  f.input.poll();
  pad.buttons[0].pressed = true;
  f.input.poll();
  assert.equal(f.input.consume()[0].action, true);
  assert.equal(f.input.consume()[0].action, true);
  pad.buttons[0].pressed = false;
  f.input.poll();
  assert.equal(f.input.consume()[0].action, false);
  f.key('Enter');
  assert.equal(f.input.consume()[1].action, true);
  assert.equal(f.input.consume()[1].action, false);
});
test('pause button on a controller suppresses both same-sample commands until neutral after resume', (t) => {
  const f = fixture(t),
    pads = [makePad(0), makePad(1)];
  f.setPads(pads);
  f.input.poll();
  pads[0].buttons[9].pressed = true;
  pads[0].axes[0] = 1;
  pads[1].buttons[0].pressed = true;
  f.key('KeyW');
  assert.deepEqual(f.input.poll(), neutralPair());
  assert.equal(f.pauses, 1);
  f.resume();
  assert.equal(f.arena.focused, true);
  assert.deepEqual(f.input.poll(), neutralPair());
  assert.equal(f.pauses, 1);
  pads[0].buttons[9].pressed = false;
  pads[0].axes[0] = 0;
  pads[1].buttons[0].pressed = false;
  f.input.poll();
  pads[1].axes[1] = -1;
  assert.equal(f.input.poll()[1].direction, 'up');
});
test('disconnect pauses both boards and a surviving controller keeps its original player slot', (t) => {
  const f = fixture(t),
    first = makePad(3),
    second = makePad(7);
  f.setPads([first, second]);
  f.input.poll();
  f.setPads([second]);
  assert.deepEqual(f.input.poll(), neutralPair());
  assert.equal(f.pauses, 1);
  assert.deepEqual(f.slots, [null, 7]);
  f.resume();
  f.input.poll();
  second.axes[0] = 1;
  assert.equal(f.input.poll()[1].direction, 'right');
  assert.equal(f.input.poll()[0].direction, null);
  const replacement = makePad(0);
  replacement.axes[0] = -1;
  f.setPads([replacement, second]);
  assert.equal(f.input.poll()[0].direction, null);
  replacement.axes[0] = 0;
  f.input.poll();
  replacement.axes[0] = -1;
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['left', 'right'],
  );
});
test('blur, hidden page, pointer cancellation and unexpected capture loss pause and clear both players', (t) => {
  const f = fixture(t, { tap: true });
  for (const cancel of [
    () => f.win.emit('blur'),
    () => {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
    },
    () => f.buttons[0].right.emit('pointercancel', { pointerId: 2 }),
    () => f.buttons[0].right.releasePointerCapture(2),
  ]) {
    f.resume();
    f.down(0, 'right', 2);
    f.down(1, 'boost', 3);
    f.key('Enter');
    cancel();
    assert.deepEqual(f.input.poll(), neutralPair());
    assert.equal(f.buttons[0].right.captures.size, 0);
    assert.equal(f.buttons[1].boost.captures.size, 0);
    f.resume();
    f.key('Enter', { repeat: true });
    f.key('KeyW', { repeat: true });
    assert.deepEqual(f.input.consume(), neutralPair());
  }
  assert.equal(f.pauses, 4);
});
test('native form shortcuts are preserved, Escape still pauses from a focused control, and destroy removes all listeners', (t) => {
  const f = fixture(t),
    editor = new Target(f.win);
  editor.interactive = true;
  editor.tag = 'input';
  assert.equal(editor.emit('keydown', { key: 'ArrowUp', code: 'ArrowUp' }).defaultPrevented, false);
  assert.equal(f.key('KeyW', { metaKey: true }).defaultPrevented, false);
  f.buttons[0].boost.emit('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(f.pauses, 1);
  f.resume();
  f.down(0, 'right', 3);
  f.input.destroy();
  assert.equal(f.buttons[0].right.captures.size, 0);
  f.key('KeyW');
  assert.deepEqual(f.input.poll(), neutralPair());
  for (const target of [f.win, f.doc, ...f.buttons.flatMap(Object.values)])
    assert.equal(
      [...target.listeners.values()].reduce((n, set) => n + set.size, 0),
      0,
    );
});
test('focused music or action controls do not strand keyboard movement but retain native Enter', (t) => {
  const f = fixture(t),
    music = new Target(f.win);
  music.interactive = true;
  assert.equal(music.emit('keydown', { key: 'Enter', code: 'Enter' }).defaultPrevented, false);
  assert.deepEqual(f.input.consume(), neutralPair());
  music.emit('keydown', { key: 'w', code: 'KeyW' });
  f.buttons[0].boost.emit('keydown', { key: 'ArrowRight', code: 'ArrowRight' });
  assert.deepEqual(
    f.input.poll().map((c) => c.direction),
    ['up', 'right'],
  );
  music.emit('keyup', { key: 'w', code: 'KeyW' });
  f.buttons[0].boost.emit('keyup', { key: 'ArrowRight', code: 'ArrowRight' });
  assert.deepEqual(f.input.poll(), neutralPair());
});
const level = {
  version: 'xonix-level.v1',
  id: 'couch-input-test',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 6.5, y: 0.5 },
  goal: { coverage: 1 },
  rules: { moveSpeed: 8, boostMultiplier: 1.5 },
};
for (const turnPolicy of ['immediate', 'grid-center'])
  test(`real duel receives equal scoped class recipes and equivalent keyboard/touch motion: ${turnPolicy}`, (t) => {
    const recipes = structuredClone(CLASSES);
    recipes[0].id = 'pack-scout';
    recipes[0].cooldown = 1;
    recipes[0].moveSpeedMultiplier = 0.75;
    const match = createDuel(level, {
      turnPolicy,
      seed: 37,
      classId: 'pack-scout',
      classRecipes: recipes,
    });
    const f = fixture(t, {
      onStop: (p) => releaseInputs(match.runs[p]),
      onPause: () => pauseDuel(match),
    });
    resumeDuel(match);
    recipes[0].cooldown = 30;
    assert.equal(match.runs[0].classRecipe.cooldown, 1);
    assert.equal(match.runs[1].classRecipe.cooldown, 1);
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
    f.key('KeyD');
    f.key('ShiftLeft');
    f.down(1, 'right', 1);
    f.down(1, 'boost', 2);
    for (let frame = 0; frame < 15; frame++) {
      f.input.poll();
      for (let tick = 0; tick < 4; tick++) stepDuel(match, f.input.consume());
    }
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
    assert.ok(Math.abs(match.runs[0].player.x - 11) < 1e-8);
    f.buttons[0].stop.emit('click');
    assert.equal(match.runs[0].player.speed, 0);
    f.input.poll();
    stepDuel(match, f.input.consume());
    assert.ok(match.runs[1].player.x > match.runs[0].player.x);
  });
test('real core gets one scan per held keyboard press and a fresh scan after release', (t) => {
  const recipes = structuredClone(CLASSES);
  recipes[0].cooldown = 0.25;
  const match = createDuel(level, { classId: 'scout', classRecipes: recipes }),
    f = fixture(t);
  resumeDuel(match);
  f.key('KeyQ');
  const events = [];
  for (let tick = 0; tick < 100; tick++) {
    if (tick % 2 === 0) f.input.poll();
    stepDuel(match, f.input.consume());
    events.push(...match.runs[0].events);
  }
  assert.equal(events.filter((e) => e.type === 'ability.used').length, 1);
  f.up('KeyQ');
  f.key('KeyQ');
  f.input.poll();
  stepDuel(match, f.input.consume());
  assert.equal(match.runs[0].events.filter((e) => e.type === 'ability.used').length, 1);
});
