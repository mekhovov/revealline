import test from 'node:test';
import assert from 'node:assert/strict';
import { classicAppearanceContext } from '../snake/classic-presentation.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { saveAcceptedAppearance } from '../presentation/theme-system.mjs';
import { advanceClassicFlight, drawClassicCable } from '../snake/classic-flight-art.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import { createClassicSnake, exportClassicSnakeReplay } from '../snake/classic-core.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';

function context(href = 'https://example.test/game/snake/play.html', dataset = {}) {
  const values = new Map(),
    writes = [];
  const sessionStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
    removeItem: (key) => {
      writes.push(key);
      values.delete(key);
    },
  };
  const candidate = createThemeCandidate(createDefaultThemeBundle());
  saveAcceptedAppearance(sessionStorage, candidate);
  writes.length = 0;
  return {
    candidate,
    writes,
    window: { location: { href }, document: { documentElement: { dataset } }, sessionStorage },
  };
}

test('Classic keeps the accepted cosmetic context on an unpinned direct link without writing preferences', () => {
  const state = context();
  assert.deepEqual(classicAppearanceContext(state.window), {
    appearanceDefault: {
      familyId: state.candidate.family.id,
      revision: state.candidate.family.revision,
    },
    appearanceThemes: [state.candidate],
  });
  assert.deepEqual(state.writes, []);
});

test('Classic uses the same query then compiled then accepted precedence as first-paint bootstrap', () => {
  const compiled = { appearanceFamily: 'orchard-workshop', appearanceRevision: 'r1' };
  const state = context('https://example.test/game/snake/play.html', compiled);
  assert.deepEqual(classicAppearanceContext(state.window), {
    appearanceDefault: { familyId: 'orchard-workshop', revision: 'r1' },
    appearanceThemes: [],
  });
  state.window.location.href += '?appearanceFamily=tryzub&appearanceRevision=r1';
  assert.deepEqual(classicAppearanceContext(state.window), {
    appearanceDefault: { familyId: 'tryzub', revision: 'r1' },
    appearanceThemes: [],
  });
  state.window.location.href += '&appearanceFamily=dos';
  assert.equal(
    classicAppearanceContext(state.window).appearanceDefault.familyId,
    'orchard-workshop',
  );
  assert.deepEqual(state.writes, []);
});

test('unreadable context storage cannot erase a valid direct-launch pin', () => {
  const window = {
    location: {
      href: 'https://example.test/game/snake/?appearanceFamily=tryzub&appearanceRevision=r1',
    },
  };
  Object.defineProperty(window, 'sessionStorage', {
    get() {
      throw new Error('Denied');
    },
  });
  assert.deepEqual(classicAppearanceContext(window), {
    appearanceDefault: { familyId: 'tryzub', revision: 'r1' },
    appearanceThemes: [],
  });
});

test('the cosmetic flight clock freezes and bounds delayed frames without mutating its caller', () => {
  const before = Object.freeze({ timeMs: 1200, rotorPhase: 0.5 });
  assert.equal(advanceClassicFlight(before, 16, false, false), before);
  assert.equal(advanceClassicFlight(before, 16, true, true), before);
  const after = advanceClassicFlight(before, 5000, true, false);
  assert.equal(after.timeMs, 1300);
  assert.ok(after.rotorPhase > before.rotorPhase);
  assert.ok(after.rotorPhase - before.rotorPhase < Math.PI / 6);
  for (const elapsed of [-1, NaN, Infinity])
    assert.deepEqual(advanceClassicFlight(before, elapsed, true, false), before);
  assert.deepEqual(advanceClassicFlight(undefined, 1000, false, false), {
    timeMs: 0,
    rotorPhase: 0,
  });
});

function recordingContext() {
  const calls = [];
  const ctx = { calls };
  for (const method of [
    'save',
    'restore',
    'translate',
    'rotate',
    'scale',
    'setTransform',
    'fillRect',
    'strokeRect',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'arc',
    'ellipse',
    'fill',
    'stroke',
    'setLineDash',
    'drawImage',
  ])
    ctx[method] = (...args) => calls.push([method, ...args]);
  return ctx;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

test('Cable and Signal mark every occupied tail cell and connect wrap seams without spanning the board', () => {
  const snake = freeze({
    id: 0,
    direction: 'right',
    body: [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
    ],
  });
  const ink = { body: '#153d61', edge: '#65b6ff', band: '#ffe16b' };
  const level = freeze({ width: 6, height: 5, wrap: true });
  for (const style of ['cable', 'signal']) {
    const ctx = recordingContext();
    drawClassicCable(ctx, snake, ink, level, { style, timeMs: 640 });
    const cells = ctx.calls
      .filter(([method, , , w, h]) => method === 'fillRect' && w === 27 && h === 27)
      .map(([, x, y]) => [x, y]);
    assert.deepEqual(
      cells,
      snake.body
        .slice(1)
        .reverse()
        .map(({ x, y }) => [x * 28 + 0.5, y * 28 + 0.5]),
    );
    let previous = null;
    const points = [];
    for (const [method, x, y] of ctx.calls) {
      if (method === 'beginPath') previous = null;
      if (!['moveTo', 'lineTo'].includes(method)) continue;
      if (method === 'lineTo' && previous)
        assert.ok(Math.hypot(x - previous[0], y - previous[1]) <= 14);
      previous = [x, y];
      points.push(previous);
    }
    for (const boundary of [
      [0, 14],
      [168, 14],
      [154, 0],
      [154, 140],
    ])
      assert.ok(points.some(([x, y]) => x === boundary[0] && y === boundary[1]));
  }
});

test('high-DPI board rendering preserves logical geometry and cannot change gameplay or replay data', () => {
  const run = freeze(createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 17 }));
  const before = JSON.stringify(run);
  const replay = exportClassicSnakeReplay(run);
  const width = run.level.width * 28;
  const height = run.level.height * 28;
  const ctx = recordingContext();
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  for (const style of ['cable', 'signal'])
    for (const reduced of [false, true]) {
      drawClassicBoard(canvas, run, {
        style,
        reduced,
        brutal: !reduced,
        blood: !reduced,
        showRemains: !reduced,
        flight: { timeMs: 680, rotorPhase: 1.2 },
        cssWidth: width,
        pixelRatio: 2,
      });
      assert.equal(canvas.width, width * 2);
      assert.equal(canvas.height, height * 2);
      assert.deepEqual(
        ctx.calls.find(([method]) => method === 'setTransform'),
        ['setTransform', 2, 0, 0, 2, 0, 0],
      );
      assert.ok(
        ctx.calls.some(
          ([method, x, y, w, h]) =>
            method === 'strokeRect' &&
            x === 1.5 &&
            y === 1.5 &&
            w === width - 3 &&
            h === height - 3,
        ),
        'the boundary stays in logical cells, not bitmap pixels',
      );
    }
  drawClassicBoard(canvas, run, { cssWidth: width * 20, pixelRatio: 8 });
  assert.ok(canvas.width <= width * 3 && canvas.height <= height * 3);
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(exportClassicSnakeReplay(run), replay);
});
