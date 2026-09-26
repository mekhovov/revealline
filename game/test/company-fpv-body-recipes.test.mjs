import test from 'node:test';
import assert from 'node:assert/strict';
import { FPV_BODY_RECIPES } from '../ui/fpv-body-recipes.mjs';
import { ACTOR_RECIPE_IDS, drawActorRecipe, resolveActorRecipe } from '../ui/actor-recipes.mjs';
import { createActorPresentation, drawPresentedActor } from '../ui/actor-presentation.mjs';

const colors = { dark: '#07111c', light: '#f1f7ed', trim: '#FFD62C', body: '#ff6d91' };
const ids = Object.keys(FPV_BODY_RECIPES);
const types = [
  'bouncer',
  'border-patrol',
  'contour-patrol',
  'claimed-rover',
  'eroder',
  'lane-boss',
  'relay-sentinel',
];
function surface() {
  const calls = [],
    stack = [];
  let state = { globalAlpha: 1, lineWidth: 1, fillStyle: '', strokeStyle: '' };
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
  return { ctx, calls, stack };
}
function paint(frame) {
  const surfaceValue = surface();
  assert.equal(drawActorRecipe(surfaceValue.ctx, frame, colors), true);
  assert.equal(surfaceValue.stack.length, 0, 'Recipe returns all canvas state to its caller.');
  return surfaceValue.calls;
}

test('six reusable quad silhouettes each retain four bounded motors and a distinct drawing', () => {
  const drawings = new Set();
  assert.equal(ids.length, 6);
  for (const id of ids) {
    assert(ACTOR_RECIPE_IDS.includes(id));
    assert.equal(resolveActorRecipe(id), id);
    const spec = FPV_BODY_RECIPES[id];
    assert(Object.isFrozen(spec));
    assert.equal(spec.motors.length, 4);
    assert.equal(new Set(spec.motors.map(String)).size, 4);
    for (const [x, y] of spec.motors) {
      const sweep = spec.guardRadius ? spec.guardRadius + 1.2 : spec.propRadius + 0.4;
      assert(Math.abs(x) + sweep <= 14 && Math.abs(y) + sweep <= 14);
    }
    const calls = paint(Object.freeze({ bodyRecipe: id, phase: 0.2, reduced: false }));
    assert.equal(calls.filter((call) => call.op === 'arc' && call.args[2] === 1.6).length, 4);
    assert.equal(
      calls.filter((call) => call.op === 'arc' && call.args[2] === 1.4).length,
      1,
      'One forward camera lens.',
    );
    assert(
      calls.every((call) =>
        call.args.every((arg) => typeof arg !== 'number' || Number.isFinite(arg)),
      ),
    );
    drawings.add(JSON.stringify(calls));
  }
  assert.equal(drawings.size, 6);
  const unknown = surface();
  assert.equal(drawActorRecipe(unknown.ctx, { bodyRecipe: 'constructor' }, colors), false);
  assert.equal(unknown.calls.length, 0);
});

test('props consume only the shared held phase and stop with reduced motion', () => {
  for (const id of ids) {
    const actor = Object.freeze({
      id: 'quad',
      type: 'bouncer',
      x: 4,
      y: 5,
      vx: 2,
      vy: 0,
      radius: 0.22,
    });
    const poses = createActorPresentation();
    const options = { bodyRecipes: { bouncer: id }, dt: 0.06 };
    poses.sample([actor], { ...options, tick: 0, time: 0 });
    const moving = poses
      .sample([{ ...actor, x: 4.1 }], { ...options, tick: 1, time: 0.1 })
      .get(actor.id);
    const paused = poses
      .sample([{ ...actor, x: 4.1 }], { ...options, tick: 1, time: 0.1, paused: true })
      .get(actor.id);
    const frozen = poses
      .sample([{ ...actor, x: 4.1 }], {
        ...options,
        tick: 1,
        time: 0.1,
        classic: { enemies: [{ id: actor.id, frozen: true }] },
      })
      .get(actor.id);
    assert.deepEqual(paint(paused), paint(moving));
    assert.deepEqual(paint(frozen), paint(moving));
    assert.notDeepEqual(paint({ ...moving, phase: moving.phase + 1 }), paint(moving));
    assert.deepEqual(
      paint({ ...moving, reduced: true, phase: 1 }),
      paint({ ...moving, reduced: true, phase: 999 }),
    );
  }
});

test('every family keeps all seven canonical role badges and physical contact cues unchanged', () => {
  for (const id of ids)
    for (const type of types) {
      const actor = Object.freeze({ id: 'quad', type, x: 4, y: 5, vx: 1, vy: 0, radius: 0.22 });
      const sample = (bodyRecipes) =>
        createActorPresentation().sample([actor], { bodyRecipes, reduced: true }).get(actor.id);
      const base = sample({}),
        themed = sample({ [type]: id });
      assert.deepEqual(
        Object.fromEntries(Object.entries(themed).filter(([key]) => key !== 'bodyRecipe')),
        base,
      );
      const render = (frame) => {
        const result = surface();
        drawPresentedActor(result.ctx, frame, { accent: '#FFD62C', muted: '#657080' });
        assert.equal(result.stack.length, 0);
        // The badge starts at this host-owned placement after the decorative body.
        const badge = result.calls.findIndex(
          (call) =>
            call.op === 'translate' &&
            call.args[0] === Math.round(frame.diameter * 0.22) &&
            call.args[1] === Math.round(frame.diameter * 0.2),
        );
        assert(badge >= 0);
        return result.calls.slice(badge);
      };
      assert.deepEqual(render(themed), render(base));
    }
});
