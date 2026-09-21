import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTouchSteering } from '../ui/touch-steering.mjs';
import { touchDirection, resolveTouchControls } from '../touch-controls.mjs';
import { emptyLibrary, exportLibrary, importLibrary, updatePreferences } from '../library.mjs';

class Surface extends EventTarget {
  captures = new Set();
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 156, height: 156 };
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.pointer('lostpointercapture', 0, 0, id);
  }
  pointer(type, x, y, id = 1, pointerType = 'touch') {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType, button: 0 });
    this.dispatchEvent(event);
    return event;
  }
}
function setup(t, mode = 'stick') {
  const arena = new Surface(),
    pad = new Surface(),
    surface = new Surface();
  const commands = [],
    releases = [],
    cancellations = [];
  let enabled = true;
  const input = attachTouchSteering({
    arena,
    pad,
    surface,
    getSettings: () => ({ mode }),
    active: () => enabled,
    onDirection: (direction) => commands.push(direction),
    onRelease: (id) => releases.push(id),
    onCancel: () => cancellations.push(true),
  });
  t.after(() => input.destroy());
  return {
    arena,
    pad,
    surface,
    commands,
    releases,
    cancellations,
    input,
    disable() {
      enabled = false;
    },
  };
}

test('cardinal touch directions reject jitter and retain heading at diagonal boundaries', () => {
  assert.equal(touchDirection(7, 9), null);
  assert.equal(touchDirection(20, 21, 'right'), 'right');
  assert.equal(touchDirection(20, 25, 'right'), 'down');
  assert.equal(touchDirection(-20, 0, 'right'), 'left');
  assert.equal(touchDirection(NaN, 40), null);
});

test('floating stick starts where the finger lands, turns through four directions, releases capture', (t) => {
  const f = setup(t);
  f.surface.pointer('pointerdown', 300, 200);
  f.surface.pointer('pointermove', 305, 202);
  assert.deepEqual(f.commands, []);
  for (const [x, y] of [
    [325, 200],
    [300, 225],
    [275, 200],
    [300, 175],
  ])
    f.surface.pointer('pointermove', x, y);
  assert.deepEqual(f.commands, ['right', 'down', 'left', 'up']);
  f.surface.pointer('pointerup', 300, 175);
  assert.deepEqual(f.releases, [1]);
  assert.equal(f.surface.captures.size, 0);
  f.surface.pointer('pointermove', 350, 200);
  assert.equal(f.commands.length, 4);
});

test('floating stick follows a drifting thumb and can reverse without returning to original contact', (t) => {
  const f = setup(t);
  f.arena.pointer('pointerdown', 100, 100);
  f.arena.pointer('pointermove', 300, 100);
  f.arena.pointer('pointermove', 230, 100);
  assert.deepEqual(f.commands, ['right', 'left']);
});

test('swipe uses recent travel so a short reverse flick turns immediately', (t) => {
  const f = setup(t, 'swipe');
  f.arena.pointer('pointerdown', 100, 100);
  f.arena.pointer('pointermove', 180, 100);
  f.arena.pointer('pointermove', 165, 100);
  f.arena.pointer('pointermove', 165, 120);
  assert.deepEqual(f.commands, ['right', 'left', 'down']);
});

test('sliding D-pad fills gaps and accepts direction changes without lifting', (t) => {
  const f = setup(t, 'dpad');
  f.pad.pointer('pointerdown', 78, 25);
  f.pad.pointer('pointermove', 145, 78);
  f.pad.pointer('pointermove', 78, 145);
  f.pad.pointer('pointermove', 10, 78);
  assert.deepEqual(f.commands, ['up', 'right', 'down', 'left']);
});

test('D-pad mode does not intercept board touches or scrolling', (t) => {
  const f = setup(t, 'dpad');
  assert.equal(f.arena.pointer('pointerdown', 10, 10).defaultPrevented, false);
  f.arena.pointer('pointermove', 90, 10);
  assert.deepEqual(f.commands, []);
});

test('one steering finger cannot be stolen by a second finger', (t) => {
  const f = setup(t);
  f.surface.pointer('pointerdown', 100, 100);
  f.surface.pointer('pointerdown', 50, 50, 2);
  f.surface.pointer('pointermove', 80, 50, 2);
  f.surface.pointer('pointerup', 80, 50, 2);
  f.surface.pointer('pointermove', 100, 125);
  assert.deepEqual(f.commands, ['down']);
  assert.deepEqual(f.releases, []);
});

for (const event of ['pointercancel', 'lostpointercapture']) {
  test(`${event} ends steering; stale moves cannot turn the craft`, (t) => {
    const f = setup(t);
    f.surface.pointer('pointerdown', 100, 100);
    f.surface.pointer(event, 100, 100);
    f.surface.pointer('pointermove', 150, 100);
    assert.deepEqual(f.commands, []);
    assert.deepEqual(f.releases, [1]);
  });
}

test('capture-loss notifications without an owned gesture cannot cancel another input owner', (t) => {
  const f = setup(t);
  for (const type of ['pointercancel', 'lostpointercapture']) {
    f.surface.dispatchEvent(new Event(type));
    f.surface.pointer(type, 0, 0, 41);
  }
  assert.deepEqual(f.cancellations, []);
  f.surface.pointer('pointerdown', 100, 100, 41);
  f.input.clear(); // Synchronous capture release belongs to this deliberate handoff.
  f.surface.pointer('lostpointercapture', 0, 0, 41);
  f.surface.dispatchEvent(new Event('lostpointercapture'));
  assert.deepEqual(f.releases, [41]);
  assert.deepEqual(f.cancellations, []);
  f.surface.pointer('pointerdown', 100, 100, 42);
  f.surface.pointer('pointercancel', 100, 100, 42);
  assert.deepEqual(f.releases, [41, 42]);
  assert.deepEqual(f.cancellations, [true], 'A genuine active-gesture interruption still cancels.');
});

test('pause and modality reset require a new gesture', (t) => {
  const f = setup(t);
  f.surface.pointer('pointerdown', 100, 100);
  f.input.clear();
  f.surface.pointer('pointermove', 150, 100);
  f.disable();
  f.surface.pointer('pointerdown', 100, 100);
  f.surface.pointer('pointermove', 150, 100);
  assert.deepEqual(f.commands, []);
});

test('mouse can use the visible stick but does not capture ordinary board clicks', (t) => {
  const f = setup(t);
  assert.equal(f.arena.pointer('pointerdown', 10, 10, 1, 'mouse').defaultPrevented, false);
  f.surface.pointer('pointerdown', 100, 100, 1, 'mouse');
  f.surface.pointer('pointermove', 120, 100, 1, 'mouse');
  assert.deepEqual(f.commands, ['right']);
});

test('touch preferences survive export/import; old libraries migrate without losing other preferences', () => {
  const old = JSON.parse(exportLibrary(emptyLibrary()));
  delete old.preferences.touchControls;
  delete old.preferences.screenSteeringHand; // This fixture predates both placement fields.
  const migrated = importLibrary(JSON.stringify(old));
  assert.equal(migrated.preferences.touchControls, null);
  const touchControls = { mode: 'swipe', side: 'left', size: 'large', opacity: 0.35 };
  const changed = updatePreferences(migrated, { touchControls });
  const imported = importLibrary(exportLibrary(changed));
  assert.deepEqual(imported.preferences.touchControls, touchControls);
  const legacy = structuredClone(changed);
  delete legacy.preferences.screenSteeringHand;
  legacy.preferences.touchControls.side = 'right';
  const migratedHand = importLibrary(legacy);
  assert.equal(migratedHand.preferences.screenSteeringHand, 'right');
  assert.deepEqual(migratedHand.preferences.touchControls, legacy.preferences.touchControls);
  assert.equal(Object.hasOwn(legacy.preferences, 'screenSteeringHand'), false);
  assert.equal(imported.preferences.turnPolicy, old.preferences.turnPolicy);
  for (const invalid of [
    { ...touchControls, mode: 'gyro' },
    { ...touchControls, opacity: NaN },
    { ...touchControls, side: 'middle' },
    { ...touchControls, surprise: true },
  ])
    assert.throws(() => resolveTouchControls(invalid));
});
