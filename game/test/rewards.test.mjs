import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCelebration,
  advanceCelebration,
  skipCelebration,
  celebrationFrame,
  CELEBRATION_SECONDS,
} from '../ui/celebration.mjs';
import { sceneDescriptor, paintScene } from '../ui/scene-art.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
const themes = JSON.parse(
  readFileSync(new URL('../content/themes.json', import.meta.url), 'utf8'),
).themes;
const campaign = JSON.parse(
  readFileSync(new URL('../content/campaign.json', import.meta.url), 'utf8'),
);
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url), 'utf8'),
);
function context() {
  const calls = [],
    values = { calls, canvas: { width: 768, height: 576 } };
  return new Proxy(values, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) =>
        calls.push([
          key,
          ...args.map((arg) =>
            typeof arg === 'object' ? { width: arg.width, height: arg.height } : arg,
          ),
        ]);
    },
    set(target, key, value) {
      target[key] = value;
      calls.push(['set', key, value]);
      return true;
    },
  });
}
function fakeCanvasDOM(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => {
        const ctx = context();
        return { width: 0, height: 0, getContext: () => ctx };
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  });
}

test('four worlds choose distinct bounded non-graphic victory presentations', () => {
  const kinds = new Set();
  for (const theme of themes) {
    let state = createCelebration({ theme, levelId: 'one', seed: 4 });
    kinds.add(state.kind);
    for (let i = 0; i < 50; i++) {
      const frame = celebrationFrame(state);
      assert.ok(frame.particles.length <= 80);
      assert.ok(frame.equipment.length <= 3);
      for (const p of frame.particles) {
        assert.ok(p.alpha >= 0 && p.alpha <= 1);
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      }
      state = advanceCelebration(state, 0.1);
    }
    assert.equal(celebrationFrame(state).finished, true);
    assert.deepEqual(celebrationFrame(state).particles, []);
    assert.equal(celebrationFrame(state).reveal, 1);
  }
  assert.equal(kinds.size, 4);
});
test('timeline is independent of frame cadence, and pausing freezes all phases', () => {
  const source = createCelebration({ theme: themes[0], levelId: 'one' }),
    outputs = [];
  for (const fps of [10, 30, 60, 120]) {
    let state = source;
    for (let i = 0; i < fps * 2; i++) state = advanceCelebration(state, 1 / fps);
    outputs.push(state.elapsed);
  }
  for (const time of outputs) assert.ok(Math.abs(time - 2) < 1e-10);
  assert.equal(advanceCelebration(source, 0.1, { paused: true }), source);
  assert.equal(source.elapsed, 0);
  assert.throws(() => advanceCelebration(source, NaN));
});
test('skip and reduced effects immediately leave only the clear completed picture', () => {
  const source = createCelebration({ theme: themes[1] });
  for (const state of [
    skipCelebration(source),
    advanceCelebration(source, 0.1, { reduced: true }),
    createCelebration({ theme: themes[1], reduced: true }),
  ]) {
    const frame = celebrationFrame(state);
    assert.equal(frame.active, false);
    assert.equal(frame.phase, 'picture');
    assert.equal(frame.reveal, 1);
    assert.deepEqual(frame.particles, []);
    assert.deepEqual(frame.equipment, []);
  }
  assert.equal(source.elapsed, 0);
});
test('seeded procedural pictures are deterministic and materially vary across campaign levels', () => {
  for (const theme of themes) {
    const signatures = [];
    for (const level of campaign.levels) {
      const a = context(),
        b = context(),
        descriptor = sceneDescriptor(theme, level, 7);
      paintScene(a, theme, descriptor);
      paintScene(b, theme, descriptor);
      assert.deepEqual(a.calls, b.calls);
      signatures.push(JSON.stringify(a.calls));
    }
    assert.equal(new Set(signatures).size, campaign.levels.length);
  }
});
test('BoardPainter auto-starts one celebration, animates despite terminal game pause, then stays clear', (t) => {
  fakeCanvasDOM(t);
  const painter = new BoardPainter(presets);
  painter.theme = themes[0];
  painter.background = painter.makeArt(themes[0]);
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  const state = createRun(campaign.levels[0]);
  state.status = 'won';
  const before = structuredClone(state),
    ctx = context();
  painter.draw(ctx, state, 0.1, { paused: true, fullReveal: true });
  assert.equal(painter.celebrationStatus.active, true);
  const age = painter.celebrationStatus.elapsed;
  painter.draw(ctx, state, 0.1, { paused: true, fullReveal: true, celebrationPaused: true });
  assert.equal(painter.celebrationStatus.elapsed, age);
  for (let i = 0; i < 50; i++) painter.draw(ctx, state, 0.1, { paused: true, fullReveal: true });
  assert.equal(painter.celebrationStatus.phase, 'picture');
  assert.equal(painter.celebrationStatus.elapsed, CELEBRATION_SECONDS);
  painter.draw(ctx, state, 0.1, { paused: true, fullReveal: true });
  assert.equal(painter.celebrationStatus.elapsed, CELEBRATION_SECONDS);
  assert.deepEqual(structuredClone(state), before);
});
test('full reveal hides all permanent walls and actors at completion, including reduced mode', (t) => {
  fakeCanvasDOM(t);
  const painter = new BoardPainter(presets);
  painter.theme = themes[0];
  painter.background = painter.makeArt(themes[0]);
  const state = createRun(campaign.levels.find((l) => l.walls.length));
  state.status = 'won';
  const ctx = context();
  painter.draw(ctx, state, 0.1, { fullReveal: true, reduced: true });
  const fills = ctx.calls.filter((c) => c[0] === 'fillRect');
  assert.deepEqual(fills, [['fillRect', 0, 0, 768, 576]]);
  assert.equal(painter.celebrationStatus.finished, true);
});
test('gallery draws a completed scene directly without inventing or mutating a game run', (t) => {
  fakeCanvasDOM(t);
  const painter = new BoardPainter(presets),
    ctx = context();
  const before = {
    celebration: painter.celebration,
    theme: painter.theme,
    levelInfo: structuredClone(painter.levelInfo),
  };
  painter.drawGallery(ctx, {
    theme: themes[2],
    level: campaign.levels[2],
    seed: 9,
    width: 240,
    height: 180,
  });
  assert.equal(ctx.calls.filter((c) => c[0] === 'drawImage').length, 1);
  assert.deepEqual(
    { celebration: painter.celebration, theme: painter.theme, levelInfo: painter.levelInfo },
    before,
  );
});
test('signal zones and hangars render read-only alongside a running neutral fallback body', (t) => {
  fakeCanvasDOM(t);
  const painter = new BoardPainter(presets);
  painter.theme = themes[0];
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = painter.makeArt(themes[0]);
  const state = createRun(campaign.levels[0]);
  state.signalZones = [
    { id: 'zone', x: 4, y: 4, w: 8, h: 6, speedFactor: 0.5, suppressedUntil: 0 },
  ];
  state.hangars = [{ id: 'home', x: 24.5, y: 0.5, radius: 2 }];
  const before = structuredClone(state);
  painter.draw(context(), state, 0.016, { paused: true });
  assert.deepEqual(structuredClone(state), before);
});
test('inherited object names resolve to a neutral registered rig before live rendering', async (t) => {
  fakeCanvasDOM(t);
  const notices = [];
  const painter = new BoardPainter(presets, { onAsset: (message) => notices.push(message) });
  for (const bodyId of ['toString', 'valueOf', 'hasOwnProperty']) {
    await painter.setLook({ ...themes[0], player: bodyId }, bodyId);
    assert.equal(painter.body, presets.characters['neutral-marker']);
    assert.equal(painter.recipe, presets.animationRecipes[painter.body.animationRecipe]);
    const state = createRun(campaign.levels[0]);
    assert.doesNotThrow(() => painter.draw(context(), state, 0.016));
    assert.match(notices.at(-1), /not registered/);
  }
});
