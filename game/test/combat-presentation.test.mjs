import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCombatPresentation,
  drawCombatPixelBody,
  drawCombatWarnings,
  drawCombatProjectiles,
  drawCombatScrap,
} from '../ui/combat-presentation.mjs';
import { sharedEnemyArtwork, runtimeActorArtRevision } from '../hunt/preferences.mjs';
import { PRESENTATION_INK, PRESENTATION_PLATE } from '../ui/actor-presentation.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { combatLevel, ticks } from './helpers/combat-fixture.mjs';

function surface() {
  const calls = [],
    state = { globalAlpha: 0.4, imageSmoothingEnabled: true },
    stack = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, name) =>
        name in state
          ? state[name]
          : (...args) => {
              calls.push({ name, args, ...state });
              if (name === 'save') stack.push({ ...state });
              if (name === 'restore') Object.assign(state, stack.pop());
            },
      set: (_, name, value) => {
        state[name] = value;
        return true;
      },
    },
  );
  return { ctx, calls, state };
}
function painter() {
  const images = [];
  const instance = createCombatPresentation({
    createCanvas: () => {
      const s = surface(),
        image = { getContext: () => s.ctx, calls: s.calls };
      images.push(image);
      return image;
    },
  });
  return { ...instance, images };
}
function view() {
  return {
    valid: true,
    tick: 240,
    actorTick: 120,
    status: 'running',
    frozen: false,
    actors: [
      {
        id: 'scout',
        role: 'scout',
        x: 4.5,
        y: 4.5,
        vx: 2,
        vy: 0,
        radius: 0.22,
        phase: 'cooldown',
        warningTicks: 0,
        warningTotal: 0,
        aim: null,
        rayEnd: null,
      },
      {
        id: 'sentry',
        role: 'sentry',
        x: 8.5,
        y: 4.5,
        vx: 0,
        vy: 0,
        radius: 0.22,
        phase: 'warning',
        warningTicks: 90,
        warningTotal: 180,
        aim: { x: 12.5, y: 4.5 },
        rayEnd: { x: 30, y: 4.5 },
      },
    ],
    projectiles: [{ id: 'shot', actorId: 'sentry', x: 9.5, y: 4.5, vx: 8, vy: 0, radius: 0.1 }],
    eliminations: [{ id: 'removed', x: 20.5, y: 10.5, tick: 230, cause: 'ram' }],
  };
}
const palette = { accent: '#76d8ce', danger: '#ffae67' };
const fills = (s) => s.calls.filter((c) => c.name === 'fillRect');

test('native pixel roles/poses differ without colour and all mask rectangles use bounded integer coordinates', () => {
  const signatures = new Set();
  for (const role of ['scout', 'sentry'])
    for (const pose of [0, 1, 2]) {
      const s = surface();
      drawCombatPixelBody(
        s.ctx,
        { role, pose },
        { accent: PRESENTATION_INK, danger: PRESENTATION_INK },
      );
      for (const {
        args: [x, y, w, h],
      } of fills(s)) {
        assert([x, y, w, h].every(Number.isInteger));
        assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 16 && y + h <= 16);
      }
      signatures.add(JSON.stringify(fills(s).map((c) => c.args)));
    }
  assert.equal(signatures.size, 6);
  assert.throws(() => drawCombatPixelBody(surface().ctx, { role: 'keeper' }));
  assert.throws(() => drawCombatPixelBody(surface().ctx, { role: 'scout', pose: 9 }));
});

test('absent, disabled and explicitly invalid projections have no canvas or cache effects', () => {
  const p = painter(),
    s = surface();
  for (const value of [null, undefined, { valid: false, error: 'invalid' }]) {
    assert.equal(p.drawActors(s.ctx, value, palette), false);
    for (const draw of [drawCombatWarnings, drawCombatProjectiles, drawCombatScrap])
      assert.equal(draw(s.ctx, value, palette), false);
  }
  assert.equal(s.calls.length, 0);
  assert.equal(p.images.length, 0);
});

test('successor ordinary prey rotates once outside its north-facing sprite in every direction', () => {
  for (const [heading, facingRadians] of [
    ['up', 0],
    ['right', Math.PI / 2],
    ['down', Math.PI],
    ['left', -Math.PI / 2],
    ['right', Math.PI / 4],
  ]) {
    const p = painter(),
      s = surface(),
      v = view();
    v.actors = [
      {
        ...v.actors[0],
        kind: 'runner',
        facingRadians,
        pursuit: { behavior: 'courier', heading, nextHeading: null, phase: 'committed' },
      },
    ];
    const before = structuredClone(v);
    p.drawActors(s.ctx, v, palette, { reduced: true });
    assert.equal(p.images[0].calls.find(({ name }) => name === 'rotate').args[0], 0);
    assert.deepEqual(
      s.calls.filter(({ name }) => name === 'rotate').map(({ args }) => args[0]),
      [facingRadians],
    );
    assert.equal(s.calls.find(({ name }) => name === 'arc').args[2], v.actors[0].radius * 16);
    assert.deepEqual(v, before);
  }
});

test('specialists retain their current armored heading without an outer or pending-turn rotation', () => {
  for (const behavior of ['shield', 'brace']) {
    const p = painter(),
      s = surface(),
      v = view();
    v.actors = [
      {
        ...v.actors[0],
        kind: 'runner',
        facingRadians: -Math.PI / 2,
        pursuit: { behavior, heading: 'left', nextHeading: 'right', phase: 'warning' },
      },
    ];
    const before = structuredClone(v);
    p.drawActors(s.ctx, v, palette, { reduced: true });
    assert.equal(p.images[0].calls.find(({ name }) => name === 'rotate').args[0], -Math.PI / 2);
    assert.equal(s.calls.filter(({ name }) => name === 'rotate').length, 0);
    assert.deepEqual(v, before);
  }
});

test('Capture ordinary warning arrows retain world intent through cached-body rotation and reduced effects', () => {
  const headings = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  for (const behavior of ['refuge', 'switchback', 'sprinter']) {
    const p = painter(),
      s = surface(),
      v = view();
    for (const [heading, facingRadians] of Object.entries(headings)) {
      v.actors = [
        {
          ...view().actors[0],
          kind: 'runner',
          vx: 0,
          vy: 0,
          facingRadians,
          pursuit: { behavior, heading, nextHeading: 'right', phase: 'warning' },
        },
      ];
      const before = structuredClone(v);
      p.drawActors(s.ctx, v, palette, { reduced: true });
      const image = s.calls.filter(({ name }) => name === 'drawImage').at(-1).args[0],
        turns = image.calls.filter(({ name }) => name === 'rotate').map(({ args }) => args[0]);
      assert.equal(turns[0], 0, 'Cached body remains north-facing');
      assert.equal(turns[1] + facingRadians, Math.PI / 2, 'Warning arrow announces world east');
      const cached = image;
      p.drawActors(s.ctx, v, palette, { reduced: true });
      assert.strictEqual(s.calls.filter(({ name }) => name === 'drawImage').at(-1).args[0], cached);
      assert.deepEqual(v, before);
    }
    assert.equal(p.images.length, 4, 'Relative intent angle is part of the sprite cache identity');
  }
});

test('industrial compact Capture gait advances through stride poses and freezes for reduced effects', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    for (const revision of ['industrial-pilot-v1', 'industrial-overhead-v2']) {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: { href: `https://example.test/game/?artReview=${revision}` },
      });
      const p = painter(),
        s = surface(),
        v = view(),
        signatures = new Set();
      v.actors = [{ ...v.actors[0], kind: 'runner', facingRadians: Math.PI / 2 }];
      const before = structuredClone(v.actors);
      for (const tick of [0, 20, 40, 60, 80, 100]) {
        v.actorTick = tick;
        p.drawActors(s.ctx, v, palette);
        const image = s.calls.filter(({ name }) => name === 'drawImage').at(-1).args[0];
        signatures.add(
          JSON.stringify(
            image.calls.filter(({ name }) => name === 'fillRect').map(({ args }) => args),
          ),
        );
      }
      assert.ok(signatures.size >= 3, `${revision} must show alternating compact footsteps.`);
      p.drawActors(s.ctx, v, palette, { reduced: true });
      const frozen = s.calls.filter(({ name }) => name === 'drawImage').at(-1).args[0];
      v.actorTick += 100;
      p.drawActors(s.ctx, v, palette, { reduced: true });
      assert.strictEqual(s.calls.filter(({ name }) => name === 'drawImage').at(-1).args[0], frozen);
      assert.deepEqual(v.actors, before);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else delete globalThis.location;
  }
});

for (const width of [200, 240, 294, 390, 600, 1152])
  test(`pixel body size, accurate footprint and opaque mandatory cues at ${width}px`, () => {
    const s = surface(),
      p = painter(),
      v = view(),
      scale = width / 1152;
    const snapshot = structuredClone(v);
    p.drawActors(s.ctx, v, palette, { screenScale: scale, canvasCSSWidth: width });
    const bodies = s.calls.filter((c) => c.name === 'drawImage');
    assert.equal(bodies.length, 2);
    for (const c of bodies) {
      assert(c.args[3] * scale >= (width >= 480 ? 24 : 16) - 1e-9);
      assert(c.args[3] * scale <= 32 + 1e-9);
      assert.equal(c.imageSmoothingEnabled, false);
      assert.equal(c.globalAlpha, 1);
    }
    for (const c of s.calls.filter((c) => c.name === 'arc')) assert.equal(c.args[2], 0.22 * 16);
    assert.deepEqual(v, snapshot);
    assert.equal(s.state.globalAlpha, 0.4);
    assert.equal(s.state.imageSmoothingEnabled, true);
  });

test('pixel cache is bounded by six role/pose frames and replaced on a palette change; repeat frames do not advance poses', () => {
  const p = painter(),
    v = view(),
    s = surface();
  v.actors[1].phase = 'cooldown';
  v.actors[1].vx = 2;
  for (const tick of [0, 24, 48, 72, 96]) {
    v.actorTick = tick;
    p.drawActors(s.ctx, v, palette);
  }
  assert.equal(p.images.length, 4);
  p.drawActors(s.ctx, v, palette, { reduced: true });
  assert.equal(p.images.length, 6);
  const frames = p.images.length;
  for (let i = 0; i < 20; i++) p.drawActors(s.ctx, v, palette, { reduced: true });
  assert.equal(p.images.length, frames);
  const original = s.calls.filter((c) => c.name === 'drawImage').at(-1).args[0];
  p.drawActors(s.ctx, v, { ...palette, accent: '#123456' });
  assert.equal(p.images.length, 8);
  p.drawActors(s.ctx, v, palette, { reduced: true });
  assert.notEqual(s.calls.filter((c) => c.name === 'drawImage').at(-1).args[0], original);
  p.reset();
  p.drawActors(s.ctx, v, palette);
  assert.equal(p.images.length, 12);
});

test('freeze/reduced effects and stationary phases use static bodies without deleting warning or projectile cues', () => {
  for (const options of [{ reduced: true }, {}]) {
    const p = painter(),
      s = surface(),
      v = view();
    if (!options.reduced) v.frozen = true;
    p.drawActors(s.ctx, v, palette, options);
    const first = s.calls.filter((c) => c.name === 'drawImage').map((c) => c.args[0]);
    v.actorTick += 24;
    p.drawActors(s.ctx, v, palette, options);
    assert.deepEqual(
      s.calls
        .filter((c) => c.name === 'drawImage')
        .slice(-2)
        .map((c) => c.args[0]),
      first,
    );
    assert(drawCombatWarnings(s.ctx, v, palette, options));
    assert(drawCombatProjectiles(s.ctx, v, palette, options));
    assert(s.calls.some((c) => c.name === 'setLineDash' && c.args[0].length === 2));
    assert(s.calls.some((c) => c.name === 'closePath'));
  }
});

test('warning keeps locked cross, ray beyond the aim and static remaining segment in monochrome', () => {
  const s = surface(),
    v = view();
  drawCombatWarnings(
    s.ctx,
    v,
    { accent: PRESENTATION_INK, danger: PRESENTATION_INK },
    { reduced: true, screenScale: 0.25 },
  );
  assert(s.calls.some((c) => c.name === 'lineTo' && c.args[0] === 30 * 16));
  assert(s.calls.some((c) => c.name === 'moveTo' && c.args[0] === 12.5 * 16 - 12));
  assert.deepEqual(s.calls.find((c) => c.name === 'setLineDash').args, [[16, 12]]);
  assert(fills(s).some((c) => c.args[2] === 20 && c.args[3] === 8));
  const bar = fills(s).slice(-4);
  assert.equal(
    bar[2].fillStyle,
    PRESENTATION_PLATE,
    'unfilled warning segment stays dark in monochrome',
  );
  assert.equal(bar[3].fillStyle, PRESENTATION_INK);
  assert.equal(bar[3].args[2], bar[2].args[2] / 2);
  assert(s.calls.filter((c) => c.name === 'stroke').every((c) => c.globalAlpha === 1));
});

test('shots keep six-CSS-pixel core and direction tail, including frozen/reduced mode', () => {
  for (const scale of [0.2, 0.5, 1, 2]) {
    const s = surface(),
      v = view();
    v.frozen = true;
    drawCombatProjectiles(s.ctx, v, palette, { screenScale: scale, reduced: true });
    const coreTop = s.calls.filter((c) => c.name === 'moveTo').at(-1);
    assert(Math.abs((v.projectiles[0].y * 16 - coreTop.args[1]) * scale - 3) < 1e-9);
    assert(
      s.calls.some(
        (c) => c.name === 'lineTo' && Math.abs(c.args[0] - (9.5 * 16 - 9 / scale)) < 1e-9,
      ),
    );
    assert(fills(s).length >= 4, 'frozen mark remains visible');
  }
});

test('warning countdown lies outside the complete painted body at every supported size', () => {
  for (const width of [200, 294, 1152])
    for (const sizeScale of [0.75, 1, 1.5]) {
      const s = surface(),
        p = painter(),
        v = view();
      v.actors = [v.actors[1]];
      const options = { screenScale: width / 1152, canvasCSSWidth: width, scale: sizeScale };
      drawCombatWarnings(s.ctx, v, palette, options);
      const barTop = fills(s)[0].args[1];
      p.drawActors(s.ctx, v, palette, options);
      const image = s.calls.find((c) => c.name === 'drawImage').args;
      assert(barTop >= image[2] + image[4] + 2 / options.screenScale - 1e-8);
    }
});

test('scrap persists without authority changes; sparks expire, reduce and stop on terminal frames', () => {
  const v = view(),
    original = structuredClone(v);
  const fresh = surface();
  drawCombatScrap(fresh.ctx, v, palette);
  assert.equal(fills(fresh).length, 11);
  for (const state of [
    { ...v, tick: 260 },
    { ...v, status: 'won' },
    { ...v, status: 'lost' },
  ]) {
    const s = surface();
    drawCombatScrap(s.ctx, state, palette);
    assert.equal(fills(s).length, 3);
  }
  const reduced = surface();
  drawCombatScrap(reduced.ctx, v, palette, { reduced: true });
  assert.equal(fills(reduced).length, 3);
  const hidden = surface();
  drawCombatScrap(hidden.ctx, v, palette, { reduced: true, showScrap: false });
  assert.equal(fills(hidden).length, 0);
  const sparkOnly = surface();
  drawCombatScrap(sparkOnly.ctx, v, palette, { showScrap: false });
  assert.equal(fills(sparkOnly).length, 8);
  assert.deepEqual(v, original);
  const capture = surface();
  drawCombatScrap(
    capture.ctx,
    { ...v, eliminations: [{ ...v.eliminations[0], cause: 'capture' }] },
    palette,
  );
  assert.notDeepEqual(
    fills(capture).map((c) => c.args),
    fills(fresh).map((c) => c.args),
  );
});

test('terminal views hide live threats but retain optional inert scrap', () => {
  for (const status of ['won', 'lost']) {
    const s = surface(),
      p = painter(),
      v = { ...view(), status };
    assert.equal(p.drawActors(s.ctx, v, palette), false);
    assert.equal(drawCombatWarnings(s.ctx, v, palette), false);
    assert.equal(drawCombatProjectiles(s.ctx, v, palette), false);
    assert.equal(s.calls.length, 0);
    assert(drawCombatScrap(s.ctx, v, palette));
    assert.equal(fills(s).length, 3);
  }
});

test('the full completed picture removes combat scrap in normal and reduced-effects views', () => {
  const run = createRun(combatLevel('scout'));
  ticks(run, 846, 'right');
  assert.equal(run.status, 'won');
  assert.equal(
    combatView(run).eliminations.length,
    1,
    'The winning run retains actual combat scrap.',
  );
  const before = authoritativeCheckpoint(run);
  for (const reduced of [false, true]) {
    const board = new BoardPainter({}),
      s = surface();
    board.theme = { id: 'fpv', family: 'fpv', palette: { ...palette, field: '#102831' } };
    board.background = { width: 1152, height: 576 };
    board.startCelebration({ levelId: run.levelId, seed: run.seed, reduced });
    board.skipCelebration();
    board.draw(s.ctx, run, 0.016, { fullReveal: true, reduced, showCombatScrap: true });
    assert.deepEqual(
      fills(s).map((call) => call.args),
      [[0, 0, 1152, 576]],
      'Only the picture backing is filled; inert scrap cannot cover the finished artwork.',
    );
    assert.equal(s.calls.filter((call) => call.name === 'drawImage').length, 1);
    assert.equal(board.celebrationStatus.finished, true);
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
});

test('rendering real warning, shot and removal projections never changes simulation identity or state', () => {
  for (const [role, tick] of [
    ['sentry', 300],
    ['sentry', 380],
    ['scout', 846],
  ]) {
    const run = createRun(combatLevel(role));
    ticks(run, tick, 'right');
    const before = authoritativeCheckpoint(run);
    const v = combatView(run),
      snapshot = structuredClone(v),
      p = painter(),
      s = surface();
    assert.equal(v.valid, true);
    for (const reduced of [true, false])
      for (const showScrap of [true, false]) {
        const options = { reduced, showScrap, screenScale: 0.25, canvasCSSWidth: 288 };
        drawCombatScrap(s.ctx, v, palette, options);
        drawCombatWarnings(s.ctx, v, palette, options);
        p.drawActors(s.ctx, v, palette, options);
        drawCombatProjectiles(s.ctx, v, palette, options);
      }
    assert.deepEqual(v, snapshot);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    for (const { args } of s.calls)
      for (const arg of args.flat()) if (typeof arg === 'number') assert(Number.isFinite(arg));
  }
});

test('maximum presentation populations have bounded drawing work and finite minimum-scale geometry', () => {
  const v = view(),
    p = painter(),
    s = surface();
  v.actors = Array.from({ length: 24 }, (_, i) => ({
    ...v.actors[i < 8 ? 1 : 0],
    id: `actor-${i}`,
  }));
  v.projectiles = Array.from({ length: 8 }, (_, i) => ({ ...v.projectiles[0], id: `shot-${i}` }));
  v.eliminations = Array.from({ length: 24 }, (_, i) => ({
    ...v.eliminations[0],
    id: `mark-${i}`,
  }));
  const options = { screenScale: 0.1, canvasCSSWidth: 115.2 };
  drawCombatScrap(s.ctx, v, palette, options);
  drawCombatWarnings(s.ctx, v, palette, options);
  p.drawActors(s.ctx, v, palette, options);
  drawCombatProjectiles(s.ctx, v, palette, options);
  assert(s.calls.length < 1600);
  assert.equal(s.calls.filter((c) => c.name === 'drawImage').length, 24);
  for (const { args } of s.calls)
    for (const arg of args.flat()) if (typeof arg === 'number') assert(Number.isFinite(arg));
});

test('Capture humanoid artwork accepts first Start, stays frozen and preserves explicit historical null', () => {
  const preference = sharedEnemyArtwork(),
    previous = preference.snapshot().style;
  const board = new BoardPainter({});
  const cached = painter(),
    destination = surface(),
    observed = view();
  board.combatPresentation = cached;
  observed.actors = [{ ...observed.actors[0], kind: 'runner', heading: 'up' }];
  const draw = () => {
    cached.drawActors(destination.ctx, observed, palette);
    return destination.calls.filter(({ name }) => name === 'drawImage').at(-1).args[0];
  };
  try {
    preference.set({ style: 'authored' });
    board.setLevel({}, { artRevision: null });
    const original = draw(),
      pixels = JSON.stringify(original.calls);
    preference.set({ style: 'military' });
    assert.equal(runtimeActorArtRevision(), 'industrial-roster-v3');
    assert.equal(draw(), original, 'setting alone cannot replace the accepted active sprite');
    const preparedLevel = board.levelInfo;
    board.acceptEnemyArtwork();
    assert.equal(board.levelInfo, preparedLevel, 'first Start does not recreate the level');
    assert.equal(board.artRevision, 'industrial-roster-v3');
    assert.notEqual(JSON.stringify(draw().calls), pixels);
    const accepted = draw();
    preference.set({ style: 'authored' });
    assert.equal(draw(), accepted, 'later menu edits wait for a new attempt');
    board.setLevel({});
    assert.equal(JSON.stringify(draw().calls), pixels);
    preference.set({ style: 'military' });
    board.setLevel({}, { artRevision: null });
    assert.equal(board.artRevision, null);
    assert.equal(JSON.stringify(draw().calls), pixels, 'null must not fall through to saved v3');
  } finally {
    preference.set({ style: previous });
    board.dispose();
  }
});
