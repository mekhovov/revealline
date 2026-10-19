import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  evaluateWorldResult,
  medalTargets,
  worldMedalGoal,
  worldMedalGoalText,
} from '../../optional-practice/civilian-fpv/world-progress.mjs';

const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
const course = {
  format: 'FlightCourse.v2',
  id: 'medal-goal-flight',
  revision: 'r1',
  environment: 'medal-goal-world',
  world: { id: 'medal-goal-world', theme: 'test-theme', style: 'test-style' },
  locales: Object.fromEntries(
    ['en', 'uk'].map((lang) => [lang, { title: 'World', brief: 'Fly', lesson: 'Practice' }]),
  ),
  spawn: { x: 0, y: 0, z: 0 },
  bounds: { min: { x: -10000, y: 0, z: -10000 }, max: { x: 10000, y: 15000, z: 10000 } },
  obstacles: [],
  actors: [
    {
      id: 'enemy',
      type: 'drone',
      position: { x: 0, y: 0, z: -2500 },
      radius: 220,
      health: 50,
      fireEveryTicks: 0,
    },
  ],
  steps: Object.fromEntries(
    ['self-level', 'acro'].map((mode) => [mode, [{ type: 'eliminate', targets: ['enemy'] }]]),
  ),
};

test('legal World flights earn each native medal and explain their own result without changing proof or state', async () => {
  await initWorldRuntime();
  const targets = medalTargets(course);
  for (const [wait, medal, next] of [
    [0, 'gold', null],
    [targets.goldTicks, 'silver', 'gold'],
    [targets.silverTicks, 'bronze', 'silver'],
  ]) {
    const flight = createWorldFlight({ course }),
      recorder = createWorldRecorder(flight);
    try {
      flight.arm();
      for (let tick = 0; tick < wait + 100 && flight.snapshot().status === 'active'; tick++) {
        flight.step({ ...neutral, actions: tick >= wait ? 1 : 0 });
        recorder.record();
      }
      const state = flight.snapshot(),
        proof = recorder.export(),
        result = evaluateWorldResult(course, proof, state),
        original = JSON.stringify({ state, proof, result });
      assert.equal(state.status, 'complete');
      assert.equal(result.medal, medal);
      const checked = await replayWorldFlight(course, proof);
      assert.equal(worldStateIdentity(checked.state), worldStateIdentity(state));
      const goal = worldMedalGoal(result, state.ticks);
      assert.equal(goal.medal, medal);
      assert.equal(goal.next, next);
      assert.equal(Object.isFrozen(goal), true);
      for (const language of ['en', 'uk']) assert.ok(worldMedalGoalText(goal, language));
      assert.equal(JSON.stringify({ state, proof, result }), original);
    } finally {
      flight.dispose();
    }
  }
});

test('exact native time and contact boundaries remain independent, including one-tick misses', () => {
  const targets = { goldTicks: 500, silverTicks: 900, goldContacts: 0, silverContacts: 4 };
  const result = (ticks, contacts) =>
    evaluateWorldResult(
      course,
      { mode: 'self-level', session: 'practice' },
      { status: 'complete', step: 1, ticks, contacts },
      { targets },
    );
  for (const [ticks, contacts, medal, remainingTicks, excessContacts] of [
    [500, 0, 'gold', undefined, undefined],
    [501, 0, 'silver', 1, 0],
    [500, 1, 'silver', 0, 1],
    [900, 4, 'silver', 400, 4],
    [901, 4, 'bronze', 1, 0],
    [900, 5, 'bronze', 0, 1],
    [901, 5, 'bronze', 1, 1],
  ]) {
    const native = result(ticks, contacts),
      goal = worldMedalGoal(native, ticks);
    assert.equal(native.medal, medal);
    assert.equal(goal.medal, native.medal);
    assert.equal(goal.remainingTicks, remainingTicks);
    assert.equal(goal.excessContacts, excessContacts);
  }
  const oneTick = worldMedalGoal(result(501, 0), 501);
  assert.match(worldMedalGoalText(oneTick), /0\.02 s sooner/);
  assert.match(worldMedalGoalText(oneTick, 'uk'), /0,02 с/);
  const contactsOnly = worldMedalGoal(result(500, 1), 500);
  assert.match(worldMedalGoalText(contactsOnly), /time requirement is already met/);
  assert.match(worldMedalGoalText(contactsOnly), /1 fewer contact/);
  assert.match(worldMedalGoalText(contactsOnly, 'uk'), /Умова часу вже виконана/);
  assert.match(worldMedalGoalText(contactsOnly, 'uk'), /максимум контактів: 0/);
  assert.equal(worldMedalGoal(result(900, 5), 900).targetContacts, 4);
});

test('ineligible, inconsistent and unavailable facts never become a next-medal claim', () => {
  const accepted = evaluateWorldResult(
    course,
    { mode: 'self-level', session: 'practice' },
    { status: 'complete', step: 1, ticks: 500, contacts: 0 },
  );
  for (const [value, ticks] of [
    [null, 500],
    [{ ...accepted, eligible: false }, 500],
    [{ ...accepted, medal: null }, 500],
    [{ ...accepted, medal: 'bronze' }, 500],
    [{ ...accepted, seconds: 11 }, 500],
    [{ ...accepted, contacts: -1 }, 500],
    [{ ...accepted, targets: null }, 500],
    [{ ...accepted, targets: { ...accepted.targets, goldTicks: 1.5 } }, 500],
    [{ ...accepted, targets: { ...accepted.targets, goldContacts: 5 } }, 500],
    [accepted, NaN],
    [accepted, -1],
    [accepted, 500.5],
  ])
    assert.equal(worldMedalGoal(value, ticks), null);
  for (const [session, status] of [
    ['review', 'complete'],
    ['practice', 'expired'],
  ]) {
    const result = evaluateWorldResult(
      course,
      { mode: 'self-level', session },
      { status, step: 1, ticks: 500, contacts: 0 },
    );
    assert.equal(worldMedalGoal(result, 500), null);
  }
  assert.equal(worldMedalGoalText(null), '');
});
