import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { ACTOR_FAMILIES, ACTOR_CASTS, actorVisual } from '../hunt/actor-catalog.mjs';
import {
  INDUSTRIAL_SOLDIER_KITS,
  INDUSTRIAL_SOLDIER_KIT_REVISION as revision,
} from '../hunt/industrial-soldier-kit.mjs';
import { createHuntDestruction, drawHuntRemains } from '../hunt/destruction.mjs';
import { createDestructionBudget } from '../hunt/destruction-budget.mjs';
import { createSnakeHuntPresentation } from '../../optional-practice/civilian-fpv/snake-hunt-presentation.mjs';
import { soldierSpecimen } from '../../scripts/produce-soldier-roster.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { SNAKE_HUNT_COURSES } from '../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';

function context() {
  const rows = [],
    stack = [];
  return {
    rows,
    fillStyle: '#000000',
    globalAlpha: 1,
    save() {
      stack.push([this.fillStyle, this.globalAlpha]);
      rows.push(['save']);
    },
    restore() {
      [this.fillStyle, this.globalAlpha] = stack.pop();
      rows.push(['restore']);
    },
    translate(...args) {
      rows.push(['translate', ...args]);
    },
    scale(...args) {
      rows.push(['scale', ...args]);
    },
    rotate(...args) {
      rows.push(['rotate', ...args]);
    },
    fillRect(...args) {
      rows.push(['rect', this.fillStyle, ...args]);
    },
  };
}
const treatments = [
  { brutal: false, blood: true },
  { brutal: true, blood: false },
  { brutal: true, blood: true },
];
const mark = (family = 'courier', cast = 'rivals', id = 'target') => ({
  id,
  family,
  cast,
  tick: 10,
  x: 1,
  y: 1,
  cause: 'contact',
});
const colors = (ctx) => ctx.rows.filter(([kind]) => kind === 'rect').map((row) => row[1]);
function burst(artRevision, event, prefs) {
  const budget = createDestructionBudget({ now: () => 0 });
  const painter = createHuntDestruction({ artRevision, budget, now: () => 0 });
  painter.advance({ valid: true, eliminations: [] }, 0, { key: 'attempt', ...prefs });
  painter.advance({ valid: true, eliminations: [event] }, 0, { key: 'attempt', ...prefs });
  const ctx = context();
  painter.draw(ctx);
  return { ctx, painter, budget };
}

test('shared defeat kit data reproduces all 144 already-reviewed live v3 specimens exactly', async () => {
  const receipt = JSON.parse(
    await readFile(
      new URL(
        '../../docs/qualification/industrial-art/roster-v3/soldiers/receipt.json',
        import.meta.url,
      ),
    ),
  );
  assert.equal(receipt.samples.length, 144);
  for (const sample of receipt.samples) {
    const actual = soldierSpecimen(
      {
        family: sample.family,
        cast: sample.cast,
        state: 'walk',
        locomotionPhase: 1 / 6,
        armed: sample.family === 'guard',
      },
      sample.size,
    );
    assert.equal(
      createHash('sha256').update(actual.rgba).digest('hex'),
      sample.rgbaSha256,
      `${sample.family}/${sample.cast}/${sample.size}`,
    );
  }
  assert.deepEqual(
    Object.keys(INDUSTRIAL_SOLDIER_KITS),
    ACTOR_FAMILIES.map((f) => f.id),
  );
  assert.equal(new Set(Object.values(INDUSTRIAL_SOLDIER_KITS).map((kit) => kit.id)).size, 12);
  for (const kit of Object.values(INDUSTRIAL_SOLDIER_KITS)) {
    assert.ok(Object.isFrozen(kit) && Object.isFrozen(kit.rectangles[0]));
    for (const [, x, y, width, height] of kit.rectangles) {
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
      assert.ok(x + width <= kit.size[0] && y + height <= kit.size[1]);
    }
  }
});

test('all families and casts drop their exact live accessory in clean, bloodless brutal and bloody overhead effects', () => {
  for (const family of ACTOR_FAMILIES)
    for (const cast of ACTOR_CASTS)
      for (const prefs of treatments) {
        const event = mark(family.id, cast.id),
          before = structuredClone(event),
          kit = INDUSTRIAL_SOLDIER_KITS[family.id];
        const visual = actorVisual(family.id, cast.id),
          { ctx, painter } = burst(revision, event, prefs),
          remains = context();
        drawHuntRemains(remains, event, { artRevision: revision, ...prefs });
        for (const [partIndex, [color, x, y, width, height]] of kit.rectangles.entries()) {
          const expected = [
            'rect',
            visual.palette[color] ?? color,
            (x - kit.size[0] / 2) / 2,
            (y - kit.size[1] / 2) / 2,
            width / 2,
            height / 2,
          ];
          assert.ok(
            ctx.rows.some((row) => JSON.stringify(row) === JSON.stringify(expected)),
            `${family.id}: burst kit`,
          );
          assert.ok(
            remains.rows.some((row) => JSON.stringify(row) === JSON.stringify(expected)),
            `${family.id}: settled kit`,
          );
          if (partIndex === 0) {
            for (const drawing of [ctx, remains])
              assert.equal(
                drawing.rows.filter((row) => JSON.stringify(row) === JSON.stringify(expected))
                  .length,
                1,
                `${family.id}: one signature accessory per accepted defeat`,
              );
          }
        }
        for (const drawing of [ctx, remains])
          assert.equal(colors(drawing).includes('#8c1934'), prefs.brutal && prefs.blood);
        assert.deepEqual(event, before);
        painter.reset();
      }
});

test('historical, unknown and explicitly absent art revisions retain legacy equipment recipes', () => {
  const legacy = burst(null, mark(), treatments[0]);
  assert.ok(colors(legacy.ctx).includes('#c99455'));
  for (const artRevision of ['industrial-pilot-v1', 'industrial-overhead-v2', 'unknown']) {
    const candidate = burst(artRevision, mark(), treatments[0]);
    assert.deepEqual(candidate.ctx.rows, legacy.ctx.rows);
    candidate.painter.reset();
  }
  const next = burst(revision, mark(), treatments[0]);
  assert.ok(colors(next.ctx).includes('#795e3f'));
  assert.equal(colors(next.ctx).includes('#c99455'), false);
  legacy.painter.reset();
  next.painter.reset();
});

test('two boards keep shared caps, frozen poses, fresh-event deduplication and silent restore with v3 kits', () => {
  const budget = createDestructionBudget({ now: () => 0 }),
    painters = [0, 1].map(() =>
      createHuntDestruction({ artRevision: revision, budget, now: () => 0 }),
    );
  const empty = { valid: true, eliminations: [] },
    full = {
      valid: true,
      eliminations: Array.from({ length: 30 }, (_, i) =>
        mark(ACTOR_FAMILIES[i % 12].id, 'tactical', String(i)),
      ),
    };
  for (const painter of painters) {
    painter.advance(empty, 0, { key: 'live', brutal: true });
    painter.advance(full, 0.04, { key: 'live', brutal: true });
    painter.draw(context());
    assert.ok(painter.snapshot().bursts <= 24);
    const a = context(),
      b = context();
    painter.draw(a);
    painter.advance(full, 0.1, { key: 'live', brutal: true, paused: true });
    painter.draw(b);
    assert.deepEqual(a.rows, b.rows);
  }
  assert.equal(budget.snapshot().particles, 128);
  assert.equal(budget.snapshot().envelopes, 4);
  assert.ok(painters.reduce((sum, p) => sum + p.snapshot().particles, 0) <= 128);
  for (const painter of painters) {
    painter.advance(full, 0, { key: 'restored', brutal: true });
    assert.equal(painter.snapshot().bursts, 0);
    painter.reset();
  }
  assert.equal(budget.snapshot().owners, 0);
});

function native(family = 'courier', prefs = treatments[0]) {
  const scene = new THREE.Scene(),
    settings = { ...prefs, showRemains: true },
    view = createSnakeHuntPresentation({ THREE, scene, preferences: () => settings });
  const caught = {
      id: 'human',
      family,
      tick: 10,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 1000, y: 0, z: 0 },
    },
    state = {
      ticks: 11,
      events: [{ type: 'catch', actor: 'human' }],
      hunt: { catches: [caught], tail: [{ x: 0, y: 1000, z: 0 }] },
    },
    options = { soldierRevision: revision, soldierActorIds: ['human'] };
  return { scene, settings, view, caught, state, options };
}
function meshState(scene, name) {
  const mesh = scene.getObjectByName(name);
  return {
    count: mesh.count,
    matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
    colors: Array.from(mesh.instanceColor?.array.slice(0, mesh.count * 3) ?? []),
  };
}

test('a real native flight contact emits v3 gear after the completed transaction increments its tick', async () => {
  await initWorldRuntime();
  const course = SNAKE_HUNT_COURSES[0],
    flight = createWorldFlight({ course }),
    scene = new THREE.Scene(),
    view = createSnakeHuntPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: false, blood: false, showRemains: true }),
    }),
    options = {
      soldierRevision: revision,
      soldierActorIds: course.actors.map((actor) => actor.id),
      actorDefinitions: course.actors,
    },
    clamp = (n, low, high) => Math.min(high, Math.max(low, n));
  try {
    flight.arm();
    view.update(flight.snapshot(), options);
    let caught = null;
    for (let step = 0; step < 5000 && flight.snapshot().status === 'active'; step++) {
      const before = flight.snapshot(),
        target = before.actors.find((actor) => actor.status === 'active').position,
        ax = clamp((target.x - before.position.x) * 0.65 - before.velocity.x * 1.4, -1800, 1800),
        az = clamp((target.z - before.position.z) * 0.65 - before.velocity.z * 1.4, -1800, 1800),
        ay = clamp((900 - before.position.y) * 3 - before.velocity.y * 2, -4000, 4000),
        state = flight.step({
          roll: ax / 4905,
          pitch: -az / 4905,
          yaw: 0,
          throttle: clamp(
            (9810 + ay) / (19620 * Math.max(0.6, before.attitude.up.y / 1000000)),
            0,
            1,
          ),
          actions: 0,
        });
      view.observe(state, options);
      view.update(state, options);
      if (state.events.some((event) => event.type === 'catch')) {
        caught = state;
        break;
      }
    }
    assert.ok(caught, 'Legal native controls must reach a contact.');
    assert.equal(caught.hunt.catches[0].tick, caught.ticks - 1);
    assert.ok(
      view.resources().cosmeticParticles > 0,
      'The accepted contact creates fresh kit feedback.',
    );
    assert.ok(view.resources().settledPieces > 0);
    const first = meshState(scene, 'hunt-cosmetic-fragments');
    view.observe(caught, options);
    view.update(caught, options);
    assert.deepEqual(meshState(scene, 'hunt-cosmetic-fragments'), first);
    view.reset();
    view.update(caught, options);
    view.observe(caught, options);
    view.update(caught, options);
    assert.equal(
      view.resources().cosmeticParticles,
      0,
      'Restoration cannot replay the consumed native catch.',
    );
  } finally {
    view.dispose();
    flight.dispose();
  }
});

test('native v3 uses exact live gear planes under all treatments and preserves source snapshots', () => {
  for (const family of ACTOR_FAMILIES)
    for (const prefs of treatments) {
      const { scene, settings, view, state, options } = native(family.id, prefs),
        before = structuredClone(state);
      view.observe(state, options);
      view.update(state, options);
      const kit = INDUSTRIAL_SOLDIER_KITS[family.id],
        settled = scene.getObjectByName('hunt-settled-remains');
      assert.ok(view.resources().cosmeticParticles > 0);
      assert.ok(settled.count >= kit.rectangles.length);
      for (const [index, [, , , width, height]] of kit.rectangles.entries()) {
        const matrix = new THREE.Matrix4(),
          position = new THREE.Vector3(),
          rotation = new THREE.Quaternion(),
          scale = new THREE.Vector3();
        settled.getMatrixAt(index, matrix);
        matrix.decompose(position, rotation, scale);
        assert.ok(Math.abs(scale.x - width * 0.026) < 1e-6);
        assert.ok(Math.abs(scale.z - height * 0.026) < 1e-6);
      }
      const fresh = meshState(scene, 'hunt-cosmetic-fragments');
      settings.showRemains = false;
      view.update(state, options);
      assert.equal(view.resources().settledPieces, 0);
      assert.deepEqual(meshState(scene, 'hunt-cosmetic-fragments'), fresh);
      assert.equal(view.resources().tailLinks, 1);
      assert.deepEqual(state, before);
      view.dispose();
      assert.equal(scene.children.length, 0);
    }
});

test('native restoration, repeated events, preference reductions and seeking do not replay old kit bursts', () => {
  const { view, scene, state, options, settings } = native('courier', treatments[2]);
  view.update(state, options); // Restore never observes a consumed command/event.
  assert.ok(view.resources().settledPieces > 0);
  assert.equal(view.resources().cosmeticParticles, 0);
  view.observe(state, options);
  view.update(state, options);
  assert.equal(view.resources().cosmeticParticles, 0, 'Duplicate restored events stay silent.');
  view.reset();
  view.observe(state, options);
  view.update(state, options);
  const paused = meshState(scene, 'hunt-cosmetic-fragments');
  assert.ok(paused.count > 0);
  view.observe(state, options);
  view.update(state, options);
  assert.deepEqual(meshState(scene, 'hunt-cosmetic-fragments'), paused);
  settings.blood = false;
  view.update(state, options);
  assert.equal(view.resources().cosmeticParticles, 0);
  settings.blood = true;
  view.observe(state, options);
  view.update(state, options);
  assert.equal(view.resources().cosmeticParticles, 0, 'Re-enabling does not replay.');
  view.reset();
  view.observe(state, options);
  view.update(state, { ...options, reducedMotion: true });
  assert.equal(view.resources().cosmeticParticles, 0);
  assert.ok(view.resources().settledPieces > 0);
  view.observe(state, options);
  view.update(state, options);
  assert.equal(view.resources().cosmeticParticles, 0);
  view.reset();
  view.observe(state, options);
  view.update(state, options);
  view.update({ ...state, ticks: 50 }, options);
  view.update(state, options);
  assert.equal(
    view.resources().cosmeticParticles,
    0,
    'A backward seek reconstructs only settled gear.',
  );
  view.dispose();
});

test('native kit admission is explicit and crowds share existing instance and burst caps', () => {
  const current = native(),
    legacy = native();
  current.view.update(current.state, { ...current.options, soldierActorIds: [] });
  legacy.view.update(legacy.state);
  assert.deepEqual(
    meshState(current.scene, 'hunt-cosmetic-fragments'),
    meshState(legacy.scene, 'hunt-cosmetic-fragments'),
  );
  assert.equal(current.view.resources().settledPieces, 0);
  current.view.reset();
  current.state.hunt.catches = Array.from({ length: 24 }, (_, i) => ({
    ...current.caught,
    id: String(i),
    family: ACTOR_FAMILIES[i % 12].id,
  }));
  current.state.events = current.state.hunt.catches.map((entry) => ({
    type: 'catch',
    actor: entry.id,
  }));
  current.options.soldierActorIds = current.state.hunt.catches.map((entry) => entry.id);
  current.settings.brutal = true;
  current.view.observe(current.state, current.options);
  current.view.update(current.state, current.options);
  assert.ok(current.view.resources().cosmeticParticles <= 128);
  assert.ok(current.view.resources().settledPieces <= 48);
  assert.equal(current.view.resources().maxBursts, 4);
  current.view.dispose();
  legacy.view.dispose();
});
