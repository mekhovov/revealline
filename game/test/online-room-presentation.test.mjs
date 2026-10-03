// Authored regressions; automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRoomSupport } from '../online/room-controls.mjs';
import { createRoomBoardPresentation } from '../online/room-events.mjs';
import { createCoopCaptureFeedback } from '../couch/coop-terrain-trail.mjs';
import { createTeamOutcomeFeedback } from '../couch/coop-outcome-presentation.mjs';

function eventTarget() {
  const listeners = new Map(),
    captures = new Set();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    fire(type, values = {}) {
      const event = {
        code: 'Space',
        button: 0,
        repeat: false,
        defaultPrevented: false,
        target: { closest: () => null },
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...values,
      };
      for (const handler of listeners.get(type) ?? []) handler(event);
      return event;
    },
    setPointerCapture(id) {
      captures.add(id);
    },
    hasPointerCapture(id) {
      return captures.has(id);
    },
    releasePointerCapture(id) {
      captures.delete(id);
      this.fire('lostpointercapture', { pointerId: id });
    },
  };
}
function supportHarness() {
  const document = eventTarget(),
    button = eventTarget(),
    state = { active: true, team: true, pauses: 0 };
  const support = attachRoomSupport({
    document,
    button,
    active: () => state.active,
    isTeam: () => state.team,
    pause: () => state.pauses++,
  });
  return { document, button, state, support };
}

test('overlapping room Support sources release independently, including pointer cancellation', () => {
  const { document, button, support } = supportHarness();
  document.fire('keydown');
  button.fire('pointerdown', { pointerId: 7 });
  button.fire('pointerdown', { pointerId: 9 });
  button.fire('pointercancel', { pointerId: 7 });
  assert.equal(support.held(), true, 'keyboard and second pointer still own their holds');
  document.fire('keyup');
  assert.equal(support.held(), true, 'releasing Space cannot clear the held touch');
  button.fire('lostpointercapture', { pointerId: 9 });
  assert.equal(support.held(), false);
  support.dispose();
});

test('background/menu recovery needs a fresh Support edge and releases captured pointers', () => {
  const { document, button, state, support } = supportHarness();
  document.fire('keydown');
  button.fire('pointerdown', { pointerId: 3 });
  state.active = false;
  support.clear();
  assert.equal(button.hasPointerCapture(3), false);
  assert.equal(support.held(), false);
  document.fire('keydown', { repeat: true });
  state.active = true;
  document.fire('keydown', { repeat: true });
  assert.equal(support.held(), false, 'held Space cannot rearm after Ready');
  document.fire('keyup');
  document.fire('keydown');
  assert.equal(support.held(), true);
  support.dispose();
  document.fire('keydown');
  button.fire('pointerdown', { pointerId: 4 });
  assert.equal(support.held(), false, 'disposed menus cannot retain input listeners');
});

test('room Support respects native menu editing and non-Team Space pause ownership', () => {
  const { document, button, state, support } = supportHarness();
  document.fire('keydown', { target: { closest: () => ({}) } });
  document.fire('keydown', { defaultPrevented: true });
  assert.equal(support.held(), false);
  state.team = false;
  button.fire('pointerdown', { pointerId: 3 });
  assert.equal(support.held(), false);
  document.fire('keydown');
  document.fire('keydown', { repeat: true });
  assert.equal(state.pauses, 1);
  support.dispose();
});

const teamRun = () => ({
  status: 'running',
  tick: 10,
  time: 1,
  totalClaimable: 4,
  cells: new Uint8Array([1, 0, 0, 0]),
  events: [
    { type: 'cells.claimed', tick: 10, time: 1, indices: [0] },
    { type: 'cut.joint', tick: 10, time: 1, players: [0, 1] },
  ],
  eliminations: [{ id: 'caught-before-recovery' }],
});

test('Team room recovery primes native capture/outcome feedback silently without altering authoritative state', () => {
  const projection = createRoomBoardPresentation(),
    run = teamRun(),
    captures = createCoopCaptureFeedback(),
    outcomes = createTeamOutcomeFeedback(),
    before = structuredClone(run);
  const recovered = projection.project(run, { paused: true });
  assert.equal(recovered.status, 'paused');
  assert.deepEqual(run, before);
  assert.strictEqual(recovered.cells, run.cells, 'settled topology remains exact');
  assert.strictEqual(recovered.eliminations, run.eliminations, 'settled remains remain available');
  assert.deepEqual(captures.observe(recovered), []);
  assert.deepEqual(outcomes.observe(recovered), []);
  const resumed = projection.project(run);
  assert.strictEqual(resumed, recovered);
  assert.equal(resumed.status, 'running');
  assert.deepEqual(captures.observe(resumed), []);
  assert.deepEqual(outcomes.observe(resumed), []);
  run.tick++;
  run.time += 0.1;
  run.events = run.events.map((event) => ({ ...event, tick: run.tick, time: run.time }));
  const next = projection.project(run);
  assert.equal(captures.observe(next).length, 1, 'new live capture remains visible');
  assert.equal(outcomes.observe(next).length, 1, 'new live joint cut remains visible');
});

test('a new room presentation owner clears old effects while paused snapshots cannot leak on resume', () => {
  const projection = createRoomBoardPresentation(),
    run = teamRun();
  const initial = projection.project(run);
  run.tick++;
  projection.project(run, { paused: true });
  assert.deepEqual(projection.project(run).events, []);
  assert.strictEqual(projection.project(run), initial);
  projection.reset();
  const recovered = projection.project(run);
  assert.notStrictEqual(recovered, initial, 'native painter gets a fresh owner after recovery');
  assert.deepEqual(recovered.events, []);
  run.status = 'won';
  assert.equal(
    projection.project(run, { paused: true }).status,
    'won',
    'native terminal state wins',
  );
});
