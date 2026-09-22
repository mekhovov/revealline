import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { classicView, drawClassicEnemy, drawEnemyPressure } from '../ui/classic-view.mjs';
import {
  createActorPresentation,
  drawPresentedActor,
  drawActiveTrail,
  PRESENTATION_INK,
  PRESENTATION_PLATE,
} from '../ui/actor-presentation.mjs';

const pack = JSON.parse(
  readFileSync(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)),
);
const theme = pack.themes[0];
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const actor = { id: 'tank', type: 'bouncer', x: 10.5, y: 10.5, vx: 3, vy: 0, radius: 0.25 };
function surface(width = 294) {
  const calls = [],
    stack = [],
    state = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1 };
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: width } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ op: key, args, ...state });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') Object.assign(state, stack.pop());
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

for (const width of [294, 1152])
  test(`${width}px carrier bolt respects readable body scaling and the unchanged contact radius`, () => {
    const enemy = { ...actor, impactCarrier: true };
    const frame = createActorPresentation()
      .sample([enemy], {
        screenScale: width / 1152,
        canvasCSSWidth: width,
        reduced: true,
      })
      .get(enemy.id);
    const s = surface(width);
    assert.equal(drawClassicEnemy(s.ctx, enemy, theme.palette, {}, frame), true);
    const tip = s.calls.find((c) => c.op === 'moveTo');
    assert.equal(tip.args[1], -Math.max(11, frame.diameter / 2));
    assert.ok((-tip.args[1] * 2 * width) / 1152 >= 11);
    assert.ok(s.calls.some((c) => c.op === 'arc' && c.args[2] === actor.radius * 16));
    assert.equal(
      s.calls.some((c) => c.op === 'drawImage'),
      false,
    );
  });

for (const width of [294, 390, 600, 1152])
  test(`R4 dark palette: ${width}px arena keeps light cut core and bounded readable width`, () => {
    assert.equal(theme.palette.paper, '#0b121b');
    const s = surface(width),
      scale = width / 1152;
    drawActiveTrail(
      s.ctx,
      [{ x1: 4.5, y1: 4.5, x2: 4.5, y2: 7.5 }],
      [],
      { x: 4.5, y: 7.5 },
      theme.palette,
      { screenScale: scale, reduced: true },
    );
    const strokes = s.calls.filter((c) => c.op === 'stroke');
    assert.deepEqual(
      strokes.map((c) => c.strokeStyle),
      [PRESENTATION_PLATE, theme.palette.accent, PRESENTATION_INK],
    );
    assert.ok(strokes[1].lineWidth * scale >= 2.9 && strokes[1].lineWidth * scale <= 3.1);
    assert.ok(strokes[2].lineWidth * scale >= 0.99);
    assert.ok(
      s.calls.some(
        (c) => c.op === 'fillRect' && c.fillStyle === PRESENTATION_INK && c.args[2] * scale >= 2.49,
      ),
    );
    assert.ok(strokes.every((c) => c.globalAlpha === 1));
  });

test('240px larger actor body leaves real contact and active-cut world coordinates unchanged', () => {
  const s = surface(240),
    frame = createActorPresentation()
      .sample([actor], { screenScale: 240 / 1152, canvasCSSWidth: 240 })
      .get(actor.id);
  assert.ok(frame.diameter > 64);
  drawPresentedActor(s.ctx, frame, theme.palette);
  assert.ok(s.calls.some((call) => call.op === 'arc' && call.args[2] === actor.radius * 16));
  const start = s.calls.length;
  drawActiveTrail(
    s.ctx,
    [{ x1: 4.5, y1: 4.5, x2: 4.5, y2: 7.5 }],
    [],
    { x: 4.5, y: 7.5 },
    theme.palette,
    { screenScale: 240 / 1152, reduced: true },
  );
  const trail = s.calls.slice(start);
  assert.deepEqual(
    trail.filter((c) => c.op === 'moveTo').map((c) => c.args),
    [
      [72, 72],
      [72, 72],
      [72, 72],
    ],
  );
  assert.deepEqual(
    trail.filter((c) => c.op === 'lineTo').map((c) => c.args),
    [
      [72, 120],
      [72, 120],
      [72, 120],
    ],
  );
  assert.deepEqual(
    trail.filter((c) => c.op === 'stroke').map((c) => c.lineWidth),
    [20, 12, 4],
  );
  assert.deepEqual(
    trail.filter((c) => c.op === 'stroke').map((c) => c.strokeStyle),
    [PRESENTATION_PLATE, theme.palette.accent, PRESENTATION_INK],
  );
});

for (const themeId of ['fpv', 'ukraine', 'retro', 'coupa'])
  test(`${themeId}: actual observed movement animates microtile bodies; Pause holds the exact pose`, () => {
    const poses = createActorPresentation(),
      options = { themeId, style: 'microtile', dt: 0.1 };
    const first = poses.sample([actor], { ...options, time: 0, tick: 0 }).get(actor.id);
    const moved = poses
      .sample([{ ...actor, x: 11.1 }], { ...options, time: 0.2, tick: 12 })
      .get(actor.id);
    const held = poses
      .sample([{ ...actor, x: 11.1 }], { ...options, time: 0.2, tick: 12, paused: true })
      .get(actor.id);
    function body(frame) {
      const s = surface();
      drawPresentedActor(s.ctx, { ...frame, x: 0, y: 0, tail: [] }, theme.palette);
      return s.calls.filter((c) => c.op === 'fillRect').map((c) => c.args);
    }
    assert.notDeepEqual(
      body(first),
      body(moved),
      'locomotion remains visible in compact treatment',
    );
    assert.deepEqual(body(moved), body(held), 'paused animation uses the retained phase');
    assert.equal(moved.radius, actor.radius * 16);
  });

test('uploaded body remains independent, with light heading/contact cues rather than dark-theme ink inversion', () => {
  const frame = createActorPresentation()
    .sample([actor], { themeId: 'fpv', reduced: true })
    .get(actor.id);
  const s = surface(),
    image = { owned: 'replacement' };
  drawPresentedActor(s.ctx, frame, theme.palette, image);
  assert.deepEqual(
    s.calls.filter((c) => c.op === 'drawImage').map((c) => c.args[0]),
    [image],
  );
  assert.ok(s.calls.some((c) => c.op === 'rotate' && c.args[0] === Math.PI / 2));
  const rings = s.calls.filter((c) => c.op === 'arc');
  assert.equal(rings.length, 1);
  assert.equal(rings[0].args[2], actor.radius * 16);
  assert.ok(s.calls.some((c) => c.op === 'stroke' && c.strokeStyle === PRESENTATION_INK));
});

test('Classic dormant/warning brackets enclose the cosmetic body while contact size stays unchanged', () => {
  const enemy = { ...actor, type: 'claimed-rover', mode: 'dormant' };
  const frame = createActorPresentation()
    .sample([enemy], { screenScale: 294 / 1152, canvasCSSWidth: 294 })
    .get(actor.id);
  const s = surface();
  drawClassicEnemy(s.ctx, enemy, theme.palette, {}, frame);
  const brackets = s.calls.filter((c) => c.op === 'strokeRect');
  assert.ok(brackets.some((c) => c.strokeStyle === PRESENTATION_INK && c.args[2] > frame.diameter));
  assert.ok(s.calls.some((c) => c.op === 'arc' && c.args[2] === actor.radius * 16));
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: real painter places capture pulse below actors/live line and preserves authority`, () => {
    const run = createRun(
      {
        version: 'xonix-level.v3',
        id: 'readability',
        revision: '1',
        name: 'Readability',
        width: 72,
        height: 36,
        encounter: null,
        spawn: { x: 4.5, y: 0.5 },
        walls: [],
        enemies: [actor],
        supplies: [],
        objectives: [],
        goal: { coverage: 0.9 },
      },
      { turnPolicy },
    );
    for (let i = 0; i < 20; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
    const checkpoint = authoritativeCheckpoint(run),
      s = surface(),
      painter = new BoardPainter(presets);
    painter.theme = theme;
    painter.body = presets.characters['neutral-marker'];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    painter.background = { width: 384, height: 288 };
    // The existing top border is a real SAFE cell. This injected cosmetic event
    // tests layering only; it neither simulates nor claims an earned capture.
    painter.effectsFor([{ type: 'cells.claimed', indices: [1] }]);
    painter.draw(s.ctx, run, 0.04);
    const rim = s.calls.findIndex(
      (c) =>
        c.op === 'fillRect' &&
        c.fillStyle === PRESENTATION_INK &&
        c.globalAlpha > 0 &&
        c.globalAlpha <= 0.2 &&
        c.args[0] === 16 &&
        c.args[1] === 0,
    );
    const line = s.calls.findIndex(
      (c) => c.op === 'stroke' && c.strokeStyle === PRESENTATION_INK && c.lineWidth > 3,
    );
    const body = s.calls.findIndex(
      (c) => c.op === 'translate' && c.args[0] === Math.round(run.enemies[0].x * 16),
    );
    assert.ok(rim >= 0 && line > rim && body > rim);
    painter.draw(s.ctx, run, 0.1, { paused: true, reduced: true });
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(painter.effects[0].age, 0.04);
  });

function pressureLevel(freeze = false) {
  return {
    version: 'xonix-level.v4',
    id: 'pressure-presentation',
    revision: '1',
    name: 'Pressure view',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [
      { id: 'hunter', type: 'bouncer', x: 23.5, y: 10.5, vx: 2, vy: 1, radius: 0.25 },
      { id: 'other', type: 'bouncer', x: 60.5, y: 26.5, vx: 0.1, vy: 0, radius: 0.25 },
    ],
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: freeze ? [{ id: 'freeze', kind: 'enemy-freeze', x: 36.5, y: 5.5 }] : [],
      enemyPressure: {
        version: 'enemy-pressure.v1',
        actors: [
          {
            id: 'hunter',
            mode: 'trail-pursuit',
            senseRadius: 20,
            scanTicks: 24,
            warningTicks: 60,
            commitTicks: 120,
            cooldownTicks: 180,
            leadTicks: 0,
          },
        ],
      },
    },
    rules: { moveSpeed: 12, lives: 3, stopOnCapture: true },
  };
}
function advanceUntil(run, predicate, limit = 400) {
  for (let i = 0; i < limit && !predicate(); i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.ok(predicate(), 'ordinary input must reach the observed state');
}
test('real optional pressure warning, commit and cooldown render distinct cues from owned targets', () => {
  const run = createRun(pressureLevel());
  for (const [phase, label] of [
    ['warning', 'AIM'],
    ['committed', 'CHASE'],
    ['cooldown', 'REST'],
  ]) {
    advanceUntil(run, () => run.enemies[0].classic.pressure.phase === phase);
    const before = authoritativeCheckpoint(run),
      view = classicView(run),
      s = surface();
    assert.equal(view.enemies[0].pressure.phase, phase);
    assert.ok(Object.isFrozen(view.enemies[0].pressure));
    drawEnemyPressure(s.ctx, view, theme.palette, { screenScale: 294 / 1152 });
    assert.deepEqual(
      s.calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]),
      [`${label} TRAIL`],
    );
    if (phase === 'warning') {
      const target = run.enemies[0].classic.pressure.target;
      assert.notEqual(view.enemies[0].pressure.target, target);
      assert.ok(
        s.calls.some(
          (c) => c.op === 'lineTo' && c.args[0] === target.x * 16 && c.args[1] === target.y * 16,
        ),
      );
      assert.ok(s.calls.some((c) => c.op === 'setLineDash' && c.args[0].length === 2));
    }
    if (phase === 'cooldown') assert.equal(view.enemies[0].pressure.target, null);
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
});
test('actual classic freeze retains the locked warning target and actor-clock countdown', () => {
  const run = createRun(pressureLevel(true));
  advanceUntil(run, () => classicView(run).enemies[0].frozen);
  const before = classicView(run).enemies[0].pressure;
  assert.equal(before.phase, 'warning');
  for (let i = 0; i < 30; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.deepEqual(classicView(run).enemies[0].pressure, before);
  const s = surface();
  drawEnemyPressure(s.ctx, classicView(run), theme.palette);
  assert.ok(s.calls.some((c) => c.op === 'fillText' && c.args[0] === 'AIM TRAIL'));
});
test('pursuit and interception stay text-distinct even in patrol, without changing authority', () => {
  for (const [mode, tag] of [
    ['trail-pursuit', 'TRAIL'],
    ['head-intercept', 'HEAD'],
  ]) {
    const level = pressureLevel();
    Object.assign(level.classic.enemyPressure.actors[0], {
      mode,
      leadTicks: mode === 'head-intercept' ? 24 : 0,
    });
    const run = createRun(level);
    const before = authoritativeCheckpoint(run),
      s = surface();
    const view = classicView(run);
    assert.equal(view.enemies[0].pressure.mode, mode);
    drawEnemyPressure(s.ctx, view, theme.palette, { screenScale: 240 / 1152 });
    assert.deepEqual(
      s.calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]),
      [tag],
    );
    assert.deepEqual(authoritativeCheckpoint(run), before);
    advanceUntil(run, () => classicView(run).enemies[0].pressure.phase === 'warning');
    const warned = surface();
    drawEnemyPressure(warned.ctx, classicView(run), theme.palette);
    assert(warned.calls.some((c) => c.op === 'fillText' && c.args[0] === `AIM ${tag}`));
  }
});
test('legacy actors acquire no pressure display and malformed getters are not executed', () => {
  const level = pressureLevel();
  delete level.classic.enemyPressure;
  const run = createRun(level),
    s = surface();
  stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(Object.hasOwn(classicView(run).enemies[0], 'pressure'), false);
  drawEnemyPressure(s.ctx, classicView(run), theme.palette);
  assert.deepEqual(s.calls, []);
  const malformed = createRun(pressureLevel());
  let reads = 0;
  Object.defineProperty(malformed.enemies[0].classic.pressure, 'target', {
    get() {
      reads++;
      return null;
    },
  });
  assert.equal(classicView(malformed), null);
  assert.equal(reads, 0);
});
