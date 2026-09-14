import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { canvasPresentation } from '../presentation/runtime.mjs';
import { mediaFixture } from './helpers/media-fixtures.mjs';
import { createActorPresentation, drawPresentedActor } from '../ui/actor-presentation.mjs';
import { drawClassicTerrain, drawClassicPickups } from '../ui/classic-view.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const presets = read('../../authoring/motion-lab/presets.json');
const themes = read('../content/themes.json').themes;
const image = (id, width = 32, height = width) => ({ id, width, height });
function surface() {
  const calls = [],
    values = { fillStyle: '', strokeStyle: '', globalAlpha: 1 },
    stack = [];
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: 1152 } },
    {
      get(target, name) {
        if (name in target) return target[name];
        if (name in values) return values[name];
        return (...args) => {
          calls.push({ op: name, args, ...values });
          if (name === 'save') stack.push({ ...values });
          if (name === 'restore') Object.assign(values, stack.pop());
        };
      },
      set(_target, name, value) {
        values[name] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}
function fixture(theme = themes.find((item) => item.id === 'fpv')) {
  const painter = new BoardPainter(presets),
    run = createRun(mediaFixture(true).campaign.levels[0]);
  painter.theme = theme;
  painter.bodyId = 'fpv-scout-v1';
  painter.body = presets.characters[painter.bodyId];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.image = image('source-player');
  painter.background = image('source-background', 768, 576);
  const sprites = {};
  for (const id of [
    'player.scout.compact',
    'player.scout.detailed',
    'enemy.bouncer',
    'enemy.contour-patrol',
    'terrain.wall',
    'pickup.supply',
    'pickup.objective',
  ])
    sprites[id] = {
      image: image(id),
      geometry: {
        frame: { x: 0, y: 0, width: 32, height: 32 },
        pivot: { x: 0.25, y: 0.75 },
        occupiedBounds: null,
        nineSlice: null,
        rotors: [
          { x: 0.5, y: -0.5, radiusScale: 0.75, direction: 1, phaseDegrees: 0, bladeCount: 3 },
        ],
      },
    };
  painter.setPresentation({
    canvas: canvasPresentation(resolvePresentation(createDefaultThemeBundle())),
    fonts: { numeric: '"Compiled Numeric", monospace' },
    image: (slot) => sprites[slot] ?? null,
  });
  return { painter, run, sprites };
}
const draws = (calls, wanted) =>
  calls.filter((call) => call.op === 'drawImage' && call.args[0] === wanted);

test('compiled bodies adopt normalized pivots and bitmap dimensions without changing presets, source art or authority', () => {
  const { painter, run, sprites } = fixture(),
    canvas = surface();
  run.player.queuedDirection = 'right';
  const before = authoritativeCheckpoint(run),
    body = structuredClone(painter.body);
  const backdrop = { image: image('pinned original', 384, 288), fit: 'contain' };
  painter.draw(canvas.ctx, run, 0.01, { paused: true, reduced: true, backdrop });
  const call = draws(canvas.calls, sprites['player.scout.detailed'].image)[0];
  assert.ok(call, 'Desktop uses the detailed body');
  assert.equal(call.args[1], -call.args[3] * 0.25);
  assert.equal(call.args[2], -call.args[4] * 0.75);
  assert.ok(call.args.slice(1).every(Number.isFinite));
  assert.equal(canvas.calls.find((entry) => entry.op === 'drawImage').args[0], backdrop.image);
  assert.equal(painter.background.id, 'source-background');
  assert.equal(painter.image.id, 'source-player');
  assert.deepEqual(painter.body, body);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.ok(
    canvas.calls.some(
      (entry) => entry.op === 'fillText' && entry.font?.includes('Compiled Numeric'),
    ),
  );
  assert.ok(
    canvas.calls.some(
      (entry) => entry.op === 'arc' && entry.args[2] === run.rules.playerRadius * 16,
    ),
    'The visible contact ring retains the simulation radius',
  );
});

test('phone and microtile presentations choose compact art; explicit player and enemy overrides retain priority', () => {
  const { painter, run, sprites } = fixture(),
    compact = surface();
  painter.draw(compact.ctx, run, 0, { paused: true, reduced: true, displayCSSWidth: 320 });
  assert.equal(draws(compact.calls, sprites['player.scout.compact'].image).length, 1);
  const player = image('manual player'),
    enemy = image('manual enemy');
  painter.image = player;
  painter.images.enemy = enemy;
  painter.overrides = {
    player: { dataUrl: 'existing player choice' },
    enemy: { dataUrl: 'existing enemy choice' },
  };
  run.enemies = [{ id: 'test-bouncer', type: 'bouncer', x: 10, y: 10, vx: 1, vy: 1, radius: 0.2 }];
  const manual = surface(),
    before = authoritativeCheckpoint(run);
  painter.draw(manual.ctx, run, 0, { paused: true, reduced: true });
  assert.equal(draws(manual.calls, player).length, 1);
  assert.equal(draws(manual.calls, enemy).length, 1);
  assert.equal(draws(manual.calls, sprites['player.scout.detailed'].image).length, 0);
  assert.equal(draws(manual.calls, sprites['enemy.bouncer'].image).length, 0);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('current non-FPV worlds retain their original canvas art while the interface can use Field Kit', () => {
  const { painter, run, sprites } = fixture(themes.find((item) => item.id === 'ukraine'));
  const canvas = surface();
  painter.draw(canvas.ctx, run, 0, { paused: true, reduced: true });
  assert.equal(draws(canvas.calls, painter.image).length, 1);
  assert.equal(draws(canvas.calls, sprites['player.scout.detailed'].image).length, 0);
});

test('published motion settings scale cosmetic clocks and zero motion keeps functional effect timing', () => {
  for (const scale of [0, 0.5, 1]) {
    const { painter, run } = fixture(),
      canvas = surface();
    const before = authoritativeCheckpoint(run);
    painter.setPresentation({
      ...painter.presentation,
      canvas: { ...painter.presentation.canvas, motionScale: scale },
    });
    painter.effectsFor([{ type: 'player.failed', x: 5, y: 5, tick: run.tick }], run);
    painter.draw(canvas.ctx, run, 0.1);
    assert.equal(painter.time, 0.1 * scale);
    assert.equal(
      painter.effects[0].age,
      0.1,
      'Effect lifetime and recovery flow keep ordinary time',
    );
    if (scale === 0)
      assert.ok(Object.values(painter.animation.phases).every((phase) => phase === 0));
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
});

test('enemy cropped-frame geometry positions the art and rotors while retaining the existing contact marker', () => {
  const canvas = surface(),
    sprite = image('cropped enemy', 32, 16);
  const frame = createActorPresentation()
    .sample([{ id: 'guard', type: 'border-patrol', x: 7, y: 8, vx: 0, vy: 1, radius: 0.2 }], {
      reduced: true,
    })
    .get('guard');
  const geometry = {
    frame: { x: 32, y: 0, width: 32, height: 16 },
    pivot: { x: 0.25, y: 0.75 },
    rotors: [{ x: 0.5, y: -0.5, radiusScale: 1, direction: 1, phaseDegrees: 0, bladeCount: 4 }],
  };
  drawPresentedActor(canvas.ctx, frame, themes[0].palette, sprite, geometry);
  assert.deepEqual(draws(canvas.calls, sprite)[0].args, [
    sprite,
    -frame.diameter * 0.25,
    -frame.diameter * 0.5 * 0.75,
    frame.diameter,
    frame.diameter * 0.5,
  ]);
  assert.ok(
    canvas.calls.some(
      (entry) =>
        entry.op === 'translate' &&
        entry.args[0] === frame.diameter * 0.5 &&
        entry.args[1] === -frame.diameter * 0.25,
    ),
  );
  assert.ok(canvas.calls.some((entry) => entry.op === 'arc' && entry.args[2] === frame.radius));
  const old = surface(),
    explicitNull = surface();
  drawPresentedActor(old.ctx, frame, themes[0].palette, sprite);
  drawPresentedActor(explicitNull.ctx, frame, themes[0].palette, sprite, null);
  assert.deepEqual(old.calls, explicitNull.calls);
});

test('terrain, supplies and objectives honor visual pivots while retaining cell and contact coordinates', () => {
  const { painter, run, sprites } = fixture(),
    canvas = surface(),
    wall = { x: 9, y: 7 },
    supply = { id: 'fixture-pad', x: 15.5, y: 8.5 },
    objective = { id: 'fixture-target', x: 21.5, y: 10.5, captured: false };
  run.cells[wall.y * 72 + wall.x] = 2;
  run.supplies = [supply];
  run.objectives = [objective];
  const before = authoritativeCheckpoint(run);
  painter.draw(canvas.ctx, run, 0, { paused: true, reduced: true });
  assert.ok(
    draws(canvas.calls, sprites['terrain.wall'].image).some(
      (call) =>
        JSON.stringify(call.args.slice(1)) ===
        JSON.stringify([wall.x * 16 + 4, wall.y * 16 - 4, 16, 16]),
    ),
  );
  for (const [slot, object] of [
    ['pickup.supply', supply],
    ['pickup.objective', objective],
  ])
    assert.deepEqual(draws(canvas.calls, sprites[slot].image)[0].args.slice(1), [
      object.x * 16 - 4,
      object.y * 16 - 12,
      16,
      16,
    ]);
  assert.ok(
    canvas.calls.some(
      (call) =>
        call.op === 'translate' &&
        call.args[0] === objective.x * 16 &&
        call.args[1] === objective.y * 16,
    ),
    'Objective contact marker stays at its true center.',
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const legacy = image('manual supply');
  painter.overrides.supply = 'explicit';
  painter.images.supply = legacy;
  const manual = surface();
  painter.draw(manual.ctx, run, 0, { paused: true, reduced: true });
  assert.deepEqual(draws(manual.calls, legacy)[0].args.slice(1), [
    supply.x * 16 - 8,
    supply.y * 16 - 8,
    16,
    16,
  ]);
});

test('classic terrain and contact pickups share pivot placement while their material and contact cues stay fixed', () => {
  const terrain = image('slow tile'),
    pickup = image('life pickup'),
    geometry = { pivot: { x: 0.25, y: 0.75 } },
    images = {
      slowTerrain: terrain,
      lifePickup: pickup,
      presentationSprites: { slowTerrain: geometry, lifePickup: geometry },
    },
    view = {
      terrain: [{ x: 4, y: 6, kind: 'slow' }],
      powerups: [{ x: 9.5, y: 7.5, kind: 'extra-life' }],
      erosion: [],
    },
    before = structuredClone(view),
    canvas = surface();
  drawClassicTerrain(canvas.ctx, view, themes[0].palette, images);
  drawClassicPickups(canvas.ctx, view, themes[0].palette, images);
  assert.deepEqual(draws(canvas.calls, terrain)[0].args.slice(1), [68, 92, 16, 16]);
  assert.deepEqual(draws(canvas.calls, pickup)[0].args.slice(1), [-5.5, -16.5, 22, 22]);
  assert.ok(
    canvas.calls.some(
      (call) => call.op === 'translate' && call.args[0] === 152 && call.args[1] === 120,
    ),
  );
  assert.ok(
    canvas.calls.some(
      (call) =>
        call.op === 'strokeRect' &&
        JSON.stringify(call.args) === JSON.stringify([-11, -11, 22, 22]),
    ),
  );
  assert.deepEqual(view, before);
  const legacy = surface();
  drawClassicTerrain(legacy.ctx, view, themes[0].palette, { slowTerrain: terrain });
  drawClassicPickups(legacy.ctx, view, themes[0].palette, { lifePickup: pickup });
  assert.deepEqual(draws(legacy.calls, terrain)[0].args.slice(1), [64, 96, 16, 16]);
  assert.deepEqual(draws(legacy.calls, pickup)[0].args.slice(1), [-11, -11, 22, 22]);
});
