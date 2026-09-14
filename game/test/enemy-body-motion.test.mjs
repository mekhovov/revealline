import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEnemyPresentations } from '../enemy-presentations.mjs';
import { createActorPresentation, drawPresentedActor } from '../ui/actor-presentation.mjs';
import { drawEnemyBodyMotion } from '../ui/enemy-body-motion.mjs';

const model = createEnemyPresentations(
  JSON.parse(readFileSync(new URL('../content/enemy-presentations.json', import.meta.url))),
);
const palette = { muted: '#657080', accent: '#ffd980' };
function surface() {
  const calls = [],
    stack = [];
  let state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_target, key) {
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ op: key, args, ...state });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') state = stack.pop();
        };
      },
      set(_target, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

test('seven exact image objects paint before retained heading badges and physical contact rings', () => {
  for (const record of model.entries) {
    const actor = { id: record.type, type: record.type, x: 4, y: 5, vx: 1, vy: 0, radius: 0.2 };
    const before = structuredClone(actor);
    const frame = createActorPresentation()
      .sample([actor], { themeId: 'fpv', dt: 0.08 })
      .get(actor.id);
    const image = { src: record.src };
    const { ctx, calls } = surface();
    drawPresentedActor(ctx, frame, palette, image, record);
    assert.equal(calls.filter((call) => call.op === 'drawImage').length, 1);
    const index = calls.findIndex((call) => call.op === 'drawImage');
    assert.equal(calls[index].args[0], image);
    assert.deepEqual(calls[index].args.slice(1), [
      -frame.diameter / 2,
      -frame.diameter / 2,
      frame.diameter,
      frame.diameter,
    ]);
    assert.ok(calls.findIndex((call) => call.op === 'arc') > index);
    assert.ok(calls.some((call) => call.op === 'arc' && call.args[2] === actor.radius * 16));
    assert.deepEqual(actor, before);
  }
});

test('surface marks remain contained at16/24/32 and use held frame clocks under pause/freeze', () => {
  const actor = { id: 'hunter', type: 'bouncer', x: 4, y: 5, vx: 2, vy: 0, radius: 0.2 };
  const poses = createActorPresentation();
  poses.sample([actor], { tick: 0, time: 0, dt: 0.05 });
  const moving = poses
    .sample([{ ...actor, x: 4.2 }], { tick: 1, time: 0.1, dt: 0.05 })
    .get(actor.id);
  const paused = poses
    .sample([{ ...actor, x: 4.2 }], { tick: 1, time: 0.1, dt: 0.1, paused: true })
    .get(actor.id);
  const frozen = poses
    .sample([{ ...actor, x: 4.2 }], {
      tick: 1,
      time: 0.1,
      dt: 0.1,
      classic: { enemies: [{ id: actor.id, frozen: true }] },
    })
    .get(actor.id);
  for (const diameter of [16, 24, 32]) {
    for (const record of model.entries) {
      const paint = (frame) => {
        const { ctx, calls } = surface();
        drawEnemyBodyMotion(ctx, frame, record, diameter);
        return calls.filter((call) => call.op === 'fillRect');
      };
      const marks = paint(moving);
      assert.deepEqual(paint(paused), marks);
      assert.deepEqual(paint(frozen), marks);
      for (const {
        args: [x, y, width, height],
      } of marks) {
        assert.ok(x >= -diameter / 2 && y >= -diameter / 2);
        assert.ok(x + width <= diameter / 2 && y + height <= diameter / 2);
      }
      assert.deepEqual(paint({ ...moving, reduced: true }), []);
    }
  }
});

test('travel and idle treatments use separate clocks; baked rotors and relay have no false parts', () => {
  const mark = (record, phase, travelPhase) => {
    const { ctx, calls } = surface();
    drawEnemyBodyMotion(ctx, { phase, travelPhase, reduced: false }, record, 32);
    return calls.filter((call) => call.op === 'fillRect').map((call) => call.args);
  };
  const hunter = model.entries[0],
    drill = model.entries[4];
  assert.deepEqual(mark(hunter, 0, 0.1), mark(hunter, 0.1, 0.1));
  assert.notDeepEqual(mark(hunter, 0, 0.1), mark(hunter, 0, 0.2));
  assert.deepEqual(mark(drill, 0.1, 0), mark(drill, 0.1, 0.2));
  assert.notDeepEqual(mark(drill, 0.1, 0), mark(drill, 0.2, 0));
  for (const index of [1, 2, 6]) assert.deepEqual(mark(model.entries[index], 0.4, 0.4), []);
});
