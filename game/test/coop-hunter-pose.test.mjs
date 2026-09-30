import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { hunterReviewCheckpoints } from '../../docs/verification/rotor-motion/team-hunter-fixture.mjs';

const compiled = validateCompiledPresentation(
    JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
  ),
  asset = compiled.resolved.assets['enemy.border-patrol'],
  image = Object.freeze({ width: asset.file.width, height: asset.file.height }),
  sprite = Object.freeze({ image, geometry: imagePresentation(asset) }),
  snapshot = Object.freeze({ image: (slot) => (slot === 'enemy.border-patrol' ? sprite : null) }),
  palette = Object.freeze({ muted: '#738d91', accent: '#ffd64a' });
function adapter() {
  const result = createCoopActorPresentation();
  result.setPresentation(snapshot);
  return result;
}
const heading = (x, y) => Math.atan2(y, x) + Math.PI / 2;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12);
function commands(actor, id) {
  const calls = [],
    stack = [];
  let state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, state: { ...state } });
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
  assert.equal(actor.draw(ctx, 'enemy', id, palette), true);
  assert.equal(stack.length, 0);
  return calls;
}

test('real Team warning, commitment and recovery point the prepared body along the locked attack', () => {
  const checkpoints = hunterReviewCheckpoints(),
    actor = adapter(),
    run = structuredClone(checkpoints[0]);
  let attackHeading;
  for (const checkpoint of checkpoints) {
    Object.assign(run, structuredClone(checkpoint));
    const before = structuredClone(run),
      enemy = run.enemies[0];
    actor.update(run);
    const frame = actor.frame('enemy', enemy.id),
      draws = commands(actor, enemy.id);
    if (enemy.phase === 'warning') {
      attackHeading = heading(enemy.targetPoint.x - enemy.x, enemy.targetPoint.y - enemy.y);
      near(frame.heading, attackHeading);
      assert.notEqual(
        frame.heading,
        Math.PI,
        'a downward patrol cannot retain its old nose direction',
      );
    } else if (enemy.phase === 'commit') near(frame.heading, heading(enemy.vx, enemy.vy));
    else if (enemy.phase === 'recovery') {
      near(frame.heading, attackHeading);
    }
    const imageIndex = draws.findIndex((call) => call.name === 'drawImage');
    assert.equal(draws[imageIndex].args[0], image);
    near(
      draws.slice(0, imageIndex).findLast((call) => call.name === 'rotate').args[0],
      frame.heading,
    );
    assert.ok(
      draws
        .slice(imageIndex)
        .some((call) => call.name === 'arc' && call.args[2] === enemy.radius * 16),
    );
    assert.deepEqual(run, before, 'presentation never writes Team simulation state');
  }
});

test('warning pose follows the fixed point, never the live player; coincident or invalid points retain heading', () => {
  const run = hunterReviewCheckpoints()[1],
    actor = adapter(),
    enemy = run.enemies[0];
  actor.update(run);
  const first = actor.frame('enemy', enemy.id);
  run.tick++;
  run.time += 1 / 60;
  run.players[enemy.target].x = 65;
  run.players[enemy.target].y = 32;
  actor.update(run);
  near(actor.frame('enemy', enemy.id).heading, first.heading);
  for (const point of [{ x: enemy.x, y: enemy.y }, { x: NaN, y: 0 }, null]) {
    enemy.targetPoint = point;
    run.tick++;
    run.time += 1 / 60;
    actor.update(run);
    near(actor.frame('enemy', enemy.id).heading, first.heading);
  }
});

test('committed nose uses actual velocity even after passing the old target; recovery retains it', () => {
  const run = hunterReviewCheckpoints()[2],
    actor = adapter(),
    enemy = run.enemies[0];
  actor.update(run);
  const expected = heading(enemy.vx, enemy.vy);
  enemy.x = enemy.targetPoint.x - 1;
  enemy.y = enemy.targetPoint.y;
  run.tick++;
  run.time += 1 / 60;
  actor.update(run);
  near(actor.frame('enemy', enemy.id).heading, expected);
  enemy.phase = 'recovery';
  enemy.vx = 0;
  enemy.vy = 0;
  run.tick++;
  run.time += 1 / 60;
  actor.update(run);
  near(actor.frame('enemy', enemy.id).heading, expected);
});

for (const reduced of [false, true])
  test(`paused prepared phases keep body, rotor and contact commands stable (reduced=${reduced})`, () => {
    const checkpoints = hunterReviewCheckpoints(),
      run = structuredClone(checkpoints[0]),
      actor = adapter();
    for (const checkpoint of checkpoints) {
      Object.assign(run, structuredClone(checkpoint));
      const enemy = run.enemies[0];
      actor.update(run, { reduced });
      const expected = actor.frame('enemy', enemy.id).heading;
      run.status = 'paused';
      actor.update(run, { reduced });
      const first = commands(actor, enemy.id);
      for (let i = 0; i < 3; i++) {
        actor.update(run, { reduced });
        assert.deepEqual(commands(actor, enemy.id), first);
        near(actor.frame('enemy', enemy.id).heading, expected);
      }
      if (enemy.phase === 'warning' || enemy.phase === 'commit') {
        const cold = adapter();
        cold.update(run, { reduced });
        near(cold.frame('enemy', enemy.id).heading, expected);
      }
    }
  });

test('reduced effects do not change locked aim and a fresh attempt cannot inherit an old recovery pose', () => {
  const checkpoints = hunterReviewCheckpoints(),
    normal = adapter(),
    reduced = adapter(),
    run = structuredClone(checkpoints[0]);
  for (const checkpoint of checkpoints) {
    Object.assign(run, structuredClone(checkpoint));
    normal.update(run);
    reduced.update(run, { reduced: true });
    near(
      normal.frame('enemy', run.enemies[0].id).heading,
      reduced.frame('enemy', run.enemies[0].id).heading,
    );
  }
  normal.update(hunterReviewCheckpoints()[0]);
  near(normal.frame('enemy', 'review-hunter').heading, Math.PI);
});

test('enabling reduced effects while a real patrol turn is paused removes its cosmetic bank', () => {
  const level = structuredClone(FIRST_CONNECTION);
  level.enemies = [
    { id: 'review-hunter', type: 'hunter', x: 70.4, y: 10.5, vx: 8, vy: 1, radius: 0.35 },
  ];
  const run = startCoop(createCoop(level)),
    actor = adapter();
  actor.update(run);
  for (let tick = 0; tick < 4; tick++) {
    stepCoop(
      run,
      [0, 1].map(() => ({ direction: null, boost: false, support: false })),
    );
    actor.update(run);
  }
  assert.notEqual(actor.frame('enemy', 'review-hunter').bank, 0, 'real boundary turn banks');
  pauseCoop(run);
  const before = structuredClone(run),
    previous = actor.frame('enemy', 'review-hunter');
  actor.update(run, { reduced: true });
  const frame = actor.frame('enemy', 'review-hunter');
  assert.equal(frame.bank, 0);
  near(frame.heading, previous.heading);
  const drawn = commands(actor, 'review-hunter');
  assert.deepEqual(drawn.find((call) => call.name === 'scale' && call.args[0] === 1)?.args, [1, 1]);
  assert.deepEqual(run, before);
});
