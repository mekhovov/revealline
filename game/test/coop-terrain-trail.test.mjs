import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCoop, startCoop, pauseCoop, stepCoop, WALL } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { preparedTeamImage } from './helpers/coop-presentation-fixture.mjs';
import { RETAINED_FPV38_PRESENTATION } from '../couch/coop-retained-presentation.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import {
  drawActiveTrail,
  PRESENTATION_INK,
  PRESENTATION_PLATE,
} from '../ui/actor-presentation.mjs';

// Real core, painter and shared trail primitive; prepared image objects and a
// finite Canvas command recorder. This does not decode pixels, prove browser
// contrast, measure performance or qualify physical-device readability.
const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);
// The no-reader contract belongs to the retained primitive presentation. Current
// image-based Team records deliberately require their complete prepared frames.
const retainedBytes = await readFile(
  new URL(
    `../presentation/compiled/runtime.${RETAINED_FPV38_PRESENTATION.sha256}.json`,
    import.meta.url,
  ),
);
assert.equal(
  createHash('sha256').update(retainedBytes).digest('hex'),
  RETAINED_FPV38_PRESENTATION.sha256,
);
const retained = JSON.parse(retainedBytes);
const wallAsset = compiled.resolved.assets['terrain.wall'];
const palette = Object.freeze({
  ink: '#f6f3e8',
  paper: '#071527',
  muted: '#a8b8cc',
  accent: '#ffd64a',
  safe: '#67aaff',
  danger: '#ff7169',
  field: '#10243e',
  grid: '#182b43',
  sky: '#233950',
  land: '#526e67',
});
const rounded = (value) => Math.round(value * 1e9) / 1e9;
const copy = (value) => structuredClone(value);

// Keep paths in backing-canvas coordinates, including the actual transforms.
// A missing or duplicated 16-unit adapter must change observed geometry.
function surface(clientWidth = 1152) {
  const calls = [],
    stack = [];
  let state = {
      imageSmoothingEnabled: true,
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      fillStyle: '#123456',
      strokeStyle: '#654321',
      font: '10px sans-serif',
      matrix: [1, 0, 0, 1, 0, 0],
      dash: [],
    },
    path = [];
  const point = (x, y) => {
    const [a, b, c, d, e, f] = state.matrix;
    return [rounded(a * x + c * y + e), rounded(b * x + d * y + f)];
  };
  const multiply = ([a, b, c, d, e, f]) => {
    const [u, v, w, z, x, y] = state.matrix;
    state.matrix = [
      u * a + w * b,
      v * a + z * b,
      u * c + w * d,
      v * c + z * d,
      u * e + w * f + x,
      v * e + z * f + y,
    ];
  };
  const scale = () => Math.hypot(state.matrix[0], state.matrix[1]);
  const rectangle = (x, y, width, height) => [
    ...point(x, y),
    rounded(width * scale()),
    rounded(height * Math.hypot(state.matrix[2], state.matrix[3])),
  ];
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          if (name === 'measureText') {
            return {
              width:
                String(args[0]).length *
                (parseFloat(state.font.match(/[\d.]+px/)?.[0]) || 10) *
                0.6,
            };
          }
          const call = { name, args, state: copy(state) };
          if (name === 'save') stack.push(copy(state));
          else if (name === 'restore') {
            assert.ok(stack.length, 'Canvas restore has an owning save.');
            state = stack.pop();
          } else if (name === 'scale') multiply([args[0], 0, 0, args[1], 0, 0]);
          else if (name === 'translate') multiply([1, 0, 0, 1, args[0], args[1]]);
          else if (name === 'rotate') {
            const c = Math.cos(args[0]),
              s = Math.sin(args[0]);
            multiply([c, s, -s, c, 0, 0]);
          } else if (name === 'setLineDash') state.dash = [...args[0]];
          else if (name === 'beginPath') path = [];
          else if (name === 'moveTo' || name === 'lineTo') path.push([name, ...point(...args)]);
          else if (name === 'arc') {
            path.push(['arc', ...point(args[0], args[1]), rounded(args[2] * scale())]);
          } else if (name === 'closePath') path.push(['closePath']);
          else if (name === 'stroke' || name === 'fill') {
            call.path = copy(path);
            call.width = rounded(state.lineWidth * scale());
          } else if (name === 'fillRect' || name === 'strokeRect') {
            call.box = rectangle(...args);
          } else if (name === 'drawImage') {
            const destination = args.length === 9 ? args.slice(5) : args.slice(1);
            assert.equal(destination.length, 4, 'This painter declares its image destination.');
            call.box = rectangle(...destination);
          } else if (name === 'fillText') call.point = point(args[1], args[2]);
          calls.push(call);
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return {
    calls,
    ctx,
    stack,
    canvas: { width: 1152, height: 576, clientWidth, getContext: () => ctx },
    reset: () => (calls.length = 0),
  };
}

function prepared({ tag = 'approved-wall', wall = true, motionScale = 1, reader = true } = {}) {
  const reads = [];
  let closes = 0;
  const image = Object.freeze({
    tag,
    width: 16,
    height: 16,
    close: () => closes++,
  });
  const tile = Object.freeze({ image, asset: wallAsset, geometry: imagePresentation(wallAsset) });
  const snapshot = {
    resolved: reader ? compiled.resolved : retained.resolved,
    canvas: { palette, motionScale },
    fonts: { ui: 'Prepared Team UI, sans-serif', numeric: 'Prepared Team Mono, monospace' },
  };
  if (reader) {
    snapshot.image = (slot) => {
      reads.push(slot);
      return slot === 'terrain.wall' ? (wall ? tile : null) : preparedTeamImage(slot);
    };
  }
  return { snapshot: Object.freeze(snapshot), reads, image, tile, closes: () => closes };
}

const commands = (left = null, right = null) => [
  { direction: left, boost: false, support: false },
  { direction: right, boost: false, support: false },
];

function liveCuts(level = RELAY_YARD) {
  const run = createCoop(level, { difficulty: 'gentle' });
  startCoop(run);
  // Both seats leave their actual border spawn, then make opposite turns.
  // Cuts, fractional heads, safe anchors and cells are generated by the core.
  for (let i = 0; i < 36; i++) stepCoop(run, commands('right', 'left'));
  for (let i = 0; i < 18; i++) stepCoop(run, commands('up', 'down'));
  assert.equal(run.status, 'running');
  for (const player of run.players) {
    assert.equal(player.status, 'active');
    assert.equal(player.cutting, true);
    assert.ok(player.trail.length >= 2, 'The legal cut has more than one visited cell.');
    assert.ok(
      player.x !== Math.floor(player.x) + 0.5 || player.y !== Math.floor(player.y) + 0.5,
      'The real cutting head is not replaced with a cell centre.',
    );
  }
  return run;
}

function expectedSegments(player) {
  const route = [
    player.safeAnchor,
    ...player.trail.map((cell) => ({ x: cell.x + 0.5, y: cell.y + 0.5 })),
    { x: player.x, y: player.y },
  ];
  return route.slice(1).map((point, index) => ({
    x1: route[index].x,
    y1: route[index].y,
    x2: point.x,
    y2: point.y,
  }));
}

const trailStrokes = (calls) =>
  calls
    .filter(
      (call) =>
        call.name === 'stroke' &&
        call.state.lineCap === 'square' &&
        call.state.lineJoin === 'miter' &&
        call.path.some(([name]) => name === 'lineTo'),
    )
    .map((call) => ({
      color: call.state.strokeStyle,
      width: call.width,
      alpha: call.state.globalAlpha,
      path: call.path,
    }));

function referenceTrails(run, width, reduced) {
  const expected = surface(width);
  for (const player of run.players) {
    drawActiveTrail(
      expected.ctx,
      expectedSegments(player),
      player.trail,
      player,
      { ...palette, accent: player.id === 0 ? palette.accent : palette.safe },
      { time: run.time, reduced, screenScale: width / 1152 },
    );
  }
  return trailStrokes(expected.calls);
}

function assertIdentityMarkers(calls) {
  const labels = calls.filter((call) => call.name === 'fillText');
  for (const [label, color] of [
    ['1', palette.accent],
    ['2', palette.safe],
  ]) {
    const text = labels.find((call) => call.args[0] === label);
    assert.ok(text, `Player ${label} retains a number.`);
    const outlines = calls.filter(
      (call) => call.name === 'stroke' && call.state.strokeStyle === color,
    );
    if (label === '1') {
      assert.ok(
        outlines.some((call) =>
          call.path.some(
            ([name, x, y]) => name === 'arc' && x === text.point[0] && y === text.point[1],
          ),
        ),
        'Player 1 retains the circular badge around its number.',
      );
    } else {
      assert.ok(
        outlines.some((call) => {
          const points = call.path.filter(([name]) => name === 'moveTo' || name === 'lineTo');
          if (points.length !== 4 || !call.path.some(([name]) => name === 'closePath'))
            return false;
          const xs = points.map((point) => point[1]),
            ys = points.map((point) => point[2]);
          return (
            Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - text.point[0]) < 1e-8 &&
            Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - text.point[1]) < 1e-8
          );
        }),
        'Player 2 retains the diamond badge around its number.',
      );
    }
  }
}

test('Team borrows the reviewed terrain.wall r2 original at every actual Relay Yard wall cell', async () => {
  const bytes = await readFile(
    new URL(`../presentation/compiled/${compiled.urls[wallAsset.file.sha256]}`, import.meta.url),
  );
  assert.equal(wallAsset.id, 'terrain.wall.field-kit');
  assert.equal(wallAsset.revision, 2);
  assert.equal(wallAsset.quality.stage, 'reviewed');
  assert.equal(
    wallAsset.file.sha256,
    '326d159fab7ab655e40c493e5e3ae27713157b419788134f23363ef222ad27db',
  );
  assert.equal(bytes.length, 146);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), wallAsset.file.sha256);
  assert.equal(bytes.readUInt32BE(16), 16);
  assert.equal(bytes.readUInt32BE(20), 16);
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    p = prepared(),
    before = copy(run);
  painter.setPresentation(p.snapshot);
  painter.paint(run);
  const walls = Array.from(run.cells).flatMap((cell, index) =>
    cell === WALL ? [[(index % run.width) * 16, Math.floor(index / run.width) * 16, 16, 16]] : [],
  );
  assert.ok(walls.length > 0, 'The selected real arena contains authored walls.');
  const draws = view.calls.filter((call) => call.name === 'drawImage' && call.args[0] === p.image);
  assert.deepEqual(
    draws.map((call) => call.box),
    walls,
    'Every wall uses exactly its complete cell footprint.',
  );
  assert.ok(draws.every((call) => call.state.imageSmoothingEnabled === false));
  assert.equal(p.reads.filter((slot) => slot === 'terrain.wall').length, 1);
  painter.paint(run);
  assert.equal(
    p.reads.filter((slot) => slot === 'terrain.wall').length,
    1,
    'Paint borrows the accepted image without reacquiring it.',
  );
  assert.equal(p.closes(), 0);
  assert.deepEqual(run, before);
  assert.equal(view.stack.length, 0);
  assert.equal(view.ctx.imageSmoothingEnabled, true);
});

test('Team wall replacement uses only the newly accepted image and clearing restores exact legacy painting', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    first = prepared({ tag: 'first' }),
    second = prepared({ tag: 'second' });
  painter.paint(run);
  const legacy = copy(view.calls);
  painter.setPresentation(first.snapshot);
  painter.paint(run);
  painter.setPresentation(second.snapshot);
  view.reset();
  painter.paint(run);
  const draws = view.calls.filter((call) => call.name === 'drawImage');
  assert.equal(
    draws.filter((call) => call.args[0] === second.image).length,
    Array.from(run.cells).filter((cell) => cell === WALL).length,
  );
  assert.ok(
    draws.every((call) => call.args[0] !== first.image),
    'No stale wall survives replacement.',
  );
  painter.setPresentation(null);
  view.reset();
  painter.paint(run);
  assert.deepEqual(
    view.calls,
    legacy,
    'An explicit null snapshot keeps the historical painter path.',
  );
  assert.equal(painter.presentation, null);
  assert.equal(first.closes() + second.closes(), 0, 'The page lease owns image disposal.');
});

test('snapshots without a terrain reader or wall keep flat backing and never retain a previous wall image', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    present = prepared();
  for (const p of [prepared({ wall: false }), prepared({ reader: false })]) {
    painter.setPresentation(present.snapshot);
    painter.setPresentation(p.snapshot);
    view.reset();
    painter.paint(run);
    assert.equal(
      view.calls.some((call) => call.name === 'drawImage' && call.args[0]?.tag),
      false,
    );
    assert.ok(
      view.calls.some(
        (call) =>
          call.name === 'fillRect' &&
          call.state.fillStyle === palette.muted &&
          JSON.stringify(call.box) === JSON.stringify([16 * 16, 14 * 16, 16, 16]),
      ),
      'The authored wall remains a full flat cell without a usable borrowed tile.',
    );
  }
  assert.equal(present.closes(), 0);
});

test('a failed terrain snapshot read leaves the previous complete Team presentation usable', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    previous = prepared(),
    failure = new Error('terrain reader rejected');
  painter.setPresentation(previous.snapshot);
  const broken = {
    ...prepared().snapshot,
    image(slot) {
      if (slot === 'terrain.wall') throw failure;
      return null;
    },
  };
  assert.throws(
    () => painter.setPresentation(broken),
    (error) => error === failure,
  );
  assert.equal(painter.presentation, previous.snapshot);
  painter.paint(run);
  assert.ok(
    view.calls.some((call) => call.name === 'drawImage' && call.args[0] === previous.image),
  );
  assert.equal(previous.closes(), 0);
});

for (const width of [1152, 320]) {
  for (const level of [FIRST_CONNECTION, RELAY_YARD]) {
    test(`${level.name} uses both real cuts with the shared outlined trail at ${width}px without changing the run`, () => {
      const run = liveCuts(level),
        before = copy(run),
        view = surface(width),
        painter = createCoopPainter(view.canvas),
        p = prepared();
      painter.setPresentation(p.snapshot);
      painter.paint(run, { reduced: true });
      const actual = trailStrokes(view.calls),
        expected = referenceTrails(run, width, true);
      assert.equal(actual.length, 6, 'Two cuts retain dark outline, player accent and light core.');
      assert.deepEqual(
        actual,
        expected,
        'The 16-unit adapter retains every actual segment and endpoint.',
      );
      for (const [index, player] of run.players.entries()) {
        const layers = actual.slice(index * 3, index * 3 + 3);
        assert.deepEqual(
          layers.map((layer) => layer.color),
          [PRESENTATION_PLATE, index === 0 ? palette.accent : palette.safe, PRESENTATION_INK],
        );
        assert.ok(layers[0].width > layers[1].width && layers[1].width > layers[2].width);
        assert.ok(layers.every((layer) => layer.alpha === 1));
        assert.ok(
          layers[0].width * (width / 1152) >= 4,
          'The dark edge remains present at the narrow display scale.',
        );
        const path = layers[0].path;
        assert.deepEqual(path[0], [
          'moveTo',
          rounded(player.safeAnchor.x * 16),
          rounded(player.safeAnchor.y * 16),
        ]);
        assert.deepEqual(path.at(-1), ['lineTo', rounded(player.x * 16), rounded(player.y * 16)]);
      }
      assertIdentityMarkers(view.calls);
      assert.deepEqual(run, before);
      assert.equal(view.stack.length, 0);
      assert.equal(view.ctx.imageSmoothingEnabled, true);
    });
  }

  test(`paused and reduced Team cut geometry stays stable at ${width}px with identical core outcomes`, () => {
    const run = liveCuts(),
      control = copy(run),
      view = surface(width),
      painter = createCoopPainter(view.canvas),
      p = prepared();
    painter.setPresentation(p.snapshot);
    painter.paint(run);
    const moving = trailStrokes(view.calls);
    assert.deepEqual(moving, referenceTrails(run, width, false));
    view.reset();
    painter.paint(run, { reduced: true });
    assert.deepEqual(
      trailStrokes(view.calls),
      moving,
      'Reduced effects preserve all three functional layers.',
    );
    // Extra renders cannot advance the real clock or affect the next core tick.
    for (let i = 0; i < 3; i++) painter.paint(run, { reduced: i % 2 === 0 });
    stepCoop(run, commands('up', 'down'));
    stepCoop(control, commands('up', 'down'));
    assert.deepEqual(run, control);
    pauseCoop(run);
    const paused = copy(run);
    view.reset();
    painter.paint(run);
    const held = copy(view.calls.filter((call) => call.name !== 'drawImage'));
    for (let i = 0; i < 3; i++) {
      view.reset();
      painter.paint(run);
      assert.deepEqual(
        view.calls.filter((call) => call.name !== 'drawImage'),
        held,
      );
    }
    assert.deepEqual(run, paused);
    view.reset();
    painter.setPresentation(prepared({ motionScale: 0 }).snapshot);
    painter.paint(run);
    assert.deepEqual(trailStrokes(view.calls), referenceTrails(run, width, true));
    assertIdentityMarkers(view.calls);
    assert.equal(view.stack.length, 0);
  });
}

test('First Connection never invents wall cells and clearing a prepared snapshot preserves both legacy cuts', () => {
  const run = liveCuts(FIRST_CONNECTION),
    before = copy(run),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  assert.equal(
    run.cells.some((cell) => cell === WALL),
    false,
  );
  painter.paint(run, { reduced: true });
  const legacy = copy(view.calls);
  painter.setPresentation(prepared().snapshot);
  view.reset();
  painter.paint(run, { reduced: true });
  assert.equal(
    view.calls.some((call) => call.name === 'drawImage' && call.args[0]?.tag),
    false,
  );
  painter.setPresentation(null);
  view.reset();
  painter.paint(run, { reduced: true });
  assert.deepEqual(view.calls, legacy);
  assert.deepEqual(run, before);
});

for (const [name, malformed] of [
  ['missing image', (tile) => ({ ...tile, image: null })],
  ['NaN image width', (tile) => ({ ...tile, image: { ...tile.image, width: NaN } })],
  ['zero image width', (tile) => ({ ...tile, image: { ...tile.image, width: 0 } })],
  ['infinite image width', (tile) => ({ ...tile, image: { ...tile.image, width: Infinity } })],
  ['negative image width', (tile) => ({ ...tile, image: { ...tile.image, width: -1 } })],
  ['string image width', (tile) => ({ ...tile, image: { ...tile.image, width: '16' } })],
  ['NaN image height', (tile) => ({ ...tile, image: { ...tile.image, height: NaN } })],
  ['zero image height', (tile) => ({ ...tile, image: { ...tile.image, height: 0 } })],
  ['missing geometry', (tile) => ({ ...tile, geometry: null })],
  ['missing pivot', (tile) => ({ ...tile, geometry: { ...tile.geometry, pivot: null } })],
  [
    'NaN pivot x',
    (tile) => ({ ...tile, geometry: { ...tile.geometry, pivot: { x: NaN, y: 0.5 } } }),
  ],
  [
    'infinite pivot y',
    (tile) => ({ ...tile, geometry: { ...tile.geometry, pivot: { x: 0.5, y: Infinity } } }),
  ],
  [
    'pivot x below zero',
    (tile) => ({ ...tile, geometry: { ...tile.geometry, pivot: { x: -0.01, y: 0.5 } } }),
  ],
  [
    'pivot y above one',
    (tile) => ({ ...tile, geometry: { ...tile.geometry, pivot: { x: 0.5, y: 1.01 } } }),
  ],
  [
    'string pivot x',
    (tile) => ({ ...tile, geometry: { ...tile.geometry, pivot: { x: '0.5', y: 0.5 } } }),
  ],
]) {
  test(`advertised Team wall with ${name} is rejected without replacing the prior snapshot`, () => {
    const view = surface(),
      painter = createCoopPainter(view.canvas),
      run = createCoop(RELAY_YARD),
      before = copy(run),
      previous = prepared({ tag: 'retained-wall' }),
      replacement = prepared({ tag: 'invalid-wall' }),
      badTile = malformed(replacement.tile);
    painter.setPresentation(previous.snapshot);
    const rejected = {
      ...replacement.snapshot,
      canvas: {
        ...replacement.snapshot.canvas,
        palette: { ...palette, muted: '#abcdef', accent: '#aa88ff' },
      },
      image: (slot) => (slot === 'terrain.wall' ? badTile : null),
    };
    assert.throws(
      () => painter.setPresentation(rejected),
      'An advertised but unusable wall is not an optional absent override.',
    );
    assert.equal(painter.presentation, previous.snapshot);
    painter.paint(run);
    const draws = view.calls.filter((call) => call.name === 'drawImage');
    assert.ok(draws.length > 0, 'The previous artwork remains paintable after rejection.');
    assert.equal(
      draws.filter((call) => call.args[0] === previous.image).length,
      Array.from(run.cells).filter((cell) => cell === WALL).length,
    );
    assert.ok(
      draws.every((call) => call.args[0] !== replacement.image),
      'Rejected wall is never painted.',
    );
    const wallBacking = view.calls.find(
      (call) =>
        call.name === 'fillRect' &&
        JSON.stringify(call.box) === JSON.stringify([16 * 16, 14 * 16, 16, 16]),
    );
    assert.ok(wallBacking);
    assert.equal(
      wallBacking.state.fillStyle,
      palette.muted,
      'The previous palette remains accepted too.',
    );
    assert.deepEqual(run, before);
    assert.equal(previous.closes() + replacement.closes(), 0);
    assert.equal(view.stack.length, 0);
    assert.equal(view.ctx.imageSmoothingEnabled, true);
  });
}

test('accepted noncentral and boundary wall pivots keep the declared pivot at each actual cell centre', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    before = copy(run),
    p = prepared();
  const cells = Array.from(run.cells).flatMap((cell, index) =>
    cell === WALL ? [[index % run.width, Math.floor(index / run.width)]] : [],
  );
  for (const pivot of [
    { x: 0.25, y: 0.75 },
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]) {
    const tile = { ...p.tile, geometry: { ...p.tile.geometry, pivot } };
    painter.setPresentation({
      ...p.snapshot,
      image: (slot) => (slot === 'terrain.wall' ? tile : p.snapshot.image(slot)),
    });
    view.reset();
    painter.paint(run);
    const draws = view.calls.filter(
      (call) => call.name === 'drawImage' && call.args[0] === p.image,
    );
    assert.deepEqual(
      draws.map((call) => call.box),
      cells.map(([x, y]) => [(x + 0.5 - pivot.x) * 16, (y + 0.5 - pivot.y) * 16, 16, 16]),
      'Placement honors the prepared pivot rather than recentering its image or moving a wall cell.',
    );
    assert.ok(draws.every((call) => call.state.imageSmoothingEnabled === false));
    assert.deepEqual(run, before);
    assert.equal(view.stack.length, 0);
  }
  assert.equal(p.closes(), 0);
});

test('an undefined wall override is explicitly absent and clears a previously borrowed tile', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    p = prepared();
  painter.setPresentation(p.snapshot);
  painter.setPresentation({
    ...p.snapshot,
    image: (slot) => (slot === 'terrain.wall' ? undefined : p.snapshot.image(slot)),
  });
  painter.paint(run);
  assert.equal(
    view.calls.some((call) => call.name === 'drawImage' && call.args[0]?.tag),
    false,
  );
  assert.ok(
    view.calls.some(
      (call) =>
        call.name === 'fillRect' &&
        call.state.fillStyle === palette.muted &&
        JSON.stringify(call.box) === JSON.stringify([16 * 16, 14 * 16, 16, 16]),
    ),
  );
  assert.equal(p.closes(), 0);
});
