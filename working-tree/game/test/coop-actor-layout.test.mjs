import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';

const compiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const palette = {
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
};
const snapshot = {
  canvas: { palette, motionScale: 1 },
  fonts: { ui: 'Prepared UI', numeric: 'Prepared Mono' },
  image(slot) {
    const asset = compiled.resolved.assets[slot];
    return asset ? { image: { slot }, geometry: imagePresentation(asset) } : null;
  },
};
function surface(width = 362) {
  const calls = [],
    stack = [];
  let state = {
    matrix: [1, 0, 0, 1, 0, 0],
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    font: '10px sans-serif',
  };
  const multiply = ([a, b, c, d, e, f]) => {
    const [g, h, i, j, k, l] = state.matrix;
    state.matrix = [
      g * a + i * b,
      h * a + j * b,
      g * c + i * d,
      h * c + j * d,
      g * e + i * f + k,
      h * e + j * f + l,
    ];
  };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, state: { ...state, matrix: [...state.matrix] } });
          if (name === 'save') stack.push({ ...state, matrix: [...state.matrix] });
          if (name === 'restore') state = stack.pop();
          if (name === 'translate') multiply([1, 0, 0, 1, ...args]);
          if (name === 'scale') multiply([args[0], 0, 0, args[1], 0, 0]);
          if (name === 'rotate') {
            const c = Math.cos(args[0]),
              s = Math.sin(args[0]);
            multiply([c, s, -s, c, 0, 0]);
          }
          if (name === 'measureText')
            return {
              width: String(args[0]).length * Number(state.font.match(/([\d.]+)px/)[1]) * 0.64,
            };
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return {
    canvas: { width: 1152, height: 576, clientWidth: width, getContext: () => ctx },
    calls,
    ctx,
  };
}
function bounds(call, rectangle = call.args.slice(1)) {
  const [a, b, c, d, e, f] = call.state.matrix;
  const [x, y, w, h] = rectangle;
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px, py]) => [a * px + c * py + e, b * px + d * py + f]);
  return {
    left: Math.min(...corners.map((p) => p[0])),
    right: Math.max(...corners.map((p) => p[0])),
    top: Math.min(...corners.map((p) => p[1])),
    bottom: Math.max(...corners.map((p) => p[1])),
  };
}

test('portrait functional player numerals retain at least fourteen CSS pixels', () => {
  const run = createCoop(FIRST_CONNECTION),
    v = surface(),
    p = createCoopPainter(v.canvas);
  p.setPresentation(snapshot);
  p.paint(run);
  for (const id of ['1', '2']) {
    const label = v.calls.find((c) => c.name === 'fillText' && c.args[0] === id);
    assert.ok(label);
    const css = (Number(label.state.font.match(/([\d.]+)px/)[1]) * 362) / 72;
    assert.ok(css >= 14 - 1e-9, `${id} is ${css} CSS pixels`);
  }
});
test('pilot complete image frames remain within the arena at the true boundary', () => {
  const run = createCoop(FIRST_CONNECTION),
    v = surface(),
    p = createCoopPainter(v.canvas);
  run.players[0].x = 0.5;
  run.players[0].y = 0.5;
  run.players[1].x = 71.5;
  run.players[1].y = 35.5;
  const before = structuredClone(run);
  p.setPresentation(snapshot);
  p.paint(run);
  for (const call of v.calls.filter(
    (c) => c.name === 'drawImage' && c.args[0].slot.startsWith('player.'),
  )) {
    const b = bounds(call);
    assert.ok(b.left >= 0 && b.top >= 0 && b.right <= 1152 && b.bottom <= 576, JSON.stringify(b));
  }
  assert.deepEqual(run, before);
});

// Pure layout cases complement command observations; neither proves native glyph readability.
import {
  coopCueScale,
  coopCueConnector,
  coopBodyBounds,
  coopPilotBodyOffset,
  placeCoopCue,
} from '../couch/coop-actor-layout.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';

test('cue connector reaches each plate edge and stops three CSS pixels before its owner', () => {
  const rect = Object.freeze({ left: 10, top: 20, right: 30, bottom: 40 });
  for (const [owner, from, to] of [
    [
      { x: -10, y: 30 },
      { x: 10, y: 30 },
      { x: -7, y: 30 },
    ],
    [
      { x: 50, y: 30 },
      { x: 30, y: 30 },
      { x: 47, y: 30 },
    ],
    [
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 20, y: 3 },
    ],
    [
      { x: 20, y: 60 },
      { x: 20, y: 40 },
      { x: 20, y: 57 },
    ],
  ]) {
    Object.freeze(owner);
    const actual = coopCueConnector(rect, owner);
    assert.deepEqual(actual, { from, to });
    assert.deepEqual(coopCueConnector(rect, owner), actual, 'Repeated geometry is deterministic.');
    assert.ok(Object.isFrozen(actual));
    assert.ok(Object.isFrozen(actual.from));
    assert.ok(Object.isFrozen(actual.to));
  }
});

test('cue connector uses the nearest corner and keeps its owner gap on diagonal segments', () => {
  const rect = { left: 10, top: 20, right: 30, bottom: 40 };
  for (const [owner, from, to] of [
    [
      { x: -2, y: 4 },
      { x: 10, y: 20 },
      { x: -0.2, y: 6.4 },
    ],
    [
      { x: 42, y: 4 },
      { x: 30, y: 20 },
      { x: 40.2, y: 6.4 },
    ],
    [
      { x: -2, y: 56 },
      { x: 10, y: 40 },
      { x: -0.2, y: 53.6 },
    ],
    [
      { x: 42, y: 56 },
      { x: 30, y: 40 },
      { x: 40.2, y: 53.6 },
    ],
  ]) {
    const before = structuredClone({ rect, owner });
    const actual = coopCueConnector(rect, owner);
    assert.deepEqual(actual.from, from);
    assert.ok(Math.abs(actual.to.x - to.x) < 1e-10);
    assert.ok(Math.abs(actual.to.y - to.y) < 1e-10);
    assert.ok(Math.abs(Math.hypot(owner.x - actual.to.x, owner.y - actual.to.y) - 3) < 1e-10);
    assert.deepEqual({ rect, owner }, before);
  }
});

test('cue connector stays absent inside, on an edge, and within the configured distance', () => {
  const rect = { left: 10, top: 20, right: 30, bottom: 40 };
  for (const owner of [
    { x: 20, y: 30 },
    { x: 10, y: 30 },
    { x: 30, y: 40 },
    { x: 39, y: 30 },
    { x: 40, y: 30 },
    { x: 36, y: 48 },
  ])
    assert.equal(coopCueConnector(rect, owner), null);
  assert.notEqual(coopCueConnector(rect, { x: 40.01, y: 30 }), null);
  assert.equal(coopCueConnector(rect, { x: 50, y: 30 }, 20), null);
  assert.deepEqual(coopCueConnector(rect, { x: 51, y: 30 }, 20), {
    from: { x: 30, y: 30 },
    to: { x: 48, y: 30 },
  });
});

test('cue connector rejects malformed, degenerate and non-finite cosmetic geometry', () => {
  const rect = { left: 10, top: 20, right: 30, bottom: 40 },
    owner = { x: 50, y: 30 };
  for (const invalid of [
    null,
    undefined,
    [],
    {},
    { ...rect, left: NaN },
    { ...rect, top: -Infinity },
    { ...rect, right: Infinity },
    { ...rect, bottom: '40' },
    { ...rect, right: 10 },
    { ...rect, bottom: 19 },
    { ...rect, left: -Number.MAX_VALUE, right: Number.MAX_VALUE },
  ])
    assert.equal(coopCueConnector(invalid, owner), null);
  for (const invalid of [null, undefined, [], {}, { x: '50', y: 30 }, { x: 50, y: NaN }])
    assert.equal(coopCueConnector(rect, invalid), null);
  for (const threshold of [null, '10', NaN, Infinity, -1, 0, 9.99])
    assert.equal(coopCueConnector(rect, owner, threshold), null);
  assert.equal(
    coopCueConnector(
      { left: -Number.MAX_VALUE, top: 0, right: -1e307, bottom: 10 },
      { x: Number.MAX_VALUE, y: 5 },
    ),
    null,
  );
});
import { drawPresentedActor } from '../ui/actor-presentation.mjs';

for (const detail of ['compact', 'detailed']) {
  test(`${detail} full frame, motor and nose bounds stay inside every corner through heading and banking`, () => {
    const prepared = snapshot.image(`player.scout.${detail}`),
      geometry = prepared.geometry,
      adapter = createCoopActorPresentation();
    adapter.setPresentation(snapshot);
    adapter.update(createCoop(FIRST_CONNECTION));
    const original = adapter.frame('pilot', 0);
    for (const width of [362, 1152, 1900])
      for (const [x, y] of [
        [8, 8],
        [1144, 8],
        [8, 568],
        [1144, 568],
      ])
        for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5])
          for (const bank of [-0.15, 0, 0.15]) {
            const frame = { x, y, heading, bank, diameter: width < 480 ? 51 : 30 };
            const margin = 1152 / width,
              offset = coopPilotBodyOffset(frame, geometry, 1152, 576, margin),
              box = coopBodyBounds(frame, geometry);
            assert.ok(x + offset.x + box.left >= margin - 1e-9);
            assert.ok(x + offset.x + box.right <= 1152 - margin + 1e-9);
            assert.ok(y + offset.y + box.top >= margin - 1e-9);
            assert.ok(y + offset.y + box.bottom <= 576 - margin + 1e-9);
            assert.deepEqual(frame, { x, y, heading, bank, diameter: width < 480 ? 51 : 30 });
            const v = surface(width);
            drawPresentedActor(
              v.ctx,
              {
                ...original,
                ...frame,
                phase: 0.37,
                style: detail === 'compact' ? 'microtile' : 'hybrid',
              },
              palette,
              prepared.image,
              geometry,
              null,
              { bodyOffset: offset },
            );
            for (const call of v.calls) {
              if (call.name === 'arc') break; // The authoritative contact is intentionally unshifted.
              if (!['drawImage', 'fillRect'].includes(call.name)) continue;
              const drawn = bounds(call, call.name === 'fillRect' ? call.args : undefined);
              assert.ok(
                drawn.left >= 0 && drawn.top >= 0 && drawn.right <= 1152 && drawn.bottom <= 576,
                JSON.stringify({ detail, width, heading, bank, drawn }),
              );
            }
          }
  });
}

test('body offset leaves shared default drawing exact and contact at its real pixel position', () => {
  const run = createCoop(FIRST_CONNECTION),
    adapter = createCoopActorPresentation();
  adapter.setPresentation(snapshot);
  adapter.update(run, { canvasCSSWidth: 362 });
  const frame = adapter.frame('pilot', 0),
    prepared = snapshot.image(frame.sourceSlot),
    a = surface(),
    b = surface(),
    c = surface();
  drawPresentedActor(a.ctx, frame, palette, prepared.image, prepared.geometry);
  drawPresentedActor(b.ctx, frame, palette, prepared.image, prepared.geometry, null, {});
  drawPresentedActor(c.ctx, frame, palette, prepared.image, prepared.geometry, null, {
    bodyOffset: { x: Infinity, y: 0 },
  });
  assert.deepEqual(b.calls, a.calls);
  assert.deepEqual(c.calls, a.calls);
  const shifted = surface();
  drawPresentedActor(shifted.ctx, frame, palette, prepared.image, prepared.geometry, null, {
    bodyOffset: { x: 16, y: 12 },
  });
  const ring = shifted.calls.find((call) => call.name === 'arc' && call.args[2] === frame.radius);
  assert.deepEqual(ring.state.matrix, [1, 0, 0, 1, Math.round(frame.x), Math.round(frame.y)]);
  const image = shifted.calls.find((call) => call.name === 'drawImage'),
    plain = a.calls.find((call) => call.name === 'drawImage');
  assert.equal(image.state.matrix[4] - plain.state.matrix[4], 16);
  assert.equal(image.state.matrix[5] - plain.state.matrix[5], 12);
});

for (const textFace of ['plain', 'pixel'])
  test(`${textFace} portrait cues and player identities retain CSS size without covering true heads`, () => {
    const run = createCoop(FIRST_CONNECTION),
      v = surface(),
      p = createCoopPainter(v.canvas);
    run.players[0].status = 'downed';
    run.players[1].graceUntil = 10;
    const hunter = run.enemies.find((e) => e.type === 'hunter');
    Object.assign(hunter, { phase: 'warning', target: 0, targetPoint: { x: 25, y: 10 } });
    const before = structuredClone(run);
    p.setPresentation(snapshot);
    p.paint(run, { textFace, reduced: true });
    const labels = v.calls.filter((c) => c.name === 'fillText');
    for (const text of ['1', '2', '+', 'LOCK 1'])
      assert.ok(
        labels.some((c) => c.args[0] === text),
        text,
      );
    for (const label of labels) {
      const cssSize = (Number(label.state.font.match(/([\d.]+)px/)[1]) * 362) / 72;
      assert.ok(cssSize >= (['1', '2'].includes(label.args[0]) ? 14 : 12) - 1e-9);
    }
    const identity = labels.find((c) => c.args[0] === '1');
    assert.equal(identity.state.matrix[0], 16);
    // The final colored circle remains at the authoritative head and exact radius.
    for (const player of run.players)
      assert.ok(
        v.calls.some(
          (c) =>
            c.name === 'arc' &&
            c.args[0] === player.x &&
            c.args[1] === player.y &&
            c.args[2] === player.radius,
        ),
      );
    const cell = 362 / run.width,
      heads = run.players.map((player) => ({
        left: player.x * cell - player.radius * cell - 2,
        right: player.x * cell + player.radius * cell + 2,
        top: player.y * cell - player.radius * cell - 2,
        bottom: player.y * cell + player.radius * cell + 2,
      }));
    function clearHeads(rect) {
      assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= 362 && rect.bottom <= 181);
      for (const head of heads)
        assert.equal(
          rect.left < head.right &&
            rect.right > head.left &&
            rect.top < head.bottom &&
            rect.bottom > head.top,
          false,
        );
    }
    for (const call of v.calls.filter(
      (c) => c.name === 'fillRect' && c.state.fillStyle === '#07111c',
    )) {
      const rect = bounds(call, call.args);
      for (const key of ['left', 'right', 'top', 'bottom']) rect[key] *= 362 / 1152;
      if (rect.bottom - rect.top >= 12) clearHeads(rect); // Label plates, not tiny contact pixels.
    }
    for (const id of ['1', '2']) {
      const label = labels.find((c) => c.args[0] === id),
        x = label.args[1] * cell,
        y = label.args[2] * cell,
        radius = id === '1' ? 10 : 12;
      clearHeads({ left: x - radius, right: x + radius, top: y - radius, bottom: y + radius });
    }
    assert.deepEqual(run, before);
  });

test('complete CSS cue plates avoid both pilot heads and remain in the 362 by181 arena', () => {
  const heads = [
      { left: 0, top: 0, right: 7, bottom: 7 },
      { left: 355, top: 174, right: 362, bottom: 181 },
    ],
    occupied = [];
  for (const [x, y, width, height] of [
    [2, 2, 30, 24],
    [360, 179, 24, 24],
    [2, 2, 72, 18],
    [360, 179, 82, 18],
    [181, 90, 18, 18],
  ]) {
    const r = placeCoopCue({
      x,
      y,
      width,
      height,
      arenaWidth: 362,
      arenaHeight: 181,
      heads,
      occupied,
    });
    assert.ok(r);
    assert.ok(r.left >= 0 && r.top >= 0 && r.right <= 362 && r.bottom <= 181);
    for (const h of heads)
      assert.equal(
        r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top,
        false,
      );
    occupied.push(r);
  }
  const scale = coopCueScale(362);
  assert.equal(scale.font(0.66, 14) * scale.cell, 14);
  assert.equal(scale.font(0.57, 12) * scale.cell, 12);
});

function largeCueRun(level) {
  const run = createCoop(level);
  // Cosmetic renderer fixture, prepared before the preservation checkpoint.
  run.players[0].status = 'downed';
  run.players[1].graceUntil = 10;
  Object.assign(
    run.enemies.find((enemy) => enemy.type === 'hunter'),
    {
      phase: 'warning',
      target: 0,
      targetPoint: { x: 25, y: 10 },
    },
  );
  return run;
}
function paintLargeCueRun(
  run,
  { prepared = true, textFace = 'pixel', textSize, width = 362 } = {},
) {
  const view = surface(width),
    painter = createCoopPainter(view.canvas);
  if (prepared) painter.setPresentation(snapshot);
  const options = { textFace, reduced: true };
  if (textSize !== undefined) options.textSize = textSize;
  painter.paint(run, options);
  return view;
}
function cueTrace(calls) {
  return createHash('sha256').update(JSON.stringify(calls)).digest('hex');
}

// Recorded before the feature from exact d51acab59232edc4e7f77ab5df491f2c403de709.
// Provenance: retained P05 Team Large renderer-tests/standard-baseline-* receipts.
// These full finite Canvas2D traces preserve Standard, not native raster appearance.
const STANDARD_CUE_TRACES = {
  'connection:false:pixel': '5b64885d16375872f6aec07aa09a1fdd36d49f6b3d41ca8e9f7e2f7ce5581c4b',
  'connection:false:plain': '9e1f00dce78d01c378f2a3ee2d34d274db96d11cd0298ff458abb5cd61131d69',
  'connection:true:pixel': '6db3ca2fbfe1a3d07dfa4db417e85dc1792d3b712767359bd13e4c0c5a4a01f0',
  'connection:true:plain': 'e14b5f0075bb1ad251e37466920353afad1598208b410b666b13deb2d9c0d926',
  'yard:false:pixel': '676d46a1ae79f687750fb6c23b6b3187ce5fd07fe147a49abee9cb130af4106b',
  'yard:false:plain': 'b5c066613e515e33b36bf9713ae67ce7efa529d3ba34f0a816e27dc53f6923cd',
  'yard:true:pixel': '65ff19cf1f53e791a74c3683b1441b9fab7ee3911f62a82e8bd4e11006e0014f',
  'yard:true:plain': 'c7afa0890489fd6cf83ec1619c21a880c6d027083761f93a5316850cfe7943c7',
};
const projectedFont = (call, width = 362) =>
  (Number(call.state.font.match(/([\d.]+)px/)[1]) *
    Math.hypot(call.state.matrix[2], call.state.matrix[3]) *
    width) /
  1152;
function cssBounds(call, rectangle, width = 362) {
  const result = bounds(call, rectangle);
  for (const key of ['left', 'right', 'top', 'bottom']) result[key] *= width / 1152;
  return result;
}
function assertFunctionalCueLayout(run, view, factor = 1) {
  const width = view.canvas.clientWidth,
    cell = width / run.width,
    heads = run.players.map((player) => ({
      left: player.x * cell - player.radius * cell - 2,
      right: player.x * cell + player.radius * cell + 2,
      top: player.y * cell - player.radius * cell - 2,
      bottom: player.y * cell + player.radius * cell + 2,
    }));
  const clear = (rect, label) => {
    assert.ok(
      rect.left >= -1e-8 &&
        rect.top >= -1e-8 &&
        rect.right <= width + 1e-8 &&
        rect.bottom <= run.height * cell + 1e-8,
      `${label}: outside board`,
    );
    for (const head of heads)
      assert.equal(
        rect.left < head.right &&
          rect.right > head.left &&
          rect.top < head.bottom &&
          rect.bottom > head.top,
        false,
        `${label}: covers real head`,
      );
  };
  for (let index = 0; index < view.calls.length; index++) {
    const call = view.calls[index];
    if (call.name !== 'fillText') continue;
    const text = String(call.args[0]),
      identity = ['1', '2'].includes(text);
    assert.ok(
      projectedFont(call, width) >= (identity ? 14 : 12) * factor - 1e-8,
      `${text}: text minimum`,
    );
    const previous = view.calls[index - 1];
    if (previous?.name === 'fillRect' && previous.state.fillStyle === '#07111c') {
      const rect = cssBounds(previous, previous.args, width);
      clear(rect, `${text} plate`);
      if (text === '+') {
        assert.ok(rect.right - rect.left >= 10 * factor - 1e-8);
        assert.ok(rect.bottom - rect.top >= 16 * factor - 1e-8);
      }
    }
    if (!identity) continue;
    let start = index;
    while (start >= 0 && view.calls[start].name !== 'beginPath') start--;
    const path = view.calls.slice(start, index),
      arc = path.find((c) => c.name === 'arc');
    let rect;
    if (arc) {
      const [x, y, r] = arc.args;
      rect = cssBounds(arc, [x - r, y - r, r * 2, r * 2], width);
    } else {
      const points = path.filter((c) => ['moveTo', 'lineTo'].includes(c.name));
      assert.equal(points.length, 4, 'Player 2 retains its diamond identity.');
      const xs = points.map((c) => c.args[0]),
        ys = points.map((c) => c.args[1]);
      rect = cssBounds(
        points[0],
        [
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        ],
        width,
      );
    }
    assert.ok(
      rect.right - rect.left >= (text === '1' ? 20 : 24) * factor - 1e-8,
      `${text}: badge scales with its text`,
    );
    clear(rect, `${text} badge`);
  }
  for (const player of run.players)
    assert.ok(
      view.calls.some(
        (c) =>
          c.name === 'arc' &&
          c.args[0] === player.x &&
          c.args[1] === player.y &&
          c.args[2] === player.radius,
      ),
      'Final contact marker retains the authored head/radius.',
    );
}
for (const [arena, level] of [
  ['connection', FIRST_CONNECTION],
  ['yard', RELAY_YARD],
])
  for (const prepared of [false, true])
    for (const textFace of ['pixel', 'plain'])
      test(`Large ${arena} ${prepared ? 'prepared' : 'legacy'} ${textFace} cues grow without losing roles or moving contacts`, () => {
        const run = largeCueRun(level),
          before = structuredClone(run),
          options = { prepared, textFace },
          standard = paintLargeCueRun(run, { ...options, textSize: 'standard' }),
          implicit = paintLargeCueRun(run, options),
          large = paintLargeCueRun(run, { ...options, textSize: 'large' });
        assert.equal(
          cueTrace(standard.calls),
          STANDARD_CUE_TRACES[`${arena}:${prepared}:${textFace}`],
          'Standard matches the exact pre-feature trace.',
        );
        assert.deepEqual(implicit.calls, standard.calls);
        const labels = (view) =>
          view.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
        const required = [
          ...(arena === 'yard' ? ['A', 'B', 'SHIELD'] : []),
          'LOCK 1',
          '1',
          '+',
          '2',
          'HUNTER',
        ];
        assert.deepEqual(labels(standard), required);
        assert.deepEqual(
          labels(large),
          ['1', '+', '2'],
          'Large retains numbered pilot text; anchored role paths are verified by the owner-identity suite.',
        );
        assertFunctionalCueLayout(run, standard);
        assertFunctionalCueLayout(run, large, 4 / 3);
        assert.deepEqual(run, before);
      });

test('Large imported two-core states retain every objective and contact at portrait scale', () => {
  const level = structuredClone(FIRST_CONNECTION);
  level.id = 'two-relays-large-cues';
  level.walls = [];
  level.strongholds = [
    [16.5, 14.5],
    [54.5, 20.5],
  ].map(([x, y], i) => ({
    id: `relay-${i + 1}`,
    core: { x, y },
    anchors: [
      { x: x - 4, y: y - 3 },
      { x: x + 4, y: y + 3 },
    ],
  }));
  level.goal = { cores: level.strongholds.map((s) => s.id) };
  const run = largeCueRun(level);
  run.players[0].x = 35.5;
  run.players[0].y = 19.5;
  run.players[1].x = 38.5;
  run.players[1].y = 19.5;
  run.strongholds[0].anchors[0].captured = true;
  run.strongholds[0].shielded = false;
  run.strongholds[1].defeated = true;
  const before = structuredClone(run);
  for (const prepared of [false, true])
    for (const textFace of ['pixel', 'plain']) {
      const view = paintLargeCueRun(run, { prepared, textFace, textSize: 'large' });
      const labels = view.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
      assert.deepEqual(labels, ['1', '+', '2']);
      assertFunctionalCueLayout(run, view, 4 / 3);
      assert.deepEqual(run, before);
    }
});

test('invalid Team text size rejects before any drawing and preserves the run', () => {
  const run = largeCueRun(RELAY_YARD),
    before = structuredClone(run);
  for (const textSize of ['giant', null, 0, {}]) {
    const view = surface(),
      painter = createCoopPainter(view.canvas);
    painter.setPresentation(snapshot);
    assert.throws(() => painter.paint(run, { textSize }), /text size/i);
    assert.equal(view.calls.length, 0);
    assert.deepEqual(run, before);
  }
  assert.throws(() => coopCueScale(362, 72, 'giant'), /text size/i);
});

test('won prepared artwork remains clean and identical under Standard and Large text', () => {
  for (const level of [FIRST_CONNECTION, RELAY_YARD]) {
    const run = createCoop(level);
    run.status = 'won';
    const before = structuredClone(run),
      image = { naturalWidth: 1152, naturalHeight: 576, id: 'accepted-original' },
      picture = {
        snapshot,
        choice: { levelId: level.id, levelRevision: level.revision, kind: 'image' },
        fit: 'contain',
        sampling: 'nearest',
        image,
      };
    const traces = [];
    for (const textSize of ['standard', 'large']) {
      const view = surface(),
        painter = createCoopPainter(view.canvas);
      painter.setPresentation(snapshot);
      painter.paint(run, { textSize, picture });
      assert.equal(view.calls.filter((c) => c.name === 'fillText').length, 0);
      assert.deepEqual(
        view.calls.filter((c) => c.name === 'drawImage').map((c) => c.args[0]),
        [image],
      );
      traces.push(view.calls);
      assert.deepEqual(run, before);
    }
    assert.deepEqual(traces[0], traces[1]);
  }
});
