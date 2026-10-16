import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop, resumeCoop } from '../coop/core.mjs';
import { coopBonusActive } from '../coop/timed-bonuses.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import {
  teamBonusReviewLevel,
  teamBonusReviewCheckpoints,
  teamReviewCommand,
  TEAM_REVIEW_IDLE,
} from '../../docs/verification/rotor-motion/team-freeze-fixture.mjs';

const compiled = validateCompiledPresentation(
    JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
  ),
  playerAsset = compiled.resolved.assets['player.scout.compact'],
  drifterAsset = { ...playerAsset, id: 'review.team.drifter' },
  image = Object.freeze({ width: 32, height: 32 }),
  sprite = Object.freeze({ image, geometry: imagePresentation(drifterAsset) }),
  snapshot = Object.freeze({
    resolved: { assets: { 'team.enemy.drifter': drifterAsset } },
    image: (slot) => (slot === 'team.enemy.drifter' ? sprite : null),
  });
function adapter() {
  const actor = createCoopActorPresentation();
  actor.setPresentation(snapshot);
  return actor;
}
function draw(actor) {
  const commands = [],
    stack = [];
  let state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          commands.push({ name, args, state: { ...state } });
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
  assert.equal(actor.draw(ctx, 'enemy', 'keeper', { muted: '#738d91', accent: '#ffd64a' }), true);
  assert.equal(stack.length, 0);
  return commands;
}
function reachFreeze({ kind = 'enemy-freeze', reduced = false } = {}) {
  const run = startCoop(createCoop(teamBonusReviewLevel(kind), { seed: 17 })),
    untouched = structuredClone(run),
    actor = adapter();
  actor.update(run, { reduced });
  for (let guard = 0; guard < 1200; guard++) {
    const commands =
      run.tick >= 121 ? [teamReviewCommand('down'), teamReviewCommand()] : TEAM_REVIEW_IDLE;
    stepCoop(run, commands);
    stepCoop(untouched, commands);
    actor.update(run, { reduced });
    assert.deepEqual(
      run,
      untouched,
      'observing every real tick does not change the core checkpoint',
    );
    const event = run.events.find((event) => event.type === 'powerup.collected');
    if (event) return { run, actor, event, untouched };
  }
  assert.fail('The public route did not acquire the timed bonus.');
}

test('real Team freeze holds prepared moving parts without dimming the body or hiding contact', () => {
  const { run, actor, untouched } = reachFreeze(),
    first = actor.frame('enemy', 'keeper'),
    commands = draw(actor);
  assert.equal(coopBonusActive(run, 'enemy-freeze'), true);
  assert.equal(first.locked, true);
  assert.equal(first.stunned, false);
  assert.equal(first.dormant, false);
  assert.equal(first.speed, 0);
  assert.ok(first.rotorPhase > 0, 'the rotor was turning before the public pickup');
  assert.equal(commands.find((call) => call.name === 'drawImage').args[0], image);
  assert.equal(commands.find((call) => call.name === 'drawImage').state.globalAlpha, 1);
  assert.equal(sprite.geometry.rotors.length, 4);
  assert.ok(
    commands.filter((call) => call.name === 'rotate').length > 4,
    'prepared hubs run through the shared rotor painter',
  );
  assert.ok(
    commands.some((call) => call.name === 'arc' && call.args[2] === run.enemies[0].radius * 16),
  );
  for (let i = 0; i < 120; i++) {
    stepCoop(run, TEAM_REVIEW_IDLE);
    stepCoop(untouched, TEAM_REVIEW_IDLE);
    actor.update(run);
    const frame = actor.frame('enemy', 'keeper');
    for (const key of ['phase', 'rotorPhase', 'travelPhase', 'heading', 'bank', 'x', 'y'])
      assert.equal(frame[key], first[key], key);
    assert.deepEqual(draw(actor), commands);
  }
  assert.deepEqual(run, untouched);
  assert.notEqual(
    run.enemies[0].vx,
    0,
    'core keeps authored velocity; presentation must use the active effect',
  );
});

test('freeze expires at the core boundary and resumes moving parts without catching up hidden time', () => {
  const { run, actor, event } = reachFreeze(),
    frozen = actor.frame('enemy', 'keeper'),
    frozenCommands = draw(actor);
  while (run.tick < event.untilTick - 1) {
    stepCoop(run, TEAM_REVIEW_IDLE);
    actor.update(run);
  }
  assert.equal(actor.frame('enemy', 'keeper').rotorPhase, frozen.rotorPhase);
  stepCoop(run, TEAM_REVIEW_IDLE);
  actor.update(run);
  assert.equal(coopBonusActive(run, 'enemy-freeze'), false);
  assert.equal(actor.frame('enemy', 'keeper').locked, false);
  const resumed = actor.frame('enemy', 'keeper');
  assert.ok(resumed.rotorPhase > frozen.rotorPhase);
  assert.ok(
    resumed.rotorPhase - frozen.rotorPhase < 0.1,
    'one cosmetic step, never a three-second catch-up',
  );
  stepCoop(run, TEAM_REVIEW_IDLE);
  actor.update(run);
  assert.notEqual(actor.frame('enemy', 'keeper').x, frozen.x);
  assert.notDeepEqual(draw(actor), frozenCommands);
});

test('real freeze survives pause, reduced effects, cold preparation and active rover motion', () => {
  for (const reduced of [false, true]) {
    const { run, actor } = reachFreeze({ reduced }),
      before = structuredClone(run),
      cold = adapter();
    cold.update(run, { reduced });
    for (const id of ['keeper', 'rover']) {
      assert.equal(cold.frame('enemy', id).locked, true);
      assert.equal(cold.frame('enemy', id).speed, 0);
    }
    assert.equal(run.enemies[1].rover.mode, 'active');
    pauseCoop(run);
    actor.update(run, { reduced });
    const paused = draw(actor),
      clock = run.tick;
    for (let i = 0; i < 4; i++) {
      stepCoop(run, TEAM_REVIEW_IDLE);
      actor.update(run, { reduced });
      assert.deepEqual(draw(actor), paused);
    }
    assert.equal(run.tick, clock);
    resumeCoop(run);
    actor.update(run, { reduced });
    assert.equal(actor.frame('enemy', 'keeper').locked, true);
    assert.deepEqual(run.bonuses, before.bonuses);
  }
});

test('slow remains animated and ordinary or dormant Team actors keep their established state', () => {
  const { run, actor } = reachFreeze({ kind: 'enemy-slow' }),
    first = actor.frame('enemy', 'keeper');
  assert.equal(first.locked, false);
  for (let i = 0; i < 20; i++) {
    stepCoop(run, TEAM_REVIEW_IDLE);
    actor.update(run);
  }
  assert.ok(actor.frame('enemy', 'keeper').rotorPhase > first.rotorPhase);
  assert.ok(actor.frame('enemy', 'keeper').speed > 0);
  const level = teamBonusReviewLevel();
  delete level.timedBonuses;
  const legacy = startCoop(createCoop(level));
  actor.update(legacy);
  assert.equal(actor.frame('enemy', 'keeper').locked, false);
  assert.equal(actor.frame('enemy', 'rover').locked, true);
  assert.equal(actor.frame('enemy', 'rover').dormant, true);
});

test('finite review checkpoints include real pickup, freeze, expiry and resumed motion', () => {
  const points = teamBonusReviewCheckpoints();
  assert.deepEqual(
    points.map((run) => coopBonusActive(run, 'enemy-freeze')),
    [false, true, true, false, false],
  );
  assert.equal(points[1].enemies[0].x, points[2].enemies[0].x);
  assert.notEqual(points[3].enemies[0].x, points[4].enemies[0].x);
});
