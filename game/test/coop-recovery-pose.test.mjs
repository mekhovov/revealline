import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoop, startCoop, stepCoop, pauseCoop, resumeCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import {
  teamBonusReviewInitial,
  teamReviewCommand,
} from '../../docs/verification/rotor-motion/team-freeze-fixture.mjs';

const command = (direction = null) => ({ direction, boost: true, support: false }),
  neutral = [0, 1].map(() => ({ direction: null, boost: false, support: false })),
  controls = (tick) =>
    tick < 20 ? [command('right'), command('left')] : [command('left'), command('right')];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
function fixture(level = FIRST_CONNECTION, difficulty = 'standard', options = {}, skip = 0) {
  const run = startCoop(createCoop(level, { difficulty, seed: 17 })),
    reference = structuredClone(run),
    actor = createCoopActorPresentation();
  actor.update(run, options);
  while (run.tick < 24) {
    stepCoop(run, controls(run.tick));
    stepCoop(reference, controls(reference.tick));
    if (run.tick <= 24 - skip) actor.update(run, options);
  }
  const before = run.players.map((player) => actor.frame('pilot', player.id));
  stepCoop(run, controls(run.tick));
  stepCoop(reference, controls(reference.tick));
  assert.equal(run.tick, 25);
  assert(run.events.some((event) => event.type === 'team.recovery'));
  assert(run.players.every((player) => player.status === 'active'));
  actor.update(run, options);
  assert.deepEqual(run, reference, 'observing poses cannot alter a core checkpoint');
  return { run, reference, actor, before, options };
}
for (const level of [FIRST_CONNECTION, RELAY_YARD])
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const options of [{}, { reduced: true }, { motionScale: 0 }])
      test(`${level.id} ${difficulty} ${JSON.stringify(options)}: same-tick team recovery is not flight toward the spawn`, () => {
        const { run, actor, before } = fixture(level, difficulty, options);
        const checkpoint = structuredClone(run);
        for (const player of run.players) {
          const pose = actor.frame('pilot', player.id),
            old = before[player.id];
          assert.equal(pose.pilotState, 'recovery');
          near(pose.heading, old.heading);
          near(pose.phase, old.phase);
          near(pose.rotorPhase, old.rotorPhase);
          near(pose.travelPhase, old.travelPhase);
          assert.equal(pose.speed, 0);
          assert.equal(pose.stunned, false, 'revived bodies remain fully visible');
          assert.equal(pose.x, player.x * 16);
          assert.equal(pose.y, player.y * 16);
          assert.equal(pose.radius, player.radius * 16);
          for (let i = 0; i < 4; i++) {
            actor.update(run, options);
            assert.deepEqual(
              actor.frame('pilot', player.id),
              pose,
              'repeated painting cannot unfreeze the relocation tick',
            );
          }
        }
        assert.deepEqual(run, checkpoint);
      });

test('recovery is observed after skipped rendering even when its core events have retired', () => {
  const { run, actor, before } = fixture(FIRST_CONNECTION, 'standard', {}, 4);
  // Start a separate adapter at the genuine pre-recovery checkpoint, then do
  // not observe until the event list has already been replaced by the next tick.
  const replay = startCoop(createCoop(FIRST_CONNECTION, { seed: 17 })),
    delayed = createCoopActorPresentation();
  delayed.update(replay);
  while (replay.tick < 24) {
    stepCoop(replay, controls(replay.tick));
    delayed.update(replay);
  }
  const prior = [delayed.frame('pilot', 0), delayed.frame('pilot', 1)];
  stepCoop(replay, controls(replay.tick));
  stepCoop(replay, neutral);
  assert.equal(
    replay.events.some((event) => event.type === 'team.recovery'),
    false,
  );
  delayed.update(replay);
  for (const player of replay.players) {
    near(delayed.frame('pilot', player.id).heading, prior[player.id].heading);
    assert.equal(delayed.frame('pilot', player.id).speed, 0);
    near(actor.frame('pilot', player.id).heading, before[player.id].heading);
  }
  assert.equal(run.players[0].graceUntil, replay.players[0].graceUntil);
});

for (const level of [FIRST_CONNECTION, RELAY_YARD])
  for (const options of [{}, { reduced: true }, { motionScale: 0 }])
    test(`${level.id} ${JSON.stringify(options)}: skipped recovery remains detectable after a new cut clears grace`, () => {
      const run = startCoop(createCoop(level, { seed: 17 })),
        actor = createCoopActorPresentation();
      actor.update(run, options);
      while (run.tick < 24) {
        stepCoop(run, controls(run.tick));
        actor.update(run, options);
      }
      const prior = run.players.map((player) => actor.frame('pilot', player.id)),
        reserves = run.team.reserves;
      stepCoop(run, controls(run.tick));
      stepCoop(run, neutral);
      while (run.tick < 31) stepCoop(run, [command('right'), command('left')]);
      assert.equal(run.team.reserves, reserves - 1);
      assert(
        run.players.every(
          (player) => player.status === 'active' && player.cutting && player.graceUntil === 0,
        ),
      );
      assert.equal(
        run.events.some((event) => event.type === 'team.recovery'),
        false,
      );
      const checkpoint = structuredClone(run);
      actor.update(run, options);
      for (const player of run.players) {
        const pose = actor.frame('pilot', player.id);
        near(pose.heading, prior[player.id].heading);
        near(pose.rotorPhase, prior[player.id].rotorPhase);
        assert.equal(pose.speed, 0, 'unobserved relocation cannot imply boost flight');
        assert.equal(pose.pilotState, 'cutting', 'functional state follows the real new cut');
        assert.equal(pose.x, player.x * 16);
        assert.equal(pose.y, player.y * 16);
        actor.update(run, options);
        assert.deepEqual(actor.frame('pilot', player.id), pose);
      }
      assert.deepEqual(run, checkpoint);
      stepCoop(run, [command('right'), command('left')]);
      actor.update(run, options);
      near(actor.frame('pilot', 0).speed, 12);
      near(actor.frame('pilot', 1).speed, 12);
    });

test('pause and held neutral retain the recovered nose; real safe-ground motion resumes it', () => {
  const { run, actor, options } = fixture(),
    saved = actor.frame('pilot', 0);
  pauseCoop(run);
  actor.update(run, options);
  const paused = actor.frame('pilot', 0),
    checkpoint = structuredClone(run);
  for (let i = 0; i < 4; i++) {
    stepCoop(run, neutral);
    actor.update(run);
    assert.deepEqual(actor.frame('pilot', 0), paused);
  }
  assert.deepEqual(run, checkpoint);
  resumeCoop(run);
  actor.update(run);
  for (let i = 0; i < 20; i++) {
    stepCoop(run, neutral);
    actor.update(run);
    near(actor.frame('pilot', 0).heading, saved.heading);
  }
  assert.ok(
    actor.frame('pilot', 0).rotorPhase !== saved.rotorPhase,
    'recovered craft can idle normally',
  );
  for (let i = 0; i < 40; i++) {
    stepCoop(run, [command('up'), command('up')]);
    actor.update(run);
    if (i === 0) {
      const heading = actor.frame('pilot', 0).heading;
      assert.ok(heading > 0 && heading < saved.heading, 'normal steering still interpolates');
      assert.ok(saved.heading - heading <= 12 / 120 + 1e-10, 'the turn keeps its existing rate');
    }
  }
  near(actor.frame('pilot', 0).heading, 0);
  assert.ok(actor.frame('pilot', 0).speed > 0);
});

test('single-player reserve recovery conservatively holds its moving partner for one sample only', () => {
  const run = startCoop(createCoop(FIRST_CONNECTION, { seed: 17 })),
    actor = createCoopActorPresentation();
  actor.update(run);
  while (run.tick < 25) {
    stepCoop(run, [command(run.tick < 20 ? 'right' : 'left'), neutral[1]]);
    actor.update(run);
  }
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[1].status, 'active');
  const until = run.players[0].downedUntil,
    reserves = run.team.reserves;
  while (run.time < until - 0.05) {
    stepCoop(run, neutral);
    actor.update(run);
  }
  for (let count = 0; count < 20 && run.team.reserves === reserves; count++) {
    stepCoop(run, [neutral[0], command('up')]);
    actor.update(run);
  }
  assert.equal(run.team.reserves, reserves - 1);
  assert.equal(run.players[1].graceUntil, 0, 'the moving partner was never downed');
  const checkpoint = structuredClone(run),
    held = actor.frame('pilot', 1);
  assert.equal(held.speed, 0);
  assert.equal(held.pilotState, 'normal');
  actor.update(run);
  assert.deepEqual(actor.frame('pilot', 1), held);
  assert.deepEqual(run, checkpoint);
  stepCoop(run, [neutral[0], command('up')]);
  actor.update(run);
  near(actor.frame('pilot', 1).speed, 12);
  assert.notEqual(actor.frame('pilot', 1).rotorPhase, held.rotorPhase);
});

test('an earned reserve pickup does not hold normal pilot movement', () => {
  const run = teamBonusReviewInitial('extra-life'),
    actor = createCoopActorPresentation(),
    reserves = run.team.reserves;
  actor.update(run);
  let collected = false;
  for (let count = 0; count < 600 && !collected; count++) {
    stepCoop(run, [teamReviewCommand(run.tick >= 121 ? 'down' : null), teamReviewCommand()]);
    actor.update(run);
    collected = run.events.some((event) => event.type === 'powerup.collected');
  }
  assert.equal(collected, true);
  assert.equal(run.team.reserves, reserves + 1);
  assert.equal(actor.frame('pilot', 0).locked, false);
  assert.ok(actor.frame('pilot', 0).speed > 0);
});

test('actual prepared image keeps the last heading and opacity through real recovery', async () => {
  const compiled = validateCompiledPresentation(
      JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
    ),
    asset = compiled.resolved.assets['player.scout.detailed'],
    image = { width: asset.file.width, height: asset.file.height },
    sprite = { image, geometry: imagePresentation(asset) },
    run = startCoop(createCoop(FIRST_CONNECTION, { seed: 17 })),
    actor = createCoopActorPresentation();
  actor.setPresentation({ image: (slot) => (slot.startsWith('player.scout.') ? sprite : null) });
  actor.update(run);
  while (run.tick < 24) {
    stepCoop(run, controls(run.tick));
    actor.update(run);
  }
  const heading = actor.frame('pilot', 0).heading;
  stepCoop(run, controls(run.tick));
  actor.update(run);
  const before = structuredClone(run),
    calls = [],
    stack = [];
  let state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, alpha: state.globalAlpha });
          if (name === 'save') stack.push({ ...state });
          if (name === 'restore') state = stack.pop();
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  assert.equal(actor.draw(ctx, 'pilot', 0, { muted: '#738d91', accent: '#ffd64a' }), true);
  assert.equal(stack.length, 0);
  near(calls.find((call) => call.name === 'rotate').args[0], heading);
  const drawn = calls.find((call) => call.name === 'drawImage');
  assert.equal(drawn.args[0], image);
  assert.equal(drawn.alpha, 1);
  assert.deepEqual(run, before);
});
