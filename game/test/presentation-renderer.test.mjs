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
import {
  actorImagePaintMetrics,
  createActorPresentation,
  drawPresentedActor,
} from '../ui/actor-presentation.mjs';
import { drawClassicTerrain, drawClassicPickups } from '../ui/classic-view.mjs';
import { createEnemyPresentations } from '../enemy-presentations.mjs';
import { createEnemyBodyAssets, createEnemyImagePool } from '../ui/enemy-body-assets.mjs';
import { canvasTextFonts } from '../text-face.mjs';

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

test('compiled player sprites size their visible body and rotor sweep instead of transparent padding', () => {
  const { painter, run, sprites } = fixture(),
    sprite = sprites['player.scout.detailed'];
  sprite.geometry.occupiedBounds = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
  const before = authoritativeCheckpoint(run),
    canvas = surface();
  painter.draw(canvas.ctx, run, 0, { paused: true, reduced: true });
  const draw = draws(canvas.calls, sprite.image)[0],
    expected = actorImagePaintMetrics(32, sprite.geometry),
    visibleWidth = draw.args[3] * (expected.visible.right - expected.visible.left),
    visibleHeight = draw.args[4] * (expected.visible.bottom - expected.visible.top);
  assert.equal(draw.args[3], expected.width / 16);
  assert.equal(draw.args[4], expected.height / 16);
  assert.ok(Math.abs(Math.max(visibleWidth, visibleHeight) * 16 - 32) < 1e-9);
  assert.ok(
    canvas.calls.some(
      (entry) => entry.op === 'arc' && entry.args[2] === run.rules.playerRadius * 16,
    ),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
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

test('compiled enemy bodies skip legacy image loads while explicit skins retain the original body path', () => {
  const { painter, run, sprites } = fixture(),
    original = image('legacy-selected-body'),
    requested = [];
  painter.enemyBodies = {
    update: (frames) => requested.push([...frames].map((frame) => frame.type)),
    current: () => ({ image: original, record: { motion: [] } }),
  };
  run.enemies = [{ id: 'guard', type: 'bouncer', x: 10, y: 10, vx: 1, vy: 1, radius: 0.2 }];
  const before = authoritativeCheckpoint(run),
    published = surface();
  painter.draw(published.ctx, run, 0, { paused: true, reduced: true });
  assert.deepEqual(requested.at(-1), []);
  assert.equal(draws(published.calls, sprites['enemy.bouncer'].image).length, 1);
  assert.equal(draws(published.calls, original).length, 0);
  const selected = surface();
  painter.draw(selected.ctx, run, 0, {
    paused: true,
    reduced: true,
    actorSkins: { bouncer: 'fpv-bouncer-v1' },
  });
  assert.deepEqual(requested.at(-1), ['bouncer']);
  assert.equal(draws(selected.calls, original).length, 1);
  assert.equal(draws(selected.calls, sprites['enemy.bouncer'].image).length, 0);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('current non-FPV worlds retain their original canvas art while the interface can use Field Kit', () => {
  const { painter, run, sprites } = fixture(themes.find((item) => item.id === 'ukraine'));
  const canvas = surface();
  painter.draw(canvas.ctx, run, 0, { paused: true, reduced: true });
  assert.equal(draws(canvas.calls, painter.image).length, 1);
  assert.equal(draws(canvas.calls, sprites['player.scout.detailed'].image).length, 0);
});

test('an explicit prepared FPV actor view changes actors without replacing the authored world', () => {
  const theme = themes.find((item) => item.id === 'ukraine');
  const { painter, run, sprites } = fixture(theme);
  const actorSnapshot = painter.presentation;
  painter.bodyId = theme.player;
  painter.body = presets.characters[painter.bodyId];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  run.enemies = [{ id: 'guard', type: 'bouncer', x: 10, y: 10, vx: 1, vy: 1, radius: 0.2 }];
  run.cells[7 * run.width + 9] = 2;
  const before = authoritativeCheckpoint(run),
    body = structuredClone(painter.body),
    canvas = surface();
  painter.draw(canvas.ctx, run, 0, {
    paused: true,
    reduced: true,
    actorAppearance: { style: 'fpv', snapshot: actorSnapshot },
  });
  assert.equal(draws(canvas.calls, sprites['player.scout.detailed'].image).length, 1);
  assert.equal(draws(canvas.calls, sprites['enemy.bouncer'].image).length, 1);
  assert.equal(draws(canvas.calls, sprites['terrain.wall'].image).length, 0);
  assert.equal(canvas.calls.find((call) => call.op === 'fillRect').fillStyle, theme.palette.field);
  assert.equal(canvas.calls.find((call) => call.op === 'drawImage').args[0], painter.background);
  assert.equal(painter.theme, theme);
  assert.equal(painter.bodyId, theme.player);
  assert.deepEqual(painter.body, body);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('the explicit actor view respects custom player and enemy bodies', () => {
  const { painter, run, sprites } = fixture(themes.find((item) => item.id === 'ukraine'));
  const player = image('custom player'),
    enemy = image('custom enemy'),
    canvas = surface();
  painter.image = player;
  painter.images.enemy = enemy;
  painter.overrides = {
    player: { dataUrl: 'custom player choice' },
    enemy: { dataUrl: 'custom enemy choice' },
  };
  run.enemies = [{ id: 'guard', type: 'bouncer', x: 10, y: 10, vx: 1, vy: 1, radius: 0.2 }];
  painter.draw(canvas.ctx, run, 0, {
    paused: true,
    reduced: true,
    actorAppearance: { style: 'fpv', snapshot: painter.presentation },
  });
  assert.equal(draws(canvas.calls, player).length, 1);
  assert.equal(draws(canvas.calls, enemy).length, 1);
  assert.equal(draws(canvas.calls, sprites['player.scout.detailed'].image).length, 0);
  assert.equal(draws(canvas.calls, sprites['enemy.bouncer'].image).length, 0);
});

test('FPV actor choice maps every active class without rewriting the authored body or class', () => {
  const roles = presets.characterPresentations.sets.find(
    (set) => set.themeId === 'fpv',
  ).classBodies;
  for (const role of Object.keys(roles)) {
    const { painter, run, sprites } = fixture(themes.find((item) => item.id === 'ukraine'));
    painter.bodyId = painter.theme.player;
    painter.body = presets.characters[painter.bodyId];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    run.activeClassId = role;
    for (const treatment of ['compact', 'detailed'])
      sprites[`player.${role}.${treatment}`] = {
        image: image(`${role}-${treatment}`),
        geometry: sprites['player.scout.detailed'].geometry,
      };
    const before = authoritativeCheckpoint(run),
      body = painter.body;
    for (const [displayCSSWidth, treatment] of [
      [1152, 'detailed'],
      [320, 'compact'],
    ]) {
      const canvas = surface();
      painter.draw(canvas.ctx, run, 0, {
        reduced: true,
        paused: true,
        displayCSSWidth,
        actorAppearance: { style: 'fpv', snapshot: painter.presentation },
      });
      assert.equal(draws(canvas.calls, sprites[`player.${role}.${treatment}`].image).length, 1);
      assert.equal(painter.body, body);
      assert.equal(painter.bodyId, painter.theme.player);
      assert.deepEqual(authoritativeCheckpoint(run), before);
    }
  }
});

test('campaign and historical actor paths remain identical; unprepared explicit FPV fails before paint', () => {
  const theme = themes.find((item) => item.id === 'ukraine');
  const historical = fixture(theme),
    campaign = fixture(theme),
    first = surface(),
    second = surface();
  historical.painter.draw(first.ctx, historical.run, 0, { paused: true, reduced: true });
  campaign.painter.draw(second.ctx, campaign.run, 0, {
    paused: true,
    reduced: true,
    actorAppearance: { style: 'campaign', snapshot: null },
  });
  assert.deepEqual(second.calls, first.calls);
  for (const actorAppearance of [
    { style: 'fpv', snapshot: null },
    { style: 'fpv', snapshot: {} },
    { style: 'unknown', snapshot: null },
  ]) {
    const canvas = surface();
    assert.throws(
      () => campaign.painter.draw(canvas.ctx, campaign.run, 0, { actorAppearance }),
      /actor/i,
    );
    assert.equal(canvas.calls.length, 0);
  }
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

test('compiled enemy defaults own their images while explicit original skins and manual uploads keep priority', async () => {
  const { painter, run, sprites } = fixture();
  const model = createEnemyPresentations(read('../content/enemy-presentations.json'));
  const loads = [],
    released = [];
  const originals = new Map(model.entries.map((record) => [record.type, image(record.src)]));
  const pool = createEnemyImagePool({
    load: async (record) => {
      loads.push(record.type);
      return { image: originals.get(record.type), release: () => released.push(record.type) };
    },
  });
  painter.enemyBodies = createEnemyBodyAssets({ pool, catalog: async () => model });
  for (const record of model.entries) {
    const id = `enemy.${record.type}`;
    sprites[id] = { ...sprites['enemy.bouncer'], image: image(id) };
  }
  run.enemies = model.entries.map(({ type }, index) => ({
    id: type,
    type,
    x: 10 + index,
    y: 10,
    vx: 1,
    vy: 0,
    radius: 0.2,
  }));
  const before = authoritativeCheckpoint(run);
  const paint = (extra = {}) => {
    const canvas = surface();
    painter.draw(canvas.ctx, run, 0, { paused: true, reduced: true, ...extra });
    return canvas.calls;
  };
  const defaults = paint();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(loads, [], 'Compiled selected defaults must not also fetch original bodies');
  for (const { type } of model.entries)
    assert.equal(draws(defaults, sprites[`enemy.${type}`].image).length, 1, type);
  const selected = model.entries[0];
  const actorSkins = { [selected.type]: selected.skinId };
  paint({ actorSkins });
  await new Promise((resolve) => setImmediate(resolve));
  const original = paint({ actorSkins });
  assert.deepEqual(loads, [selected.type]);
  assert.equal(draws(original, originals.get(selected.type)).length, 1);
  assert.equal(draws(original, sprites[`enemy.${selected.type}`].image).length, 0);
  const manual = image('manual selected original');
  painter.images.enemy = manual;
  painter.overrides.enemy = { dataUrl: 'existing manual upload' };
  const uploaded = paint({ actorSkins });
  assert.equal(draws(uploaded, manual).length, 1);
  assert.equal(draws(uploaded, originals.get(selected.type)).length, 0);
  assert.deepEqual(released, [selected.type]);
  assert.equal(pool.size(), 0);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  painter.enemyBodies.clear();
});

test('compiled player selection keeps each class body and leaves unknown or other-world bodies unchanged', () => {
  const { painter, run, sprites } = fixture();
  const set = presets.characterPresentations.sets.find((entry) => entry.themeId === 'fpv');
  const before = authoritativeCheckpoint(run);
  for (const [role, bodyId] of Object.entries(set.classBodies)) {
    const slot = `player.${role}.detailed`;
    sprites[slot] = { ...sprites['player.scout.detailed'], image: image(slot) };
    painter.bodyId = bodyId;
    painter.body = presets.characters[bodyId];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    const body = structuredClone(painter.body),
      canvas = surface();
    painter.draw(canvas.ctx, run, 0, { paused: true, reduced: true });
    assert.equal(draws(canvas.calls, sprites[slot].image).length, 1, role);
    assert.deepEqual(painter.body, body, `${role} preserves its original rotor recipe`);
  }
  painter.bodyId = 'unknown-custom-body';
  const custom = surface();
  painter.draw(custom.ctx, run, 0, { paused: true, reduced: true });
  assert.equal(draws(custom.calls, painter.image).length, 1);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('Plain canvas text uses the selected system pair and switching back restores compiled fonts without authority changes', () => {
  const { painter, run } = fixture();
  run.player.queuedDirection = 'right';
  const before = authoritativeCheckpoint(run);
  const plain = surface();
  painter.draw(plain.ctx, run, 0, { paused: true, reduced: true, textFace: 'plain' });
  const fonts = canvasTextFonts('plain', painter.presentation.fonts);
  assert.ok(
    plain.calls.some((entry) => entry.op === 'fillText' && entry.font?.includes(fonts.numeric)),
  );
  assert.equal(
    plain.calls.some(
      (entry) => entry.op === 'fillText' && entry.font?.includes('Compiled Numeric'),
    ),
    false,
  );
  const restored = surface();
  painter.draw(restored.ctx, run, 0, { paused: true, reduced: true });
  assert.ok(
    restored.calls.some(
      (entry) => entry.op === 'fillText' && entry.font?.includes('Compiled Numeric'),
    ),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('cosmetic look status starts before image completion and an obsolete look cannot replace newer feedback', async (t) => {
  const previousImage = globalThis.Image,
    pending = [],
    statuses = [],
    warnings = [];
  globalThis.Image = class {
    constructor() {
      pending.push(this);
    }
    set src(value) {
      this.source = value;
    }
  };
  t.after(() => {
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  });
  const painter = new BoardPainter(presets, {
    onAssetStatus: (s) => statuses.push(s),
    onAsset: (s) => warnings.push(s),
  });
  painter.makeArt = () => ({});
  const theme = themes.find((entry) => entry.id === 'fpv');
  const first = painter.setLook(theme, 'fpv-scout-v1');
  assert.equal(statuses.at(-1).status, 'preparing');
  assert.equal(pending.length, 1);
  const second = painter.setLook(theme, 'fpv-scout-v1');
  pending[1].onload();
  await second;
  assert.equal(statuses.at(-1).status, 'ready');
  const count = statuses.length;
  pending[0].onload();
  await first;
  assert.equal(statuses.length, count);
  assert.equal(painter.image, pending[1]);
  const failed = painter.setLook(theme, 'fpv-scout-v1');
  pending[2].onerror();
  await failed;
  assert.equal(statuses.at(-1).status, 'error');
  assert.match(warnings.at(-1), /artwork is unavailable/);
  const superseded = painter.setLook(theme, 'fpv-scout-v1');
  assert.equal(statuses.at(-1).status, 'preparing');
  await painter.setLook(theme, 'neutral-marker');
  assert.equal(statuses.at(-1).status, 'ready');
  assert.equal(painter.image, null);
  assert.equal(pending.length, 4, 'the procedural body needs no image request');
  const proceduralCount = statuses.length;
  pending[3].onload();
  await superseded;
  assert.equal(statuses.length, proceduralCount, 'obsolete pixels cannot revive their status');
  assert.equal(painter.image, null);
});
