import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCouchInput } from '../couch/couch-input.mjs';
import { createCoopCommandBatch, COOP_INPUT_CAPABILITIES } from '../coop/input-policy.mjs';
import { createCoop, startCoop, pauseCoop, resumeCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const pad = (index) => ({
  index,
  id: `Co-op fixture ${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
});

/** Real capture-aware input, command policy and simulation; only the DOM/devices are fixtures. */
function arena(t, pads = []) {
  const win = new Events();
  const doc = new Document();
  doc.parentNode = win;
  const canvas = doc.createElement('canvas');
  doc.body.append(canvas);
  const buttons = [0, 1].map((player) => {
    const controls = doc.createElement('div');
    controls.className = 'race-pad';
    controls.dataset.player = String(player);
    doc.body.append(controls);
    return Object.fromEntries(
      ['up', 'right', 'down', 'left', 'boost', 'action'].map((kind) => {
        const button = doc.createElement('button');
        if (kind === 'boost' || kind === 'action') button.dataset.action = kind;
        else button.dataset.direction = kind;
        controls.append(button);
        return [kind, button];
      }),
    );
  });
  const run = startCoop(
    createCoop({
      version: 'revealline-coop-level.v1',
      id: 'input-policy',
      revision: 1,
      name: 'Input policy arena',
      width: 72,
      height: 36,
      spawns: [
        { x: 5.5, y: 0.5 },
        { x: 20.5, y: 0.5 },
      ],
      enemies: [{ id: 'retention', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 }],
      goal: { coverage: 0.99 },
    }),
  );
  const batch = createCoopCommandBatch();
  let input;
  function pause() {
    pauseCoop(run);
    input.clear();
    batch.release();
  }
  input = attachCouchInput({
    ...COOP_INPUT_CAPABILITIES,
    window: win,
    document: doc,
    arena: canvas,
    getGamepads: () => pads,
    active: () => run.status === 'running',
    continuousSteering: () => true,
    onPause: pause,
  });
  t.after(() => input.destroy());
  function tick() {
    input.poll();
    const commands = batch.consume(input.consume());
    stepCoop(run, commands);
    for (const event of run.events)
      if (['cut.closed', 'player.downed', 'player.revived'].includes(event.type)) {
        input.clearPlayer(event.player);
        batch.release(event.player);
      }
    return commands;
  }
  function key(code, down = true, extra = {}) {
    canvas.emit(down ? 'keydown' : 'keyup', {
      code,
      key: code === 'Escape' ? 'Escape' : code.replace('Key', '').toLowerCase(),
      repeat: false,
      ...extra,
    });
  }
  function pointer(player, direction, id, down = true) {
    buttons[player][direction].emit(down ? 'pointerdown' : 'pointerup', {
      pointerId: id,
      button: 0,
      pointerType: 'touch',
    });
  }
  function resume() {
    input.clear();
    batch.release();
    resumeCoop(run);
  }
  return { run, input, batch, tick, key, pointer, pause, resume };
}

test('co-op keyboard Support stays held through fixed ticks and releases independently', (t) => {
  const a = arena(t);
  a.key('KeyQ');
  a.key('Enter');
  for (let i = 0; i < 30; i++)
    assert.deepEqual(
      a.tick().map((command) => command.support),
      [true, true],
    );
  a.key('KeyQ', false);
  assert.deepEqual(
    a.tick().map((command) => command.support),
    [false, true],
  );
  a.key('Enter', false);
  assert.deepEqual(
    a.tick().map((command) => command.support),
    [false, false],
  );
});

test('simultaneous touch Support remains held until each pointer ends', (t) => {
  const a = arena(t);
  a.pointer(0, 'action', 17);
  a.pointer(1, 'action', 29);
  for (let i = 0; i < 30; i++)
    assert.deepEqual(
      a.tick().map((command) => command.support),
      [true, true],
    );
  a.pointer(0, 'action', 17, false);
  assert.deepEqual(
    a.tick().map((command) => command.support),
    [false, true],
  );
  a.pointer(1, 'action', 29, false);
  assert.deepEqual(
    a.tick().map((command) => command.support),
    [false, false],
  );
});

test('controller Support uses the same held command semantics as keyboard and touch', (t) => {
  const p = pad(0),
    a = arena(t, [p]);
  a.tick();
  p.buttons[0].pressed = true;
  for (let i = 0; i < 30; i++) assert.equal(a.tick()[0].support, true);
  p.buttons[0].pressed = false;
  assert.equal(a.tick()[0].support, false);
});

test('adding a touch hold to held keyboard Support never interrupts an ongoing rescue', (t) => {
  const a = arena(t);
  const target = a.run.players[1];
  Object.assign(target, {
    x: 6.5,
    y: 0.5,
    cellIndex: 6,
    safeAnchor: { x: 6.5, y: 0.5 },
    status: 'downed',
    downedUntil: 12,
    downedClaimedAt: 0,
  });
  a.key('KeyQ');
  for (let i = 0; i < 60; i++) assert.equal(a.tick()[0].support, true);
  const startedAt = a.run.players[0].rescue.startedAt;
  a.pointer(0, 'action', 17);
  assert.equal(a.tick()[0].support, true);
  assert.equal(a.run.players[0].rescue.startedAt, startedAt);
  a.key('KeyQ', false);
  for (let i = 0; i < 61; i++) assert.equal(a.tick()[0].support, true);
  assert.equal(target.status, 'active');
  assert.equal(a.run.team.rescues, 1);
  assert.equal(a.run.team.reserves, 3);
  assert.equal(a.run.players[0].support.uses, 0);
  a.pointer(0, 'action', 17, false);
  assert.equal(a.tick()[0].support, false);
});

test('a quick fresh Support tap is preserved across one forced neutral tick without repeating', () => {
  const batch = createCoopCommandBatch();
  const none = { direction: null, boost: false, action: false };
  batch.release(0);
  assert.equal(batch.consume([{ ...none, action: true }, none])[0].support, false);
  assert.equal(batch.consume([none, none])[0].support, true);
  assert.equal(batch.consume([none, none])[0].support, false);
});

test('Support held across pause is not replayed on resume', (t) => {
  const a = arena(t);
  a.key('KeyQ');
  assert.equal(a.tick()[0].support, true);
  a.pause();
  a.resume();
  for (let i = 0; i < 3; i++) assert.equal(a.tick()[0].support, false);
  a.key('KeyQ', true, { repeat: true });
  assert.equal(a.tick()[0].support, false);
  a.key('KeyQ', false);
  a.key('KeyQ');
  assert.equal(a.tick()[0].support, true);
});

test('a fresh same-direction gesture emits one steering edge for rescue cancellation', (t) => {
  const a = arena(t);
  a.key('KeyD');
  assert.equal(a.tick()[0].steer, true);
  assert.equal(a.tick()[0].steer, false);
  a.key('KeyD', false);
  a.key('KeyD');
  assert.equal(a.tick()[0].steer, true);
  assert.equal(a.tick()[0].steer, false);
});

test('a fresh steering edge survives the forced neutral handoff exactly once', (t) => {
  const a = arena(t);
  a.pause();
  a.resume();
  a.key('KeyD');
  assert.notEqual(a.tick()[0].steer, true);
  assert.equal(a.tick()[0].steer, true);
  assert.equal(a.tick()[0].steer, false);
});

test('a fresh keyboard gesture before the first resumed tick is deferred once, then moves', (t) => {
  const page = arena(t);
  page.key('KeyD');
  page.tick();
  page.key('KeyD', false);
  page.pause();
  page.resume();
  const x = page.run.players[0].x;
  page.key('KeyD');
  assert.equal(page.input.snapshotDirection(0), 'right');
  assert.equal(page.tick()[0].direction, null);
  assert.equal(page.run.players[0].x, x);
  assert.equal(page.tick()[0].direction, 'right');
  assert.ok(Math.abs(page.run.players[0].x - x - 8 * FIXED_DT) < 1e-9);
});

test('fresh same-direction steering immediately after a real bank resumes while the partner keeps moving', (t) => {
  const page = arena(t);
  page.key('ArrowRight');
  page.key('KeyS');
  for (let i = 0; i < 80; i++) page.tick();
  page.key('KeyS', false);
  page.key('KeyD');
  for (let i = 0; i < 60; i++) page.tick();
  page.key('KeyD', false);
  page.key('KeyW');
  let closed = false;
  for (let i = 0; i < 100; i++) {
    page.tick();
    if (page.run.events.some((event) => event.type === 'cut.closed' && event.player === 0)) {
      closed = true;
      break;
    }
  }
  assert.equal(closed, true, 'fixture must close through real steering');
  assert.equal(page.run.players[0].blockedDirection, 'up');
  const bankY = page.run.players[0].y;
  const partnerX = page.run.players[1].x;
  page.key('KeyW', false);
  page.key('KeyW');
  const release = page.tick();
  assert.equal(release[0].direction, null);
  assert.equal(release[1].direction, 'right');
  assert.equal(page.run.players[0].y, bankY);
  assert.ok(page.run.players[1].x > partnerX, 'the other seat receives its ordinary command');
  assert.equal(page.tick()[0].direction, 'up');
  assert.ok(
    page.run.players[0].y < bankY,
    'the new same-direction gesture survives the neutral tick',
  );
});

test('holding a keyboard key across pause cannot masquerade as a fresh gesture', (t) => {
  const page = arena(t);
  page.key('KeyD');
  page.tick();
  page.pause();
  page.resume();
  const x = page.run.players[0].x;
  page.key('KeyD', true, { repeat: true });
  for (let i = 0; i < 3; i++) page.tick();
  assert.equal(page.run.players[0].x, x);
  page.key('KeyD', false);
  page.key('KeyD');
  page.tick();
  assert.ok(page.run.players[0].x > x);
});

test('a fresh touch gesture before the resumed tick survives the neutral command', (t) => {
  const page = arena(t);
  page.pointer(0, 'right', 1);
  page.tick();
  page.pointer(0, 'right', 1, false);
  page.pause();
  page.resume();
  const x = page.run.players[0].x;
  page.pointer(0, 'right', 2);
  assert.equal(page.tick()[0].direction, null);
  assert.equal(page.run.players[0].x, x);
  assert.equal(page.tick()[0].direction, 'right');
  assert.ok(page.run.players[0].x > x);
});

test('a held touch pointer must end before it can restart motion after pause', (t) => {
  const page = arena(t);
  page.pointer(0, 'right', 1);
  page.tick();
  page.pause();
  page.resume();
  const x = page.run.players[0].x;
  page.pointer(0, 'right', 1);
  for (let i = 0; i < 3; i++) page.tick();
  assert.equal(page.run.players[0].x, x);
  page.pointer(0, 'right', 1, false);
  page.pointer(0, 'right', 2);
  page.tick();
  assert.ok(page.run.players[0].x > x);
});

test('a controller direction after physical release and before the resumed tick is preserved', (t) => {
  const controller = pad(0);
  const page = arena(t, [controller]);
  page.tick();
  controller.axes[0] = 1;
  page.tick();
  page.pause();
  page.resume();
  controller.axes[0] = 0;
  page.input.poll();
  controller.axes[0] = 1;
  const x = page.run.players[0].x;
  assert.equal(page.tick()[0].direction, null);
  assert.equal(page.run.players[0].x, x);
  assert.equal(page.tick()[0].direction, 'right');
  assert.ok(page.run.players[0].x > x);
});

test('resetting one controller preserves a second controller continuous direction and Boost', (t) => {
  const first = pad(0);
  const second = pad(1);
  const page = arena(t, [first, second]);
  page.tick();
  first.axes[0] = 1;
  second.axes[0] = 1;
  second.buttons[5] = { pressed: true, value: 1 };
  page.tick();
  page.input.clearPlayer(0);
  page.batch.release(0);
  const x = page.run.players[1].x;
  const command = page.tick();
  assert.equal(command[0].direction, null);
  assert.equal(command[1].direction, 'right');
  assert.equal(command[1].boost, true);
  assert.ok(Math.abs(page.run.players[1].x - x - 12 * FIXED_DT) < 1e-9);
  assert.equal(
    page.input.snapshotDirection(0),
    null,
    'first controller stays blocked until physical release',
  );
});
