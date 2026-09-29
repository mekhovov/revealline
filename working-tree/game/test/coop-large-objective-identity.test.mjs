import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { page } from './helpers/coop-host.mjs';
import { placeCoopCue } from '../couch/coop-actor-layout.mjs';
import { drawCoopCueSymbol } from '../couch/coop-cue-symbols.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';

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
  let path = [];
  let state = {
    matrix: [1, 0, 0, 1, 0, 0],
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    font: '10px sans-serif',
    dash: [],
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
          calls.push({
            name,
            args,
            state: { ...state, matrix: [...state.matrix] },
            ...(name === 'stroke' ? { path: [...path] } : {}),
          });
          if (name === 'beginPath') path = [];
          if (name === 'setLineDash') state.dash = [...args[0]];
          if (['moveTo', 'lineTo'].includes(name)) {
            const [a, b, c, d, e, f] = state.matrix;
            path.push({
              name,
              x: ((a * args[0] + c * args[1] + e) * width) / 1152,
              y: ((b * args[0] + d * args[1] + f) * width) / 1152,
            });
          }
          if (name === 'closePath') path.push({ name });
          if (name === 'arc') {
            const [a, b, c, d, e, f] = state.matrix;
            path.push({
              name,
              x: ((a * args[0] + c * args[1] + e) * width) / 1152,
              y: ((b * args[0] + d * args[1] + f) * width) / 1152,
              radius: (args[2] * Math.hypot(a, b) * width) / 1152,
              start: args[3],
              end: args[4],
            });
          }
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

// Actual painter and prepared slot geometry. Finite text metrics/Canvas commands
// establish these fixture contracts, not native glyph readability or playability.
const near = (a, b) => Math.abs(a - b) < 1e-7;
const fontPx = (call, width) =>
  (Number(call.state.font.match(/([\d.]+)px/)[1]) *
    Math.hypot(call.state.matrix[2], call.state.matrix[3]) *
    width) /
  1152;
const cssBounds = (call, rectangle, width) =>
  Object.fromEntries(
    Object.entries(bounds(call, rectangle)).map(([key, value]) => [key, (value * width) / 1152]),
  );
function makeRun(kind) {
  const level = structuredClone(FIRST_CONNECTION);
  level.id = `large-${kind}-eight-relays`;
  level.walls = [];
  const xs = kind === 'spread' ? [10.5, 27.5, 44.5, 61.5] : [31.5, 34.5, 37.5, 40.5];
  const ys = kind === 'spread' ? [10.5, 25.5] : [16.5, 21.5];
  const dx = kind === 'spread' ? 4 : 1,
    dy = kind === 'spread' ? 3 : 1;
  level.strongholds = ys
    .flatMap((y) =>
      xs.map((x) => ({
        core: { x, y },
        anchors: [
          { x: x - dx, y: y - dy },
          { x: x + dx, y: y + dy },
        ],
      })),
    )
    .map((hold, index) => ({ ...hold, id: `relay-${index + 1}` }));
  level.goal = { cores: level.strongholds.map((hold) => hold.id) };
  const run = createCoop(level); // Authoritative strict validation precedes visual state setup.
  Object.assign(run.players[0], { x: 35.5, y: 19.5 });
  Object.assign(run.players[1], { x: 38.5, y: 19.5, graceUntil: 10 });
  return run;
}
function setStage(run, stage) {
  // These are explicit renderer snapshots, not invented successful player inputs.
  run.players[0].status = stage === 2 ? 'active' : 'downed';
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  Object.assign(hunter, {
    phase: ['warning', 'commit', 'recovery'][stage],
    target: 0,
    targetPoint: { x: 25, y: 10 },
    speedScale: stage ? 0.6 : 1,
    slowUntil: stage ? 10 : 0,
  });
  if (stage)
    for (const [index, hold] of run.strongholds.entries()) {
      if (index > 1) continue;
      for (const anchor of hold.anchors) anchor.captured = true;
      hold.shielded = false;
      hold.defeated = index === 1 || stage === 2;
    }
}
function paint(run, width, textFace, options = {}) {
  const before = JSON.stringify(run),
    view = surface(width),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(snapshot);
  painter.paint(run, { textSize: 'large', textFace, reduced: true, ...options });
  assert.equal(JSON.stringify(run), before, 'Painting must preserve every serialized run byte.');
  return view;
}
function maximalRun(kind, stage) {
  const original = makeRun(kind),
    level = structuredClone(original.level),
    template = FIRST_CONNECTION.enemies.find((enemy) => enemy.type === 'hunter');
  level.enemies = [5.5, 12.5, 23.5, 30.5]
    .flatMap((y) => [8.5, 22.5, 49.5, 63.5].map((x) => ({ ...template, x, y })))
    .map((enemy, index) => ({ ...enemy, id: `pressure-${index}` }));
  const run = createCoop(level);
  run.players = structuredClone(original.players);
  setStage(run, stage);
  for (const [index, enemy] of run.enemies.entries())
    Object.assign(enemy, {
      phase: ['warning', 'commit', 'recovery', 'cooldown'][index % 4],
      target: (index + stage) % 2,
      targetPoint: { x: 25 + index, y: 10 },
      speedScale: stage && index % 3 === 0 ? 0.6 : 1,
      slowUntil: stage && index % 3 === 0 ? 10 : 0,
    });
  return run;
}

test('explicit objective rows share a pitch without changing ordinary placement or caller geometry', () => {
  const options = {
    x: 40,
    y: 42,
    width: 30,
    height: 16,
    arenaWidth: 200,
    arenaHeight: 100,
    heads: [],
    occupied: [],
    preferClear: true,
  };
  const before = structuredClone(options),
    ordinary = placeCoopCue(options);
  assert.deepEqual(placeCoopCue({ ...options, rowPitch: null }), ordinary);
  const aligned = placeCoopCue({ ...options, rowPitch: 22.4 });
  assert.ok(near(aligned.x, 40));
  assert.ok(near(aligned.y, 34.6), 'Rows use the shared pitch, not this shorter plate height.');
  assert.equal(aligned.height, 16);
  assert.deepEqual(options, before);
  for (const rowPitch of [0, -1, 15, Infinity, NaN, '22.4'])
    assert.throws(() => placeCoopCue({ ...options, rowPitch }), /row pitch/);
});
test('unavailable row slots retain the ordinary non-dropping fallback', () => {
  const betweenRows = {
    x: 50,
    y: 23.4,
    width: 10,
    height: 20,
    arenaWidth: 100,
    arenaHeight: 50,
    heads: [
      { left: 0, right: 100, top: 11.2, bottom: 13.2 },
      { left: 0, right: 100, top: 33.6, bottom: 35.6 },
    ],
    occupied: [],
    preferClear: true,
  };
  const ordinary = placeCoopCue(betweenRows);
  assert.ok(ordinary);
  assert.deepEqual(placeCoopCue({ ...betweenRows, rowPitch: 22.4 }), ordinary);
  const full = {
    ...betweenRows,
    heads: [],
    occupied: [{ left: 0, right: 100, top: 0, bottom: 50 }],
  };
  assert.deepEqual(
    placeCoopCue({ ...full, rowPitch: 22.4 }),
    placeCoopCue(full),
    'Impossible clear capacity stays explicit overlap, not a missing cue.',
  );
  const tall = { ...betweenRows, heads: [], height: 1, arenaHeight: 1000 };
  assert.deepEqual(
    placeCoopCue({ ...tall, rowPitch: 1 }),
    placeCoopCue(tall),
    'Oversized row search stays bounded without discarding the cue.',
  );
});

test('fractional neighboring rows admit shared edges but reject genuine intersections', () => {
  const first = placeCoopCue({
    x: 20,
    y: 12.2,
    width: 30,
    height: 22.4,
    arenaWidth: 42,
    arenaHeight: 70,
    heads: [],
    occupied: [],
    rowPitch: 22.4,
  });
  const options = {
    x: 20,
    y: 34.6,
    width: 30,
    height: 22.4,
    arenaWidth: 42,
    arenaHeight: 70,
    heads: [],
    occupied: [first],
    rowPitch: 22.4,
  };
  const adjacent = placeCoopCue(options);
  assert.ok(near(adjacent.y, 34.6));
  assert.ok(Math.abs(first.bottom - adjacent.top) < 1e-12);
  const genuinelyOverlapping = placeCoopCue({
    ...options,
    occupied: [{ ...first, bottom: first.bottom + 0.001 }],
  });
  assert.ok(near(genuinelyOverlapping.y, 57));
  assert.ok(genuinelyOverlapping.top > first.bottom + 0.001);
});

const cssScale = (call, width) =>
  (Math.hypot(call.state.matrix[0], call.state.matrix[1]) * width) / 1152;
function samePath(a, b) {
  return (
    a.length === b.length &&
    a.every((point, index) => {
      const other = b[index];
      return (
        Object.keys(point).length === Object.keys(other).length &&
        Object.entries(point).every(([key, value]) =>
          typeof value === 'number' ? near(value, other[key]) : value === other[key],
        )
      );
    })
  );
}
function symbolPairs(view, size = 14) {
  const width = view.canvas.clientWidth,
    strokes = view.calls.filter((call) => call.name === 'stroke'),
    pairs = [];
  for (let i = 1; i < strokes.length; i++) {
    const dark = strokes[i - 1],
      light = strokes[i];
    if (
      dark.state.strokeStyle === '#07111c' &&
      near(dark.state.lineWidth * cssScale(dark, width), (3 * size) / 14) &&
      near(light.state.lineWidth * cssScale(light, width), (1.5 * size) / 14) &&
      samePath(dark.path, light.path)
    )
      pairs.push({ dark, light });
  }
  return pairs;
}
function roles(run) {
  const result = [];
  for (const hold of run.strongholds) {
    for (const [index, anchor] of hold.anchors.entries())
      result.push({
        id: `anchor:${hold.id}:${index}`,
        owner: anchor,
        mark: index === 0 ? 'anchor-a' : 'anchor-b',
        captured: anchor.captured,
        size: 3,
      });
    result.push({
      id: `core:${hold.id}`,
      owner: hold.core,
      size: 5,
      mark: hold.defeated ? 'secured' : hold.shielded ? 'shielded' : 'exposed',
    });
  }
  for (const enemy of run.enemies) {
    if (enemy.active === false) continue;
    result.push({
      id: `enemy:${enemy.id}`,
      owner: enemy,
      target: enemy.target,
      size: 14,
      mark:
        enemy.type !== 'hunter'
          ? 'drifter'
          : enemy.phase === 'warning'
            ? 'hunter-lock'
            : enemy.phase === 'commit'
              ? 'hunter-charge'
              : enemy.phase === 'recovery'
                ? 'hunter-recovery'
                : 'hunter',
    });
  }
  return result;
}
const sameNumbers = (actual, expected) =>
  actual.length === expected.length && actual.every((value, index) => near(value, expected[index]));
function assertOwnedSymbols(run, view) {
  const width = view.canvas.clientWidth,
    cell = width / run.width,
    actual = [14, 5, 3].flatMap((size) => symbolPairs(view, size)),
    used = new Set();
  for (const role of roles(run)) {
    // Symbol unit tests establish exact local geometry independently. Here its
    // actual drawing is the oracle for host scale, ownership and integration.
    const reference = surface(width);
    reference.ctx.scale(1152 / width, 1152 / width);
    reference.ctx.translate(role.owner.x * cell, role.owner.y * cell);
    reference.ctx.scale(role.size / 14, role.size / 14);
    drawCoopCueSymbol(reference.ctx, {
      mark: role.mark,
      size: 14,
      target: role.target,
      captured: role.captured ?? false,
    });
    for (const pair of symbolPairs(reference, role.size)) {
      const at = actual.findIndex(
        (candidate, index) => !used.has(index) && samePath(candidate.light.path, pair.light.path),
      );
      assert.ok(
        at >= 0,
        `${role.id} ${role.mark} must be drawn at its exact owner with ${role.size} CSS-pixel geometry`,
      );
      used.add(at);
      const found = actual[at];
      assert.equal(found.light.state.globalAlpha, 1);
      assert.ok(near((found.light.state.matrix[4] * width) / 1152, role.owner.x * cell));
      assert.ok(near((found.light.state.matrix[5] * width) / 1152, role.owner.y * cell));
      assert.notEqual(
        found.light.state.strokeStyle,
        '#07111c',
        'Foreground retains contrast to its dark backing.',
      );
      assert.deepEqual(found.light.state.dash, []);
    }
  }
  assert.equal(used.size, actual.length, 'No duplicate, stale, or unowned anchored symbols.');
  for (const hold of run.strongholds) {
    for (const anchor of hold.anchors)
      assert.equal(
        view.calls.some(
          (call) =>
            call.name === 'fillRect' &&
            sameNumbers(call.args, [anchor.x - 0.7, anchor.y - 0.7, 1.4, 1.4]),
        ),
        false,
        'The old large anchor backing cannot remain beneath the tiny locator.',
      );
    assert.equal(
      view.calls.some(
        (call) =>
          call.name === 'arc' &&
          sameNumbers(call.args.slice(0, 3), [hold.core.x, hold.core.y, 0.48]),
      ),
      false,
      'The old filled core cannot remain beneath the tiny locator.',
    );
  }
  const leaders = view.calls.filter(
    (call) =>
      call.name === 'stroke' &&
      call.state.strokeStyle === '#a8b8cc' &&
      call.path.length === 2 &&
      call.path[0].name === 'moveTo' &&
      call.path[1].name === 'lineTo',
  );
  assert.equal(leaders.length, 0, 'Anchored roles do not acquire long label leaders.');
}
function pilotRows(view) {
  const result = new Map(),
    calls = view.calls,
    width = view.canvas.clientWidth;
  for (let index = 0; index < calls.length; index++) {
    const call = calls[index];
    if (call.name !== 'fillText') continue;
    const text = String(call.args[0]);
    assert.ok(['1', '2', '+'].includes(text), `No redundant Large caption ${text}`);
    let rect;
    if (text === '+') {
      const backing = calls[index - 1];
      assert.equal(backing.name, 'fillRect');
      rect = cssBounds(backing, backing.args, width);
    } else {
      assert.equal(result.has(text), false, `Pilot ${text} appears once.`);
      let start = index;
      while (start >= 0 && calls[start].name !== 'beginPath') start--;
      const path = calls.slice(start, index),
        arc = path.find((entry) => entry.name === 'arc');
      if (arc) {
        const [x, y, r] = arc.args;
        rect = cssBounds(arc, [x - r, y - r, 2 * r, 2 * r], width);
      } else {
        const points = path.filter((entry) => ['moveTo', 'lineTo'].includes(entry.name));
        assert.equal(points.length, 4, 'Pilot 2 retains a diamond.');
        const xs = points.map((entry) => entry.args[0]),
          ys = points.map((entry) => entry.args[1]);
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
    }
    if (text === '+') {
      const owner = [...result.keys()].at(-1);
      result.get(owner).plus = { call, rect };
    } else result.set(text, { call, rect, index });
  }
  assert.deepEqual([...result.keys()], ['1', '2']);
  return result;
}
function assertPilots(run, view, { reduced = true } = {}) {
  const width = view.canvas.clientWidth,
    cell = width / run.width,
    rows = pilotRows(view),
    actors = createCoopActorPresentation();
  actors.setPresentation(snapshot);
  actors.update(run, {
    reduced,
    motionScale: reduced ? 0 : 1,
    canvasCSSWidth: width,
    style: 'hybrid',
  });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const lastSymbol = Math.max(
    -1,
    ...symbolPairs(view).map(({ light }) => view.calls.indexOf(light)),
  );
  for (const player of run.players) {
    const row = rows.get(String(player.id + 1)),
      shape = player.id === 0 ? 27 : 32,
      frame = actors.frame('pilot', player.id),
      offset = frame?.bodyOffset,
      bodyX = (player.x + (offset?.x ?? 0) / 16) * cell,
      bodyY = (player.y + (offset?.y ?? 0) / 16) * cell,
      groupWidth = shape + (player.status === 'downed' ? 14 : 0),
      groupX = clamp(bodyX, groupWidth / 2 + 1, width - groupWidth / 2 - 1),
      y = clamp(
        bodyY +
          (player.id === 1 ? 1 : -1) * ((frame ? frame.diameter / 32 : 0.7) * cell + shape / 2 + 4),
        shape / 2 + 1,
        width / 2 - shape / 2 - 1,
      );
    assert.ok(
      near(row.rect.left, groupX - groupWidth / 2),
      `Pilot ${player.id + 1} stays beside its own body, with only perimeter clamping.`,
    );
    assert.ok(
      near((row.rect.top + row.rect.bottom) / 2, y),
      `Pilot ${player.id + 1} keeps its above/below-body anchor.`,
    );
    assert.ok(near(row.rect.right - row.rect.left, shape));
    assert.ok(near(row.rect.bottom - row.rect.top, shape));
    assert.ok(fontPx(row.call, width) >= (14 * 4) / 3 - 1e-7, 'Pilot numerals retain Large text.');
    assert.ok(row.index > lastSymbol, 'Player identities remain above dense non-player symbols.');
    assert.ok(
      row.rect.left >= 1 - 1e-7 &&
        row.rect.top >= 1 - 1e-7 &&
        row.rect.right <= width - 1 + 1e-7 &&
        row.rect.bottom <= width / 2 - 1 + 1e-7,
    );
    if (player.status === 'downed') {
      assert.ok(row.plus);
      assert.ok(near(row.plus.rect.right - row.plus.rect.left, 14));
      assert.ok(near(row.plus.rect.bottom - row.plus.rect.top, 22));
      assert.ok(fontPx(row.plus.call, width) >= 16 - 1e-7);
      assert.ok(near(row.plus.rect.left, row.rect.right));
      assert.ok(row.plus.rect.right <= width - 1 + 1e-7);
    } else assert.equal(row.plus, undefined);
    assert.ok(
      view.calls.some(
        (call) =>
          call.name === 'arc' &&
          call.args[0] === player.x &&
          call.args[1] === player.y &&
          call.args[2] === player.radius,
      ),
      'True cutting head and radius remain unchanged.',
    );
    if (offset && (offset.x !== 0 || offset.y !== 0)) {
      const tether = view.calls.find(
        (call) =>
          call.name === 'stroke' &&
          call.state.strokeStyle === '#f1f7ed' &&
          call.state.dash.length === 2 &&
          call.path.length === 2 &&
          near(call.path[0].x, player.x * cell) &&
          near(call.path[0].y, player.y * cell) &&
          near(call.path[1].x, bodyX) &&
          near(call.path[1].y, bodyY),
      );
      assert.ok(tether, 'A perimeter-shifted cosmetic body keeps its exact true-head tether.');
    }
  }
  return rows;
}
function assertSlowHalos(run, view) {
  const width = view.canvas.clientWidth,
    cell = width / run.width,
    halos = view.calls.filter(
      (call) =>
        call.name === 'arc' && call.args[2] === 0.88 && call.state.strokeStyle === '#e6f8ff',
    ),
    slowed = run.enemies.filter(
      (enemy) => enemy.active !== false && enemy.speedScale < 1 && enemy.slowUntil > run.time,
    );
  assert.equal(halos.length, slowed.length);
  for (const enemy of slowed) {
    const halo = halos.find(
      (call) =>
        near((call.state.matrix[4] * width) / 1152, enemy.x * cell) &&
        near((call.state.matrix[5] * width) / 1152, enemy.y * cell),
    );
    assert.ok(halo, `${enemy.id} retains its own slow halo`);
    assert.deepEqual(halo.state.dash, [0.16, 0.12]);
  }
}
function assertSelectedRelay(run, view, id) {
  const selected =
      run.strongholds.find((hold) => hold.id === id) ??
      run.strongholds.find((hold) => !hold.defeated) ??
      run.strongholds[0],
    cell = view.canvas.clientWidth / run.width;
  const brackets = view.calls.filter(
    (call) =>
      call.name === 'stroke' && call.state.strokeStyle === '#f1f7ed' && call.path.length === 12,
  );
  assert.equal(brackets.length, 0, 'No 22px selection brackets remain around tiny objectives.');
  const links = view.calls.filter(
    (call) =>
      call.name === 'stroke' &&
      call.state.strokeStyle === '#f1f7ed' &&
      near(call.state.lineWidth * cssScale(call, view.canvas.clientWidth), 0.75),
  );
  assert.equal(
    links.length,
    selected ? 1 : 0,
    'Only one selected relay receives its two relation segments.',
  );
  if (!selected) return;
  const expected = selected.anchors.flatMap((anchor) => [
    { name: 'moveTo', x: selected.core.x * cell, y: selected.core.y * cell },
    { name: 'lineTo', x: anchor.x * cell, y: anchor.y * cell },
  ]);
  assert.ok(
    samePath(links[0].path, expected),
    'Both segments terminate at the selected core and its exact A/B positions.',
  );
  assert.deepEqual(links[0].state.dash, []);
  const backing = view.calls.find(
    (call) =>
      call.name === 'stroke' &&
      call.state.strokeStyle === '#07111c' &&
      near(call.state.lineWidth * cssScale(call, view.canvas.clientWidth), 2) &&
      samePath(call.path, expected),
  );
  assert.ok(backing, 'The selected relation stays outlined over light or dark art.');
  assert.ok(view.calls.indexOf(backing) < view.calls.indexOf(links[0]));
  for (const enemy of run.enemies.filter((e) => e.active !== false && e.phase === 'warning')) {
    const warning = view.calls.find(
      (call) =>
        call.name === 'stroke' &&
        call.path.some(
          (point) =>
            point.name === 'moveTo' &&
            near(point.x, enemy.x * cell) &&
            near(point.y, enemy.y * cell),
        ) &&
        call.path.some(
          (point) =>
            point.name === 'lineTo' &&
            near(point.x, enemy.targetPoint.x * cell) &&
            near(point.y, enemy.targetPoint.y * cell),
        ),
    );
    assert.ok(
      warning && view.calls.indexOf(warning) > view.calls.indexOf(links[0]),
      'Threat trajectories remain above objective relation links.',
    );
  }
}
for (const [kind, width] of [
  ['spread', 292],
  ['dense', 304],
])
  for (const textFace of ['pixel', 'plain'])
    for (const maximal of [false, true])
      for (let stage = 0; stage < 3; stage++)
        test(`${maximal ? 'maximum' : 'ordinary'} ${width}px ${kind} ${textFace} stage${stage}: tiny exact objective positions, full enemy roles and nearby pilots`, () => {
          const run = maximal ? maximalRun(kind, stage) : makeRun(kind);
          if (!maximal) setStage(run, stage);
          const view = paint(run, width, textFace);
          assertOwnedSymbols(run, view);
          assertPilots(run, view);
          assertSlowHalos(run, view);
          assertSelectedRelay(run, view);
        });

test('adding or reordering the maximum encounter cannot move either pilot identity', () => {
  for (const width of [292, 304, 1152])
    for (const downed of [false, true]) {
      const run = maximalRun('dense', 2);
      if (downed) for (const player of run.players) player.status = 'downed';
      const dense = assertPilots(run, paint(run, width, 'plain'));
      const reordered = structuredClone(run);
      reordered.enemies.reverse();
      reordered.strongholds.reverse();
      const reversed = assertPilots(reordered, paint(reordered, width, 'plain'));
      const sparse = structuredClone(run);
      sparse.enemies = [];
      sparse.strongholds = [];
      const empty = assertPilots(sparse, paint(sparse, width, 'plain'));
      for (const id of ['1', '2']) {
        assert.deepEqual(dense.get(id).rect, reversed.get(id).rect);
        assert.deepEqual(dense.get(id).rect, empty.get(id).rect);
      }
    }
});
test('both active and downed pilots keep their own identities at every board corner', () => {
  for (const width of [292, 1152])
    for (const [x, y] of [
      [0.5, 0.5],
      [71.5, 0.5],
      [0.5, 35.5],
      [71.5, 35.5],
    ])
      for (const downed of [false, true]) {
        const run = makeRun('spread');
        run.enemies = [];
        for (const player of run.players)
          Object.assign(player, { x, y, status: downed ? 'downed' : 'active' });
        assertPilots(run, paint(run, width, 'plain'));
      }
});
test('selected relay links track its exact group without moving owners or numbered pilots', () => {
  const run = makeRun('dense');
  setStage(run, 1);
  let previous;
  for (const id of ['relay-1', 'relay-8', 'missing', null]) {
    const view = paint(run, 304, 'pixel', { selectedRelayId: id });
    assertOwnedSymbols(run, view);
    assertSelectedRelay(run, view, id);
    const rows = assertPilots(run, view);
    if (previous)
      for (const key of ['1', '2']) assert.deepEqual(rows.get(key).rect, previous.get(key).rect);
    previous = rows;
  }
});
test('actual hunter symbols preserve both target shapes and omit invalid target identities', () => {
  for (const phase of ['warning', 'commit'])
    for (const target of [0, 1, -1, 2, null]) {
      const run = makeRun('spread');
      setStage(run, 0);
      Object.assign(
        run.enemies.find((enemy) => enemy.type === 'hunter'),
        { phase, target },
      );
      assertOwnedSymbols(run, paint(run, 292, 'plain'));
    }
});
test('symbol state and slow halos remain visible while paused and honor active-time expiry', () => {
  const run = makeRun('spread');
  setStage(run, 1);
  Object.assign(
    run.enemies.find((enemy) => enemy.type !== 'hunter'),
    { speedScale: 0.6, slowUntil: 10 },
  );
  run.status = 'paused';
  for (const time of [9, 10])
    for (const reduced of [true, false]) {
      run.time = time;
      const view = paint(run, 292, 'plain', { reduced });
      assertOwnedSymbols(run, view);
      assertSlowHalos(run, view);
      assertPilots(run, view, { reduced });
    }
});
test('the real Team host shows its relay key only for stronghold selection', async (t) => {
  const f = await page(t);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.$('coop-relay-key').hidden, false);
  assert.match(f.$('coop-relay-key').textContent, /shield/i);
  assert.match(f.$('coop-relay-key').textContent, /anchor/i);
  await f.choose('coop-level', 'first-connection');
  assert.equal(f.$('coop-relay-key').hidden, true);
  await f.choose('coop-level', 'relay-yard');
  assert.equal(f.$('coop-relay-key').hidden, false);
});
