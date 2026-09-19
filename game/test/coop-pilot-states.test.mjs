import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, pauseCoop, resumeCoop, FIXED_DT } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { createActorPresentation } from '../ui/actor-presentation.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { coopBodyBounds, coopPilotBodyOffset } from '../couch/coop-actor-layout.mjs';

const command = (direction = null, boost = false, support = false) => ({
  direction,
  boost,
  support,
});
const neutral = () => [command(), command()];
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-8, why || `${a} != ${b}`);
const pose = (fixture, seat) => fixture.adapter.frame('pilot', seat);

// Independently recorded legal Relay Yard Standard/seed17 route. No authored
// level, player, enemy, time, status, cell or resource field is assigned here.
function route(seat) {
  const cmd = (direction = null, support = false) => command(direction, true, support);
  return [
    [140, [cmd('right'), cmd('left')]],
    [70, [cmd('up'), cmd('up')]],
    [214, [cmd('right'), cmd('left')]],
    [24, [cmd(seat === 0 ? 'left' : null), cmd(seat === 1 ? 'right' : null)]],
    [35, [cmd(seat === 0 ? 'up' : null), cmd(seat === 1 ? 'up' : null)]],
    [17, [cmd(seat === 1 ? 'right' : null), cmd(seat === 0 ? 'left' : null)]],
    [120, [cmd(null, seat === 1), cmd(null, seat === 0)]],
  ];
}
function fixture(seat, end = 483, options = {}, snapshot = null) {
  const run = startCoop(createCoop(RELAY_YARD, { difficulty: 'standard', seed: 17 }));
  const adapter = createCoopActorPresentation();
  adapter.setPresentation(snapshot);
  adapter.update(run, options);
  const observations = [];
  const f = { run, adapter, options, observations };
  for (const [ticks, inputs] of route(seat))
    for (let i = 0; i < ticks && run.tick < end; i++) {
      const prior = pose(f, seat);
      stepCoop(run, inputs, FIXED_DT);
      adapter.update(run, options);
      if (run.events.some((e) => ['player.downed', 'player.revived'].includes(e.type)))
        observations.push({
          before: prior,
          after: pose(f, seat),
          events: structuredClone(run.events),
        });
    }
  assert.equal(run.tick, end, 'The genuine trace must reach its requested observation.');
  return f;
}
function ticks(f, inputs, count = 1) {
  for (let i = 0; i < count; i++) {
    stepCoop(f.run, inputs, FIXED_DT);
    const before = structuredClone(f.run);
    f.adapter.update(f.run, f.options);
    assert.deepEqual(f.run, before, 'The presentation adapter must remain read-only.');
  }
}
function walking(seat, direction) {
  const inputs = neutral();
  inputs[seat] = command(direction);
  return inputs;
}
function pictureGeometry() {
  return Object.freeze({
    frame: { x: 0, y: 0, width: 64, height: 64 },
    pivot: { x: 0.12, y: 0.88 },
    occupiedBounds: null,
    rotors: [
      { x: 0.7, y: -0.65, radiusScale: 1, direction: 1, phaseDegrees: 0, bladeCount: 3 },
      { x: 0.1, y: -0.05, radiusScale: 1, direction: -1, phaseDegrees: 23, bladeCount: 3 },
    ],
  });
}
function prepared(geometry = pictureGeometry()) {
  const sprite = Object.freeze({ image: Object.freeze({ width: 64, height: 64 }), geometry });
  return Object.freeze({
    image: (slot) => (slot.startsWith('player.scout.') ? sprite : null),
  });
}

for (const seat of [0, 1]) {
  test(`P${seat + 1} command-earned knockdown does not turn the body toward its anchor teleport`, () => {
    const original = structuredClone(RELAY_YARD);
    const f = fixture(seat);
    const observation = f.observations.find((item) =>
      item.events.some((e) => e.type === 'player.downed' && e.player === seat),
    );
    assert.ok(observation);
    assert.equal(f.run.players[seat].status, 'downed');
    assert.equal(pose(f, seat).pilotState, 'downed');
    assert.equal(pose(f, seat).rescueTarget, null);
    near(angle(observation.after.heading, observation.before.heading), 0);
    near(observation.after.phase, observation.before.phase);
    near(observation.after.travelPhase, observation.before.travelPhase);
    assert.equal(observation.after.stunned, true);
    assert.deepEqual(RELAY_YARD, original);
  });

  for (const options of [{}, { reduced: true }, { motionScale: 0 }]) {
    const label = options.reduced
      ? 'reduced'
      : options.motionScale === 0
        ? 'zero motion'
        : 'normal';
    test(`P${seat + 1} real safe-ground crawl turns its heading with frozen rotors (${label})`, () => {
      const f = fixture(seat, 483, options);
      const down = pose(f, seat);
      ticks(f, neutral());
      for (const direction of ['left', 'right']) {
        const before = f.run.players[seat].x;
        ticks(f, walking(seat, direction), 40);
        const current = pose(f, seat);
        assert.ok(
          direction === 'left' ? f.run.players[seat].x < before : f.run.players[seat].x > before,
        );
        assert.equal(f.run.players[seat].status, 'downed');
        assert.equal(current.pilotState, 'crawling');
        assert.equal(current.rescueTarget, null);
        near(angle(current.heading, direction === 'left' ? -Math.PI / 2 : Math.PI / 2), 0);
        near(current.phase, down.phase);
        near(current.travelPhase, down.travelPhase);
        assert.equal(current.diameter, down.diameter);
        assert.equal(current.radius, f.run.players[seat].radius * 16);
        assert.equal(current.stunned, true);
        assert.equal(current.locked, true);
      }
      const held = pose(f, seat);
      const state = structuredClone(f.run);
      for (let paint = 0; paint < 10; paint++) {
        f.adapter.update(f.run, options);
        assert.deepEqual(pose(f, seat), held);
      }
      assert.deepEqual(f.run, state);
      ticks(f, neutral());
      assert.equal(pose(f, seat).pilotState, 'downed');
      const stopped = pose(f, seat).heading;
      ticks(f, neutral(), 5);
      near(pose(f, seat).heading, stopped);
    });
  }

  test(`P${seat + 1} actual rescue identifies only its live partner and clears on recovery`, () => {
    const f = fixture(seat, 560);
    const helper = 1 - seat;
    assert.equal(f.run.players[seat].status, 'downed');
    assert.equal(f.run.players[helper].rescue.target, seat);
    near(f.run.time - f.run.players[helper].rescue.startedAt, 0.5);
    assert.equal(pose(f, helper).pilotState, 'rescuing');
    assert.equal(pose(f, helper).rescueTarget, seat);
    assert.equal(pose(f, seat).pilotState, 'downed');
    assert.equal(pose(f, seat).rescueTarget, null);
    const before = structuredClone(f.run);
    const held = [pose(f, 0), pose(f, 1)];
    for (let paint = 0; paint < 10; paint++) {
      f.adapter.update(f.run);
      assert.deepEqual([pose(f, 0), pose(f, 1)], held);
    }
    assert.deepEqual(f.run, before);
    const support = neutral();
    support[helper].support = true;
    ticks(f, support, 60);
    assert.ok(f.run.events.some((e) => e.type === 'player.revived' && e.player === seat));
    assert.equal(pose(f, seat).pilotState, 'recovery');
    assert.equal(pose(f, helper).rescueTarget, null);
    assert.notEqual(pose(f, helper).pilotState, 'rescuing');
    assert.equal(f.run.team.reserves, 3);
    assert.ok(f.run.players.every((player) => player.support.uses === 0));
  });

  test(`P${seat + 1} cancelled or paused rescue cannot leave a stale target cue`, () => {
    for (const kind of ['release', 'steer', 'pause']) {
      const f = fixture(seat, 560);
      const helper = 1 - seat;
      if (kind === 'pause') {
        pauseCoop(f.run);
        f.adapter.update(f.run);
      } else {
        const input = neutral();
        if (kind === 'steer') input[helper] = { ...command(null, true, true), steer: true };
        ticks(f, input);
      }
      assert.equal(f.run.players[helper].rescue, null);
      assert.equal(pose(f, helper).rescueTarget, null);
      assert.notEqual(pose(f, helper).pilotState, 'rescuing');
      const held = [pose(f, 0), pose(f, 1)];
      const before = structuredClone(f.run);
      f.adapter.update(f.run);
      assert.deepEqual([pose(f, 0), pose(f, 1)], held);
      assert.deepEqual(f.run, before);
      if (kind === 'pause') {
        resumeCoop(f.run);
        f.adapter.update(f.run);
        assert.equal(pose(f, helper).rescueTarget, null);
      }
    }
  });
}

test('ordinary active-pilot heading remains equivalent to the shared observed-motion sampler', () => {
  const f = fixture(0, 0);
  const shared = createActorPresentation();
  const sample = () =>
    shared.sample(
      f.run.players.map((player) => ({
        id: 'pilot:' + player.id,
        type: 'team-pilot',
        x: player.x,
        y: player.y,
        vx: player.direction === 'right' ? 1 : 0,
        vy: player.direction === 'down' ? 1 : 0,
        radius: player.radius,
      })),
      { tick: f.run.tick, time: f.run.time, dt: f.run.tick === 0 ? 0 : FIXED_DT },
    );
  sample();
  for (const direction of ['up', 'right', 'down', 'left']) {
    for (let tick = 0; tick < 10; tick++) {
      ticks(f, walking(0, direction));
      const reference = sample().get('pilot:0');
      near(angle(pose(f, 0).heading, reference.heading), 0);
      assert.equal(pose(f, 0).rescueTarget, null);
      assert.equal(pose(f, 0).pilotState, f.run.players[0].cutting ? 'cutting' : 'normal');
    }
  }
});

test('crawl into unsecured land stops truthfully instead of inferring motion from intended input', () => {
  const f = fixture(0);
  ticks(f, neutral());
  ticks(f, walking(0, 'down'), 120);
  assert.equal(f.run.players[0].status, 'downed');
  const before = { x: f.run.players[0].x, y: f.run.players[0].y };
  ticks(f, walking(0, 'down'), 10);
  assert.deepEqual({ x: f.run.players[0].x, y: f.run.players[0].y }, before);
  assert.equal(pose(f, 0).pilotState, 'downed');
  assert.equal(f.run.cells[f.run.players[0].cellIndex], 1);
});

test('pilot heading and state caches reset with fresh attempts, explicit reset and snapshot replacement', () => {
  const f = fixture(0);
  ticks(f, neutral());
  ticks(f, walking(0, 'left'), 40);
  assert.equal(pose(f, 0).pilotState, 'crawling');
  f.adapter.reset();
  const fresh = startCoop(createCoop(RELAY_YARD, { difficulty: 'standard', seed: 17 }));
  f.adapter.update(fresh);
  assert.equal(pose(f, 0).pilotState, 'normal');
  assert.equal(pose(f, 0).rescueTarget, null);
  near(pose(f, 0).heading, 0);
  f.adapter.update(f.run);
  const separate = createCoopActorPresentation();
  separate.update(f.run);
  assert.deepEqual(
    pose(f, 0),
    separate.frame('pilot', 0),
    'new run identity must discard old history',
  );
  f.adapter.setPresentation(prepared());
  f.adapter.update(f.run);
  const replacement = createCoopActorPresentation();
  replacement.setPresentation(prepared());
  replacement.update(f.run);
  assert.deepEqual(pose(f, 0), replacement.frame('pilot', 0));
});

test('a revived crawler preserves its last observed heading until it actually moves again', () => {
  const f = fixture(0);
  ticks(f, neutral());
  ticks(f, walking(0, 'left'), 40);
  const heading = pose(f, 0).heading;
  const pulses = neutral();
  // Genuine paid recovery is allowed to elapse; no reserve, status or time injection.
  for (let tick = 0; tick < 1500 && f.run.players[0].status === 'downed'; tick++) ticks(f, pulses);
  assert.equal(f.run.players[0].status, 'active', 'The ordinary paid recovery must finish.');
  assert.equal(pose(f, 0).pilotState, 'recovery');
  near(angle(pose(f, 0).heading, heading), 0);
  ticks(f, neutral(), 10);
  near(angle(pose(f, 0).heading, heading), 0);
  ticks(f, walking(0, 'right'), 40);
  near(angle(pose(f, 0).heading, Math.PI / 2), 0);
  assert.equal(f.run.team.reserves, 2);
});

test('real border crawl rotates uploaded pivot/rotor bounds before responsive body offsets', () => {
  const geometry = pictureGeometry();
  const f = {
    run: startCoop(createCoop(FIRST_CONNECTION, { difficulty: 'standard', seed: 17 })),
    adapter: createCoopActorPresentation(),
    options: { reduced: true },
  };
  f.adapter.setPresentation(prepared(geometry));
  f.adapter.update(f.run, f.options);
  // A genuine short self-cross returns the downed pilot to its safe border.
  ticks(f, [command('right', true), command()], 20);
  for (let tick = 0; tick < 40 && f.run.players[0].status === 'active'; tick++)
    ticks(f, [command('left', true), command()]);
  assert.ok(
    f.run.events.some((item) => item.type === 'player.downed' && item.cause === 'self-trail'),
  );
  ticks(f, neutral());
  ticks(f, walking(0, 'down'), 40);
  assert.equal(f.run.players[0].status, 'downed');
  near(f.run.players[0].x, 0.5);
  for (const width of [200, 240, 390, 844, 1152]) {
    const before = structuredClone(f.run);
    f.adapter.update(f.run, { reduced: true, canvasCSSWidth: width });
    const frame = pose(f, 0);
    near(angle(frame.heading, Math.PI), 0);
    assert.ok(frame.bodyOffset.x > 0, 'Rotated body must actually need border clearance.');
    assert.deepEqual(
      frame.bodyOffset,
      coopPilotBodyOffset(frame, geometry, 1152, 576, 1152 / width),
    );
    const bounds = coopBodyBounds(frame, geometry);
    const x = Math.round(frame.x) + frame.bodyOffset.x;
    const y = Math.round(frame.y) + frame.bodyOffset.y;
    const margin = 1152 / width;
    assert.ok(x + bounds.left >= margin - 1e-8);
    assert.ok(x + bounds.right <= 1152 - margin + 1e-8);
    assert.ok(y + bounds.top >= margin - 1e-8);
    assert.ok(y + bounds.bottom <= 576 - margin + 1e-8);
    assert.equal(frame.radius, f.run.players[0].radius * 16);
    assert.deepEqual(f.run, before);
  }
});
