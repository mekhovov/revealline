import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
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

test('props consume only the shared held rotor phase and stop with reduced motion', () => {
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
    assert.notDeepEqual(paint({ ...moving, rotorPhase: moving.rotorPhase + 0.1 }), paint(moving));
    assert.deepEqual(paint({ ...moving, phase: moving.phase + 1 }), paint(moving));
    assert.deepEqual(
      paint({ ...moving, reduced: true, rotorPhase: 1 }),
      paint({ ...moving, reduced: true, rotorPhase: 999 }),
    );
  }
});

// Observe the actually painted blade vertices through the Canvas transform
// stack. Animation clocks alone cannot expose the old apparent reversal.
function paintedBlades(calls) {
  let matrix = [1, 0, 0, 1, 0, 0],
    points = [];
  const stack = [],
    blades = [],
    point = (x, y) => [
      matrix[0] * x + matrix[2] * y + matrix[4],
      matrix[1] * x + matrix[3] * y + matrix[5],
    ],
    transform = ([a, b, c, d, e, f]) => {
      const [aa, bb, cc, dd, ee, ff] = matrix;
      matrix = [
        aa * a + cc * b,
        bb * a + dd * b,
        aa * c + cc * d,
        bb * c + dd * d,
        aa * e + cc * f + ee,
        bb * e + dd * f + ff,
      ];
    };
  for (const { op, args } of calls) {
    if (op === 'save') stack.push([...matrix]);
    else if (op === 'restore') matrix = stack.pop();
    else if (op === 'translate') transform([1, 0, 0, 1, ...args]);
    else if (op === 'scale') transform([args[0], 0, 0, args[1], 0, 0]);
    else if (op === 'rotate')
      transform([
        Math.cos(args[0]),
        Math.sin(args[0]),
        -Math.sin(args[0]),
        Math.cos(args[0]),
        0,
        0,
      ]);
    else if (op === 'beginPath') points = [];
    else if (op === 'moveTo' || op === 'lineTo') points.push(point(...args));
    else if (op === 'fill' && points.length === 5)
      blades.push({ origin: point(0, 0), points: [...points] });
  }
  assert.equal(stack.length, 0);
  return blades;
}
const TAU = Math.PI * 2;
const wrap = (value, period) => ((((value + period / 2) % period) + period) % period) - period / 2;
const bladeAngle = (blade) =>
  Math.atan2(blade.points[2][1] - blade.origin[1], blade.points[2][0] - blade.origin[0]);

test('all six procedural quads paint alias-safe diagonal props-in pairs at 10/30/60/120 FPS', () => {
  const report = [],
    failures = [];
  for (const id of ids)
    for (const fps of [10, 30, 60, 120]) {
      const poses = createActorPresentation(),
        options = { bodyRecipes: { bouncer: id } },
        actor = { id: 'quad', type: 'bouncer', x: 10, y: 10, vx: 12, vy: 0, radius: 0.22 },
        first = poses.sample([actor], { ...options, time: 0, tick: 0 }).get(actor.id),
        second = poses
          .sample([{ ...actor, x: actor.x + 12 / fps }], {
            ...options,
            time: 1 / fps,
            tick: 120 / fps,
            dt: 1 / fps,
          })
          .get(actor.id),
        before = paintedBlades(paint(first)),
        after = paintedBlades(paint(second)),
        row = { id, fps, steps: [] };
      assert.equal(before.length, 12);
      assert.equal(
        after.length,
        12,
        'Exactly three blades at each of four hubs; no doubled props.',
      );
      for (const [index, [x, y]] of FPV_BODY_RECIPES[id].motors.entries()) {
        const direction = x * y > 0 ? 1 : -1,
          step = wrap(bladeAngle(after[index * 3]) - bladeAngle(before[index * 3]), TAU / 3);
        row.steps.push({ motor: [x, y], direction, apparentStep: step });
        if (!(step * direction > 0 && Math.abs(step) <= (TAU / 3) * 0.22 + 1e-9))
          failures.push({ id, fps, motor: [x, y], direction, apparentStep: step });
      }
      report.push(row);
    }
  if (failures.length) console.log(JSON.stringify({ actualPaintedRotorMatrix: report }));
  assert.deepEqual(
    failures,
    [],
    'Signed painted blade motion must agree with the shared props-in convention without apparent reversal.',
  );
});

test('procedural blade handedness follows its motor direction and keeps the original bounded geometry', () => {
  for (const id of ids) {
    const spec = FPV_BODY_RECIPES[id],
      phase = 0.37,
      blades = paintedBlades(
        paint({ bodyRecipe: id, phase: 999, rotorPhase: phase, reduced: false }),
      );
    for (const [index, [x, y]] of spec.motors.entries()) {
      const direction = x * y > 0 ? 1 : -1,
        blade = blades[index * 3],
        angle = phase * direction + index * 0.7 + (direction * TAU) / 3,
        dx = blade.points[1][0] - x,
        dy = blade.points[1][1] - y,
        localX = dx * Math.cos(angle) + dy * Math.sin(angle),
        localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      assert.deepEqual(blade.origin, [x, y]);
      assert.ok(Math.abs(localX - spec.propRadius * 0.55) < 1e-9);
      assert.ok(
        Math.abs(localY + direction * 1.25) < 1e-9,
        'Blade handedness mirrors with the actual direction.',
      );
      for (const current of blades.slice(index * 3, index * 3 + 3))
        for (const [px, py] of current.points)
          assert.ok(Math.hypot(px - x, py - y) <= spec.propRadius + 0.4);
    }
  }
});

test('legacy or invalid frames use a finite static prop pose instead of the unsafe idle clock', () => {
  for (const id of ids) {
    const still = paint({ bodyRecipe: id, rotorPhase: 0, reduced: false });
    for (const rotorPhase of [undefined, null, NaN, Infinity])
      assert.deepEqual(paint({ bodyRecipe: id, phase: 999, rotorPhase, reduced: false }), still);
  }
});

test('the current DroneAid theme uses corrected procedural props in the actual board painter without changing its run', () => {
  const theme = JSON.parse(
      readFileSync(
        new URL('../content/company-boot/droneaid-nl-parts-in-motion/themes.json', import.meta.url),
      ),
    ).themes[0],
    presets = JSON.parse(
      readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
    ),
    run = createRun({
      version: 'xonix-level.v3',
      id: 'company-rotor-runtime',
      revision: '1',
      name: 'Company rotor runtime',
      width: 72,
      height: 36,
      encounter: null,
      spawn: { x: 60.5, y: 0.5 },
      enemies: [{ id: 'quad', type: 'bouncer', x: 10.5, y: 10.5, vx: 12, vy: 0, radius: 0.22 }],
      walls: [],
      supplies: [],
      objectives: [],
      goal: { coverage: 0.99 },
    }),
    painter = new BoardPainter(presets),
    view = surface();
  view.ctx.canvas = { width: 1152, height: 576, clientWidth: 1152 };
  painter.theme = theme;
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { width: 384, height: 288 };
  assert.equal(theme.actorRecipes.bouncer, 'fpv-whoop');
  const paintRun = (dt, options = {}) => {
    view.calls.length = 0;
    const checkpoint = authoritativeCheckpoint(run);
    painter.draw(view.ctx, run, dt, options);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    const blades = paintedBlades(view.calls);
    assert.equal(blades.length, 12);
    return blades;
  };
  const before = paintRun(0);
  for (let tick = 0; tick < 12; tick++) stepRun(run, {}, FIXED_DT);
  const after = paintRun(0.1);
  FPV_BODY_RECIPES['fpv-whoop'].motors.forEach(([x, y], index) => {
    const direction = x * y > 0 ? 1 : -1,
      delta = wrap(bladeAngle(after[index * 3]) - bladeAngle(before[index * 3]), TAU / 3);
    assert.ok(delta * direction > 0 && Math.abs(delta) <= (TAU / 3) * 0.22 + 1e-9);
  });
  assert.deepEqual(paintRun(0.1, { paused: true }), after);
  const reduced = paintRun(0.1, { reduced: true });
  assert.deepEqual(paintRun(0.1, { reduced: true }), reduced);
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
