import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { attachCouchInput } from '../couch/couch-input.mjs';
import { attachCouchTouch } from '../ui/couch-touch.mjs';

function fixture(t, mode) {
  const doc = new Document(),
    win = new Events();
  const settings = doc.createElement('section');
  doc.body.append(settings);
  const pads = [0, 1].map((player) => {
    const pad = doc.createElement('div');
    pad.className = 'race-pad';
    pad.dataset.player = String(player);
    const cross = doc.createElement('div');
    cross.className = 'race-cross';
    for (const direction of ['up', 'down', 'left', 'right']) {
      const button = doc.createElement('button');
      button.dataset.direction = direction;
      cross.append(button);
    }
    pad.append(cross);
    doc.body.append(pad);
    return pad;
  });
  // This fixture owns its storage; production preference reads never mutate profiles.
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem() {} },
  });
  let active = true,
    input;
  const touch = attachCouchTouch({
    document: doc,
    controls: settings,
    clear: () => input?.clearPhysical(),
  });
  input = attachCouchInput({
    document: doc,
    window: win,
    arena: doc.body,
    getGamepads: () => [],
    active: () => active,
    continuousSteering: () => true,
    steeringEdges: true,
    getTouchSettings: () => ({ ...touch.snapshot(), mode }),
  });
  const surfaces = pads.map((p) =>
    p.querySelector(mode === 'dpad' ? '.race-cross' : '.touch-surface'),
  );
  for (const el of surfaces)
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 156, height: 156 });
  t.after(() => {
    input.destroy();
    touch.destroy();
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else delete globalThis.localStorage;
  });
  const pointer = (seat, type, x, y, id = seat + 1) =>
    surfaces[seat].emit(type, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: 'touch',
      button: 0,
    });
  return { input, pointer, pads, setActive: (v) => (active = v) };
}
for (const mode of ['stick', 'swipe', 'dpad'])
  test(`${mode}: both seats steer independently, release persists, recovery clears stale fingers`, (t) => {
    const f = fixture(t, mode);
    f.pointer(0, 'pointerdown', mode === 'dpad' ? 145 : 78, 78);
    f.pointer(1, 'pointerdown', 78, mode === 'dpad' ? 145 : 78);
    if (mode !== 'dpad') {
      f.pointer(0, 'pointermove', 115, 78);
      f.pointer(1, 'pointermove', 78, 115);
    }
    assert.equal(f.input.snapshotDirection(0), 'right');
    assert.equal(f.input.snapshotDirection(1), 'down');
    f.pointer(0, 'pointerup', 115, 78);
    f.pointer(1, 'pointerup', 78, 115);
    assert.equal(f.input.snapshotDirection(0), 'right');
    assert.equal(f.input.snapshotDirection(1), 'down');
    f.input.clearPlayer(0);
    f.pointer(0, 'pointermove', 0, 78);
    assert.equal(f.input.snapshotDirection(0), null);
    assert.equal(f.input.snapshotDirection(1), 'down');
    f.setActive(false);
    f.pointer(1, 'pointerdown', 1, 78);
    assert.equal(f.input.snapshotDirection(1), 'down');
  });
