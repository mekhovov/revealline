import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { rotorAnchors } from '../../authoring/motion-lab/animation.mjs';
import {
  createActorPresentation,
  actorDiameter,
  actorRole,
  drawPresentedActor,
  drawActiveTrail,
  drawCapturePulse,
} from '../ui/actor-presentation.mjs';

const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const actor = { id: 'patrol', type: 'bouncer', x: 4.5, y: 4.5, vx: 0, vy: 0, radius: 0.2 };
function surface(width = 1152, clientWidth = 1152) {
  const calls = [],
    values = { fillStyle: '', strokeStyle: '', globalAlpha: 1 },
    stack = [];
  const ctx = new Proxy(
    { canvas: { width, height: 576, clientWidth } },
    {
      get(o, k) {
        if (k in o) return o[k];
        if (k in values) return values[k];
        return (...args) => {
          calls.push({ op: k, args, ...values });
          if (k === 'save') stack.push({ ...values });
          if (k === 'restore') Object.assign(values, stack.pop());
        };
      },
      set(_o, k, v) {
        values[k] = v;
        return true;
      },
    },
  );
  return { ctx, calls };
}
function frame(themeId = 'fpv', style = 'hybrid', type = 'bouncer') {
  return createActorPresentation()
    .sample([{ ...actor, type, vx: 4 }], { themeId, style, dt: 0.08 })
    .get(actor.id);
}

test('facing uses newly observed tick positions instead of a stale velocity field', () => {
  const poses = createActorPresentation();
  poses.sample([actor], { tick: 0, time: 0 });
  const next = { ...actor, x: 4.8, vx: 0, vy: -4 };
  const f = poses.sample([next], { tick: 1, time: 0.1, dt: 0.1, reduced: true }).get(actor.id);
  assert.equal(f.heading, Math.PI / 2);
  assert.ok(Math.abs(f.speed - 3) < 1e-9);
  assert.equal(next.vy, -4);
  assert.equal(next.x, 4.8);
});
test('contour and outer patrols face their measured path without velocity fields', () => {
  for (const type of ['contour-patrol', 'border-patrol']) {
    const poses = createActorPresentation();
    poses.sample([{ ...actor, type }], { tick: 0, time: 0 });
    const f = poses
      .sample([{ ...actor, type, y: 5 }], { tick: 1, time: 0.1, dt: 0.1, reduced: true })
      .get(actor.id);
    assert.equal(f.heading, Math.PI);
    assert.equal(f.role, type === 'contour-patrol' ? 'contour' : 'patrol');
  }
});
test('pause and classic freeze retain heading, banking and animation clocks', () => {
  for (const options of [
    { paused: true },
    { classic: { enemies: [{ id: actor.id, frozen: true }] } },
  ]) {
    const poses = createActorPresentation();
    poses.sample([actor], { tick: 0, time: 0 });
    const moved = { ...actor, x: 4.8 };
    const before = poses.sample([moved], { tick: 1, time: 0.1, dt: 0.02 }).get(actor.id);
    const held = poses.sample([moved], { tick: 2, time: 0.2, dt: 0.1, ...options }).get(actor.id);
    for (const field of ['heading', 'bank', 'phase', 'travelPhase'])
      assert.equal(held[field], before[field], field);
    assert.deepEqual(held.tail, before.tail);
    assert.equal(held.speed, 0);
  }
});
test('stun and dormancy stop active motion; reduced effects keep direction but no moving accents', () => {
  const poses = createActorPresentation();
  const first = poses.sample([actor], { dt: 0.1 }).get(actor.id);
  const stunned = poses.sample([{ ...actor, stunnedUntil: 2 }], { time: 1, dt: 0.1 }).get(actor.id);
  assert.equal(stunned.phase, first.phase);
  assert.equal(stunned.stunned, true);
  const dormant = poses
    .sample([actor], { dt: 0.1, classic: { enemies: [{ id: actor.id, mode: 'dormant' }] } })
    .get(actor.id);
  assert.equal(dormant.phase, first.phase);
  assert.equal(dormant.dormant, true);
  const reduced = poses
    .sample([{ ...actor, x: 5 }], { tick: 3, time: 3, dt: 0.1, reduced: true })
    .get(actor.id);
  assert.equal(reduced.phase, first.phase);
  assert.equal(reduced.bank, 0);
  assert.deepEqual(reduced.tail, []);
  assert.equal(reduced.heading, Math.PI / 2);
});
test('stationary tread/walking phase stays still while idle rotor/antenna clock can continue', () => {
  const poses = createActorPresentation();
  const a = poses.sample([actor], { tick: 0, time: 0, dt: 0.1 }).get(actor.id);
  const b = poses.sample([actor], { tick: 1, time: 0.1, dt: 0.1 }).get(actor.id);
  assert.equal(b.travelPhase, a.travelPhase);
  assert.ok(b.phase > a.phase);
  const c = poses.sample([{ ...actor, x: 5 }], { tick: 2, time: 0.2, dt: 0.1 }).get(actor.id);
  assert.ok(c.travelPhase > b.travelPhase);
});
test('cosmetic size targets desktop/phone readability without altering contact radius', () => {
  for (const css of [320, 390, 600, 1152]) {
    const scale = css / 1152,
      diameter = actorDiameter({ screenScale: scale, canvasCSSWidth: css });
    assert.ok(diameter * scale >= (css >= 480 ? 24 : 16) - 1e-9);
    assert.ok(diameter * scale <= 32 + 1e-9);
  }
  const small = createActorPresentation()
    .sample([actor], { screenScale: 0.3, canvasCSSWidth: 345 })
    .get(actor.id);
  assert.equal(small.radius, actor.radius * 16);
  assert.ok(small.diameter > 30);
  assert.ok(actorDiameter({ screenScale: 0.01, scale: 100 }) <= 64);
});
test('four themes have distinct geometric silhouettes even with identical colors', () => {
  const palette = themes[0].palette,
    signatures = [];
  for (const id of ['fpv', 'ukraine', 'retro', 'coupa']) {
    const { ctx, calls } = surface();
    drawPresentedActor(ctx, frame(id), palette);
    signatures.push(JSON.stringify(calls.filter((c) => c.op === 'fillRect').map((c) => c.args)));
  }
  assert.equal(new Set(signatures).size, 4);
});
test('compact and detailed recipes differ; custom families resolve to the matching visual theme', () => {
  const a = surface(),
    b = surface();
  drawPresentedActor(a.ctx, frame('fpv', 'microtile'), themes[0].palette);
  drawPresentedActor(b.ctx, frame('fpv', 'props'), themes[0].palette);
  assert.ok(
    b.calls.filter((c) => c.op === 'fillRect').length >
      a.calls.filter((c) => c.op === 'fillRect').length,
  );
  const f = createActorPresentation()
    .sample([actor], { themeId: 'custom-atlas', themeFamily: 'atlas' })
    .get(actor.id);
  assert.equal(f.themeId, 'ukraine');
});
test('every actor override keeps its own body slot, facing and unscaled collision cue', () => {
  for (const type of [
    'bouncer',
    'border-patrol',
    'lane-boss',
    'contour-patrol',
    'claimed-rover',
    'eroder',
  ]) {
    const f = frame('fpv', 'hybrid', type),
      image = { role: actorRole(type) },
      { ctx, calls } = surface();
    drawPresentedActor(ctx, f, themes[0].palette, image);
    const draws = calls.filter((c) => c.op === 'drawImage');
    assert.equal(draws.length, 1);
    assert.equal(draws[0].args[0], image);
    assert.ok(calls.some((c) => c.op === 'rotate' && c.args[0] === Math.PI / 2));
    assert.ok(calls.some((c) => c.op === 'arc' && c.args[2] === actor.radius * 16));
  }
});
test('history is bounded and reset removes old headings; published frames cannot mutate history', () => {
  const poses = createActorPresentation();
  let f;
  for (let tick = 0; tick < 40; tick++)
    f = poses
      .sample([{ ...actor, x: 4.5 + tick * 0.1 }], { tick, time: tick / 30, dt: 1 / 30 })
      .get(actor.id);
  assert.ok(f.tail.length <= 3);
  assert.ok(f.tail.every((p) => Math.hypot(p.x - f.x / 16, p.y - f.y / 16) < 1.15));
  assert.throws(() => {
    f.tail[0].x = 999;
  }, TypeError);
  poses.reset();
  assert.equal(poses.sample([actor]).get(actor.id).heading, 0);
  assert.equal(
    poses.sample(Array.from({ length: 200 }, (_, i) => ({ ...actor, id: String(i) }))).size,
    64,
  );
});
test('trail core and head remain visible with reduced effects; animated packet stays on the cut', () => {
  const segments = [{ x1: 4.5, y1: 4.5, x2: 5.5, y2: 4.5 }],
    points = [{ x: 4.5, y: 4.5 }],
    player = { x: 5.5, y: 4.5 };
  const { ctx, calls } = surface();
  drawActiveTrail(ctx, segments, points, player, themes[0].palette, { time: 0.1 });
  const packet = calls.find((c) => c.op === 'fillRect' && c.args[2] === 3 && c.args[3] === 3);
  assert.ok(packet);
  assert.ok(packet.args[0] >= 4.5 * 16 - 1 && packet.args[0] <= 5.5 * 16);
  const reduced = surface();
  drawActiveTrail(reduced.ctx, segments, points, player, themes[0].palette, {
    reduced: true,
    time: 3,
  });
  assert.equal(
    reduced.calls.some((c) => c.op === 'fillRect' && c.args[2] === 3),
    false,
  );
  assert.ok(reduced.calls.some((c) => c.op === 'fillRect' && c.args.join() === '86,70,4,4'));
  assert.ok(reduced.calls.some((c) => c.op === 'fillRect' && c.args.join() === '64,64,16,16'));
});
test('capture pulse touches only newly secured cells and is absent for reduced motion', () => {
  const cells = new Uint8Array(72 * 36);
  cells[73] = 1;
  cells[74] = 0;
  const effect = { age: 0.03, indices: [73, 74, -1, 99999] },
    s = surface();
  drawCapturePulse(s.ctx, effect, 72, cells, themes[0].palette);
  const blocks = s.calls.filter((c) => c.op === 'fillRect');
  assert.equal(blocks.length, 4, 'fill and exposed rim stay inside the one still-safe cell');
  assert.deepEqual(blocks[0].args, [16, 16, 16, 16]);
  assert.ok(blocks.every((block) => block.globalAlpha <= 0.2));
  assert.ok(
    blocks.every(({ args: [x, y, w, h] }) => x >= 16 && y >= 16 && x + w <= 32 && y + h <= 32),
  );
  const reduced = surface();
  drawCapturePulse(reduced.ctx, effect, 72, cells, themes[0].palette, true);
  assert.deepEqual(reduced.calls, []);
});
test('integrated renderer animates observed actors and capture effects without changing replay authority', () => {
  const level = {
    version: 'xonix-level.v3',
    id: 'actor-check',
    revision: '1',
    name: 'Actor check',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 60.5, y: 0.5 },
    enemies: [{ ...actor, vx: 2 }],
    walls: [],
    supplies: [],
    objectives: [],
    goal: { coverage: 0.1 },
  };
  const run = createRun(level),
    p = new BoardPainter(presets),
    s = surface(1152, 600);
  p.theme = themes[0];
  p.body = presets.characters['neutral-marker'];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 384, height: 288 };
  p.draw(s.ctx, run, FIXED_DT);
  stepRun(run, { direction: 'down' }, FIXED_DT);
  const checkpoint = authoritativeCheckpoint(run);
  p.draw(s.ctx, run, FIXED_DT);
  p.draw(s.ctx, run, FIXED_DT, { paused: true });
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  const indices = [73, 74];
  p.effectsFor([{ type: 'cells.claimed', indices }]);
  indices[0] = 999;
  assert.deepEqual(p.effects.at(-1).indices, [73, 74]);
  const age = p.effects.at(-1).age;
  p.draw(s.ctx, run, 0.1, { paused: true });
  assert.equal(p.effects.at(-1).age, age);
});

function playerFixture({ wide = true, css = 600, bodyId = 'fpv-body', image } = {}) {
  const run = createRun({
    version: wide ? 'xonix-level.v3' : 'xonix-level.v1',
    id: 'player-size-check',
    revision: '1',
    name: 'Player size check',
    width: wide ? 72 : 48,
    height: 36,
    ...(wide ? { encounter: null } : {}),
    spawn: { x: 4.5, y: 0.5 },
    enemies: [{ ...actor, vx: 2 }],
    goal: { coverage: 0.8 },
    rules: { playerRadius: 0.25 },
  });
  const p = new BoardPainter(presets),
    s = surface(run.width * 16, css);
  p.theme = themes[0];
  p.body = presets.characters[bodyId];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 384, height: 288 };
  p.image = image ?? { id: 'player-original', naturalWidth: 1280, naturalHeight: 1280 };
  return { p, s, run };
}

for (const wide of [false, true]) {
  test(`${wide ? 'wide' : 'legacy'}: all four player rigs keep a readable bounded size across phone and desktop canvases`, () => {
    for (const bodyId of ['fpv-body', 'ukrainian-bird', 'retro-craft', 'navi-avatar']) {
      for (const css of [320, 390, 600, 1152]) {
        const { p, s, run } = playerFixture({ wide, css, bodyId }),
          checkpoint = authoritativeCheckpoint(run);
        p.draw(s.ctx, run, FIXED_DT, { paused: true });
        const draw = s.calls.find((call) => call.op === 'drawImage' && call.args[0] === p.image),
          span = Math.max(draw.args[3], draw.args[4]) * 16,
          cssSpan = (span * css) / (run.width * 16);
        assert.ok(cssSpan >= (css >= 480 ? 24 : 16) - 1e-9, `${bodyId}, ${css}px: ${cssSpan}`);
        assert.ok(cssSpan <= 32 + 1e-9);
        assert.ok(span <= 64);
        assert.ok(
          s.calls.some(
            (call) =>
              call.op === 'arc' &&
              call.args[0] === run.player.x * 16 &&
              call.args[1] === run.player.y * 16 &&
              call.args[2] === 4,
          ),
          'the core ring uses the configured 0.25-cell radius outside cosmetic scaling',
        );
        assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      }
    }
  });
}

test('custom player art retains its aspect ratio and rotor anchor coordinates independently of enemy slots', () => {
  const image = { id: 'custom-player', naturalWidth: 40, naturalHeight: 80 },
    enemyImage = { id: 'custom-enemy' },
    { p, s, run } = playerFixture({ image });
  p.images.enemy = enemyImage;
  p.draw(s.ctx, run, FIXED_DT);
  const draws = s.calls.filter((call) => call.op === 'drawImage'),
    player = draws.find((call) => call.args[0] === image),
    enemy = draws.find((call) => call.args[0] === enemyImage);
  assert.ok(player && enemy);
  assert.equal(player.args[3] / player.args[4], 0.5);
  for (const anchor of rotorAnchors(p.body)) {
    assert.ok(
      s.calls.some(
        (call) =>
          call.op === 'translate' &&
          Math.abs(call.args[0] - anchor.x * player.args[3]) < 1e-9 &&
          Math.abs(call.args[1] - anchor.y * player.args[4]) < 1e-9,
      ),
    );
  }
  assert.equal(p.image, image);
  assert.equal(p.images.enemy, enemyImage);
});

test('player scale is cosmetic, independent of actor scale, and bounded even on very small canvases', () => {
  const { p, s, run } = playerFixture({ css: 1152 });
  const span = (options) => {
    s.calls.length = 0;
    p.draw(s.ctx, run, 0, { paused: true, ...options });
    const call = s.calls.find((c) => c.op === 'drawImage' && c.args[0] === p.image);
    return Math.max(call.args[3], call.args[4]) * 16;
  };
  const checkpoint = authoritativeCheckpoint(run),
    ordinary = span({});
  assert.equal(span({ actorScale: 0.75 }), ordinary);
  assert.ok(span({ playerScale: 0.75 }) < ordinary);
  assert.ok(span({ playerScale: 1e9 }) <= 32);
  s.ctx.canvas.clientWidth = 160;
  assert.ok(span({ playerScale: 1e9 }) <= 64);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
});

test('the larger player keeps direction response and animated rotors while pause and reduced effects freeze their clocks', () => {
  const { p, s, run } = playerFixture();
  p.draw(s.ctx, run, FIXED_DT);
  const idle = p.animation.phases.propellers,
    idleHeading = p.heading;
  stepRun(run, { direction: 'right' }, FIXED_DT);
  const checkpoint = authoritativeCheckpoint(run);
  p.draw(s.ctx, run, FIXED_DT);
  assert.ok(p.animation.phases.propellers > idle);
  assert.ok(p.heading > idleHeading);
  assert.ok(p.bank > 0);
  const moving = structuredClone(p.animation),
    heading = p.heading;
  p.draw(s.ctx, run, 0.1, { paused: true });
  assert.deepEqual(p.animation, moving);
  assert.equal(p.heading, heading);
  p.draw(s.ctx, run, 0.1, { reduced: true });
  assert.deepEqual(p.animation, moving);
  assert.equal(p.heading, Math.PI / 2);
  assert.equal(p.bank, 0);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
});

test('explicit display width supports detached textures while invalid widths preserve direct-canvas and logical fallbacks', () => {
  const { p, s, run } = playerFixture({ css: 600 });
  const span = (displayCSSWidth) => {
    s.calls.length = 0;
    p.draw(s.ctx, run, 0, { paused: true, displayCSSWidth });
    const call = s.calls.find((c) => c.op === 'drawImage' && c.args[0] === p.image);
    return Math.max(call.args[3], call.args[4]) * 16;
  };
  const direct = span(undefined),
    checkpoint = authoritativeCheckpoint(run);
  for (const invalid of [null, 0, -1, NaN, Infinity, '306']) assert.equal(span(invalid), direct);
  const override = span(306);
  assert.ok(override > direct);
  s.ctx.canvas.clientWidth = 0;
  assert.equal(span(306), override, 'detached texture uses the host-provided display width');
  for (const invalid of [undefined, null, 0, -1, NaN, Infinity, '306'])
    assert.equal(span(invalid), 32, 'unmeasured render targets retain the logical-width fallback');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
});
