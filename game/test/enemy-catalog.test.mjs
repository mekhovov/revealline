import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENEMY_CATALOG,
  ENEMY_THEMES,
  emptyEnemyCatalogDraft,
  validateEnemyCatalogDraft,
  enemyCatalogSelection,
  enemySkinId,
} from '../enemy-catalog.mjs';
import { createEnemyCatalogScenario } from '../enemy-catalog-scenarios.mjs';
import {
  createActorPresentation,
  drawEnemySilhouette,
  drawPresentedActor,
} from '../ui/actor-presentation.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  classicView,
  drawClassicPickups,
  drawClassicStatus,
  drawLineImpacts,
  PICKUP_COLORS,
  pickupDiameter,
} from '../ui/classic-view.mjs';
import { presentationEvent, drawEventFeedback, drawRecoveryCue } from '../ui/event-feedback.mjs';
import { BoardPainter } from '../ui/render.mjs';

const { themes } = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url)));
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const canvas = () => {
  const calls = [],
    values = {},
    stack = [];
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: 600 } },
    {
      get: (obj, key) =>
        key in obj
          ? obj[key]
          : key in values
            ? values[key]
            : (...args) => {
                calls.push({ op: key, args, ...values });
                if (key === 'save') stack.push({ ...values });
                if (key === 'restore') Object.assign(values, stack.pop());
              },
      set: (_, key, value) => {
        values[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
};

test('catalog data is owned, strict and separate from run authority; selection never filters live actors', () => {
  const input = structuredClone(emptyEnemyCatalogDraft());
  input.entries[0].enabled = false;
  const selection = enemyCatalogSelection(input),
    run = createRun(createEnemyCatalogScenario('bouncer', emptyEnemyCatalogDraft(), themes).level),
    before = authoritativeCheckpoint(run);
  assert.equal(selection.allowedTypes.includes('bouncer'), false);
  assert.equal(run.enemies[0].type, 'bouncer');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.throws(() => createEnemyCatalogScenario('bouncer', input, themes), /Enable/);
  input.entries[1].skinId = enemySkinId('bouncer', 'fpv');
  assert.throws(() => validateEnemyCatalogDraft(input));
  const bad = structuredClone(emptyEnemyCatalogDraft());
  let reads = 0;
  Object.defineProperty(bad.entries[0], 'enabled', {
    get() {
      reads++;
      return true;
    },
  });
  assert.throws(() => validateEnemyCatalogDraft(bad));
  assert.equal(reads, 0);
  assert.throws(() => validateEnemyCatalogDraft({ ...emptyEnemyCatalogDraft(), enemies: [] }));
  assert.ok(Object.isFrozen(selection.actorSkins));
});
for (const themeId of ENEMY_THEMES)
  test(`${themeId}: seven role body geometries differ before badges, with the same colors`, () => {
    const signatures = ENEMY_CATALOG.map(({ type }) => {
      const f = createActorPresentation()
          .sample([{ id: 'a', type, x: 4, y: 4, vx: 1, vy: 0 }], { themeId, reduced: true })
          .get('a'),
        { ctx, calls } = canvas();
      drawEnemySilhouette(ctx, f, { body: '#aaa', trim: '#aaa', light: '#aaa', dark: '#000' });
      return JSON.stringify(calls.map(({ op, args }) => [op, args]));
    });
    assert.equal(new Set(signatures).size, 7);
  });
for (const themeId of ENEMY_THEMES)
  test(`${themeId}: all seven catalog practice routes validate and execute ordinary inputs`, () => {
    for (const { type } of ENEMY_CATALOG) {
      const scenario = createEnemyCatalogScenario(type, emptyEnemyCatalogDraft(themeId), themes),
        run = createRun(scenario.level, { classId: 'scout' });
      assert.equal(scenario.theme.id, themeId);
      for (let i = 0; i < 40; i++) stepRun(run, { direction: 'right' }, FIXED_DT);
      assert.ok(run.tick > 0);
      assert.ok(run.classic.powerups[0].collectedTick !== null);
    }
  });
test('selected procedural skins alter body family, while a custom role image and collision radius remain independent', () => {
  const f = createActorPresentation()
    .sample([{ id: 'a', type: 'contour-patrol', x: 4, y: 4, radius: 0.2 }], {
      actorSkins: { 'contour-patrol': enemySkinId('contour-patrol', 'coupa') },
    })
    .get('a');
  assert.equal(f.themeId, 'coupa');
  const { ctx, calls } = canvas(),
    image = { id: 'owned-contour' };
  drawPresentedActor(ctx, f, themes[0].palette, image);
  assert.equal(calls.filter((c) => c.op === 'drawImage').length, 1);
  assert.equal(calls.find((c) => c.op === 'drawImage').args[0], image);
  assert.ok(calls.some((c) => c.op === 'arc' && c.args[2] === 3.2));
});
test('four pixel pickup glyphs keep dark plates and original type badges in inverted and ordinary palettes', () => {
  const kinds = Object.keys(PICKUP_COLORS),
    view = { powerups: kinds.map((kind, i) => ({ kind, x: i + 2.5, y: 2.5 })), erosion: [] };
  for (const palette of [
    themes[0].palette,
    { ...themes[0].palette, ink: '#ffffff', paper: '#000000' },
  ]) {
    const { ctx, calls } = canvas();
    drawClassicPickups(
      ctx,
      view,
      palette,
      { freezePickup: { id: 'custom' } },
      { screenScale: 306 / 1152, canvasCSSWidth: 306 },
    );
    assert.equal(
      calls.filter(
        (c) =>
          c.op === 'fillRect' && c.args.join() === '-12,-12,24,24' && c.fillStyle === '#0c1423',
      ).length,
      4,
    );
    assert.equal(calls.filter((c) => c.op === 'drawImage').length, 1);
    for (const color of Object.values(PICKUP_COLORS))
      assert.ok(calls.some((c) => c.op === 'fillRect' && c.fillStyle === color));
  }
  for (const width of [306, 600, 1152])
    assert.ok(
      (pickupDiameter({ screenScale: width / 1152, canvasCSSWidth: width }) * width) / 1152 >=
        (width < 480 ? 14 : 18) - 1e-9,
    );
});
test('contact pickups copy positions before collection disappears; current timers read fixed ticks', () => {
  const run = createRun(
      createEnemyCatalogScenario('bouncer', emptyEnemyCatalogDraft(), themes).level,
    ),
    all = [];
  for (let i = 0; i < 130; i++) {
    stepRun(run, { direction: 'right' }, FIXED_DT);
    all.push(...run.events.map((e) => presentationEvent(e, run)).filter(Boolean));
  }
  const pickup = all.find((e) => e.type === 'powerup.collected');
  assert.deepEqual([pickup.x, pickup.y], [8.5, 0.5]);
  assert.equal(
    classicView(run).powerups.some((p) => p.x === 8.5),
    false,
  );
  const before = authoritativeCheckpoint(run),
    view = classicView(run),
    { ctx, calls } = canvas();
  drawClassicStatus(ctx, view, themes[0].palette, { screenScale: 306 / 1152, canvasCSSWidth: 306 });
  assert.ok(calls.some((c) => c.op === 'fillText' && /SPEED.*s/.test(c.args[0])));
  assert.deepEqual(authoritativeCheckpoint(run), before);
});
test('failure feedback stays at the failed tick, never later respawn; reduced effects still explain loss and recovery', () => {
  const run = createRun(
      createEnemyCatalogScenario('bouncer', emptyEnemyCatalogDraft(), themes).level,
    ),
    event = { type: 'player.failed', tick: run.tick };
  const f = presentationEvent(event, run);
  run.player.x = 70;
  assert.equal(f.x, 6.5);
  assert.equal(presentationEvent({ ...event, tick: 9 }, run).x, undefined);
  const shapes = [];
  for (const themeId of ENEMY_THEMES) {
    const { ctx, calls } = canvas();
    drawEventFeedback(ctx, f, themes[0].palette, { themeId, reduced: true });
    shapes.push(JSON.stringify(calls.filter((c) => c.op === 'fillRect').map((c) => c.args)));
    if (themeId === 'fpv')
      assert.equal(
        calls.filter((c) => c.op === 'strokeRect').length,
        0,
        'FPV debris uses solid rotor fragments without corner frames',
      );
    assert.ok(
      calls.some(
        (c) =>
          c.op === 'fillText' &&
          c.args[0] ===
            `${themeId === 'fpv' ? 'CRAFT LOST' : themeId === 'coupa' ? 'LINK LOST' : 'LIFE LOST'} · -1 LIFE`,
      ),
    );
  }
  assert.equal(new Set(shapes).size, 4);
  const { ctx, calls } = canvas();
  drawRecoveryCue(ctx, { status: 'respawning', respawnAt: 3, time: 2.6 }, themes[0].palette);
  assert.ok(calls.some((c) => c.op === 'fillText' && c.args[0] === 'RECOVERY 0.4s'));
});
test('real line strike projects authoritative front positions unchanged under repeated pause/reduced painting', () => {
  const level = createEnemyCatalogScenario('bouncer', emptyEnemyCatalogDraft(), themes).level;
  level.spawn = { x: 36.5, y: 0.5 };
  level.goal.coverage = 0.99;
  level.enemies = [{ id: 'seed', type: 'bouncer', x: 40.5, y: 5.5, vx: -2, vy: 0 }];
  level.rules = {
    moveSpeed: 10,
    lives: 3,
    graceSeconds: 0,
    respawnSeconds: 0.1,
    stopOnCapture: true,
  };
  level.classic.powerups = [];
  level.classic.lineImpact = { version: 'line-impact.v1', speed: 24 };
  const run = createRun(level);
  for (let i = 0; i < 204; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.classic.lineImpact.fronts.length, 2);
  const view = classicView(run),
    before = authoritativeCheckpoint(run),
    { ctx, calls } = canvas();
  for (let i = 0; i < 3; i++) drawLineImpacts(ctx, view, { screenScale: 306 / 1152 });
  for (const front of run.classic.lineImpact.fronts)
    assert.equal(
      calls.filter(
        (c) => c.op === 'translate' && c.args[0] === front.x * 16 && c.args[1] === front.y * 16,
      ).length,
      3,
    );
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.ok(Object.isFrozen(view.lineImpacts[0]));
  for (let i = 0; i < 100; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(classicView(run).lineImpacts.length, 0);
});
test('painter event feedback is bounded and frozen by pause; rendering cannot change authority', () => {
  const run = createRun(
      createEnemyCatalogScenario('bouncer', emptyEnemyCatalogDraft(), themes).level,
    ),
    p = new BoardPainter(presets),
    { ctx } = canvas();
  p.theme = themes[0];
  p.body = presets.characters['neutral-marker'];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 384, height: 288 };
  p.effectsFor(
    Array.from({ length: 50 }, () => ({
      type: 'powerup.collected',
      kind: 'extra-life',
      id: 'pickup-0',
      tick: 0,
    })),
    run,
  );
  assert.equal(p.effects.length, 8);
  const before = authoritativeCheckpoint(run);
  p.draw(ctx, run, 0.1, { paused: true, reduced: true });
  assert.ok(p.effects.every((e) => e.age === 0));
  p.draw(ctx, run, 0.1, { paused: false, reduced: true });
  assert.ok(p.effects.every((e) => e.age === 0.1));
  assert.deepEqual(authoritativeCheckpoint(run), before);
});
