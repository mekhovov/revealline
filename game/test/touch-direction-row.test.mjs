import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTouchSteering } from '../ui/touch-steering.mjs';

// Real pointer handlers with explicit painted control bounds; native fit is separate.
function setup(t, row = true) {
  const commands = [],
    releases = [];
  const pad = new EventTarget();
  const order = ['left', 'up', 'down', 'right'];
  const captures = new Set();
  let enabled = true;
  pad.getBoundingClientRect = () => ({
    left: 24,
    top: 392,
    width: row ? 268 : 192,
    height: row ? 64 : 192,
  });
  pad.querySelectorAll = () =>
    order.map((move, i) => ({
      dataset: { move },
      getBoundingClientRect: () => ({ left: 24 + i * 68, top: 392, width: 64, height: 64 }),
    }));
  pad.setPointerCapture = (id) => captures.add(id);
  pad.hasPointerCapture = (id) => captures.has(id);
  pad.releasePointerCapture = (id) => captures.delete(id);
  const input = attachTouchSteering({
    pad,
    getSettings: () => ({ mode: 'dpad' }),
    active: () => enabled,
    onDirection: (direction) => commands.push(direction),
    onRelease: (id) => releases.push(id),
  });
  t.after(() => input.destroy());
  const pointer = (type, x, y = 424, id = 1) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      clientX: x,
      clientY: y,
      pointerId: id,
      button: 0,
      pointerType: 'touch',
    });
    pad.dispatchEvent(event);
  };
  return {
    commands,
    releases,
    captures,
    pointer,
    disable: () => {
      enabled = false;
    },
  };
}

for (const [x, direction] of [
  [56, 'left'],
  [124, 'up'],
  [192, 'down'],
  [260, 'right'],
]) {
  test(`short row tap sends ${direction} and release does not invent another command`, (t) => {
    const f = setup(t);
    f.pointer('pointerdown', x);
    f.pointer('pointerup', x);
    assert.deepEqual(f.commands, [direction]);
    assert.deepEqual(f.releases, [1]);
    assert.equal(f.captures.size, 0);
  });
}

test('sliding row follows labelled buttons, retaining intent through gaps and outside bounds', (t) => {
  const f = setup(t);
  f.pointer('pointerdown', 124);
  for (const x of [157, 192, 225, 260, 350]) f.pointer('pointermove', x);
  assert.deepEqual(f.commands, ['up', 'down', 'right']);
  f.pointer('pointermove', 56);
  assert.deepEqual(f.commands, ['up', 'down', 'right', 'left']);
});

test('cancelled or inactive row cannot keep steering; another finger cannot steal it', (t) => {
  const f = setup(t);
  f.pointer('pointerdown', 124);
  f.pointer('pointerdown', 260, 424, 2);
  f.pointer('pointermove', 260, 424, 2);
  assert.deepEqual(f.commands, ['up']);
  f.pointer('pointercancel', 124);
  f.pointer('pointermove', 260);
  assert.deepEqual(f.commands, ['up']);
  assert.deepEqual(f.releases, [1]);
  f.pointer('pointerdown', 192);
  f.disable();
  f.pointer('pointermove', 260);
  assert.deepEqual(f.commands, ['up', 'down']);
  assert.deepEqual(f.releases, [1, 1]);
});

test('square D-pad retains radial sliding through its four directions', (t) => {
  const f = setup(t, false);
  f.pointer('pointerdown', 120, 405);
  f.pointer('pointermove', 205, 488);
  f.pointer('pointermove', 120, 570);
  f.pointer('pointermove', 36, 488);
  assert.deepEqual(f.commands, ['up', 'right', 'down', 'left']);
});
