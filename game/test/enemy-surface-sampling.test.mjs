import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createEnemyPresentations } from '../enemy-presentations.mjs';
import { createActorPresentation, drawPresentedActor } from '../ui/actor-presentation.mjs';
import { drawEnemyBodyMotion } from '../ui/enemy-body-motion.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { canvasPresentation, imagePresentation } from '../presentation/runtime.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const source = read('../content/enemy-presentations.json');
const records = createEnemyPresentations(source).entries;
const themes = read('../content/themes.json').themes;
const presets = read('../../authoring/motion-lab/presets.json');
const palette = { muted: '#657080', accent: '#ffd980' };
function surface() {
  const calls = [],
    stack = [];
  let values = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: 1152 } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in values) return values[key];
        return (...args) => {
          calls.push({ op: key, args, ...values });
          if (key === 'save') stack.push({ ...values });
          if (key === 'restore') values = stack.pop();
        };
      },
      set(_target, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}
function makeRun() {
  return createRun({
    version: 'xonix-level.v3',
    id: 'surface-motion-check',
    revision: '1',
    name: 'Surface motion',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 60.5, y: 0.5 },
    enemies: [{ id: 'hunter', type: 'bouncer', x: 10.5, y: 10.5, vx: 12, vy: 0, radius: 0.2 }],
    walls: [],
    supplies: [],
    objectives: [],
    goal: { coverage: 0.9 },
  });
}
function paint(frame, record, diameter = 32) {
  const { ctx, calls } = surface();
  drawEnemyBodyMotion(ctx, frame, record, diameter);
  return calls.filter(({ op }) => op === 'fillRect');
}
function cycle(mark, part, diameter) {
  const [x, y, width, height] = mark.args;
  const span = (part.kind === 'travel-glint' ? part.height : part.width) * diameter;
  const extent = part.kind === 'travel-glint' ? height : width;
  const center = ((part.kind === 'travel-glint' ? part.y : part.x) - 0.5) * diameter;
  return ((part.kind === 'travel-glint' ? y : x) - center + span / 2) / (span - extent);
}
const apparentStep = (next, previous) => ((next - previous + 1.5) % 1) - 0.5;
function sample(sampler, run, dt, extra = {}) {
  return sampler
    .sample(run.enemies, { tick: run.tick, time: run.time, dt, ...extra })
    .get('hunter');
}

for (const fps of [10, 30, 60, 120])
  test(`actual painted surface accents retain forward sampling at ${fps} FPS`, () => {
    const run = makeRun(),
      sampler = createActorPresentation(),
      previous = new Map(),
      evidence = [];
    for (let n = 0; n < 12; n++) {
      for (let tick = 0; tick < 120 / fps; tick++) stepRun(run, { direction: null }, FIXED_DT);
      const before = authoritativeCheckpoint(run),
        frame = sample(sampler, run, 1 / fps);
      // Each catalog part follows this real movement sample; records and geometry
      // are original. This does not invent other actors' behavior or decode pixels.
      for (const record of records) {
        const marks = paint(frame, record);
        assert.equal(marks.length, record.motion.length);
        marks.forEach((mark, index) => {
          const part = record.motion[index],
            key = `${record.type}/${index}`,
            unit = cycle(mark, part, 32);
          if (previous.has(key))
            evidence.push({ key, step: apparentStep(unit, previous.get(key)) });
          previous.set(key, unit);
          const [x, y, width, height] = mark.args;
          assert(x >= -16 && y >= -16 && x + width <= 16 && y + height <= 16);
        });
      }
      assert.deepEqual(authoritativeCheckpoint(run), before);
    }
    assert(evidence.length > 0);
    assert(
      evidence.every(({ step }) => step > 0 && step <= 0.22 + 1e-9),
      JSON.stringify({ fps, evidence }),
    );
  });

test('surface sampling supports every admitted rate through the exact catalog bound', () => {
  const admitted = structuredClone(source);
  admitted.entries[0].motion[0].rate = 8;
  assert.doesNotThrow(() => createEnemyPresentations(admitted));
  const rejected = structuredClone(admitted);
  rejected.entries[0].motion[0].rate = 8.001;
  assert.throws(() => createEnemyPresentations(rejected), /rate bound/);
  assert(records.every((record) => record.motion.every((part) => part.rate <= 8)));
  const run = makeRun(),
    sampler = createActorPresentation();
  const first = sample(sampler, run, 0.1);
  for (let n = 0; n < 12; n++) stepRun(run, { direction: null }, FIXED_DT);
  const second = sample(sampler, run, 0.1);
  for (const kind of ['travel-glint', 'phase-sweep']) {
    const record = structuredClone(admitted.entries[0]);
    record.motion = [{ ...record.motion[0], kind, width: 0.2, height: 0.2 }];
    const a = cycle(paint(first, record)[0], record.motion[0], 32);
    const b = cycle(paint(second, record)[0], record.motion[0], 32);
    assert(Math.abs(apparentStep(b, a) - 0.22) < 1e-9);
  }
});

test('surface clocks hold through pause, freeze, stun, reduced effects and background return', () => {
  for (const held of [
    { paused: true },
    { classic: { enemies: [{ id: 'hunter', frozen: true }] } },
    { classic: { enemies: [{ id: 'hunter', stunned: true }] } },
    { classic: { enemies: [{ id: 'hunter', mode: 'dormant' }] } },
  ]) {
    const run = makeRun(),
      sampler = createActorPresentation();
    sample(sampler, run, 1 / 60);
    for (let tick = 0; tick < 2; tick++) stepRun(run, { direction: null }, FIXED_DT);
    const moving = sample(sampler, run, 1 / 60);
    const paused = sample(sampler, run, 20, held);
    for (const record of records) assert.deepEqual(paint(paused, record), paint(moving, record));
    const reduced = sample(sampler, run, 20, { ...held, reduced: true });
    for (const record of records) assert.deepEqual(paint(reduced, record), []);
    const returned = sample(sampler, run, 0, held);
    for (const record of records) assert.deepEqual(paint(returned, record), paint(moving, record));
    const resumed = sample(sampler, run, 20);
    for (const record of records) {
      const a = paint(returned, record),
        b = paint(resumed, record);
      b.forEach((mark, i) => {
        const step = apparentStep(
          cycle(mark, record.motion[i], 32),
          cycle(a[i], record.motion[i], 32),
        );
        assert(step >= 0 && step <= 0.22 + 1e-9, 'background elapsed cannot skip a surface cycle');
      });
    }
  }
});

test('stationary surface travel stays still while its independent idle accents continue', () => {
  const run = makeRun(),
    sampler = createActorPresentation();
  sample(sampler, run, 1 / 60);
  for (let tick = 0; tick < 2; tick++) stepRun(run, { direction: null }, FIXED_DT);
  const moving = sample(sampler, run, 1 / 60);
  const repeated = sample(sampler, run, 0);
  for (const record of records) assert.deepEqual(paint(repeated, record), paint(moving, record));
  for (const dt of [undefined, NaN, Infinity, -Infinity, -1]) {
    const held = sample(sampler, run, dt);
    assert.equal(held.surfacePhase, moving.surfacePhase);
    assert.equal(held.surfaceTravelPhase, moving.surfaceTravelPhase);
    for (const record of records) assert.deepEqual(paint(held, record), paint(moving, record));
  }
  // A separate stationary actor observation exercises gait/idle separation.
  const stopped = createActorPresentation(),
    actor = { ...run.enemies[0], vx: 0, vy: 0 };
  const a = stopped.sample([actor], { tick: 0, time: 0, dt: 0.1 }).get('hunter');
  const b = stopped.sample([actor], { tick: 1, time: 0.1, dt: 0.1 }).get('hunter');
  assert.deepEqual(paint(a, records[0]), paint(b, records[0]));
  assert.notDeepEqual(paint(a, records[4]), paint(b, records[4]));
});

test('legacy direct frames preserve finite clocks and missing/nonfinite clocks cannot paint NaN', () => {
  for (const record of records) {
    const legacy = { phase: 0.12, travelPhase: 0.23, reduced: false };
    assert.deepEqual(
      paint(legacy, record),
      paint({ ...legacy, surfacePhase: 0.12, surfaceTravelPhase: 0.23 }, record),
    );
    for (const bad of [undefined, null, NaN, Infinity, -Infinity]) {
      const marks = paint(
        { phase: bad, travelPhase: bad, surfacePhase: bad, surfaceTravelPhase: bad },
        record,
      );
      assert(marks.every((mark) => mark.args.every(Number.isFinite)));
    }
    const current = { ...legacy, surfacePhase: 0.4, surfaceTravelPhase: 0.5 };
    assert.deepEqual(
      paint(current, record),
      paint({ ...current, phase: 123, travelPhase: 456 }, record),
    );
  }
});

test('the real prepared BoardPainter retains the original image and bounded surface motion without core changes', () => {
  const run = makeRun(),
    painter = new BoardPainter(presets),
    { ctx, calls } = surface();
  const compiled = read('../presentation/compiled/runtime.json');
  const asset = compiled.resolved.assets['enemy.bouncer'];
  const sprite = { image: { id: 'accepted-bouncer' }, geometry: imagePresentation(asset), asset };
  painter.theme = themes.find(({ id }) => id === 'fpv');
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { width: 384, height: 288 };
  painter.setPresentation({
    canvas: canvasPresentation(compiled.resolved),
    image: (slot) => (slot === 'enemy.bouncer' ? sprite : null),
  });
  painter.enemyBodies = { update() {}, record: () => records[0] };
  const positions = [];
  for (let n = 0; n < 8; n++) {
    for (let tick = 0; tick < 2; tick++) stepRun(run, { direction: null }, FIXED_DT);
    const before = authoritativeCheckpoint(run);
    calls.length = 0;
    painter.draw(ctx, run, 1 / 60);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    const imageIndex = calls.findIndex(
      ({ op, args }) => op === 'drawImage' && args[0] === sprite.image,
    );
    assert(imageIndex >= 0);
    const marks = calls
      .slice(imageIndex + 1)
      .filter(({ op, globalAlpha }) => op === 'fillRect' && globalAlpha === 0.55);
    assert.equal(marks.length, records[0].motion.length);
    const diameter = marks[0].args[2] / records[0].motion[0].width;
    positions.push(cycle(marks[0], records[0].motion[0], diameter));
  }
  assert(
    positions
      .slice(1)
      .every(
        (p, i) => apparentStep(p, positions[i]) > 0 && apparentStep(p, positions[i]) <= 0.22 + 1e-9,
      ),
    JSON.stringify(positions),
  );
});

test('non-surface FPV body, gait, rotor, badge and contact command streams stay unchanged', () => {
  const sampler = createActorPresentation(),
    calls = [];
  for (let tick = 0; tick < 12; tick++) {
    const actors = records.map((record, i) => ({
      id: record.type,
      type: record.type,
      x: 5 + tick * 0.2,
      y: 5 + i,
      vx: 12,
      vy: 0,
      radius: 0.2,
    }));
    for (const frame of sampler.sample(actors, { tick, time: tick / 60, dt: 1 / 60 }).values()) {
      const painted = surface();
      drawPresentedActor(painted.ctx, frame, palette);
      calls.push(...painted.calls);
    }
  }
  const hash = createHash('sha256').update(JSON.stringify(calls)).digest('hex');
  assert.equal(hash, '5a6dd9d4245e315f6160cffe8ad82418b5f00621fad8b4b944f9156547401ca1');
});
